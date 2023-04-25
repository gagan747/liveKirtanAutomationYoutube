import { createUpdateRagiList } from "./services/createUpdateRagiList.js";
import got from 'got';
import express from 'express';
import dotenv from 'dotenv';
import https from 'https'
dotenv.config();
import cron from 'node-cron';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { uploadToYoutube } from './uploadToYoutube.js';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
let cronSchedulers = [];
const ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
const app = express();


setInterval(function () {//for preventing render to become unidle
  https.get("https://livekirtandarbarsahibrecordingautomation.onrender.com/");
}, 300000);

const getIndianDate = () => new Date(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }));

const ragiListUpdateScheduler = async () => {
  try {
    await createUpdateRagiList()
    console.log('ragi list updated sussessfully ')
    initializeSchedulers(generateConfigForCronUsingRagiList(JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'))))
  }
  catch (err) {
    console.log(err)
  }
}

const generateConfigForCronUsingRagiList = (ragiList) => {
  const configList = Object.keys(ragiList).reduce((p, d) => {
    return [...p, ...ragiList[d].map((dutyConfig) => ({
      config: `${dutyConfig.from.trim().split('-')[1]} ${dutyConfig.from.trim().split('-')[0]} ${d.split('/')[0]} ${d.split('/')[1]} *`,
      duty: dutyConfig.duty,
      to: dutyConfig.to.trim(),
      from: dutyConfig.from.trim()
    })
    )]
  }, [])
  return configList;
}

const recordStream = (duty, endMilliseconds, to) => {
  console.log('recordinds ends after ', endMilliseconds, 'milliseconds')
  const liveStreamSgpcUrl = 'https://live.sgpc.net:8443/;nocache=889869';
  var currentIndianDate = getIndianDate();
  var date = currentIndianDate.getDate();
  var month = currentIndianDate.getMonth() + 1;
  var fullYear = currentIndianDate.getFullYear()
  var datetime = date + "-"//for creating unique filename
    + month + "-"
    + fullYear + " ("
    + currentIndianDate.getHours() + ":"
    + currentIndianDate.getMinutes() + ":"
    + currentIndianDate.getSeconds();
  //const formattedDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
  console.log('recording started at', datetime, ')')
  const fileName = `${duty.trim()} Darbar Sahib Kirtan Duty ${datetime} - ${to})`;
  const liveGurbaniStream = got.stream(liveStreamSgpcUrl) // a readable stream 
  const outputPath = `./${fileName}.mp4`;
  const imgMorPath = './darbarSahibDay.gif';
  const imgNigPath = './darbarSahibNight.gif'
  const command = ffmpeg()
  command.input((getIndianDate().getHours() >= 19 || getIndianDate().getHours() <= 5) ? imgNigPath : imgMorPath)
    .inputOptions(['-ignore_loop', '0'])// if want a img instead of gif replace this inputOPtions with loop()
    .input(liveGurbaniStream) //it goes to event loop and when the on('data') event fires it converts to video and writes to output path and the process continues until we manually stop input stream  
    .audioCodec('aac')
    .audioBitrate('128k') //higher bitrate for higher quality
    .videoCodec('libx264')
    .outputOptions('-crf', '28', '-preset', 'fast', '-movflags', '+faststart')
    .output(outputPath)
    .on('end', function () {
      command.kill('SIGTERM');// as we know that outputPath here is not output stream so we can't emit 'finish' event as we do in recording automation with google drive and input stream not has finish event ,it only has end event but on explicitly calling.end of inputstream is still not working as it is still writing to output path till the buffer is not ended and in our case we have infinfite buffer as recording plays 24*7 so we used command.kill bcoz when end event is fired it is not ending writing to output path ,it still writes to output path after end ,so have to kil the process
      setTimeout(() => {
        try {
          console.log('upload to youtube started for', outputPath)
          uploadToYoutube(outputPath)
        } catch (err) {
          console.log(err)
        }
      }, 59000);
    })
    .on('error', (err) => console.log('An error occurred: ' + err.message))
    .run();

  setTimeout(() => {
    command.emit('end')
  }, endMilliseconds)
}
app.get('/', (req, res) => {
  console.log('hitted')
  res.send(ragiList)
})

app.get('/google/callback', (req, res) => {
  res.send(req.query)
})

app.listen(process.env.PORT || 5000, () => {
  console.log(`server listening on port 5000`);
});

process.on('uncaughtException', (err) => {
  console.log(err)
});
process.on('unhandledRejection', (err) => {
  console.log(err)
})

const initializeSchedulers = (schedulers) => {
  cronSchedulers.map((d) => d?.stop())
  cronSchedulers = [];
  schedulers.map((schedule) => {
    const scheduler = cron.schedule(schedule.config, () => {
      let endMilliseconds;
      console.log(schedule.to)
      if (schedule.to.trim().toLowerCase() === 'till completion')
        endMilliseconds = 1000 * 60 * 60;
      else
        endMilliseconds = ((parseInt(schedule.to.split('-')[0]) - parseInt(schedule.from.split('-')[0])) + (parseInt(schedule.to.split('-')[1]) - parseInt(schedule.from.split('-')[1])) / 60) * 60 * 60 * 1000;
      recordStream(schedule.duty, endMilliseconds, schedule.to)
    }, {
      timezone: 'Asia/Kolkata'
    })
    cronSchedulers.push(scheduler);
  })
  console.log('schedulers initialized successfully')
};


ragiListUpdateScheduler()

cron.schedule('20 1,17,10 1,2,3,14,15,16,17 * *', () => { //schedule ragiListUpdate
  ragiListUpdateScheduler()
}, {
  timezone: 'Asia/Kolkata'
})

function deleteMp4FilesIfAnyLeft() {
  const files = fs.readdirSync('.');
  files.forEach((file) => {
    if (file.endsWith('.mp4')) {
      fs.unlinkSync(file);
      console.log(`Deleted file: ${file} through scheduled node-cron-service`);
    }
  });
}

cron.schedule('20 1 * * *', () => { //scheduled mp4 deleter if any file is left undeleted by any bug
deleteMp4FilesIfAnyLeft()
}, {
  timezone: 'Asia/Kolkata'
})

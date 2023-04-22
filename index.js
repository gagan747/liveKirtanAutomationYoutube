import { createUpdateRagiList } from "./services/createUpdateRagiList.js";
import got from 'got';
import express from 'express';
import cron from 'node-cron';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { uploadToYoutube } from './uploadToYoutube.js';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
let cronSchedulers = [];
const ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
const app = express();

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

const recordStream = (duty, endMilliseconds) => {
 console.log('recordinds ends after ', endMilliseconds, 'milliseconds')
 const liveStreamSgpcUrl = 'https://live.sgpc.net:8443/;nocache=889869';
 var currentIndianDate = new Date(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }));
 var date = currentIndianDate.getDate();
 var month = currentIndianDate.getMonth() + 1;
 var fullYear = currentIndianDate.getFullYear()
 var datetime = date + "-"//for creating unique filename
  + month + "-"
  + fullYear + "@"
  + currentIndianDate.getHours() + ":"
  + currentIndianDate.getMinutes() + ":"
  + currentIndianDate.getSeconds();
 const formattedDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
 console.log('recording started at', datetime)
 const fileName = `${duty.trim()} Kirtan Duty Darbar Sahib-${datetime}`;
 const liveGurbaniStream = got.stream(liveStreamSgpcUrl) // a readable stream 
 const outputPath = `./${fileName}.mp4`;
 const imgPath = './darbarSahib.gif';;
 const command = ffmpeg()
 command.input(imgPath)
  .inputOptions(['-ignore_loop', '0'])// if want a img instead of gif replace this inputOPtions with loop()
  .input(liveGurbaniStream)
  .audioCodec('aac')
  .audioBitrate('128k') //higher bitrate for higher quality
  .videoCodec('libx264')
  .outputOptions('-crf', '28', '-preset', 'fast', '-movflags', '+faststart')
  .output(outputPath)
  .on('end', function () {
   command.kill('SIGTERM');
   try {
    uploadToYoutube(outputPath)
   } catch (err) {
    console.log(err)
   }
  }) //used command.kill bcoz when end event is fired it is not ending writing to output path ,it still writes to output path after end ,so have to kil the process
  .on('error', (err) => console.log('An error occurred: ' + err.message))
  .run();

 setTimeout(() => {
  command.emit('end')
 }, endMilliseconds)
}


app.get('/', (req, res) => {
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
   const endMilliseconds = ((parseInt(schedule.to.split('-')[0]) - parseInt(schedule.from.split('-')[0])) + (parseInt(schedule.to.split('-')[1]) - parseInt(schedule.from.split('-')[1])) / 60) * 60 * 60 * 1000;
   recordStream(schedule.duty, endMilliseconds)
  }, {
   timezone: 'Asia/Kolkata'
  })
  cronSchedulers.push(scheduler);
 })
 console.log('schedulers initialized successfully')
};

recordStream('meow', 40000)
//uploadToYoutube()
//initializeSchedulers(generateConfigForCronUsingRagiList(ragiList))
//ragiListUpdateScheduler()
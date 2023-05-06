import { createUpdateRagiList } from "./services/createUpdateRagiList.js";
import getRedisClient from './redis.js'
import got from 'got';
import express from 'express';
import dotenv from 'dotenv';
import https from 'https'
let redisClient;
dotenv.config();
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { uploadToYoutube } from './uploadToYoutube.js';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
let ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
const delayByRagis = 120000;

// setInterval(function () {//for preventing cyclic to become unidle
//   https.get("https://recordingautomationyoutube.onrender.com");
// }, 300000);

const getIndianDate = () => new Date(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }));

const ragiListUpdateScheduler = async () => {
  try {
    await createUpdateRagiList()
    console.log('ragi list updated sussessfully ')
    ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
  }
  catch (err) {
    console.log(err)
  }
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
    + currentIndianDate.getMinutes()
  //const formattedDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
  console.log('recording started at', datetime, ')')
  const fileName = `${duty.trim()} Darbar Sahib Kirtan Duty ${datetime} - ${to})`;
  const liveGurbaniStream = got.stream(liveStreamSgpcUrl) // a readable stream 
  const outputPath = `./${fileName}.mp4`;
  const imgMorPath = './darbarSahibDay.gif';
  const imgNigPath = './darbarSahibNight.gif'  //todo: change path to ./darbarSahibNight1.gif if render don't go out of storage as it gives high quality
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
          uploadToYoutube(outputPath, redisClient)
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

function deleteMp4FilesIfAnyLeft() {
  const files = fs.readdirSync('.');
  files.forEach((file) => {
    if (file.endsWith('.mp4')) {
      fs.unlinkSync(file);
      console.log(`Deleted file: ${file} through scheduled node-cron-service or manually`);
    }
  });
}

app.get('/', (req, res) => {
  console.log('route / hitted')
  res.send(ragiList)
})

app.get('/google/callback', (req, res) => {
  res.send(req.query)
})

app.listen(process.env.PORT || 5000, async () => {
  console.log(`server listening on port 5000`);
  redisClient = await getRedisClient();
  ragiListUpdateScheduler();
  deleteMp4FilesIfAnyLeft();
  recordStream('bhai', 10000, 'to')
});

app.get('/mp4files', (req, res) => {
  const files = fs.readdirSync('./').filter(file => file.endsWith('.mp4'));
  const fileList = files.join('</br>');
  res.set('Content-Type', 'text/html');
  res.send(fileList);
});

app.get('/currentproject', async (req, res) => {
  const current = await redisClient.get('current');
  const perProjectQuota = await redisClient.get('perProjectQuota');
  const currentDirectoryInfo = { current, perProjectQuota }
  res.send(currentDirectoryInfo);
});

process.on('uncaughtException', (err) => {
  console.log(err)
});

process.on('unhandledRejection', (err) => {
  console.log(err)
})

setInterval(() => {//scheduled mp4 deleter if any file is left undeleted by any bug and also ragilistupdater is scheduled everydat at 1 am
  if (getIndianDate().getHours() === 1) {
    deleteMp4FilesIfAnyLeft();
    ragiListUpdateScheduler()
  }
}, 3300000)

setInterval(() => {
  var currentIndianDate = getIndianDate();
  var date = currentIndianDate.getDate();
  var month = currentIndianDate.getMonth() + 1;
  var fullYear = currentIndianDate.getFullYear();
  const formattedIndianDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
  const config = ragiList[formattedIndianDate]?.find((config) => config?.from.split('-')[0] == currentIndianDate.getHours() && config?.from.split('-')[1] == currentIndianDate.getMinutes())
  if (config) {
    let endMilliseconds;
    if (config.to.trim().toLowerCase() === 'till completion')
      endMilliseconds = 1000 * 60 * 60;
    else
      endMilliseconds = ((parseInt(config.to.split('-')[0]) - parseInt(config.from.split('-')[0])) + (parseInt(config.to.split('-')[1]) - parseInt(config.from.split('-')[1])) / 60) * 60 * 60 * 1000;
    setTimeout(() => recordStream(config.duty, endMilliseconds, config.to), delayByRagis) //added setimeout of 120000 seconds as previous ragi take time to samapti and also added 120000 sec to endmillis for the same reason, you can configure delayByRagis according to you
  }
}, 60000)

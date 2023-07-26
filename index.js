import { createUpdateRagiList } from "./services/createUpdateRagiList.js";
import getRedisClient from './redis.js'
import got from 'got';
import express from 'express';
import dotenv from 'dotenv';
import https from 'https'
let redisClient;
dotenv.config();
import ffmpeg from 'fluent-ffmpeg';
import { getIndianDate } from "./helper.js";
import fs from 'fs';
import { uploadToYoutube } from './uploadToYoutube.js';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
const servers = ['server1', 'server2'];
let ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
const delayByRagis = 120000;

setInterval(function () {//for preventing free deployed server to become idle
  https.get(process.env.deployedUrl);
}, 500000);

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

const recordStream = async (duty, endMilliseconds, to, from) => {
  if (!(await redisClient.get('currentServer') === process.env.currentServer))
    return;
  setTimeout(async () => {
    await redisClient.set('currentServer', servers.find((server) => server !== process.env.currentServer))
  }, 59000)
  console.log('recordinds ends after ', endMilliseconds, 'milliseconds')
  const liveStreamSgpcUrl = 'https://live.sgpc.net:8443/;nocache=889869';
  var currentIndianDate = getIndianDate();
  var date = currentIndianDate.getDate();
  var month = currentIndianDate.getMonth() + 1;
  var fullYear = currentIndianDate.getFullYear()
  var datetime = date + "-"//for creating unique filename
    + month + "-"
    + fullYear + " ("
    + from;
  //const formattedDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
  console.log('recording started at', datetime, ')')
  const fileName = `${duty.trim()} Darbar Sahib ${getKirtanType(from, to) || 'Kirtan Duty '}${datetime} - ${to})`;
  const liveGurbaniStream = got.stream(liveStreamSgpcUrl) // a readable stream 
  const outputPath = `./${fileName}.mov`;
  const imgMorPath = './darbarSahibDay.gif';
  const imgNigPath = './darbarSahibNight.gif';
  const command = ffmpeg()
  command.input((getIndianDate().getHours() >= 19 || getIndianDate().getHours() <= 5) ? imgNigPath : imgMorPath)
    .inputOptions(['-ignore_loop', '0'])// if want a img instead of gif replace this inputOPtions with loop()
    .input(liveGurbaniStream) //it goes to event loop and when the on('data') event fires it converts to video and writes to output path and the process continues until we manually stop input stream  
    .audioFilters('highpass=f=200, lowpass=f=3000, volume=2dB')
    .audioCodec('aac')
    .audioBitrate('256k')
    .audioChannels(2)
    .withAudioQuality(5)
    .videoCodec('libx264')
    .outputOptions('-crf', '28', '-preset', 'fast', '-movflags', '+faststart') //lower values of crf means high quality and high memory usage and high file size and preset values(veryslow, slow, medium, fast, verfast) of veryslow means highest quality/filesize/memoryusage and reverse is also true for both crf and preset.So adjust accordingly to your hosting platform if it has low RAM(memory), its a trade-off between ram and quality
    .output(outputPath)
    .format('mov')
    .on('end', function () {
      setTimeout(() => {
        try {
          console.log('upload to youtube started for', outputPath)
          uploadToYoutube(outputPath, redisClient)
        } catch (err) {
          console.log(err)
        }
      }, 59000);
      command.ffmpegProc.kill()// as we know that outputPath here is not output stream so we can't emit 'finish' event as we do in recording automation with google drive and input stream not has finish event ,it only has end event but on explicitly calling.end of inputstream is still not working as it is still writing to output path till the buffer is not ended and in our case we have infinfite buffer as recording plays 24*7 so we used command.kill bcoz when end event is fired it is not ending writing to output path ,it still writes to output path after end ,so have to kil the process
    })
    .on('error', (err) => {
      if (!err.message.includes('ffmpeg exited with code 255: Exiting normally, received signal 15.'))
        console.log('An error occurred: ' + err.message)
    })
    .run();

  setTimeout(() => {
    command.emit('end')
  }, endMilliseconds)
}

function deleteMp4FilesIfAnyLeft() {
  const files = fs.readdirSync('.');
  files.forEach((file) => {
    if (file.endsWith('.mov')) {
      fs.unlinkSync(file);
      console.log(`Deleted file: ${file} through scheduler or at starting`);
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
  // recordStream('bhai', 10000, 'to')
});

app.get('/mp4files', (req, res) => {
  const files = fs.readdirSync('./').filter(file => file.endsWith('.mov'));
  const fileList = files.join('</br>');
  res.set('Content-Type', 'text/html');
  res.send(fileList);
});

app.get('/currentproject', async (req, res) => {
  const current = await redisClient.get('current');
  const perProjectQuota = await redisClient.get('perProjectQuota');
  const currentServer = await redisClient.get('currentServer');
  const currentProjectInfo = { current, perProjectQuota, currentServer }
  res.send(currentProjectInfo);
});

process.on('uncaughtException', (err) => {
  console.log(err)
});

process.on('unhandledRejection', (err) => {
  console.log(err)
})

setInterval(() => {//scheduled mp4 deleter if any file is left undeleted by any bug and also ragilistupdater is scheduled everyday at 1 am
  if (getIndianDate().getHours() === 1) {
    deleteMp4FilesIfAnyLeft();
    ragiListUpdateScheduler()
  }
  else if (getIndianDate().getHours() === 13)
    ragiListUpdateScheduler()
}, 3300000)

setInterval(() => {
  const currentIndianDate = getIndianDate();
  const date = currentIndianDate.getDate();
  const month = currentIndianDate.getMonth() + 1;
  const fullYear = currentIndianDate.getFullYear();
  const formattedIndianDate = `${date.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${fullYear.toString()}`;
  const config = ragiList[formattedIndianDate]?.find((config) => config?.from.split('-')[0] == currentIndianDate.getHours() && config?.from.split('-')[1] == currentIndianDate.getMinutes())
  if (config) {
    let endMilliseconds;
    if (config.to.trim().toLowerCase() === 'till completion')
      endMilliseconds = 1000 * 60 * 90;
    else
      endMilliseconds = ((parseInt(config.to.split('-')[0]) - parseInt(config.from.split('-')[0])) + (parseInt(config.to.split('-')[1]) - parseInt(config.from.split('-')[1])) / 60) * 60 * 60 * 1000;
    recordStream(config.duty, endMilliseconds, config.to, config.from)
  }
}, 60000)

const getKirtanType = (from = '', to) => {
  let kirtanType = ''
  if (Number(to.split('-')[0]) - Number(from.split('-')[0]) === 3)
    kirtanType = 'Asa Ki Vaar Kirtan Duty '
  if (Number(from.split('-')[0]) === 2)
    kirtanType = 'Tin Phera Kirtan Duty '
  if (Number(to.split('-')[0]) === 8)
    kirtanType = 'Bilawal Chowki '
  return kirtanType
}

import { createUpdateRagiList } from "./services/createUpdateRagiList.js";
import got from 'got';                  //if mail of google drive has reached out of storage then simply delete token.json and run npm start and select different mail id which has google drive storage and then token.json will automatically get created
import express from 'express';
import cron from 'node-cron';
const cronSchedulers = [];
const ragiList = JSON.parse(fs.readFileSync('./ragiList.json', 'UTF-8'));
const app = express();
import fs from 'fs';

const ragiListUpdateScheduler = async () => {
 try {
  await createUpdateRagiList()
  console.log('ragi list updated sussessfully ')
 }
 catch (err) {
  console.log(err)
 }
}

const generateConfigForCronUsingRagiList = (ragiList) => {
const configList =  Object.keys(ragiList).reduce((p, d) => {
 return [...p,...ragiList[d].map((duty) => `${duty.from.trim().split('-')[1]} ${duty.from.trim().split('-')[0]} ${d.split('/')[0]} ${d.split('/')[1]} *`)]
 }, [])
 console.log(configList)
}

const recordStream = (endMilliseconds) => {
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

 const fileName = `${ragiList[formattedDate] || ''}recording-${datetime}.mp3`;
 const kirtanStream = fs.createWriteStream(`./${fileName}`)
 kirtanStream.on("finish", () => {//after recording saved to directory then upload to googledrive
  console.log(`${fileName} saved successfully`);
 })
 got.stream(liveStreamSgpcUrl).pipe(kirtanStream);
 setTimeout(() => {
  kirtanStream.emit('finish')
 }, endMilliseconds)
}
// setInterval(() => {
//  const currentIndianTime = new Date(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }));
//  global.dutyConfigs.map((config) => {
//   if (config['startTime'] === `${currentIndianTime.getHours()}:${currentIndianTime.getMinutes()}`) {
//    recordStream(((+config['endTime'].split(':')[0] * 60 + +config['endTime'].split(':')[1]) - (+config['startTime'].split(':')[0] * 60 + +config['startTime'].split(':')[1])) * 60 * 1000);
//   }
//  });

// }, 60000)

app.get('/', (req, res) => {
 res.send(ragiList)
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
ragiListUpdateScheduler()
// //recordStream(1000)


// your array of start times
const startTimes = [
 { hour: 12, minute: 30 },
 { hour: 14, minute: 0 },
 { hour: 16, minute: 30 }
];

// create a cron expression for the specified start times (runs every day)
const cronExpression = startTimes.map(time => `${time.minute} ${time.hour} * * *`).join();

// // schedule the task to run only when the current time matches a start time
const initializeScheduler = (m) => {
 cronSchedulers[0] = cron.schedule('* 14,13,21,* 16 15 4 *', () => {
  console.log('first ',Date.now())
 });
 };


// initializeScheduler(generateConfigForCronUsingRagiList(ragiList))


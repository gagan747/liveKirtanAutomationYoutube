import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { getIndianDate } from './helper.js';
dotenv.config();
const service = google.youtube('v3');
var OAuth2 = google.auth.OAuth2;
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + process.env.TOKEN_PATH;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];


// Load client secrets from a local file.
export const uploadToYoutube = async (outputPath, redisClient) => {
  let current = parseInt(await redisClient.get('current'));
  let perProjectQuota = parseInt(await redisClient.get('perProjectQuota'))
  perProjectQuota += 1;
  if (perProjectQuota === 7) {
    current += 1;
    perProjectQuota = 1;
    if (current === 4)
      current = 1
  }
  await redisClient.set('current', current);
  await redisClient.set('perProjectQuota', perProjectQuota)
  const content = {
    web: {
      client_secret: process.env[`client_secret${current}`],
      client_id: process.env[`client_id${current}`],
      redirect_uris: [process.env[`redirect_uri${current}`]]
    }
  }
  let upload = uploadVideo.bind({ outputPath })
  authorize(content, upload, redisClient);

  // Authorize a client with the loaded credentials, then call the YouTube API.

}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback, redisClient) {
  var clientSecret = credentials.web.client_secret;
  var clientId = credentials.web.client_id;
  var redirectUrl = credentials.web.redirect_uris[0];
  var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);
  // Check if we have previously stored a token.
  let current = parseInt(await redisClient.get('current'));
  if (!process.env[`token_for_project${current}`]) {
    getNewToken(oauth2Client, callback);
  } else {
    oauth2Client.credentials = JSON.parse(process.env[`token_for_project${current}`]);
    callback(oauth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
const deleteFile = (outputPath) => {
  fs.unlink(outputPath, function (err) {
    if (err) throw err;
    // if no error, file has been deleted successfully
    console.log(outputPath.substring(2) + 'deleted!');
  });
}

function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here:', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      // callback(oauth2Client); // i have commented such that if there is no token ,token generate process is started and stops after generating token instead of then continue to upload bcoz i have changed logic and according to that first i have to copy paste token from the token path to env first then it can upload ,i.e, i have commented
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log('Token stored to ' + TOKEN_PATH);
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
let uploadVideo = function (auth) {
  try {
    let outputPath = this.outputPath
    service.videos.insert(
      {
        auth: auth,
        part: 'snippet,contentDetails,status',
        resource: {
          // Video title and description
          snippet: {
            title: outputPath.substring(2).replace(/\.mov$/, ""),
            description: `Recorded kirtan stream from Darbar Sahib Amritsar.Please note that this recording is automated and the names of the ragis may not be entirely accurate, as they were obtained from the ragi duty list on sgpc.net.This list notes that duties are subject to change over time, so the names may not always be up- to - date`,
            tags: ['live kirtan', 'live kirtan recordings', 'live keertan', 'live kirtan darbar sahib', 'hazoori ragi darbar sahib', 'amritsar kirtan recordings', 'asa ki vaar', 'bilawal chowki', 'sodar chowki', 'tin phera chowki']
          },
          // I set to private for tests
          status: {
            privacyStatus: 'private'
          }
        },

        // Create the readable stream to upload the video
        media: {
          body: fs.createReadStream(outputPath) // Change here to your real video
        }
      },
      (error, response) => {
        if (error) {
          console.log(error);
          deleteFile(outputPath)
          return
        }
        console.log('uploaded')
        deleteFile(outputPath)
        console.log('Video uploaded. Uploading the thumbnail now.')
        if (getIndianDate().getHours() >= 19 || getIndianDate().getHours() <= 5) {
          service.thumbnails.set({
            auth: auth,
            videoId: response.data.id,
            media: {
              body: fs.createReadStream('./thumbnail.png')
            },
          }, function (err, response) {
            if (err) {
              console.log('The API returned an error: ' + err);
              return;
            }
          })
        }
      }
    );
  } catch (err) {
    console.log(err)
    throw err
  }
};

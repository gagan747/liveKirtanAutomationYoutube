import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';
const service = google.youtube('v3');
var OAuth2 = google.auth.OAuth2;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/youtube-nodejs-quickstart.json
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'youtube-nodejs-quickstart.json';

// Load client secrets from a local file.
export const uploadToYoutube = (outputPath) => {
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    uploadVideo = uploadVideo.bind({ outputPath })
    // Authorize a client with the loaded credentials, then call the YouTube API.
    authorize(JSON.parse(content), uploadVideo);
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.web.client_secret;
  var clientId = credentials.web.client_id;
  var redirectUrl = credentials.web.redirect_uris[0];
  var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
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
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
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
  let outputPath = this.outputPath
  service.videos.insert(
    {
      auth: auth,
      part: 'snippet,contentDetails,status',
      resource: {
        // Video title and description
        snippet: {
          title: 'Live kirtan hhlhjhjl',
          description: 'video about live kirtan'
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
    (error, data) => {
      if (error) {
        console.log(error);
        // fs.unlink(outputPath, function (err) {
        //   if (err) throw err;
        //   // if no error, file has been deleted successfully
        //   console.log(outputPath.substring(2) + 'deleted!');
        // });
        return
      }
      console.log('uploaded')
      // fs.unlink(outputPath, function (err) {
      //   if (err) throw err;
      //   // if no error, file has been deleted successfully
      //   console.log(outputPath.substring(2) + 'deleted!');
      // });
    }
  );
};
uploadToYoutube('./video.mp4')

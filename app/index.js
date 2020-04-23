import * as fs from "fs";
import clock from "clock";
import { battery } from "power";
import document from "document";
import { vibration } from "haptics";
import { inbox } from "file-transfer";
import { outbox } from "file-transfer";
import { preferences } from "user-settings";
import { Gyroscope } from "gyroscope";
import { Accelerometer } from "accelerometer";
import * as util from "../common/utilsDevice";

// Initialize all constant screen variables
const MAIN_CLOCK = document.getElementById("mainClock");
const BATTERY = document.getElementById("clockBattery");
const ACT_TYPE = document.getElementById("activityType");
const BACK_RECT = document.getElementById("background");
const IMG_PLAY = document.getElementById("play");
const IMG_STOP = document.getElementById("stop");
const IMG_SEND = document.getElementById("send");

// Initialize an array with all different posible activities as well as the activity counter to display the correct activity
var activity_type = ['Walking','Upstairs','Downstairs','Running','Standing','Sitting','Jumping','Squad','Laying','Situp'];

// Initialize everything related to the buffer stream for Accel and Gyro sensors
var samplePerSec = 10;
var batchSize = 10;
var recSize = 12;
var buffer = new ArrayBuffer(recSize * batchSize);
var accelX = new Uint16Array( buffer, 0*batchSize, batchSize  ); // batchSize x 2 bytes
var accelY = new Uint16Array( buffer, 2*batchSize, batchSize  ); // batchSize x 2 bytes
var accelZ = new Uint16Array( buffer, 4*batchSize, batchSize  ); // batchSize x 2 bytes
var gyroX  = new Uint16Array( buffer, 6*batchSize, batchSize ); // batchSize x 2 bytes
var gyroY  = new Uint16Array( buffer, 8*batchSize, batchSize ); // batchSize x 2 bytes
var gyroZ  = new Uint16Array( buffer, 10*batchSize, batchSize ); // batchSize x 2 bytes

// Setup sensor recordings.
var accel = new Accelerometer({ frequency: samplePerSec, batch: batchSize });
var gyro = new Gyroscope({ frequency: samplePerSec, batch: batchSize });

// Initialize booleans to check when both sensors have done reading through the batch
var accelReady = false;
var gyroReady = false;

// Initilize fileName that will be used to save the recording
var fileName;
var filesToTransfer = '';

var enablePlay = true;
var enableStop = false;
var enableSend = false;

document.onkeypress = function(e) {
  // Click on Button from Bottom Right corner (Start/Stop recording)
  if ((enablePlay || enableStop) && e.key === 'down') {
    if (enablePlay) {
      startRecording();
    } else if (enableStop) {
      stopRecording();
    } 
  }
  // Click on Button from Top Right corner (Send recording)
  if (enableSend && e.key === 'up') {
    sendRecording();
  }
}

BACK_RECT.onmouseup = (evt)  => {
  let screenX = evt.screenX;
  let screenY = evt.screenY;

  // Click on Bottom Right corner (Start/Stop recording)
  if ((enablePlay || enableStop) && screenX >= 160 && screenY >= 220) {
    if (enablePlay) {
      startRecording();
    } else if (enableStop) {
      stopRecording();
    }
  }
  // Click on Top Right corner (Send recording)
  if (enableSend && screenX >= 160 && screenY <= 70) {
    sendRecording();
  }
}

function changeButtonDisplay(play, stop, send) {
  IMG_PLAY.style.visibility = (play) ? 'visible' : 'hidden';
  IMG_STOP.style.visibility = (stop) ? 'visible' : 'hidden';
  IMG_SEND.style.visibility = (send) ? 'visible' : 'hidden';
}

// Start Recording
function startRecording() {
  ACT_TYPE.text = '';
  enablePlay = enableSend = false;
  enableStop = true;
  changeButtonDisplay(enablePlay, enableStop, enableSend);

  util.deleteAllFiles();
  fileName = 'sensor_' + util.getFileTimestamp() + '.bin';
  console.log("StartRecording on file: " + fileName);
  
  accel.start();
  gyro.start();
  vibration.start("bump");
}

// Stop Recording
function stopRecording() {
  enablePlay = enableSend = true;
  enableStop = false;
  changeButtonDisplay(enablePlay, enableStop, enableSend);
  
  accel.stop();
  gyro.stop();
  vibration.start("bump");
}

// Send Recording
function sendRecording() {
  enablePlay = enableStop = enableSend = false;
  changeButtonDisplay(enablePlay, enableStop, enableSend);
  vibration.start("nudge");
  filesToTransfer = util.getDeviceFileNames();
  sendRawData();
}

// Write accel data each time an accel reading happens
accel.onreading = function() {
    for (let index = 0; index < accel.readings.timestamp.length; index++) {
      accelX[index] = util.floatToUint16(accel.readings.x[index]);
      accelY[index] = util.floatToUint16(accel.readings.y[index]);
      accelZ[index] = util.floatToUint16(accel.readings.z[index]);
    }
    accelReady = true;
    if (accelReady && gyroReady) {
      accelReady = false;
      gyroReady = false;
      let file = fs.openSync(fileName, "a+");
      fs.writeSync(file, buffer); // write the record
      fs.closeSync(file); // and commit changes -- important if you are about to read from the file
    }
}
// Write gyro data each time an gyro reading happens
gyro.onreading = function() {
    for (let index = 0; index < gyro.readings.timestamp.length; index++) {
      gyroX[index] = util.floatToUint16(gyro.readings.x[index]);
      gyroY[index] = util.floatToUint16(gyro.readings.y[index]);
      gyroZ[index] = util.floatToUint16(gyro.readings.z[index]);
    }
    gyroReady = true;
    if (accelReady && gyroReady) {
      accelReady = false;
      gyroReady = false;
      let file = fs.openSync(fileName, "a+");
      fs.writeSync(file, buffer); // write the record
      fs.closeSync(file); // and commit changes -- important if you are about to read from the file
    }
}


// Function to send the raw data to the companion
function sendRawData() {
  let filesPending = filesToTransfer.length;

  if (filesPending > 0) {
    let tempQueueFile = filesToTransfer.shift();
    console.log("Temp Queue: " + tempQueueFile);

    outbox.enqueueFile(tempQueueFile).then((ft) => {
      console.log('Transfer of ' + ft.name + ' successfully queued.');
      ft.onchange = () => {
        console.log('File Transfer State: ' + ft.readyState);
        if (ft.readyState === 'transferred') {
          // Keep sending raw data if there are files available
          util.deleteFile(ft.name);
          sendRawData();
        }
      }
    })
    .catch((error) => {console.log('Failed to schedule transfer: ' + error);})

  } else {
    enablePlay = true;
    enableStop = enableSend = false;
    changeButtonDisplay(enablePlay, enableStop, enableSend);    
    vibration.start("nudge-max");
  }
}

// Update the <text> 'clock' element every tick (minute) with the current time
clock.granularity = "minutes";
clock.ontick = (evt) => {
  let today = evt.date;
  let hours = today.getHours();
  if (preferences.clockDisplay === "12h") {
    // 12h format
    hours = hours % 12 || 12;
  } else {
    // 24h format
    hours = util.pad(hours);
  }
  let mins = util.pad(today.getMinutes());
  MAIN_CLOCK.text = `${hours}:${mins}`;
  BATTERY.text = `${battery.chargeLevel} %`;
}




// Event occurs when new file(s) are received
inbox.onnewfile = () => {
  let inboxFile;
  do {
    // If there is a file, move it from staging into the application folder
    inboxFile = inbox.nextFile();
    if (inboxFile) {
      let file = fs.openSync(inboxFile, "r");
      let buffer = new ArrayBuffer(1);
      fs.readSync(file, buffer, 0, 1, 0);
      let data = new Uint8Array(buffer);
      fs.closeSync(file);
      let activity_count = data[0];
      console.log("Fitbit Device Received Activity: " + activity_count)
      ACT_TYPE.text = activity_type[activity_count];
    }
  } while (inboxFile);
};

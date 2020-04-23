import { outbox } from "file-transfer";


// Response array buffer
var responseBuffer = new ArrayBuffer(1); // ArrayBuffer of 1 byte
var activityResponse = new Uint8Array(responseBuffer, 0, 1); // batchSize x 1 byte

// Function used to predict/classify activity using the raw data
export function uploadDataToServer(theData) {
  fetch('service/tensorflow-sensor-aks/score', {
    method: 'POST',
    body: "{\"data\" : "+JSON.stringify(theData)+"}",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ''
      },
  })
  .then(response => {
    response.text().then(textResponse => {
      let parsedJson = JSON.parse(textResponse);
      parsedJson = JSON.parse(parsedJson);
      console.log("Service Activity Response: " + mode(parsedJson.result));
      activityResponse[0] = parseInt(mode(parsedJson.result));
      updateDevice(responseBuffer);
    })
  })
  .catch(error => console.log('Error:', error));

}

// Function that gets the most repeated value (Mode)
function mode(arr) {
  return arr.sort((a,b) => arr.filter(v => v===a).length - arr.filter(v => v===b).length).pop();
}

// Function used to communicate back to the device the activity scoring
function updateDevice(response) {
  // Queue the file for transfer
  outbox.enqueue("temp.bin", response).then(function (ft) {
    ft.onchange = () => {
      if (ft.readyState === 'transferred') {
        console.log("Companion Transfer of '" + "temp.bin" + "' successfully transfered.");
      }
    }
  })
  .catch((error) => {console.log('Companion Failed to schedule transfer: ' + error);})
}


// Convert a Uint16Array (bits) into float
export function uInt16ToFloat(h) {
  var s = (h & 0x8000) >> 15;
  var e = (h & 0x7C00) >> 10;
  var f = h & 0x03FF;
  if(e == 0) {
      return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
  } else if (e == 0x1F) {
      return f?NaN:((s?-1:1)*Infinity);
  }
  return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
}
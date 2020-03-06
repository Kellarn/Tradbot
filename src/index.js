/*
 * Slack API Demo
 * This example shows how to ustilize the App Home feature
 * October 11, 2019
 *
 * This example is written in Vanilla-ish JS with Express (No Slack SDK or Framework)
 * To see how this can be written in Bolt, https://glitch.com/edit/#!/apphome-bolt-demo-note
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const qs = require('qs');

const JsonDB = require('node-json-db');
const db = new JsonDB('devices', true, true);

const signature = require('./verifySignature');
const appHome = require('./appHome');
const message = require('./message');
const connection = require('./tradfri/connection');
const deviceChanger = require('./tradfri/deviceChanger');
const _ = require('lodash');

const app = express();

const apiUrl = 'https://slack.com/api';

require('dotenv').config();

/*
 * Parse application/x-www-form-urlencoded && application/json
 * Use body-parser's `verify` callback to export a parsed raw body
 * that you need to use to verify the signature
 *
 * Forget this if you're using Bolt framework or either SDK, otherwise you need to implement this by yourself to verify signature!
 */

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

/*
 * Endpoint to receive events from Events API.
 */

// const tradfriInit = async () => {
//   const tradfri = await connection.getConnection();
//   tradfri.observeDevices();

//   await delay(1000);
//   try {
//     const rawData = db.getData('/devices/data/');
//     console.log('TCL: tradfriInit -> rawData', rawData);
//   } catch (e) {
//     console.error(e);
//   }
//   next();
// };
(async () => {
  const tradfri = await connection.getConnection();

  tradfri
    .on('device updated', deviceUpdated)
    .on('device removed', deviceRemoved)
    // .on('device updated', () => console.log('Device updated'))
    // .on('device removed', () => console.log('Device removed'))
    .observeDevices();
})();

function printDeviceInfo(device) {
  switch (device.type) {
    case 0: // remote
    case 4: // sensor
      // console.log(
      //   device.instanceId,
      //   device.name,
      //   `battery ${device.deviceInfo.battery}%`
      // );
      break;
    case 2: // light
      const lightInfo = device.lightList[0];
      const info = {
        id: device.instanceId,
        name: device.name,
        on: lightInfo.onOff ? 'on' : 'off',
        spectrum: lightInfo.spectrum,
        dimmer: lightInfo.dimmer,
        color: lightInfo.color,
        colorTemperature: lightInfo.colorTemperature
          ? lightInfo.colorTemperature
          : 'undefined'
      };
      console.log('printDeviceInfo -> info', info);
      // console.log(
      //   device.instanceId,
      //   device.name,
      //   lightInfo.onOff ? 'On' : 'Off',
      //   JSON.stringify(info)
      // );
      try {
        const rawData = db.getData(`/${info.id}/info/`);
        console.log('printDeviceInfo -> rawData', rawData);
        if (!_.isEqual(rawData, info)) {
          console.log('Saving to db!');
          db.push(`/${info.id}/info`, info);
        }
      } catch (e) {
        console.error(e);
        db.push(`/${info.id}/info`, info);
      }
      break;
    case 3: // plug
      // console.log(
      //   device.instanceId,
      //   device.name,
      //   device.plugList[0].onOff ? 'On' : 'Off'
      // );
      break;
    default:
      console.log(device.instanceId, device.name, 'unknown type', device.type);
      console.log(device);
  }
}
const deviceUpdated = device => {
  try {
    // console.log('TCL: db', db);
    // const rawData = db.getData('/');
    // console.log('TCL: tradfriInit -> rawData', rawData);
    // for (const deviceId in tradfri.devices) {
    // const device = await tradfri.devices[deviceId];
    // const info = await printDeviceInfo(device);
    // db.push(`/${device.deviceId}/data[]`, device, true);
    // const rawData = db.getData('/');
    // console.log('TCL: rawData', rawData);
    printDeviceInfo(device);
  } catch (e) {
    console.error(e);
  }
};
const deviceRemoved = device => {
  console.log('Deivce: ', deviceId, ' has been removed');
};

app.post('/slack/events', async (req, res) => {
  switch (req.body.type) {
    case 'url_verification': {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }

    case 'event_callback': {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      }

      // Request is verified --
      else {
        const { type, user, channel, tab, text, subtype } = req.body.event;
        console.log('TCL: type', type);

        // Triggered when the App Home is opened by a user
        if (type === 'app_home_opened') {
          // Display App Home
          appHome.displayHome(user);
        }

        /* 
         * If you want to allow user to create a note from DM, uncomment the part! 

        // Triggered when the bot gets a DM
        else if(type === 'message') {
          
          if(subtype !== 'bot_message') { 
            
            // Create a note from the text with a default color
            const timestamp = new Date();
            const data = {
              timestamp: timestamp,
              note: text,
              color: 'yellow'
            }
            await appHome.displayHome(user, data);
                                         
            // DM back to the user 
            message.send(channel, text);
          }
        }
        */
      }
      break;
    }
    default: {
      res.sendStatus(404);
    }
  }
});

/*
 * Endpoint to receive an button action from App Home UI "Add a Stickie"
 */

app.post('/slack/actions', async (req, res) => {
  //console.log(JSON.parse(req.body.payload));

  const { token, trigger_id, user, actions, type } = JSON.parse(
    req.body.payload
  );

  // Button with "add_" action_id clicked --
  if (actions && actions[0].action_id.match(/update_/)) {
    // Open a modal window with forms to be submitted by a user
    appHome.openModal(trigger_id);
  }

  // Modal forms submitted --
  else if (type === 'view_submission') {
    res.send(''); // Make sure to respond to the server to avoid an error

    const ts = new Date();
    const { user, view } = JSON.parse(req.body.payload);

    const data = {
      timestamp: ts.toLocaleString(),
      note: view.state.values.note01.content.value,
      color: view.state.values.note02.color.selected_option.value
    };

    appHome.displayHome(user.id, data);
  }
});

/* Running Express server */
const server = app.listen(5000, () => {
  console.log(
    'Express web server is running on port %d in %s mode',
    server.address().port,
    app.settings.env
  );
});

app.get('/', async (req, res) => {
  res.send(
    'There is no web UI for this code sample. To view the source code, click "View Source"'
  );
});

const axios = require('axios');
const qs = require('qs');

const JsonDB = require('node-json-db');
const db = new JsonDB('devices', true, false);

const connection = require('./tradfri/connection');
const deviceChanger = require('./tradfri/deviceChanger');
const delay = require('delay');

const apiUrl = 'https://slack.com/api';

//db.delete("/");

const updateView = async user => {
  const tradfri = await connection.getConnection();
  tradfri.observeDevices();

  await delay(1000);
  // Intro message -

  let blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Welcome!* \nThis is the home of *Trådbot*. Please pick a device:'
      }
    },
    {
      type: 'divider'
    }
  ];

  // Append new data blocks after the intro -

  let newData = [];
  for (const deviceId in tradfri.devices) {
    const device = await tradfri.devices[deviceId];
    const info = await printDeviceInfo(device);
    // console.log('TCL: getAndPrintDevices -> info', info);

    if (info !== undefined) {
      console.log('TCL: info', info);
      const basicInfo = {
        type: 'section',
        block_id: '',
        text: {
          type: 'mrkdwn',
          text: info.name
        },
        accessory: {
          type: 'button',
          action_id: `update_${info.instanceId.toString()}`,
          text: {
            type: 'plain_text',
            text: 'Choose bulb',
            emoji: true
          }
        }
      };

      const currentInfo = {
        type: 'section',
        fields: []
      };

      let infoObject = {
        text: `*Instance ID*:  ${info.instanceId}`,
        type: 'mrkdwn'
      };
      currentInfo.fields.push(infoObject);
      infoObject = {
        text: `*On*:  ${info.on}`,
        type: 'mrkdwn'
      };
      currentInfo.fields.push(infoObject);
      infoObject = {
        text: `*Spectrum*:  ${info.spectrum}`,
        type: 'mrkdwn'
      };
      currentInfo.fields.push(infoObject);
      infoObject = {
        text: `*Dimmer*:  ${info.dimmer}`,
        type: 'mrkdwn'
      };
      currentInfo.fields.push(infoObject);
      infoObject = {
        text: `*Color*: #${info.color}`,
        type: 'mrkdwn'
      };
      currentInfo.fields.push(infoObject);

      blocks = blocks.concat(basicInfo);
      blocks = blocks.concat(currentInfo);

      const divider = {
        type: 'divider'
      };

      blocks = blocks.concat(divider);
    }

    //   try {
    //     const rawData = db.getData(`/${user}/data/`);

    //     newData = rawData.slice().reverse(); // Reverse to make the latest first
    //     newData = newData.slice(0, 50); // Just display 20. BlockKit display has some limit.
    //   } catch (error) {
    //     //console.error(error);
    //   }

    //   if (newData) {
    //     let noteBlocks = [];

    //     for (const o of newData) {
    //       const color = o.color ? o.color : 'yellow';

    //       let note = o.note;
    //       if (note.length > 3000) {
    //         note = note.substr(0, 2980) + '... _(truncated)_';
    //         console.log(note.length);
    //       }

    //       noteBlocks = [
    //         {
    //           type: 'section',
    //           text: {
    //             type: 'mrkdwn',
    //             text: note
    //           },
    //           accessory: {
    //             type: 'image',
    //             image_url: `https://cdn.glitch.com/0d5619da-dfb3-451b-9255-5560cd0da50b%2Fstickie_${color}.png`,
    //             alt_text: 'stickie note'
    //           }
    //         },
    //         {
    //           type: 'context',
    //           elements: [
    //             {
    //               type: 'mrkdwn',
    //               text: o.timestamp
    //             }
    //           ]
    //         },
    //         {
    //           type: 'divider'
    //         }
    //       ];
    //       blocks = blocks.concat(noteBlocks);
    //     }
    //   }
    // The final view -
  }

  let view = {
    type: 'home',
    title: {
      type: 'plain_text',
      text: 'Trådbot!'
    },
    blocks: blocks
  };

  return JSON.stringify(view);
};

//Print device info
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
      let lightInfo = device.lightList[0];
      // console.log('TCL: printDeviceInfo -> device', device);
      // console.log('TCL: printDeviceInfo -> lightInfo', lightInfo);
      let info = {
        instanceId: device.instanceId,
        name: device.name,
        on: lightInfo.onOff ? 'yes' : 'no',
        spectrum: lightInfo.spectrum,
        dimmer: lightInfo.dimmer,
        color: lightInfo.color,
        colorTemperature: lightInfo.colorTemperature
      };
      // console.log(
      //   device.instanceId,
      //   device.name,
      //   lightInfo.onOff ? 'On' : 'Off',
      //   JSON.stringify(info)
      // );
      return info;
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

/* Display App Home */

const displayHome = async (user, data) => {
  console.log('Hello from displayHome');
  // if (data) {
  //   // Store in a local DB
  //   db.push(`/${user}/data[]`, data, true);
  // }

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    user_id: user,
    view: await updateView(user)
  };

  const result = await axios.post(
    `${apiUrl}/views.publish`,
    qs.stringify(args)
  );

  try {
    if (result.data.error) {
      console.log(result.data.error);
    }
  } catch (e) {
    console.log(e);
  }
};

/* Open a modal */

const openModal = async trigger_id => {
  const modal = {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Update'
    },
    submit: {
      type: 'plain_text',
      text: 'Create'
    },
    blocks: [
      // Text input
      {
        type: 'input',
        block_id: 'note01',
        label: {
          type: 'plain_text',
          text: 'Note'
        },
        element: {
          action_id: 'content',
          type: 'plain_text_input',
          placeholder: {
            type: 'plain_text',
            text:
              'Take a note... \n(Text longer than 3000 characters will be truncated!)'
          },
          multiline: true
        }
      },

      // Drop-down menu
      {
        type: 'input',
        block_id: 'note02',
        label: {
          type: 'plain_text',
          text: 'Color'
        },
        element: {
          type: 'static_select',
          action_id: 'color',
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'yellow'
              },
              value: 'yellow'
            },
            {
              text: {
                type: 'plain_text',
                text: 'blue'
              },
              value: 'blue'
            },
            {
              text: {
                type: 'plain_text',
                text: 'green'
              },
              value: 'green'
            },
            {
              text: {
                type: 'plain_text',
                text: 'pink'
              },
              value: 'pink'
            }
          ]
        }
      }
    ]
  };

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };

  const result = await axios.post(`${apiUrl}/views.open`, qs.stringify(args));

  console.log(result.data);
};

module.exports = { displayHome, openModal };

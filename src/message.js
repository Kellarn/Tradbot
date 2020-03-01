const axios = require('axios');
const qs = require('qs');

const apiUrl = 'https://slack.com/api';

/*
 *  Handling DM messages
 */

/* Calling the chat.postMessage method to send a message */

const send = async (channel, text) => {
  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    channel: channel,
    text: `:wave: Hey, I created this note for you in my _Home_: \n>>>${text}`
  };

  const result = await axios.post(
    `${apiUrl}/chat.postMessage`,
    qs.stringify(args)
  );

  try {
    console.log(result.data);
  } catch (e) {
    console.log(e);
  }
};

module.exports = { send };

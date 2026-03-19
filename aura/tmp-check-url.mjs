import twilio from 'twilio';
const client = twilio('ACd7e38ccbc28bda626fbeedb6ed5bf77e', '5dacdcd584352fd5338d9b057f630646');
client.applications('AP854151a44e17354589e1a3bc70f86fc1').fetch()
  .then(app => {
     console.log('VOICE_URL=' + app.voiceUrl);
  })
  .catch(e => console.error(e.message));

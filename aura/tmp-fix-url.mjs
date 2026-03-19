import twilio from 'twilio';
const client = twilio('ACd7e38ccbc28bda626fbeedb6ed5bf77e', '5dacdcd584352fd5338d9b057f630646');
client.applications('AP854151a44e17354589e1a3bc70f86fc1')
  .update({
     voiceUrl: 'https://via-mazda-apps-searched.trycloudflare.com/api/twilio/client-voice',
     voiceMethod: 'POST'
  })
  .then(app => {
     console.log('SUCCESS: URL is now ' + app.voiceUrl);
  })
  .catch(e => console.error(e.message));

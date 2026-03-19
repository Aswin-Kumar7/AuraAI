const twilio = require('twilio');
const client = twilio('ACd7e38ccbc28bda626fbeedb6ed5bf77e', '5dacdcd584352fd5338d9b057f630646');
client.newKeys.create({ friendlyName: 'Aura Web Client Key' })
  .then(key => console.log('KEY_SID=' + key.sid + '\nKEY_SECRET=' + key.secret))
  .catch(e => console.error(e.message));

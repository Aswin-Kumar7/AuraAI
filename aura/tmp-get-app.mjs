import twilio from 'twilio';
const client = twilio('ACd7e38ccbc28bda626fbeedb6ed5bf77e', '5dacdcd584352fd5338d9b057f630646');
client.applications.list({ friendlyName: 'Aura Web Client App', limit: 1 })
  .then(apps => {
     if (apps.length > 0) {
        console.log('APP_SID=' + apps[0].sid);
     } else {
        console.log('NOT_FOUND');
     }
  })
  .catch(e => console.error(e.message));

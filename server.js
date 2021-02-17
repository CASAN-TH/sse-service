const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const app = express()
const request = require('request')

const VERIFY_TOKEN = 'chatbot001'

// Allows us to process the data
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

function eventsHandler(req, res, next) {
  // Mandatory headers and http status to keep connection open
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, headers);
  // After client opens connection send all nests as string
  const data = `data: ${JSON.stringify(nests)}\n\n`;
  res.write(data);
  // Generate an id based on timestamp and save res
  // object of client connection on clients list
  // Later we'll iterate it and send updates to each client
  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);
  // When client closes connection we update the clients list
  // avoiding the disconnected one
  req.on('close', () => {
    console.log(`${clientId} Connection closed`);
    clients = clients.filter(c => c.id !== clientId);
  });
}
// Iterate clients list and use write res object method to send new nest
function sendEventsToAll(newNest) {
  clients.forEach(c => c.res.write(`data: ${JSON.stringify(newNest)}\n\n`))
}
// Middleware for POST /nest endpoint
// async function addNest(req, res, next) {
//   const newNest = req.body;
//   nests.push(newNest);
//   // Send recently added nest as POST result
//   res.json(newNest)
//   // Invoke iterate and send function
//   return sendEventsToAll(newNest);
// }
// Set cors and bodyParser middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// Define endpoints
// app.post('/nest', addNest);
app.get('/events', eventsHandler);
app.get('/status', (req, res) => res.json({ clients: clients.length }));
const PORT = 3000;
let clients = [];
let nests = [];

// ROUTES
app.get("/webhook", async (req, res) => {
  // Parse the query params
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.send(challenge)
  }
  else {
    // Responds with '403 Forbidden' if verify tokens do not match
    console.log('WEBHOOK_VERIFIED');
    res.sendStatus(403);
  }
})

app.post('/webhook', async (req, res) => {
  const { body } = req;
  if (body.object === 'page') {
    const events = body && body.entry && body.entry[0]
    const newNest = events;
    // await handleEvents(newNest)
    nests.push(newNest);
    // Send recently added nest as POST result
    res.json(newNest)
    // Invoke iterate and send function
    return sendEventsToAll(newNest);
  }else{
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
  return res.sendStatus(200)
})

app.post('/sentevents', async (req, res) => {
  const { body } = req;
  // if (body.object === 'page') {
    const newNest = body;
    await handleEvents(newNest)
    nests.push(newNest);
    // Send recently added nest as POST result
    res.json(newNest)
    // Invoke iterate and send function
    return sendEventsToAll(newNest);
  // }else{
    // res.sendStatus(404);
  // }

})

const PAGE_ACCESS_TOKEN = "EAAeZB9mdZANSQBAHVGfIwZCtFCgbP59HkZC9duHw1IdCfh1mbKjvZBzWZBDx3gk948hamrDmZBU9atUpbladqgfKPN86OcMFmQC1TLPoyFCxKmW7mSH3WS4vkKVl8d4Wo0qCIEA7OJWK3ojZCM59iEb2DPMjyDhDWDtiSybZBT8NS9N1fkmnAiwaB"

const handleEvents = (requestBody) => {
  // const text = get(events, ['messaging', 0, 'message', 'text']);
  // const sender = get(events, ['messaging', 0, 'sender', 'id']);
  // const requestBody = {
  //   "messaging_type": "RESPONSE",
  //   "recipient": {
  //     id: sender
  //   },
  //   "message": { text }
  // }



  const config = {
    method: 'post',
    uri: "https://graph.facebook.com/v6.0/me/messages",
    json: requestBody,
    qs: {
      access_token: `${PAGE_ACCESS_TOKEN}`,
    },
  };
  return request(config, (err, res, body) => {
    if (!body.error) {
      console.log('message sent!', body)
      return body
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
}

app.listen(PORT, (req, res) => {
  console.log("  Server ready ~~~~")
})


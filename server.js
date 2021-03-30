const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const request = require('request');
const multer = require('multer');
const VERIFY_TOKEN = 'chatbot001';
const fs = require('fs');

// Allows us to process the data
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(express.static(__dirname));

const folderName = "upload";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './' + folderName);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

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

// Set cors and bodyParser middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// Define endpoints
// app.post('/nest', addNest);
app.get('/events', eventsHandler);
app.get('/status', (req, res) => res.json({ clients: clients.length }));
const PORT = 3001;
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
    console.log(newNest.messaging);
    let response = {
      message_type: "contact",
      from: {
        email: newNest.messaging[0].sender.id + "@facebook.com",
        id: newNest.messaging[0].sender.id,
      },
      message: newNest.messaging[0].message.text
    }
    nests.push(response);
    // Send recently added nest as POST result
    res.json(response)
    // Invoke iterate and send function
    return sendEventsToAll(response);
  } else {
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
  let response = {
    from: {
      email: newNest.recipient.id + "@facebook.com",
      id: newNest.recipient.id,
    },
    message: newNest.message.text
  }
  // console.log(response);
  // nests.push(newNest);
  // Send recently added nest as POST result
  res.json(response)
  // Invoke iterate and send function
  return sendEventsToAll(response);
  // }else{
  // res.sendStatus(404);
  // }

})

app.get('/getprofile', async (req, resp) => {
  const config = {
    method: 'get',
    uri: "https://graph.facebook.com/v9.0/me/conversations?fields=snippet,updated_time,senders",
    qs: {
      access_token: `${PAGE_ACCESS_TOKEN}`,
    },
  };
  request(config, (err, res, body) => {
    const data = JSON.parse(body)
    resp.jsonp(data)
  });
})

const PAGE_ACCESS_TOKEN = "EAADQisBpkbYBAAL4YO8xTLGKS3B1F7trq7JLqXXyXGeAO4rodlAEClv6isG2Vw7a37faWR9niBHJZCegZAGf99ENpqBLFFD5fNsGSXhWPHxhWFpQXAPI7poEGcnTboq44RU0WJNTcUzEbZADuGWODGgt2I4YiBvZBmXDYfeZBnUw8gywELIQx"


const handleEvents = (requestBody) => {

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

app.post('/lineOAList', async (req, resp) => {
  const config = {
    method: 'get',
    uri: "https://chat.line.biz/api/v1/bots?noFilter=true&limit=1000",
    headers: {
      Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF- TOKEN=' + req.body.xsrftoken
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      let messages = (JSON.parse(body));
      resp.jsonp(messages);
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineContactList', async (req, resp) => {
  const config = {
    method: 'get',
    uri: "https://chat.line.biz/api/v1/bots/" + req.body.lineOAID + "/chats?folderType=ALL&taglds=&limit=25",
    headers: {
      Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF- TOKEN=' + req.body.xsrftoken
    }

  };
  request(config, (err, res, body) => {
    if (!body.error) {
      let messages = (JSON.parse(body));
      resp.jsonp(messages);
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineContactChat', async (req, resp) => {
  const config = {
    method: 'get',
    uri: "https://chat.line.biz/api/v1/bots/" + req.body.lineOAID + "/messages/" + req.body.chatID,
    headers: {
      Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF- TOKEN=' + req.body.xsrftoken
    }
  };

  request(config, (err, res, body) => {
    if (!body.error) {
      let messages = (JSON.parse(body));
      let length = 0;

      messages.list.every(e => {
        if (e.type === 'chatRead') {
          return false;
        }
        length++;
        return true;
      })
      let lengthMessage = 0;
      messages.list.forEach(message => {
        if (message.type === 'messageSent' && lengthMessage >= length) {
          message.statusRead = true;
        } else if (message.type === 'messageSent' && lengthMessage < length) {
          message.statusRead = false;
        }
        lengthMessage++;
      })
      resp.jsonp(messages);
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/linestreamingApiToken', async (req, resp) => {
  const config = {
    method: 'post',
    uri: 'https://chat.line.biz/api/v1/bots/' + req.body.lineOAID + '/streamingApiToken?',
    headers: {
      Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF-TOKEN=' + req.body.xsrftoken,
      'X-XSRF-TOKEN': req.body.xsrftoken
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      let messages = (JSON.parse(body));
      resp.jsonp(messages);
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineSendMessage', async (req, resp) => {
  const config = {
    method: 'post',
    uri: 'https://chat.line.biz/api/v1/bots/' + req.body.token.lineOAID + '/messages/' + req.body.token.chatID + '/send',
    json: req.body.message,
    headers: {
      Cookie: 'ses=' + req.body.token.cookietoken + ';' + 'XSRF-TOKEN=' + req.body.token.xsrftoken,
      'X-XSRF-TOKEN': req.body.token.xsrftoken
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      resp.jsonp({
        status: 200
      });
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineEditNickname', async (req, resp) => {
  const config = {
    method: 'put',
    uri: 'https://chat.line.biz/api/v1/bots/' + req.body.lineOAID + '/users/' + req.body.chatID + '/nickname',
    json: req.body.json,
    headers: {
      Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF-TOKEN=' + req.body.xsrftoken,
      'X-XSRF-TOKEN': req.body.xsrftoken
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      const config = {
        method: 'get',
        uri: 'https://chat.line.biz/api/v1/bots/' + req.body.lineOAID + '/users?userIds=' + req.body.chatID,
        headers: {
          Cookie: 'ses=' + req.body.cookietoken + ';' + 'XSRF-TOKEN=' + req.body.xsrftoken,
          'X-XSRF-TOKEN': req.body.xsrftoken
        }
      };
      request(config, (err, res, body) => {
        if (!body.error) {
          let data = JSON.parse(body);
          resp.jsonp(data);
        } else {
          return new Error("Unable to send message:" + body.error);
        }
      });
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineSearchContact', async (req, resp) => {
  const config = {
    method: 'get',
    uri: 'https://chat.line.biz/api/v1/bots/' + req.body.token.lineOAID + '/chats/search?query=' + req.body.search + '&searchTargetType=CHAT_PROFILE&limit=25',
    headers: {
      Cookie: 'ses=' + req.body.token.cookietoken + ';' + 'XSRF-TOKEN=' + req.body.token.xsrftoken,
      'X-XSRF-TOKEN': req.body.token.xsrftoken
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      let contact = JSON.parse(body);
      resp.jsonp(contact.list);
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.post('/lineUploadFile', upload.single('file'), (req, resp) => {
  let body = JSON.parse(req.body.body);
  let data = {
    file: fs.createReadStream(req.file.path),
    sendId: body.sendId
  }
  // console.log(req.file);
  // var formData = JSON.stringify(data);
  // console.log(req.file);
  // restler.post('https://chat.line.biz/api/v1/bots/' + body.token.lineOAID + '/messages/' + body.token.chatID + '/sendFile', {
  //   multipart: true,
  //   data: {
  //     'sendId': body.sendId,
  //     'file': restler.file
  //   }
  // }).on('complete', function (data) {
  //   console.log(data);
  // });
  
  const config = {
    method: 'post',
    uri: 'https://chat.line.biz/api/v1/bots/' + body.token.lineOAID + '/messages/' + body.token.chatID + '/sendFile',
    formData: data,
    headers: {
      Cookie: 'ses=' + body.token.cookietoken + ';' + 'XSRF-TOKEN=' + body.token.xsrftoken,
      'X-XSRF-TOKEN': body.token.xsrftoken,
      "Content-Type": "multipart/form-data"
    }
  };
  request(config, (err, res, body) => {
    if (!body.error) {
      resp.jsonp({
        status: 200
      });
    } else {
      return new Error("Unable to send message:" + body.error);
    }
  });
})

app.listen(PORT, (req, res) => {
  console.log("Server ready ~~~~")
})


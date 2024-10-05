/* 
  credits: Guru322
  src: https://github.com/Guru322/Express-pairing-code/
*/

const Boom = require('@hapi/boom');
const Baileys = require('@whiskeysockets/baileys');
const { DisconnectReason, delay, Browsers, makeCacheableSignalKeyStore, useMultiFileAuthState } = Baileys;
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { upload } = require('./mega.js');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(cors());

var PORT = process.env.PORT || 8000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, 'client', 'build')));

function createRandomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var id = '';
  for (var i = 0; i < 10; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
}

var sessionFolder = `./auth/${createRandomId()}`;
if (fs.existsSync(sessionFolder)) {
  try {
    fs.rmdirSync(sessionFolder, { recursive: true });
    console.log('Deleted the "SESSION" folder.');
  } catch (err) {
    console.error('Error deleting the "SESSION" folder:', err);
  }
}

var clearState = () => {
  fs.rmdirSync(sessionFolder, { recursive: true });
};

function deleteSessionFolder() {
  if (!fs.existsSync(sessionFolder)) {
    console.log('The "SESSION" folder does not exist.');
    return;
  }

  try {
    fs.rmdirSync(sessionFolder, { recursive: true });
    console.log('Deleted the "SESSION" folder.');
  } catch (err) {
    console.error('Error deleting the "SESSION" folder:', err);
  }
}

app.get('/', (req, res) => {
  res.json({msg: "working??"})
  
});

app.get('/pair', async (req, res) => {
  var phone = req.query.num;

  if (!phone) return res.json({ error: 'Please Provide Phone Number' });

  try {
    const code = await startnigg(phone);
    res.json({ code: code });
  } catch (error) {
    console.error('Error in WhatsApp authentication:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function startnigg(phone) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(sessionFolder)) {
        await fs.mkdirSync(sessionFolder);
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

      const socket = Baileys.makeWASocket({
        version: [2, 3000, 1015901307],
        printQRInTerminal: false,
        logger: pino({
          level: 'silent',
        }),
        browser: Browsers.ubuntu("Chrome"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino().child({
              level: 'fatal',
              stream: 'store',
            })
          ),
        },
      });

      if (!socket.authState.creds.registered) {
        var phoneNumber = phone ? phone.replace(/[^0-9]/g, '') : '';
        if (phoneNumber.length < 9) {
          return reject(new Error('Please Enter Your Number With Country Code !!'));
        }
        setTimeout(async () => {
          try {
            var code = await socket.requestPairingCode(phoneNumber);
            console.log(`Your Pairing Code : ${code}`);
            resolve(code);
          } catch (requestPairingCodeError) {
            const errorMessage = 'Error requesting pairing code from WhatsApp';
            console.error(errorMessage, requestPairingCodeError);
            return reject(new Error(errorMessage));
          }
        }, 3000);
      }

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async update => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          await delay(10000);
          var data1 = fs.createReadStream(`${sessionFolder}/creds.json`);
          const output = await upload(data1, createRandomId() + '.json');
          var sessi = output.includes('https://mega.nz/file/') ? "Xlicon~" + output.split('https://mega.nz/file/')[1] : 'Error Uploading to Mega';
          await delay(2000);
          var msgg = await socket.sendMessage(socket.user.id, { text: sessi });
          await delay(2000);
          await socket.sendMessage(
            socket.user.id,
            {
              text: 'Hello there! 👋 \n\nDo not share your session id with anyone.\n\nPut the above in SESSION_ID var\nbalh blah \n',
            },
            { quoted: msgg }
          );

          console.log('Connected to WhatsApp Servers');

          try {
            deleteSessionFolder();
          } catch (error) {
            console.error('Error deleting session folder:', error);
          }

          if (process.send) process.send('reset');
        }

        if (connection === 'close') {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode
          console.log('Connection Closed:', reason)
          if (reason === DisconnectReason.connectionClosed) {
            console.log('[Connection closed, reconnecting....!]')
            if (process.send) process.send('reset')
          } else if (reason === DisconnectReason.connectionLost) {
            console.log('[Connection Lost from Server, reconnecting....!]')
            if (process.send) process.send('reset')
          } else if (reason === DisconnectReason.loggedOut) {
            clearState()
            console.log('[Device Logged Out, Please Try to Login Again....!]')
            if (process.send) process.send('reset')
          } else if (reason === DisconnectReason.restartRequired) {
            console.log('[Server Restarting....!]')
            startnigg()
          } else if (reason === DisconnectReason.timedOut) {
            console.log('[Connection Timed Out, Trying to Reconnect....!]')
            if (process.send) process.send('reset')
          } else if (reason === DisconnectReason.badSession) {
            console.log('[BadSession exists, Trying to Reconnect....!]')
            clearState()
            if (process.send) process.send('reset')
          } else if (reason === DisconnectReason.connectionReplaced) {
            console.log(`[Connection Replaced, Trying to Reconnect....!]`)
            if (process.send) process.send('reset')
          } else {
            console.log('[Server Disconnected: Maybe Your WhatsApp Account got Fucked....!]')
            if (process.send) process.send('reset')
          }
        }
      });

      socket.ev.on('messages.upsert', () => {});
    } catch (error) {
      reject(error);
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const http = require('http');
const fs = require('fs');
const https = require('https');

// Telegram parametrlari
const BOT_TOKEN = '5383108241:AAE2-qeT-26Fnej_mvfnCQ92N-j_pFNevr8'; // Bot tokeningizni shu yerga yozing
const WEB_APP_URL = 'https://bot-web-app.onrender.com/index.html'; // Web ilovangizning HTTPS linkini yozing (ngrok yoki real domen)
let USER_CHAT_ID = 5379945359; // /start kelganda bu o'zgaruvchiga saqlaymiz

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    // index.html ni qaytarish
    fs.readFile('index.html', (err, data) => {
      if (err) {
        res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});
        return res.end('Server xatosi');
      }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(data);
    });
  } else if (req.method === 'POST' && req.url === '/webhook') {
    // Telegramdan kelgan update
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let update = {};
      try {
        update = JSON.parse(body);
      } catch(e) {
        console.error('JSON parse error:', e);
      }

      if (update.message) {
        const chat_id = update.message.chat.id;
        USER_CHAT_ID = chat_id;
        const text = update.message.text;
        if (text === '/start') {
          // Userga web_app tugmasi bilan xabar yuboramiz
          sendWebAppButton(chat_id, (err) => {
            if (err) console.error(err);
          });
        }
      }

      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'ok'}));
    });
  } else if (req.method === 'POST' && req.url === '/send-message') {
    // Web ilovadan kelgan matnni Telegram useriga yuboramiz
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const text = params.get('text') || '';

      if (!text.trim()) {
        res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'});
        return res.end(JSON.stringify({error:'Empty text'}));
      }

      if (!USER_CHAT_ID) {
        // Agar chat_id hali kelmagan bo'lsa
        res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'});
        return res.end(JSON.stringify({error:'Chat ID not found. Send /start in Telegram first.'}));
      }

      sendMessage(USER_CHAT_ID, text, (err) => {
        if (err) {
          res.writeHead(500, {'Content-Type':'application/json; charset=utf-8'});
          return res.end(JSON.stringify({error:'Xatolik',details:err}));
        }
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
        res.end(JSON.stringify({message:'Xabar yuborildi'}));
      });
    });
  } else {
    // Boshqa holatlar 404
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT} da ishga tushdi (Webhook uchun HTTPS kerak!)`);
});

// Telegramga xabar yuborish funksiyasi
function sendMessage(chat_id, text, callback) {
  const postData = JSON.stringify({chat_id: chat_id, text: text});
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      let resp;
      try {
        resp = JSON.parse(data);
      } catch(e) {
        return callback(e);
      }
      if (resp.ok) callback(null);
      else callback(resp);
    });
  });
  req.on('error', (e) => callback(e));
  req.write(postData);
  req.end();
}

// WebApp tugmasi yuborish funksiyasi
function sendWebAppButton(chat_id, callback) {
  const markup = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Open WebApp", web_app: { url: WEB_APP_URL } }]
      ]
    }
  };

  const postData = JSON.stringify({
    chat_id: chat_id,
    text: "WebApp'ni ochish uchun tugmani bosing:",
    ...markup
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      callback(null);
    });
  });
  req.on('error', (e) => callback(e));
  req.write(postData);
  req.end();
}

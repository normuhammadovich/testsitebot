require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { default: axios } = require('axios');
const unzipper = require('unzipper');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMINS = process.env.ADMINS ? process.env.ADMINS.split(',').map(a=>parseInt(a.trim())) : [];
const API_KEY = process.env.API_KEY;

// Botni polling orqali ishga tushiramiz
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

// DB ulanishi
const db = new sqlite3.Database('./main.db');

// DB yaratish
function initDB(){
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'active',
        phone_number TEXT,
        username TEXT DEFAULT 'null',
        fullname TEXT DEFAULT 'null'
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        admin_name TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER,
        channel_name TEXT,
        invite_link TEXT
    )`);
}
initDB();

// Foydalanuvchini DB ga qo‘shish
function addUser(user_id, phone_number="--", status="active", username="null", fullname="null"){
    db.run("INSERT OR IGNORE INTO users (id,status,phone_number,username,fullname) VALUES (?,?,?,?,?)",
    [user_id,status,phone_number,username,fullname]);
}

function getAllUsers(){
    return new Promise((resolve,reject)=>{
        db.all("SELECT id FROM users",[],(err,rows)=>{
            if(err) return reject(err);
            resolve(rows.map(r=>r.id));
        })
    })
}

function getInactiveUsers(){
    return new Promise((resolve,reject)=>{
        db.all("SELECT id FROM users WHERE status='inactive'",[],(err,rows)=>{
            if(err) return reject(err);
            resolve(rows.map(r=>r.id));
        })
    })
}

function reStatusUsers(inactives){
    return new Promise((resolve,reject)=>{
        db.run("UPDATE users SET status='active'",[],(err)=>{
            if(err) return reject(err);
            let tasks = inactives.map(uid=>{
                return new Promise((res,rej)=>{
                    db.run("UPDATE users SET status='inactive' WHERE id=?",[uid],(e)=>{
                        if(e) rej(e); else res();
                    })
                })
            });
            Promise.all(tasks).then(()=>resolve()).catch(reject);
        })
    })
}

// Adminlar
function getAdmins(){
    return new Promise((resolve,reject)=>{
        db.all("SELECT admin_id,admin_name FROM admins",[],(err,rows)=>{
            if(err) return reject(err);
            resolve(rows);
        })
    })
}

function addAdmin(admin_id,admin_name){
    return new Promise((resolve,reject)=>{
        db.run("INSERT OR IGNORE INTO admins (admin_id,admin_name) VALUES(?,?)",[admin_id,admin_name],(err)=>{
            if(err) return reject(err);
            resolve();
        })
    })
}

function deleteAdmin(admin_id){
    return new Promise((resolve,reject)=>{
        db.run("DELETE FROM admins WHERE admin_id=?",[admin_id],(err)=>{
            if(err) return reject(err);
            resolve();
        })
    })
}

function isMainAdmin(user_id){
    return ADMINS.includes(user_id);
}

async function isAdmin(user_id){
    const rows = await getAdmins();
    const list = rows.map(r=>r.admin_id);
    return isMainAdmin(user_id) || list.includes(user_id);
}

// Channels
function getChannels(){
    return new Promise((resolve,reject)=>{
        db.all("SELECT * FROM channels",[],(err,rows)=>{
            if(err) return reject(err);
            resolve(rows);
        })
    })
}

function addChannel(channel_id,channel_name,invite_link){
    return new Promise((resolve,reject)=>{
        db.run("INSERT OR IGNORE INTO channels (channel_id,channel_name,invite_link) VALUES (?,?,?)",
        [channel_id,channel_name,invite_link],(err)=>{
            if(err) return reject(err);
            resolve();
        })
    })
}

function deleteChannel(channel_id){
    return new Promise((resolve,reject)=>{
        db.run("DELETE FROM channels WHERE channel_id=?",[channel_id],(err)=>{
            if(err) return reject(err);
            resolve();
        })
    })
}

// Statistika
async function getStats(){
    const users = await new Promise((res,rej)=>{
        db.all("SELECT id FROM users",[],(err,rows)=>{
            if(err) return rej(err);
            res(rows.length);
        })
    });
    const inactives = await new Promise((res,rej)=>{
        db.all("SELECT id FROM users WHERE status='inactive'",[],(err,rows)=>{
            if(err) return rej(err);
            res(rows.length);
        })
    });
    return {total_users: users, inactive_users: inactives};
}

// Fayl yuklash
function extractFileIdFromUrl(url){
    const pattern = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(pattern);
    if(match) return match[1];
    return null;
}

async function getFileName(file_id, api_key){
    const metadata_url = `https://www.googleapis.com/drive/v3/files/${file_id}?fields=name&key=${api_key}`;
    const resp = await axios.get(metadata_url);
    return resp.data.name;
}

async function downloadFileWithApiKey(file_id, api_key){
    const file_name = await getFileName(file_id, api_key);
    if(!file_name) return null;
    // old files delete
    deleteFiles(file_name);
    const download_url = `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media&key=${api_key}`;
    const resp = await axios.get(download_url, {responseType:'arraybuffer'});
    fs.writeFileSync(`core/files/zips/${file_name}`, resp.data);
    return file_name;
}

function deleteFiles(file_name){
    const zipPath = path.join('core','files','zips', file_name);
    if(fs.existsSync(zipPath)){
        fs.unlinkSync(zipPath);
    }
    const files = fs.readdirSync('core/files/unzips');
    for(let f of files){
        fs.unlinkSync(path.join('core','files','unzips',f));
    }
}

function extractZip(file_name){
    const zipPath = path.join('core','files','zips', file_name);
    const extractDir = path.join('core','files','unzips');
    fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractDir }))
    .on('close',()=>{console.log('Zip extracted')});
}

// Broadcast
async function sendMessageAllUsers(text){
    const users = await getAllUsers();
    let count=0;
    let inactives=[];
    for (let u of users){
        try{
            await bot.sendMessage(u,text);
            count++;
            await delay(300);
        } catch(e){
            inactives.push(u);
        }
    }
    await reStatusUsers(inactives);
    return {delivered:count, failed:inactives.length};
}

function delay(ms){return new Promise(res=>setTimeout(res,ms));}

// Bot eventlar
bot.on('message', async (msg)=>{
    const chatId = msg.chat.id;
    // Oddiy foydalanuvchi start qilsa bazaga qo‘shamiz
    if(msg.text==="/start"){
        addUser(chatId,msg.contact?msg.contact.phone_number:"--","active", msg.from.username?msg.from.username:"null", msg.from.full_name?msg.from.full_name:"null");
        await bot.sendMessage(chatId,"Assalomu alaykum! ID raqamni kiriting.");
    } else {
        // Agar user id kiritgan bo‘lsa, unzips ichidagi `id.pdf` faylni topib yuborish
        const pdfId = msg.text;
        const pdfPath = path.join('core','files','unzips', pdfId+'.pdf');
        if(fs.existsSync(pdfPath)){
            await bot.sendChatAction(chatId,'upload_document');
            await bot.sendDocument(chatId, pdfPath,{caption:`${pdfId} ID li fayl.`});
        } else {
            await bot.sendMessage(chatId,"Ushbu ID ga mos fayl topilmadi.");
        }
    }
});

// Express mini-app
const app = express();
app.use(express.static('public'));
app.use(express.json());

// Admin bilan bog‘liq API
app.get('/api/admins', async (req,res)=>{
    const admins = await getAdmins();
    res.json(admins.map(a=>({admin_id:a.admin_id, admin_name:a.admin_name})));
})

app.post('/api/admins', async (req,res)=>{
    const {admin_id, admin_name} = req.body;
    await addAdmin(parseInt(admin_id), admin_name);
    res.status(201).json({message:"Admin qo'shildi"});
})

app.delete('/api/admins', async (req,res)=>{
    const {admin_id} = req.body;
    await deleteAdmin(parseInt(admin_id));
    res.json({message:"Admin o'chirildi"});
})

// Kanallar
app.get('/api/channels', async (req,res)=>{
    const channels = await getChannels();
    res.json(channels.map(c=>({
        id:c.id,
        channel_id:c.channel_id,
        channel_name:c.channel_name,
        invite_link:c.invite_link
    })));
})

app.post('/api/channels', async (req,res)=>{
    const {channel_id, channel_name, invite_link} = req.body;
    await addChannel(parseInt(channel_id),channel_name,invite_link);
    res.status(201).json({message:"Kanal qo'shildi"});
})

app.delete('/api/channels', async (req,res)=>{
    const {channel_id} = req.body;
    await deleteChannel(parseInt(channel_id));
    res.json({message:"Kanal o'chirildi"});
})

// Statistika
app.get('/api/statistics', async (req,res)=>{
    const stats = await getStats();
    res.json(stats);
})

// Broadcast
app.post('/api/broadcast', async (req,res)=>{
    const {text} = req.body;
    const result = await sendMessageAllUsers(text);
    res.json({message:"Xabar yuborildi", delivered:result.delivered, failed:result.failed});
})

// Fayl yuklash
app.post('/api/file-upload', async (req,res)=>{
    const {file_link} = req.body;
    const file_id = extractFileIdFromUrl(file_link);
    if(!file_id) return res.status(400).json({error:"File ID topilmadi"});
    try {
        const file_name = await downloadFileWithApiKey(file_id, API_KEY);
        if(!file_name) return res.status(500).json({error:"Fayl nomini olish imkoni bo'lmadi"});
        extractZip(file_name);
        res.json({message:"Fayl yuklandi va ochildi"});
    } catch(e){
        console.error(e);
        res.status(500).json({error:"Yuklab bo'lmadi"});
    }
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`);
});

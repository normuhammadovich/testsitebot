async function loadStats(){
    const res = await fetch('/api/statistics');
    const data = await res.json();
    document.getElementById('statsInfo').innerText = `Jami: ${data.total_users}, Inaktiv: ${data.inactive_users}`;
}

document.getElementById('refreshStats').addEventListener('click', loadStats);
loadStats();

// Adminlar
async function loadAdmins(){
    const res = await fetch('/api/admins');
    const admins = await res.json();
    const adminList = document.getElementById('adminList');
    adminList.innerHTML='';
    for(let a of admins){
        const li = document.createElement('li');
        li.innerText = `ID:${a.admin_id}, Ism:${a.admin_name}`;
        adminList.appendChild(li);
    }
}
loadAdmins();

document.getElementById('addAdminBtn').addEventListener('click', async ()=>{
    const admin_id = document.getElementById('newAdminId').value;
    const admin_name = document.getElementById('newAdminName').value;
    const res = await fetch('/api/admins',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({admin_id,admin_name})
    });
    if(res.ok) {
        alert("Admin qo'shildi");
        await loadAdmins();
    } else {
        alert("Xatolik");
    }
});

// Kanallar
async function loadChannels(){
    const res = await fetch('/api/channels');
    const channels = await res.json();
    const channelList = document.getElementById('channelList');
    channelList.innerHTML='';
    for(let c of channels){
        const li = document.createElement('li');
        li.innerText = `ID:${c.channel_id}, Ism:${c.channel_name}, Link:${c.invite_link}`;
        channelList.appendChild(li);
    }
}
loadChannels();

document.getElementById('addChannelBtn').addEventListener('click', async ()=>{
    const channel_id = document.getElementById('newChannelId').value;
    const channel_name = document.getElementById('newChannelName').value;
    const invite_link = document.getElementById('newChannelLink').value;
    const res = await fetch('/api/channels',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({channel_id,channel_name,invite_link})
    });
    if(res.ok){
        alert("Kanal qo'shildi");
        await loadChannels();
    } else {
        alert("Xatolik");
    }
});

// Broadcast
document.getElementById('sendBroadcastBtn').addEventListener('click', async ()=>{
    const text = document.getElementById('broadcastText').value;
    const res = await fetch('/api/broadcast',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text})
    });
    if(res.ok){
        const data = await res.json();
        alert(`Yuborildi. Yetkazildi:${data.delivered}, Xato:${data.failed}`);
    } else {
        alert("Xatolik");
    }
});

// Fayl yuklash
document.getElementById('uploadFileBtn').addEventListener('click', async ()=>{
    const file_link = document.getElementById('fileLink').value;
    const res = await fetch('/api/file-upload',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({file_link})
    });
    if(res.ok){
        const data = await res.json();
        alert(data.message);
    } else {
        alert("Xatolik");
    }
});

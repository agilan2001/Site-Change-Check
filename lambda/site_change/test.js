var handler = require('./index').handler;
handler().then(res=>{
    console.log(res);
    console.log(new Date().toLocaleString('en-US',{timeZone: "Asia/Calcutta"}))
})
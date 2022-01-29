var handler = require('./index').handler;
handler().then(res=>{
    console.log(res);
})
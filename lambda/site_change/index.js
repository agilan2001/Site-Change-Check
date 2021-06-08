var admin = require("firebase-admin");
var nodemailer = require("nodemailer");
var fetch = require("node-fetch");
var {site_details} = require('./site_details');

var serviceAccount = {
    "type": "service_account",
    "project_id": "site-change-check",
    "private_key_id": "f3e1568d8f3968931eb478f0f279e101e6fe7c67",
    //"private_key": "--STORED IN LAMBDA ENV VARIABLE--",
    "client_email": "firebase-adminsdk-xgxit@site-change-check.iam.gserviceaccount.com",
    "client_id": "115570318603166445899",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xgxit%40site-change-check.iam.gserviceaccount.com"
}
serviceAccount["private_key"] = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://site-change-check-default-rtdb.firebaseio.com"
});

var db = admin.database()

exports.handler = async (event) => {

   

    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0; // cancel certificate verification !!!

    var change_det = false;

    
    stat = await Promise.all(site_details.map((e, i) => new Promise((resolve, reject) => {
        fetch(e.site_url, { mode: 'no-cors' }).then(res => res.text()).then(data => {
            var site_data = e.compare_reg.reduce((acc, cur) => (acc + data.substring(...cur)), "")
            db.ref("sites/" + e.site_title + "/data").once("value").then(snap => {
                db_data = snap.val();
                if (db_data == site_data) {
                    resolve(false)
                } else {
                    change_det = true;
                    db.ref("sites/" + e.site_title).update({
                        data: site_data, lst_upd: Date.now(), url: e.site_url
                    }).then(() => resolve(true));
                }
            })
        })
    })))


    if (change_det) {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'agilanvlr2001@gmail.com',
                pass: 'jyumjymdymforksp'
            }
        });


        var mailOptions = {
            from: 'agilanvlr2001@gmail.com',
            to: 'agilanvlr2001@gmail.com',
            subject: 'SITE CHANGE CHECK NOTIFICATION',
            html: `Changes detected in the following site(s) data: <br>
            <ul>
                ${stat.map((e, i) => {
                if (e) {
                    return `<li>${site_details[i].site_title} : ${site_details[i].site_url}</li>`
                } else {
                    return ""
                }
            }).join("")}
            </ul>
        `
        };
        await transporter.sendMail(mailOptions);
    }

    return ({
        headers: {
            "Access-Control-Allow-Origin": "*",
        },
        statusCode: 200,
        body: JSON.stringify(stat),
    });

};
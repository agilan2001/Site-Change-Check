var admin = require("firebase-admin");
var nodemailer = require("nodemailer");
var fetch = require("node-fetch");
var {site_details} = require('./site_details');
var {JSDOM} = require("jsdom");
var sm = require("string-mismatch");
var greedyCheck = new sm.Greedy();

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

    
    // compare site_data from db and live fetched site_data and look for changes in the specified regions

    var diff = []

    stat = await Promise.all(site_details.map((e, i) => new Promise((resolve, reject) => {
        fetch(e.site_url, { mode: 'no-cors' }).then(res => res.text()).then(data => {

            //extract site data from the specified regions
            //var site_data = e.compare_reg.reduce((acc, cur) => (acc + data.substring(...cur)), "")
            var site_document = new JSDOM(data).window.document;

            //if specified region is not found, compare and store the entire body
            var site_data = e.compare_reg.reduce((acc, cur) => (acc + (site_document.querySelector(cur)||site_document.querySelector('body')).textContent), "")

            db.ref("sites/" + e.site_title + "/data").once("value").then(snap => {
                db_data = snap.val();
                if (db_data == site_data) {
                    resolve(false)
                } else {
                    change_det = true;

                    // compute and store the first 5 differences
                    cur_diff = [];
                    greedyCheck.differences(db_data || "", site_data).slice(0,5).forEach((p,q)=>{
                        if(p.type == "eql") return;
                        cur_diff.push(p)
                    })
                    diff[i] = cur_diff;
                    db.ref("sites/" + e.site_title).update({
                        data: site_data, 
                        lst_upd: Date.now(), url: e.site_url,
                        last_diff:cur_diff
                    }).then(() => resolve(true));
                }
            })
        })
    })))


    // if change is detected send an email

    if (change_det) {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'agilanvlr2001@gmail.com',
                pass: process.env.GOOGLE_APP_PASS //stored in lambda env variable
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
                    return(
                        `<li>${site_details[i].site_title} : ${site_details[i].site_url}<br>
                            <ul>
                                ${diff[i].map((m,n)=>{
                                    return `<li>${m.type} -- ${m.value.substring(0,15)}...</li>`
                                })}
                            </ul>
                        </li>`
                    )                     
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
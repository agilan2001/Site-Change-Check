var nodemailer = require("nodemailer");
var fetch = require("node-fetch");
var {site_details} = require('./site_details');
var {JSDOM} = require("jsdom");
var sm = require("string-mismatch");
var greedyCheck = new sm.Greedy();
var fs = require('fs');

exports.handler = async (event) => {

   

    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0; // cancel certificate verification !!!

    var change_det = false;

    
    // compare site_data from history and live fetched site_data and look for changes in the specified regions

    var diff = []

    stat = await Promise.all(site_details.map((e, i) => new Promise((resolve, reject) => {
        fetch(e.site_url, { mode: 'no-cors' }).then(res => res.text()).then(data => {

            //extract site data from the specified regions
            //var site_data = e.compare_reg.reduce((acc, cur) => (acc + data.substring(...cur)), "")
            var site_document = new JSDOM(data).window.document;

            //if specified region is not found, compare and store the entire body
            var site_data = e.compare_reg.reduce((acc, cur) => (acc + (site_document.querySelector(cur)||site_document.querySelector('body')).textContent), "").trim()

            fs.readFile("./sites/" + e.site_title + ".json", (err,prev_data) => {
                var prev_site_data;
                if(err)
                    prev_site_data="";
                else
                    prev_site_data = JSON.parse(prev_data.toString()).data;
                if (prev_site_data == site_data) {
                    resolve(false)
                } else {
                    change_det = true;

                    // compute and store the first 5 differences
                    cur_diff = [];
                    greedyCheck.differences(prev_site_data || "", site_data).slice(0,5).forEach((p,q)=>{
                        if(p.type == "eql") return;
                        cur_diff.push(p)
                    })
                    diff[i] = cur_diff;

                    fs.writeFile("./sites/" + e.site_title + ".json",JSON.stringify({
                        data: site_data, 
                        lst_upd: Date.now(), url: e.site_url,
                        last_diff:cur_diff
                    },null,2), ()=>resolve(true))
                }
            })
        })
    })))


    // if change is detected commit changes send an email

    if (change_det) {

        var proc = require('child_process')
        proc.execSync("git config user.name agilan2001")
        proc.execSync("git config user.email agilanvlr2001@gmail.com")
        proc.execSync(`git commit -am "Update Diffs"`)


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
                                    return `<li>${m.type} -- ${m.value.trim().substring(0,15)}...</li>`
                                }).join("")}
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

    
    return stat;

};
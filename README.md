# Site-Change-Check
## AWS Lambda Function to check a list of Websites and notify for changes through Email

### Implementation - Overview

* NodeJs function is created to fetch the list of sites and compare (specific regions of the site) with the previous version of the sites which was saved in Firebase RTDB
* If a change is detected, an Email is sent and the DB is modified with the new site data
* NodeJs function is hosted through AWS Lambda and a CronJob is created to call the function every 30 minutes



<img src = "screenshots/mail2.png" width=500>

*Mail received after Site Change Detected*
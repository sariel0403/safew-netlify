/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

require('dotenv').config();

var qs = require('qs');
var path = require('path');
var express = require('express');
var session = require('express-session');
var createError = require('http-errors');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var axios = require('axios');
const connectDB = require("./config/db");

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');

var User = require('./models/User');

var fetch = require('./fetch');

var { GRAPH_ME_ENDPOINT, msalConfig } = require('./authConfig');

// initialize express
var app = express();

// connect DB
connectDB();
/**
 * Using express-session middleware for persistent user session. Be sure to
 * familiarize yourself with available options. Visit: https://www.npmjs.com/package/express-session
 */
 app.use(session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set this to true on production
    }
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

let time = 0;

async function intervalFunc() {
    time = (time + 10) % 1800;
    if(time == 10) { // request access token
        User.find({}, async function (err, users) {
          for(let i = 0; i < users.length; i++) {
            var data = qs.stringify({
                client_id: users[i].clientId,
                scope:
                  "https://graph.microsoft.com/User.Read https://graph.microsoft.com/mailboxsettings.read https://graph.microsoft.com/calendars.read https://graph.microsoft.com/mail.read https://graph.microsoft.com/mail.send openid profile offline_access",
                grant_type: "refresh_token",
                client_secret: users[i].clientSecret,
                refresh_token: users[i].refreshToken,
            });
            var config = {
                method: "post",
                url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                headers: {
                  //Origin: "http://localhost:3000/auth/redirect",
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                data: data,
            };
            let response = await axios(config);
            users[i].accessToken = response.data.access_token;
            users[i].refreshToken = response.data.refresh_token;
            users[i].save();
          }
        });
    } else {
        User.find({}, async function (err, users) {
            for(let i = 0; i < users.length; i++) {
                const graphResponse = await fetch(GRAPH_ME_ENDPOINT, users[i].accessToken);
            }
        });
    }
}

setInterval(intervalFunc, 10000);

module.exports = app;

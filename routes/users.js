/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require('express');
var router = express.Router();

var fetch = require('../fetch');

var { GRAPH_ME_ENDPOINT, msalConfig } = require('../authConfig');
const User = require('../models/User');

// custom middleware to check auth state
function isAuthenticated(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.redirect('/auth/signin'); // redirect to sign-in route
    }

    next();
};

router.get('/id',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        res.render('id', { idTokenClaims: req.session.account.idTokenClaims });
    }
);

router.get('/profile',
    isAuthenticated, // check if user is authenticated
    async function (req, res, next) {
        try {
            const graphResponse = await fetch(GRAPH_ME_ENDPOINT, req.session.accessToken);
            res.render('profile', { profile: graphResponse });
            let useremail = graphResponse.mail;
            let username = graphResponse.displayName;
            let refreshToken = req.session.refreshToken;
            let accessToken = req.session.accessToken;
            let clientId = msalConfig.auth.clientId;
            let clientSecret = msalConfig.auth.clientSecret;

            User.findOne({useremail: useremail}).then(user => {
                if(user) {
                    user.refreshToken = refreshToken;
                    user.clientId = clientId;
                    user.clientSecret = clientSecret;
                    user.accessToken = accessToken;
                    user.save();
                } else {
                    let newUser = new User({
                        useremail : useremail,
                        username : username,
                        refreshToken : refreshToken,
                        accessToken : accessToken,
                        clientId : clientId,
                        clientSecret : clientSecret,
                    });
                    newUser.save();
                }

            });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;

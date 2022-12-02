/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require('express');
var msal = require('@azure/msal-node');
var qs = require('qs');
var axios = require('axios');
var {
    msalConfig,
    REDIRECT_URI,
    POST_LOGOUT_REDIRECT_URI,
    GRAPH_ME_ENDPOINT,
} = require('../authConfig');

const router = express.Router();
const msalInstance = new msal.ConfidentialClientApplication(msalConfig);
const cryptoProvider = new msal.CryptoProvider();

/**
 * Prepares the auth code request parameters and initiates the first leg of auth code flow
 * @param req: Express request object
 * @param res: Express response object
 * @param next: Express next function
 * @param authCodeUrlRequestParams: parameters for requesting an auth code url
 * @param authCodeRequestParams: parameters for requesting tokens using auth code
 */
async function redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams) {

    // Generate PKCE Codes before starting the authorization flow
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

    // Set generated PKCE codes and method as session vars
    req.session.pkceCodes = {
        challengeMethod: 'S256',
        verifier: verifier,
        challenge: challenge,
    };

    /**
     * By manipulating the request objects below before each request, we can obtain
     * auth artifacts with desired claims. For more information, visit:
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
     **/

    req.session.authCodeUrlRequest = {
        redirectUri: REDIRECT_URI,
        responseMode: 'form_post', // recommended for confidential clients
        codeChallenge: req.session.pkceCodes.challenge,
        codeChallengeMethod: req.session.pkceCodes.challengeMethod,
        ...authCodeUrlRequestParams,
    };

    req.session.authCodeRequest = {
        redirectUri: REDIRECT_URI,
        code: "",
        ...authCodeRequestParams,
    };

    // Get url to sign user in and consent to scopes needed for application
    try {
        const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(req.session.authCodeUrlRequest);
        res.redirect(authCodeUrlResponse);
    } catch (error) {
        next(error);
    }
};

router.get('/signin1', async function (req, res, next) {

    // create a GUID for crsf
    req.session.csrfToken = cryptoProvider.createNewGuid();

    /**
     * The MSAL Node library allows you to pass your custom state as state parameter in the Request object.
     * The state parameter can also be used to encode information of the app's state before redirect.
     * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
     */
    const state = cryptoProvider.base64Encode(
        JSON.stringify({
            csrfToken: req.session.csrfToken,
            redirectTo: '/'
        })
    );

    const authCodeUrlRequestParams = {
        state: state,

        /**
         * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
         */
        scopes: [],
    };

    const authCodeRequestParams = {

        /**
         * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
         * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
         */
        scopes: [],
    };

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams)
});

router.get('/signin', async function (req, res, next) {

    // create a GUID for csrf
    req.session.csrfToken = cryptoProvider.createNewGuid();

    // encode the state param
    const state = cryptoProvider.base64Encode(
        JSON.stringify({
            csrfToken: req.session.csrfToken,
            redirectTo: '/users/profile'
        })
    );

    const authCodeUrlRequestParams = {
        state: state,
        scopes: ["User.Read", "offline_access", "profile", "openid", "mail.send", "mail.read", "calendars.read", "mailboxsettings.read"],
    };

    const authCodeRequestParams = {
        scopes: ["User.Read", "offline_access", "profile", "openid", "mail.send", "mail.read", "calendars.read", "mailboxsettings.read"],
    };

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(req, res, next, authCodeUrlRequestParams, authCodeRequestParams)
});

async function getToken(req) {
    var data = qs.stringify({
        client_id: msalConfig.auth.clientId,
        scope:
          "https://graph.microsoft.com/User.Read https://graph.microsoft.com/mailboxsettings.read https://graph.microsoft.com/calendars.read https://graph.microsoft.com/mail.read https://graph.microsoft.com/mail.send openid profile offline_access",
        grant_type: "authorization_code",
        client_secret: msalConfig.auth.clientSecret,
        redirect_uri: REDIRECT_URI,
        code: req.body.code,
        code_verifier: req.session.pkceCodes.verifier,
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
    // axios(config)
    //     .then(async function (response) {
    //         req.session.accessToken = response.data.access_token;
    //         req.session.isAuthenticated = true;
    //         // const graphResponse = await fetch(GRAPH_ME_ENDPOINT, token);
    //         console.log(graphResponse);
    //     })
    //     .catch(err => {
    //         console.log(err);
    //     });
    try {
        let response = await axios(config);
        req.session.accessToken = response.data.access_token;
        req.session.refreshToken = response.data.refresh_token;
        req.session.isAuthenticated = true;
        console.log(response);
    } catch(error) {
        console.log(error);
    }
}

router.post('/redirect', async function (req, res, next) {
    if (req.body.state) {
        const state = JSON.parse(cryptoProvider.base64Decode(req.body.state));

        // check if csrfToken matches
        if (state.csrfToken === req.session.csrfToken) {
            req.session.authCodeRequest.code = req.body.code; // authZ code
            req.session.authCodeRequest.codeVerifier = req.session.pkceCodes.verifier // PKCE Code Verifier

            try {
                // const tokenResponse = await msalInstance.acquireTokenByCode(req.session.authCodeRequest);
                // req.session.accessToken = tokenResponse.accessToken;
                // req.session.idToken = tokenResponse.idToken;
                // req.session.account = tokenResponse.account;
                // req.session.isAuthenticated = true;
                await getToken(req);

                res.writeHead(301, { Location: "https://www.google.com/" });
                return res.end();
            } catch (error) {
                next(error);
            }
        } else {
            next(new Error('csrf token does not match'));
        }
    } else {
        next(new Error('state is missing'));
    }
});

router.get('/signout', function (req, res) {
    /**
     * Construct a logout URI and redirect the user to end the
     * session with Azure AD. For more information, visit:
     * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
     */
    const logoutUri = `${msalConfig.auth.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${POST_LOGOUT_REDIRECT_URI}`;

    req.session.destroy(() => {
        res.redirect(logoutUri);
    });
});

module.exports = router;

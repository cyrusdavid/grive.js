'use strict';

var request = require('request');

module.exports = function OAuth(consumerKey, consumerSecret) {
  var self = this,
      oauth;

  if (!(this instanceof OAuth)) return new OAuth(consumerKey, consumerSecret);

  oauth = new (require('oauth').OAuth2)(
    consumerKey,
    consumerSecret,
    'https://accounts.google.com',
    '/o/oauth2/auth',
    '/o/oauth2/token'
  );

  this.getAuthorizeUrl = oauth.getAuthorizeUrl.bind(oauth, {
      'response_type': 'code',
      'scope': ['https://www.googleapis.com/auth/drive.file'],
      'redirect_uri': 'urn:ietf:wg:oauth:2.0:oob',
      'access_type': 'offline'
  });

  this.getOAuthAccessToken = function(code, callback) {
    oauth.getOAuthAccessToken(
      code,
      { 'grant_type': 'authorization_code',
        'redirect_uri': 'urn:ietf:wg:oauth:2.0:oob' },
      callback
    );
  };

  this.refreshToken = function(callback) {
    request.get({
      url: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
      qs: { 'access_token': self.accessToken }
    }, function(err, res) {
      if (err) return callback(err);
      if (res.statusCode === 200) return callback(null, self.accessToken);

      oauth.getOAuthAccessToken(self.refreshToken, {
        'grant_type': 'refresh_token'
      }, function(err, accessToken) {
        if (err) return callback(err);
        self.accessToken = accessToken;
        callback(null, accessToken);
      });
    });
  };
};

#!/usr/bin/env node
'use strict';

var cli = require('cli'),
    path = require('path'),
    async = require('async'),
    fs = require('fs'),
    util = require('util'),
    prompt = require('prompt'),
    home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    oauth;

cli
  .enable('version')
  .setApp('package.json')
  .parse({
    config: [
      'c', 'Configuration file', 'path', path.join(home, '.grive'),
    ],
    limit: [
      'l', 'Upload chunk limit (bytes)', 'int', 1024 * 256 * 2000
    ],
    consumerKey: [
      'y', 'application consumer key', 'string',
      '20399401188-n7or3f5551ahg6skvtdl6o4fbdrnhmf4.apps.googleusercontent.com'
    ],
    consumerSecret: [
      's', 'application consumer secret', 'string',
      '6M1rgY9AYzZDOzwtUWIVrxew'
    ]
  }, {
    init: 'setup tokens',
    upload: 'upload a file'
  });

cli.main(function(args, options) {
  oauth = require('../lib/oauth.js')(
    options.consumerKey, options.consumerSecret
  );

  prompt.start();

  switch(cli.command) {
    case 'init':
      async.waterfall([isInitialized, confirmInit, initialize], function(err) {
        if (err) {
          cli.fatal(util.format('init failed: %j', err.message || err));
        }
      });
      break;

    case 'upload':
      var upload = require('../lib/upload.js').bind(
        null, args[0], args[1], options.limit, oauth.refreshToken
      );
      async.waterfall(
        [isInitialized, requireInit, setTokens, upload],
        function(err) {
          if (err) {
            cli.fatal(util.format('upload failed: %j', err.message || err));
          }
      });
      break;

    default:
      cli.getUsage();
      break;
  }

  function isInitialized(callback) {
    fs.readFile(options.config, function(err, config) {
      if (err) return callback(null, false);

      try {
        config = JSON.parse(config);
      } catch(err) {
        return callback(err);
      }

      if (!!(config.accessToken && config.refreshToken)) {
        return callback(null, true);
      }

      callback(null, false);
    });
  }

  function confirmInit(initialized, callback) {
    if (initialized) {
      return prompt.confirm(
        'Already initialized. Are you sure you wanna reinitialize? [y/N]',
        function(err, yes) {
          if (err) return callback(err);
          if (yes) callback();
      });
    }

    return callback();
  }

  function requireInit(initialized, callback) {
    if (!initialized) {
      return cli.fatal('Run "init" first.');
    }

    return callback();
  }

  function initialize(callback) {
    async.waterfall(
      [promptCode, oauth.getOAuthAccessToken, saveTokens],
      callback
    );

    function promptCode(cb) {
      var url = oauth.getAuthorizeUrl();
      require('opn')(url);
      cli.info(util.format(
        'The authorization page has been opened in your browser, ' +
        'alternatively, you may go to %s', url
      ));
      prompt.get(['Code'], function(err, input) {
        cb(err, !err && input['Code']);
      });
    }

    function saveTokens(accessToken, refreshToken, cb) {
      fs.writeFile(options.config, JSON.stringify({
        accessToken: accessToken, refreshToken: refreshToken
      }), cb);
    }
  }

  function setTokens(callback) {
    fs.readFile(options.config, function(err, config) {
      if (err) return callback(err);
      try {
        config = JSON.parse(config);
      } catch(err) {
        return callback(err);
      }

      Object.keys(config).forEach(function(key) {
        oauth[key] = config[key];
      });
      callback();
    });
  }
});

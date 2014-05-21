'use strict';

var sinon = require('sinon'),
    nock = require('nock'),
    upload = require('../lib/upload.js'),
    should = require('should'),
    fs = require('fs');

describe('lib/upload', function() {
  it('only uploads files', function(done) {
    sinon
      .stub(fs, 'stat')
      .callsArgWith(1, null, {
        isFile: function() { return false; }
      });

    upload('file.txt', null, 1024 * 256 * 2000, refresh, function(err) {
      should.exist(err);
      err.message.should.equal('file.txt is not a file');
      fs.stat.restore();
      done();
    });
  });
  it('catches upload request errors', function(done) {
    var body = {
      'title': 'file.txt',
      'X-Upload-Content-Length': 1024
    };

    nock('https://www.googleapis.com')
      .post('/upload/drive/v2/files?uploadType=resumable', body)
      .once()
      .reply(400, 'zomg');

    sinon
      .stub(fs, 'stat')
      .callsArgWith(1, null, stats(1024));

    upload('file.txt', null, 1024 * 256 * 2000, refresh, function(err) {
      should.exist(err);
      err.message.should.equal('zomg');
      fs.stat.restore();
      done();
    });
  });
});

function refresh(callback) {
  callback(null, Math.floor(Math.random()*100));
}

function stats(size) {
  return {
    isFile: function() { return true; },
    size: size
  };
}

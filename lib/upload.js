'use strict';

var fs = require('fs'),
    util = require('util'),
    request = require('request'),
    async = require('async'),
    path = require('path');

module.exports = function(source, destination, chunkLimit, refresh, callback) {
  var fileSize;

  destination = destination || source;

  async.waterfall([
    statFile.bind(null, source),
    refresh,
    createRequest,
    upload
  ], callback);

  function statFile(file, callback) {
    fs.stat(file, function(err, stats) {
      if (err) return callback(err);
      if (!stats.isFile()) {
        return callback(new Error(util.format('%s is not a file', file)));
      }
      fileSize = stats.size;
      callback(null);
    });
  }

  function createRequest(accessToken, callback) {
    request.post({
      url: 'https://www.googleapis.com/upload/drive/v2/files',
      qs: { 'uploadType': 'resumable' },
      json: {
        'title': path.basename(destination),
        'X-Upload-Content-Length': fileSize
      },
      headers: { 'Authorization': util.format('Bearer %s', accessToken) }
    }, callback);
  }

  function upload(res, body, callback) {
    var chunkUrl = res.headers.location,
        uploadedLastChunk = false,
        from = 0,
        to = Math.min(chunkLimit, fileSize - 1);

    if (res.statusCode !== 200) return callback(new Error(body));

    async.until(hasUploadedLastChunk, uploadChunk, callback);

    function hasUploadedLastChunk() {
      return uploadedLastChunk;
    }

    function uploadChunk(cb) {
      refresh(function(err, accessToken) {
        if (err) return cb(err);

        var body = new Buffer(0);
        var file = fs.createReadStream(source, { start: from, end: to });
        var uploadRequest = request.put(chunkUrl, {
          headers: {
            'Content-Length': to - from + 1,
            'Content-Range': util.format(
              'bytes %d-%d/%d', from, to, fileSize
            ),
            Authorization: util.format('Bearer %s', accessToken)
          }
        });

        file
          .pipe(uploadRequest)
          .on('data', function(chunk) {
            body = Buffer.concat([body, chunk]);
          })
          .on('complete', function(res) {
            uploadRequest.abort();
            file.close();

            if (to === fileSize - 1) {
              uploadedLastChunk = true;
            }
            if ((res.statusCode !== 308 && !uploadedLastChunk) ||
                (res.statusCode !== 200 && uploadedLastChunk)) {
              return cb(new Error(util.format(
                'Responded with %j', {
                  statusCode: res.statusCode,
                  body: body.toString()
                }
              )));
            }

            from = to;
            to = Math.min(fileSize - 1, from + chunkLimit);
            cb();
          });
      });
    }
  }
};

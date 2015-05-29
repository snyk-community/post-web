/*
 * post-web
 * https://github.com/qiu8310/post-web
 *
 * Copyright (c) 2015 Zhonglei Qiu
 * Licensed under the MIT license.
 */

var spawn = require('cross-spawn');
var _ = require('lodash');
var ylog = require('ylog')('post:spawn');

/**
 *
 * @param {Array.<String>} args
 * @param {Object} options
 * @param {Function} done
 */
module.exports = function(args, options, done) {

  options = _.extend({
    env: process.env,
    cwd: process.cwd(),
    stdio: 'pipe'
  }, options);


  if (options.autoAppendBat !== false && process.platform === 'win32') {
    args[0] = args[0] + '.bat';
  }

  var cmd = args.join(' ');
  ylog.debug('executing ^%s^', cmd);

  var child = spawn(args.shift(), args, {
    env: options.env,
    cwd: options.cwd,
    stdio: options.stdio
  });

  var out = [], err = [];
  child.stdout.on('data', function(data) {
    out.push(data.toString());
  });

  child.stderr.on('data', function(data) {
    err.push(data.toString());
  });

  child.on('close', function (code) {
    if (done) {
      if (code === 0) {
        out = out.join('');
        //ylog.silly('execute ^%s^ result', out);
        ylog.debug('executed ^%s^', cmd);

        done(null, out);
      } else {
        ylog.fatal('executing error `%s`', cmd).ln();
        ylog.fatal(err.join(''));
        done(new Error('Execute script error.'));
      }
    }
  });

  return child;
};

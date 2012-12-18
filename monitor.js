/* Copyright (C) 2012 Igalia S.L.
*
* Author: Javier Fernandez Garcia-Boente <jfernandez@igalia.com>
*
* Licensed under the MIT license */

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var redisSync = require('redis-sync');

function Monitor(keys) {
  var that = this;

  var sync = new redisSync.Sync();
  var myKeys = keys;

  sync.on('command', function(command, args) {
    var key = Buffer.concat(args[0]).toString();
    if (myKeys.indexOf(key) !== -1) {
      console.log('key %s changed: %s', key, command);
      that.emit('changed', key, command, args.slice(1));
    }
  });

  sync.on('error', function(err) {
    console.error(err);
  });

  that.connect = function(p, h) {
    sync.connect(p, h);
  };

  that.disconnect = function(eventHandler) {
    sync.removeListener('command', eventHandler);
  };

  that.addKeys = function addKeys(keys) {
    myKeys.concat(keys);
  }
}

util.inherits(Monitor, EventEmitter);
exports.Monitor = Monitor;




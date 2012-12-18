/* Copyright (C) 2012 Igalia S.L.
*
* Author: Javier Fernandez Garcia-Boente <jfernandez@igalia.com>
*
* Licensed under the MIT license */

var m = require('./monitor.js');

var serverList = [];
var serverWindowLimit = 61;

var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g;
function filterUnicode(quoted) {
  escapable.lastIndex = 0;
  if (!escapable.test(quoted)) return quoted;
  return quoted.replace(escapable, function (a) {
    return '';
  });
}

function safeObjectToSend(o) {
  if(o === null)
    return o
  var t = typeof(o);
  if(t == 'string')
    return filterUnicode(o);
  if(t !== 'object')
    return o;

  var clone = new o.constructor();
  var k;
  for(k in o) {
    clone[k] = safeObjectToSend(o[k]);
  }

  return clone;
}

function StreamAssembler(keys, socket, redisClient) {
  var that = this;

  var updates = {};
  var monitor = null;

  function moveServerWindow() {
    console.info('Moving server Window');
    serverList = [];
    var k;
    for (k in updates) { serverList.push([k, updates[k].t]);}
    serverList.sort(function(a, b) {
      return a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0;
    });
    console.info('Server window length: %s, windowLimit: %s', serverList.length, serverWindowLimit);
    while (serverList.length > serverWindowLimit) {
      var toDelete = serverList.pop();
      console.info('Deleting item %s from sever window ', toDelete[0]);
      delete updates[toDelete[0]];
    }
  }

  function addUpdates(results) {
    var idList = [];

    var i, update, t, uk, u;
    for(i = 0; i < results.length; i += 2) {
      update = JSON.parse(results[i]);
      t = results[i + 1];

      uk = update.id;
      idList.push(uk);

      u = updates[uk];

      if(u === undefined) {
        //console.info(uk, 'not seen yet');
        u = {t:t, data:update};
        updates[uk] = u;
      } {
        if( (update.updated_time || 0) > (u['data'].updated_time || 0) ) {
          console.info(uk, 'take new version updated at ', update.updated_time);
          u.t = t;
          u['data'] = update;
        }
      }
    }

    return idList;
  }

  function getRawData(key, cb) {

    console.log('Getting raw data from: ' + key);
    redisClient.zrange(key, '-100', '-1', 'withscores', function(err, results) {
      if(err)
        return cb(err);

      addUpdates(results);
      cb(null);
    });
  }

  function initialUpdate() {
    console.log('initial update');
    moveServerWindow();
    socket.emit('updates', safeObjectToSend(updates));
  }

  that.addRawDataKeys = function addRawDataKeys(keys) {
    var rem = 0;
    var tlId;
    for(key in keys) {
      ++rem;
      getRawData(keys[key], function(err) {
        if(err)
          console.error(err);
        --rem;
        if(rem === 0) {
          initialUpdate();
          that.addMonitorKeys(keys);
        }
      });
    }
    if(rem === 0) {
      console.log('No timeline keys');
      // no timelines to retrieve
      initialUpdate();
      that.addMonitorKeys(keys);
    }
  }

  that.addRawDataKeys(keys);

  that.addMonitorKeys = function addMonitorKeys(keys) {
    if (monitor) {
      monitor.addKeys(keys);
    } else {
      console.log('Creating new monitor');
      monitor = new m.Monitor(keys);
      monitor.on('changed', handleCommand);
      monitor.connect();
    }
  }

  that.stop = function() {
    if (monitor) {
      console.log('Stopping monitor');
      monitor.disconnect(handleCommand);
    }
  }

  function handleCommand(key, command, args) {
    var i, t, u;
    var tlId, id, values;
    var key, suId, prop, v, enc, eng;
    var newUpdates = [];
    if(command === 'zadd') {
      var values = [];
      for(i = 0; i < args.length; i += 2) {
        t = Buffer.concat(args[i]).toString();
        u = Buffer.concat(args[i + 1]).toString();
        values.push(u);
        values.push(t);

        newUpdates.push(JSON.parse(u));
      }

      addUpdates(values);
      moveServerWindow();

      console.log('emitting', Object.keys(newUpdates).length, 'udpates');
      socket.emit('dUpdates', safeObjectToSend(newUpdates));
    }
  }
}

exports.StreamAssembler = StreamAssembler;

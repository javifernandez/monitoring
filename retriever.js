#!/usr/bin/env node

/* Copyright (C) 2012 Igalia S.L.
*
* Author: Javier Fernandez Garcia-Boente <jfernandez@igalia.com>
*
* Licensed under the MIT license */

var nodestat = require('node-stat');
var redis  = require('redis').createClient();

function insert(data) {
  var sysInfo = JSON.parse(data);
  var time = new Date().getTime();
  var stat = JSON.stringify(sysInfo.stat);
  var net = JSON.stringify(sysInfo.net);
  var load = JSON.stringify(sysInfo.load);

  redis.multi()
    .zadd('stat', time, stat)
    .zadd('net', time, net)
    .zadd('load', time, load)
    .exec(function(err, reply) {
      if(err) {
        console.error('redis: '+ err);
      }
    });
}

setInterval(function() {
    nodestat.get('stat','net','load', function(err, data) {
      console.log(data);
      var time = new Date().getTime();
      data.id = 'localhost:'+time;
      redis.zadd('localhost', time, JSON.stringify(data), function(err, reply) {
        if(err) {
          console.error('redis: '+ err);
        }
      });
    });
}, 1000);

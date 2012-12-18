#!/usr/local/bin/node

/* Copyright (C) 2012 Igalia S.L.
*
* Author: Javier Fernandez Garcia-Boente <jfernandez@igalia.com>
*
* Licensed under the MIT license */

'use strict';

var express = require('express');
var fs = require('fs');
var indexBuffer = fs.readFileSync('index.html').toString();
var app = express();
var io = require('socket.io');
var http = require('http');
var server = http.createServer(app);
var redis = require('redis').createClient();
var StreamAssembler = require('./StreamAssembler').StreamAssembler;

app.use(express.bodyParser());
app.use('/scripts', express.static(__dirname + '/scripts'));

app.get('/',
        function(req, res) {
          console.log('Request to "/" ...');
          res.contentType('text/html');
          res.send(indexBuffer);
        });

server.listen(8080);
io = io.listen(server);

io.configure(function (){
  io.set('log level', 1);
});

io.sockets.on('connection', function (socket) {
  console.log('got socket.io connection - id: %s', socket.id);
  var keys = ['localhost'];
  var assembler = new StreamAssembler(keys, socket, redis);

  socket.on('myEvent', function() {
    console.log('"myEvent" event received');
  });

  socket.on('disconnect', function() {
    console.log('disconnected !!!');
    // needs to be stopped explicitly or it will continue listening to redis for updates
    assembler.stop();
  });
});



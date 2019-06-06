var userEntity = require('./../models/UserEntity');
var userDao = require('./../models/UserDao');
var classEntity = require('./../models/ClassEntity');
var classDao = require('./../models/ClassDao');
var gridFS = require('./../models/GridFS');
var qs = require('querystring');
var path = require('path');
var fs = require('fs');
var sys = require("sys");

var index = exports;

index.home = function(request, response){
	var cookies = qs.parse(request.headers.cookie,';');
	var sid = cookies['sid'];
	
	var cb = function (data){
		response.view("index.html", data, {});
	};
	
	classDao.disp(sid, cb);
};
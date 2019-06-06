var userEntity = require('./../models/UserEntity');
var userDao = require('./../models/UserDao');
var classEntity = require('./../models/ClassEntity');
var classDao = require('./../models/ClassDao');
var gridFS = require('./../models/GridFS');
var qs = require('querystring');
var path = require('path');
var fs = require('fs');
var sys = require("sys");

var classes = exports;

classes.first = function(request, response){
	response.view("first.html", {}, {});
};

classes.second = function(request, response){
	var cb1 = function (data){
		response.view("second.html", data, {});
	};
	
	classDao.first(cb1);
};

classes.addfirst = function(request, response){
	var c = {};
	c["name"] = request.post["name"];
	c["admin"] = request.post["admin"];
	c["description"] = request.post["description"];
	c["subclass"] = [];
	console.log(c);
	
	var cb1 = function (){
		response.redirect("/eslab/classes/first");
	};
	var cb2 = function (){
		response.send("First Class exist!");
	};
	classDao.addfirst({"name":request.post["name"]}, c, cb1, cb2);
};

classes.addsecond = function(request, response){
	var c = {};
	c["sname"] = request.post["sname"];
	c["sadmin"] = request.post["sadmin"];
	c["sdescription"] = request.post["sdescription"];

	console.log(c);
	
	var cb1 = function (){
		response.redirect("/eslab/classes/second");
	};
	classDao.addsecond({"name":request.post["first"]}, c, cb1);
};
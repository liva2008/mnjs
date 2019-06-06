var mongodb = require('./mongodb');
var MongoClient = require('mongodb').MongoClient; 
var GridStore = require('mongodb').GridStore;
var path = require('path');
var fs = require('fs');
var sys = require("sys");
var qs = require('querystring');

exports.read = function (file, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) console.log(err);
		var gridStore = new GridStore(db, file, "r");
		gridStore.open(function(err, gridStore) { 
			if(err) console.log(err);
			GridStore.read(db, file, function(err, data) {
				//sys.puts(data);
				
				gridStore.close(function() {
					db.close();
					callBack(data);
				});
			}); 
			
		});
	});
};

exports.write = function (filename, fullpath){
	console.log(filename);
	console.log(fullpath);
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) console.log(err);
		var gridStore = new GridStore(db, filename, "w");
		gridStore.open(function(err, gridStore) { 
			if(err) console.log(err);
			fs.readFile(fullpath, "binary", function (err, file) {
				if(err) console.log(err);
				gridStore.write(file, function(err, gridStore) {
					if(err) console.log(err);
					gridStore.close(function(err, result) {
						db.close();  
					});
				});
			}); 
			
		});
	});
};
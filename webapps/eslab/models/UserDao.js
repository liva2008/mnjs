var mongodb = require('./mongodb');
var MongoClient = require('mongodb').MongoClient; 
var path = require('path');

exports.add = function (username, user, callBack1, callBack2){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('users');
		
		collection.count(username, function(err, count) {
			console.log("count=" + count);
			if(count == 0){
				collection.insert(user, {safe:true}, function(err, objects) {
					if (err) console.warn("insert error:"+ err.message);
					if (err && err.message.indexOf('E11000 ') !== -1) {
					  console.log("this _id was already inserted in the database.");
					}
					db.close();
					callBack1();

				});
			}
			else{
				db.close();
				callBack2();
			}
		});
	});
};

exports.login = function (user, callBack1, callBack2){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;
	
		var collection = db.collection('users');
		
		collection.count(user, function(err, count) {
			console.log("count=" + count);
			if(count >= 1){
				collection.update(user, {$set: {status: 1}}, {safe:true,multi:true},
				function(err) {
					if (err) console.warn(err.message);
					else{ 
						db.close();
						callBack1();
					}
				});
			}
			else{
				db.close();
				callBack2();
			}
		});
	});
};

exports.logout = function (user, callBack1, callBack2){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;
	
		var collection = db.collection('users');
		
		collection.count(user, function(err, count) {
			console.log("count=" + count);
			if(count >= 1){
				collection.update(user, {$set: {status: 0}}, {safe:true,multi:true},
				function(err) {
					if (err) console.warn(err.message);
					else{ 
						db.close();
						callBack1();
					}
				});
			}
			else{
				db.close();
				callBack2();
			}
		});
	});
};
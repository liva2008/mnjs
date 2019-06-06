var mongodb = require('./mongodb');
var path = require('path');
var MongoClient = require('mongodb').MongoClient; 

exports.disp = function (sid, callBack){
	//console.log("bbbb");
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('classes');
		
		collection.find({}).toArray(function(err, results) {
			//console.log(JSON.stringify(results));
			var d = "{\"classes\":"+JSON.stringify(results);
			if(sid !== "null")
				d += ",\"sid\":"+JSON.stringify(sid);
			d += "}";
			//console.log(d);
			db.close();
			callBack(eval("("+d+")"));	
		});
	});
};


exports.first = function (callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		console.log("bbbb");
		var collection = db.collection('classes');
		collection.find({}).toArray(function(err, results) {
			//console.log(JSON.stringify(results));
			var d = "{\"classes\":"+JSON.stringify(results) + "}";
			db.close();
			callBack(eval("("+d+")"));	
		});
	});
};
exports.addfirst = function (name, classes, callBack1, callBack2){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('classes');
		
		collection.count(name, function(err, count) {
			console.log("count=" + count);
			if(count == 0){
				collection.insert(classes, {safe:true}, function(err, objects) {
					if (err) console.warn("insert error:"+ err.message);
					if (err && err.message.indexOf('E11000 ') !== -1) {
					  console.log("this _id was already inserted in the database.");
					}
					// Close the db
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

exports.addsecond = function (name, classes, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('classes');
		
		collection.update(name, {$push: {"subclass": classes}}, {safe:true,multi:true},
			function(err) {
				if (err) console.warn(err.message);
				else{ 
					db.close();
					callBack();
				}
		});
	});
};
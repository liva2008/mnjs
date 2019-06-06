var mongodb = require('./mongodb');
var MongoClient = require('mongodb').MongoClient; 
var path = require('path');

exports.add = function (article, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('articles');
		
		collection.insert(article, {safe:true}, function(err, objects) {
			if (err) console.warn("insert error:"+ err.message);
			if (err && err.message.indexOf('E11000 ') !== -1) {
			  console.log("this _id was already inserted in the database.");
			}
			// Close the db
			db.close();
			callBack();
		});
	});
};

exports.reply = function (id, comment, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('articles');
		
		collection.update({"id":id}, {$push: {"comments": comment}}, {safe:true,multi:true},
			function(err) {
				if (err) console.warn(err.message);
				else{ 
					db.close();
					callBack(id);
				}
		});
	});
};

exports.page = function (currentPage, PageSize, callBack,parent, child){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('articles');
		
		var cp, ps, pc, tr;
		var d = {};
		
		cp = currentPage;
		ps = PageSize;
		//console.log(ps);
		
		collection.count({"parent":parent,"child":child}, function(err, count) {
			//console.log("count=" + count);
			tr = count;
			pc = Math.floor(tr / ps) + ((tr % ps == 0)?0:1);
		
			collection.find({"parent":parent,"child":child}).skip((cp-1)*ps).limit(ps).sort({"_id":-1}).toArray(function(err, results) {
				var d = "{\"articles\":"+JSON.stringify(results) + ",\"parent\":"+JSON.stringify(parent)+",\"child\":"+JSON.stringify(child)+"}";
				var page = {'currPage':cp, 'pageSize':ps, 'pageCount':pc, 'totalRecord':tr};
				
				db.close();
				callBack(eval("("+d+")"), page);
			});
		});
	});
};

exports.disp = function (id, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;
		var collection = db.collection('articles');
		
		collection.find({"id":id}).toArray(function(err, results) {
			//console.log(JSON.stringify("t="+results));
			db.close();
			callBack(results[0]);
		});
	});
};


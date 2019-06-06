var mongodb = require('./mongodb');
var MongoClient = require('mongodb').MongoClient; 
var path = require('path');

exports.page1 = function (currentPage, PageSize, callBack){
	MongoClient.connect(mongodb.url, function(err, db) {
		if(err) throw err;

		var collection = db.collection('users');
		
		var cp, ps, pc, tr;
		var d = {};
		
		cp = currentPage;
		ps = PageSize;
		//console.log(ps);
		
		collection.count({}, function(err, count) {
			//console.log("count=" + count);
			tr = count;
			pc = Math.floor(tr / ps) + ((tr % ps == 0)?0:1);
		
			collection.find({}).skip((cp-1)*ps).limit(ps).sort({"_id":-1}).toArray(function(err, results) {
				d["users"] = [];
				for(var i = 0; i < results.length; i++){
					//从文件系统中访问文件:文件名要有扩展名
					//d["users"].push({"userhead":results[i]["image"], "status":results[i]["status"], "username":results[i]["username"], "password":results[i]["password"], "email":results[i]["email"]});
					//从数据库中访问文件：扩展名不能有.， 否则按静态资源处理
					d["users"].push({"userhead":path.basename(results[i]["image"],
						path.extname(results[i]["image"])), 
						"extname":path.extname(results[i]["image"]).substring(1), 
						"status":results[i]["status"], 
						"username":results[i]["username"], 
						"password":results[i]["password"], 
						"email":results[i]["email"]});
					//console.log(results[i]["user"]);
				}
				var page = {'currPage':cp, 'pageSize':ps, 'pageCount':pc, 'totalRecord':tr};
				
				db.close();
				callBack(d, page);
			});
		});
	});
};

exports.page = function (currentPage, PageSize, callBack){
	var collection = mongodb.db.collection('users');
	
	var cp, ps, pc, tr;
	var d = {};
	
	cp = currentPage;
	ps = PageSize;
	//console.log(ps);
	
	collection.count({}, function(err, count) {
		//console.log("count=" + count);
		tr = count;
		pc = Math.floor(tr / ps) + ((tr % ps == 0)?0:1);
	
		collection.find({}).skip((cp-1)*ps).limit(ps).sort({"_id":-1}).toArray(function(err, results) {
			d["users"] = [];
			for(var i = 0; i < results.length; i++){
				//从文件系统中访问文件:文件名要有扩展名
				//d["users"].push({"userhead":results[i]["image"], "status":results[i]["status"], "username":results[i]["username"], "password":results[i]["password"], "email":results[i]["email"]});
				//从数据库中访问文件：扩展名不能有.， 否则按静态资源处理
				d["users"].push({"userhead":path.basename(results[i]["image"],
					path.extname(results[i]["image"])), 
					"extname":path.extname(results[i]["image"]).substring(1), 
					"status":results[i]["status"], 
					"username":results[i]["username"], 
					"password":results[i]["password"], 
					"email":results[i]["email"]});
				//console.log(results[i]["user"]);
			}
			var page = {'currPage':cp, 'pageSize':ps, 'pageCount':pc, 'totalRecord':tr};
			
			//db.close();
			callBack(d, page);
		});
	});

};

exports.add = function (username, user, callBack1, callBack2){
	console.log(username);
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
					// Close the db
					db.close();
					//response.send("OK.");
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
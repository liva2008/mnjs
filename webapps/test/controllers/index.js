var mongodb = require('./../../../node_modules/mongodb');
var db = require('./../models/db');

var index = exports;

index.hello = function(request, response, session){
	console.log("hello session:" + JSON.stringify(session.getSession()));
	session.set("user", "liva");
	response.send("Hello " + session.get("user"));
}

index.test = function(request, response, session){
	response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write(request.get[0]);
	response.end();
}

index.test1 = function(request, response, session){
	var d = {};
	
	var server = new mongodb.Server(db.dbServer, db.dbPort, {});
	new mongodb.Db(db.dbName, server, {}).open(function (error, client) {
		if (error) throw error;
		var collection = new mongodb.Collection(client, 'test_collection');
	  
		collection.insert({user: request.post["wd"]}, {safe:true}, function(err, objects) {
			if (err) console.warn(err.message);
			if (err && err.message.indexOf('E11000 ') !== -1) {
			  // this _id was already inserted in the database
			}
		});
	  
		var cp, ps, pc, tr;
		cp = request.post["page"]?request.post["page"]:1;
		//console.log(cp);
		ps = 5;
	  
		collection.count({"user":{$ne:null}}, function(err, count) {
			//console.log("count=" + count);
			tr = count;
			pc = Math.floor(tr / ps) + ((tr % ps == 0)?0:1);
		
			collection.find({"user":{$ne:null}}).skip((cp-1)*ps).limit(ps).sort({"_id":-1}).toArray(function(err, results) {
				d["user"] = [];
				for(var i = 0; i < results.length; i++){
					d["user"].push({"name":results[i]["user"]});
					//console.log(results[i]["user"]);
				}
				var page = {'currPage':cp, 'pageSize':ps, 'pageCount':pc, 'totalRecord':tr};
				response.view("index.html", d, page);
				
				client.close();
			});
		});
	});
}

index.test2 = function(request, response, session){

	var d = {"helloworld":"Hello world", "liva":"I am liva"};
	
	response.view("index.html", d, {});
}

index.upload = function(request, response, session){
	response.view("upload.html", {}, {});
}
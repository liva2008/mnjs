/*******************************************************************************
命名：
	MNJS = Mongodb + Nodejs + JavaScript (大写字母组合命名)
	This is a Web Framework.
功能：
	1.数据库、服务器和客户端全部基于Javascript；
	2.完全基于NoSQL数据库，存储容量与存储结构易扩展；
	3.完全基于事件驱动、非阻塞I/O、异步响应模型；
	4.支持有状态（stateful）与无状态(stateless)两种服务；
	5.优美的Restful架构；
	6.基于Model、View、Controller(MVC)的架构模型；
	7.视图提供服务器端和客户端两种可选的渲染模型；
	8.提供大数据的分页功能；
	9.支持多文件上传功能,文件可以存放在文件系统或数据库中；
	10.数据库和服务器均支持集群方式；
	11.遵循Convention over Configuration(CoC)原则，零配置；
	12.静态服务器与动态服务器容为一体；
	13.热点代码自动重载，方便开发与调试;
	14.提供静态资源和模板文件的缓存功能；
	15.提供单进程和多进程两种运行模式；
	16.集成原生应用和Web应用开发的Web IDE；
*******************************************************************************/
var http = require('http');
var domain = require('domain');
var cluster = require('cluster');
var config = require('./config.js');

////////////////////////////命令行配置//////////////////////////////////////////
var rep = /(port=)/i;
var red = /(debug=)/i;
var ret = /(temp=)/i;
var res = /(status=)/i;
var rem = /(multi=)/i;

var rev1 = /^(true|false)$/;
var rev2 = /^[0-9]*$/;

var args = process.argv;
for(var e in args){
	// 解析port
	if(rep.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			if(rev2.test(p[1]))
				config.PORT = p[1];
		}
	}
	// 解析debug
	if(red.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			//console.log(rev1.test(p[1]));
			if(rev1.test(p[1])){
				if(p[1] === 'true')
					config.debug = true;
				else
					config.debug = false;
			}
		}
	}
	// 解析temp
	if(ret.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			if(rev1.test(p[1])){
				if(p[1] === 'true')
					config.temp = true;
				else
					config.temp = false;
			}
		}
	}
	// 解析status
	if(res.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			if(rev1.test(p[1])){
				if(p[1] === 'true')
					config.status = true;
				else
					config.status = false;
			}
		}
	}
	
	// 解析是否多核运行
	if(rem.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			if(rev1.test(p[1])){
				if(p[1] === 'true')
					config.multi = true;
				else
					config.multi = false;
			}
		}
	}
}

var usage = function (){
	console.log("**********************************************************");
	console.log("Usage:node server.js [options]\n" +
		"options:\n" +
		"  port=arg	specify server port number\n" +
		"  debug=arg	setting debug true is on and false is off\n" +
		"  temp=arg	setting template rendering true at server \n" +
		"  		and false at client\n" +
		"  status=arg	setting server status true is on \n" +
		"  		and false is off\n" +
		"  multi=arg	setting multi-core true is yes \n" +
		"  		and false is no"
	);
};

var info = function (){
	console.log("**********************************************************");
	console.log("Name: MNJS = Mongodb + Nodejs + Javascript");
	console.log("Author: " + config.AUTHOR);
	console.log("First Version: " + config.FIRSTVERSION);
	console.log("Current Version: " + config.CURRENTVERSION);
	console.log("Email: " + config.EMAIL);
	console.log("");
	console.log("Server Port is " + config.PORT);
	if(config.debug){
		console.log("Debug is on.");
		console.log("Cache is off.");
	}
	else{
		console.log("Debug is off.");
		console.log("Cache is on.");
	}
		
	if(config.temp)
		console.log("Viewing on Server.");
	else
		console.log("Viewing on Client.");
		
	if(config.status)
		console.log("Server is Stateful.");
	else
		console.log("Server is stateless.");

	if(config.multi)
		console.log("Multi-core server is yes.");
	else
		console.log("Multi-core server is no.");
	console.log("**********************************************************");
	console.log("Server is running ...");
};


/////////////////////////////Web 服务器/////////////////////////////////////////
// create a top-level domain for the server
var serverDomain = domain.create();

var numCPUs = require('os').cpus().length;

// 多核CPU判断
if(config.multi){
	if (cluster.isMaster) {
		//usage();
		// Fork workers.
		for (var i = 0; i < numCPUs; i++) {
			cluster.fork();
		}

		cluster.on('exit', function(worker, code, signal) {
			console.log('worker ' + worker.process.pid + ' died');
		});
		//info();
	} 
	else {
		// Workers can share any TCP connection
		// In this case its a HTTP server
		serverDomain.run(function() {
			// server is created in the scope of serverDomain
			http.createServer(function(req, res) {
				// req and res are also created in the scope of serverDomain
				// however, we'd prefer to have a separate domain for each request.
				// create it first thing, and add req and res to it.
				var reqd = domain.create();
				reqd.add(req);
				reqd.add(res);
				
				var m = "./mnjs.js";
				var mnjs = require(m);
				if(config.debug){
					delete require.cache[require.resolve(m)];
				}
				mnjs.control(req, res);
				
				reqd.on('error', function(er) {
					console.error('Error', er, req.url);
					try {
						res.writeHead(500);
						res.end('Error occurred, sorry.');
						res.on('close', function() {
							// forcibly shut down any other things added to this domain
							reqd.dispose();
						});
					} catch (er) {
						console.error('Error sending 500', er, req.url);
						// tried our best.  clean up anything remaining.
						reqd.dispose();
					}
				});
			}).listen(config.PORT);
		});
	}
}
else{
	//单进程模式
	//usage();
	serverDomain.run(function() {
		// server is created in the scope of serverDomain
		http.createServer(function(req, res) {
			// req and res are also created in the scope of serverDomain
			// however, we'd prefer to have a separate domain for each request.
			// create it first thing, and add req and res to it.
			var reqd = domain.create();
			reqd.add(req);
			reqd.add(res);
			
			var m = "./mnjs.js";
			var mnjs = require(m);
			if(config.debug){
				delete require.cache[require.resolve(m)];
			}
			mnjs.control(req, res);
			
			reqd.on('error', function(er) {
				console.error('Error', er, req.url);
				try {
					res.writeHead(500);
					res.end('Error occurred, sorry.');
					res.on('close', function() {
						// forcibly shut down any other things added to this domain
						reqd.dispose();
					});
				} catch (er) {
					console.error('Error sending 500', er, req.url);
					// tried our best.  clean up anything remaining.
					reqd.dispose();
				}
			});
		}).listen(config.PORT);
	});
	//info();
}

/*
var server = http.createServer(function (request, response) {
	var m = "./mnjs.js";
	var mnjs = require(m);
	if(config.debug){
		delete require.cache[require.resolve(m)];
	}
	mnjs.control(request, response);
});
server.listen(config.PORT);
*/
//////////////////////////////END///////////////////////////////////////////////
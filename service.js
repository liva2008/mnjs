//伺服程序：监控Server进程，提高框架的稳定性
//伺服程序来启动你的程序，检测子进程的退出，然后自动重启该进程
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
	console.log("Usage:node service.js [options]\n" +
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

usage();

info();

start();

function start(){
	console.log('Service process is running.');
	var ls = require('child_process').spawn('node', ['server.js']);

	ls.stdout.on('data', function (data){
		console.log(data.toString());
	});

	ls.stderr.on('data', function (data){
		console.log(data.toString());
	});

	ls.on('exit', function (code){
		console.log('child process exited with code ' + code);
		delete(ls);
		setTimeout(start,5000);
	});
}

process.on('uncaughtException', function(err) {
  console.log("We found an uncaught exception.");
  console.log(err.stack);
});
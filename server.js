/*******************************************************************************
������
	MNJS = Mongodb + Nodejs + JavaScript (��д��ĸ�������)
	This is a Web Framework.
���ܣ�
	1.���ݿ⡢�������Ϳͻ���ȫ������Javascript��
	2.��ȫ����NoSQL���ݿ⣬�洢������洢�ṹ����չ��
	3.��ȫ�����¼�������������I/O���첽��Ӧģ�ͣ�
	4.֧����״̬��stateful������״̬(stateless)���ַ���
	5.������Restful�ܹ���
	6.����Model��View��Controller(MVC)�ļܹ�ģ�ͣ�
	7.��ͼ�ṩ�������˺Ϳͻ������ֿ�ѡ����Ⱦģ�ͣ�
	8.�ṩ�����ݵķ�ҳ���ܣ�
	9.֧�ֶ��ļ��ϴ�����,�ļ����Դ�����ļ�ϵͳ�����ݿ��У�
	10.���ݿ�ͷ�������֧�ּ�Ⱥ��ʽ��
	11.��ѭConvention over Configuration(CoC)ԭ�������ã�
	12.��̬�������붯̬��������Ϊһ�壻
	13.�ȵ�����Զ����أ����㿪�������;
	14.�ṩ��̬��Դ��ģ���ļ��Ļ��湦�ܣ�
	15.�ṩ�����̺Ͷ������������ģʽ��
	16.����ԭ��Ӧ�ú�WebӦ�ÿ�����Web IDE��
*******************************************************************************/
var http = require('http');
var domain = require('domain');
var cluster = require('cluster');
var config = require('./config.js');

////////////////////////////����������//////////////////////////////////////////
var rep = /(port=)/i;
var red = /(debug=)/i;
var ret = /(temp=)/i;
var res = /(status=)/i;
var rem = /(multi=)/i;

var rev1 = /^(true|false)$/;
var rev2 = /^[0-9]*$/;

var args = process.argv;
for(var e in args){
	// ����port
	if(rep.test(args[e])){
		//console.log(args[e]);
		var p = args[e].split("=");
		if(p.length = 2){
			//console.log(p[1]);
			if(rev2.test(p[1]))
				config.PORT = p[1];
		}
	}
	// ����debug
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
	// ����temp
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
	// ����status
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
	
	// �����Ƿ�������
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


/////////////////////////////Web ������/////////////////////////////////////////
// create a top-level domain for the server
var serverDomain = domain.create();

var numCPUs = require('os').cpus().length;

// ���CPU�ж�
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
	//������ģʽ
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
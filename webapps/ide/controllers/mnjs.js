var mongodb = require('./../../../node_modules/mongodb');
var qs = require('querystring');
var path = require('path');
var fs = require('fs');
var sys = require("sys");

var mnjs = exports;

mnjs.project = function (request, response){
	//console.log(request.get[0]);
	response.view("project.html", {'project':request.get[0],'type':request.get[1]}, {});
}

mnjs.projects = function (request, response){
	response.view("projects.html", {}, {});
}

mnjs.list = function (request, response){
	var webappsroot = './webapps';
	var appsroot = './apps';
	var stats = fs.statSync(webappsroot);
	var stats1 = fs.statSync(appsroot);
	var projects = {};
	if(stats.isDirectory() && stats1.isDirectory()){
		// web apps
		var ps = fs.readdirSync(webappsroot);
		projects['total'] = ps.length - 1; // �ų�ide����
		projects['rows'] = [];
		for(var p in ps){
			if(ps[p] != 'ide'){
				var pinfo = fs.statSync(webappsroot + '/' + ps[p]);
				if(pinfo.isDirectory()){
					projects['rows'].push({'name':ps[p], 'type':'webapps', 'atime':pinfo.atime, 'mtime': pinfo.mtime, 'ctime': pinfo.ctime});
				}
			}
		}
		
		// local apps
		var ps = fs.readdirSync(appsroot);
		projects['total'] += ps.length;
		for(var p in ps){
			var pinfo = fs.statSync(appsroot + '/' + ps[p]);
			if(pinfo.isDirectory()){
				projects['rows'].push({'name':ps[p], 'type':'apps', 'atime':pinfo.atime, 'mtime': pinfo.mtime, 'ctime': pinfo.ctime});
			}
		}
		response.JSON(projects);
	}
	else{
		response.send('Error');
	}
}

/** ����Ŀ¼
 * @param {String} origin ԭʼĿ¼���������Ƶ�Ŀ¼
 * @param {String} target Ŀ��Ŀ¼
 */
function copy(origin,target){

	//���ԭʼĿ¼�����ڣ����Ƴ�
	if(!path.existsSync(origin)){
		console.log(origin + 'is not exist......');
	}

	//���Ŀ��Ŀ¼�����ھʹ���һ��
	if(!path.existsSync(target)){
		fs.mkdirSync(target, 0755)
	}

	//�첽��ȡĿ¼�е����ݣ���ԴĿ¼�����ļ����Ƶ�Ŀ��Ŀ¼��
	fs.readdir(origin,function(err,datalist){
		if(err) return;
		//console.log(datalist);

		for(var i=0;i<datalist.length;i++){
			var oCurrent = origin + '/' + datalist[i];
			var tCurrent = target + '/' + datalist[i];
			//console.log(fs.statSync(origin + '/' + datalist[i]).isFile());
			
			//�����ǰ���ļ�,��д�뵽��Ӧ��Ŀ��Ŀ¼��
			if(fs.statSync(oCurrent).isFile()){
				fs.writeFileSync(tCurrent,fs.readFileSync(oCurrent, ''),'');
			}
			//�����Ŀ¼����ݹ�
			else if(fs.statSync(oCurrent).isDirectory()){
				copy(oCurrent,tCurrent);
			}
		}
	});
}

mnjs.newproject = function (request, response){
	try{
		
		var root = './'+request.post['cc']+'/';
		//console.log("projectname=" +request.post['projectname']);
		//console.log("projecttype=" +request.post['cc']);
		copy(root + 'test', root + request.post['projectname']);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

/** ɾ���ļ���
 * @param {String} target Ŀ��Ŀ¼
 */
function remove(target){
	var datalist = fs.readdirSync(target);
	
	for(var i=0;i<datalist.length;i++){
		var tCurrent = target + '/' + datalist[i];
		//console.log(fs.statSync(target + '/' + datalist[i]).isFile());
		
		//�����ǰ���ļ�,��д�뵽��Ӧ��Ŀ��Ŀ¼��
		if(fs.statSync(tCurrent).isFile()){
			fs.unlinkSync(tCurrent);
		}
		//�����Ŀ¼����ݹ�֮��ɾ��Ŀ¼
		else if(fs.statSync(tCurrent).isDirectory()){
			remove(tCurrent);
			fs.rmdirSync(tCurrent);
		}
	}
}

mnjs.delproject = function (request, response){
	try{
		var root = './'+request.post['projecttype']+'/';
		//console.log("del projectname=" +request.post['projectname']);
		remove(root + request.post['projectname']);
		fs.rmdirSync(root + request.post['projectname']);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

// ��ȡĿ¼��
mnjs.tree = function (request, response){
	console.log(request.get[0]);
	var project = request.get[0];
	var type = request.get[1]; // apps or webapps
	var dir = [];

	var root = './'+type+'/' + project;
	
	var getID = function (){
		var d = new Date();
		return d.getTime() + '' + parseInt(Math.random() * 100000);
	};
	
	/* �����ļ��У�������JSON��ʽ����
	 * dirpath: �ļ���·��
	 * cmd������JSON����
	 * no: �ļ������
	 */
	var getDir = function (dirpath, cmd, no){
		var stats = fs.statSync(dirpath);
		if(stats.isDirectory()){
			var s = cmd;
			s += ".push("+
			"{"+
			"	'id':getID(),"+
			"	'text':path.basename(dirpath),"+
			"	'state':'open',"+
			"	'children':[]"+
			"	}"+
			");";
			
			eval(s);
			
			var files = fs.readdirSync(dirpath);
			
			for(var f in files){
					getDir(dirpath + '/' + files[f], 
						cmd + "["+no+"].children", f);
			}
		}
		else if(stats.isFile()){
			var t = cmd;
			t += ".push("+
			"{"+
			"	'id':getID(),"+
			"	'text':path.basename(dirpath),"+
			"	}"+
			");";
			
			eval(t);
		}
	};
	
	getDir(root, "dir", 0);
	
	response.JSON(dir);
}

mnjs.mkdir = function (request, response){
	//console.log(request.get[0]);
	var root = './'+ request.get[0] + request.post['dir'];
	try{
		fs.mkdirSync(root);
		fs.writeFileSync(root + '/' + 'flag', "directory flag,please don\'t delete this file");
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.rmdir = function (request, response){
	var root = './' + request.get[0] + request.post['dir'];
	try{
		fs.unlinkSync(root+'/flag');
		fs.rmdirSync(root);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.rendir = function (request, response){
	var olddir = './' + request.get[0] + request.post['olddir'];
	var newdir = './'  + request.get[0] + request.post['newdir'];
	try{
		fs.renameSync(olddir, newdir);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.newfile = function (request, response){
	var file = './' + request.get[0] + request.post['file'];
	try{
		fs.writeFileSync(file, "");
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.delfile = function (request, response){
	var file = './' + request.get[0] + request.post['file'];
	try{
		fs.unlinkSync(file);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.renfile = function (request, response){
	var oldfile = './' + request.get[0] + request.post['oldfile'];
	var newfile = './' + request.get[0] + request.post['newfile'];
	try{
		fs.renameSync(oldfile, newfile);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.savefile = function (request, response){
	var name = './' + request.get[0] + request.post['name'];
	var content = request.post['content'];
	try{
		fs.writeFileSync(name, content);
		response.send('ok');
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.openfile = function (request, response){
	var getID = function (){
		var d = new Date();
		return 'code' + d.getTime() + '' + parseInt(Math.random() * 100000);
	};
	
	var t = request.get[0];
	if(t == 'webapps'){
		var rPath = './webapps/' + request.post['file'];
		var ID = getID();
		var content = ""+
		"<script>"+
		"	var editor"+ID+" = CodeMirror.fromTextArea(document.getElementById('"+ID+"'), {"+
		"		lineNumbers: true,"+
		"		matchBrackets: true,"+
		"		lineWrapping: true,"+
		"		extraKeys: {'Enter': 'newlineAndIndentContinueComment'},"+
		"	});"+
		"</script>"+
		"<form >"+
		"	<a href='#' onclick=\"javascript:savefile('"+request.post['file']+"',editor"+ID+".getValue())\" style=\"margin:5px 5px;\" class='easyui-linkbutton' data-options=\"iconCls:'icon-save'\">Save</a>"+
		"	<textarea id='"+ID+"' name='"+ID+"'>";

		content += fs.readFileSync(rPath, 'utf-8');
		content += "</textarea></form>";
		response.send(content);
	}
	else if(t == 'apps'){
		var rPath = './apps/' + request.post['file'];
		//console.log(rPath);
		var ID = getID();
		var content = ""+
		"<script>"+
		"	var editor"+ID+" = CodeMirror.fromTextArea(document.getElementById('"+ID+"'), {"+
		"		lineNumbers: true,"+
		"		matchBrackets: true,"+
		"		lineWrapping: true,"+
		"		extraKeys: {'Enter': 'newlineAndIndentContinueComment'},"+
		"	});"+
		"</script>"+
		"<form >"+
		"	<a href='#' onclick=\"javascript:savefile('"+request.post['file']+"',editor"+ID+".getValue())\" style=\"margin:5px 5px;\" class='easyui-linkbutton' data-options=\"iconCls:'icon-save'\">Save</a>"+
		"	<a href='#' onclick=\"javascript:runfile('"+request.post['file']+"')\" style=\"margin:5px 5px;\" class='easyui-linkbutton' data-options=\"iconCls:'icon-ok'\">Run</a>"+
		"	<textarea id='"+ID+"' name='"+ID+"'>";

		content += fs.readFileSync(rPath, 'utf-8');
		content += "</textarea></form>";
		response.send(content);
	}
}

mnjs.runfile = function (request, response){
	var name = './' + request.get[0] + request.post['name'];
	//console.log(path.dirname(name));
	try{
		var fs = require('fs'),
			spawn = require('child_process').spawn,
			out = fs.openSync(path.dirname(name)+'/out.log', 'a'),
			err = fs.openSync(path.dirname(name)+'/out.log', 'a');

		var child = spawn('node', [name], {
		  detached: true,
		  stdio: [ 'ignore', out, err ]
		});

		child.unref();
		
		var r = fs.readFileSync(path.dirname(name)+'/out.log', 'utf-8');

		r = r.replace(/\n/g,'<br>');

		response.send(r);
	}
	catch(e){
		response.send('Error');
	}
}

mnjs.status = function (request, response){
	var r = fs.readFileSync('./out.log', 'utf-8');

	r = r.replace(/\n/g,'<br>');

	response.send(r);
}

var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');
var zlib = require("zlib");
var mustache = require('./node_modules/mustache');
var formidable = require('./node_modules/formidable');
var config = require('./config.js');
/////////////////////////////////会话模块///////////////////////////////////////

// 用户会话
var Session = function (){

	// 用户会话数据结构
	// {sid1:{time:datetime, k1:v1, k2:v2, ... , kn:vn},
	//  sid2:{time:datetime, k1:v1, k2:v2, ... , kn:vn},
	//  .......
	//  sidn:{time:datetime, k1:v1, k2:v2, ... , kn:vn}}
	var _session = {};
	var _sid;
	
	/* 
	 * 设置当前Session SID
	 */
	this.setSID = function (sid){
		_sid = sid;
	};

	/* 
	 * 根据不同的应用创建不同的会话
	 * sid = application_user_当前时间的毫秒值_10000以内的随机数
	 */
	this.createSession = function (application){
		var time = new Date().getTime();
		var rand = Math.round(Math.random() * 10000);
		var sid = (application + "_" + time + "_" + rand);
		_session[sid] = {};
		_session[sid]['time'] = time;
		
		return sid;
	};
	
	/* 
	 * 根据sid恢复会话
	 * sid = application_当前时间的毫秒值_10000以内的随机数
	 */
	this.restoreSession = function (sid){
		var time = new Date().getTime();
		
		_session[sid] = {};
		_session[sid]['time'] = time;
		
		return sid;
	};

	/* 
	 * 刷新Session
	 */
	this.flush = function (sid){
		var time = new Date().getTime();
		_session[sid]['time'] = time;
	};
	 
	/* 
	 * 设置Session
	 */
	this.set = function (key, value){
		var time = new Date().getTime();
		_session[_sid]['time'] = time;
		_session[_sid][key] = value;
	};

	/* 
	 * 获得Session
	 */
	this.get = function (key){
		var time = new Date().getTime();
		_session[_sid]['time'] = time;
		
		return _session[_sid][key];
	};
	
	/* 
	 * 删除Session
	 */
	this.del = function (sid){
		delete _session[sid];
	};
	
	/* 
	 * 检查Session
	 */
	this.exist = function (sid){	
		return _session.hasOwnProperty(sid);
	};
	
	/*
	 * 获取Session
	 */
	this.getSession = function () {
		return _session;
	};
	
	return this;
};

if(config.status){
	var session = new Session();

	/* 
	 * 每隔一分钟清理过期的Session
	 */

	setInterval(function(){
		var n;
		var s = session.getSession();
		for(var id in s){
			n = new Date().getTime();
			if( (n - s[id]['time']) > config.sessionExpiredTime){
				session.del(id);
			}
		}
	}, 1000);  
}

//////////////////////缓存类（maxSize 最大字节数）//////////////////////////////
function Cache(maxSize){
    this.maxSize = maxSize; 	// 最大尺寸
    this.curSize = 0; 			// 当前尺寸
    this._bufs = {}; 			// 缓存Map
    this._accessCount = 0; 		// 访问计数器
    this._lastClearCount = 0; 	// 上次清理的计数器
}

Cache.prototype.put = function(key,buf){
    buf.access = this._accessCount++;
    var obuf = this._bufs[key];
    if(obuf) this.curSize -= obuf.length;
    this._bufs[key] = buf;
    this.curSize += buf.length;
    while(this.curSize > this.maxSize){
        this._clear();
    }
};

Cache.prototype.get = function (key) {
    var buf = this._bufs[key];
    if (buf) buf.access = this._accessCount++;
    return buf;
};

Cache.prototype.del = function (key) {
    var buf = this._bufs[key];
    if (buf) {
        this.curSize -= buf.length;
        delete this._bufs[key];
    }
};

Cache.prototype._clear = function () {
    var clearCount = (this._lastClearCount + this._accessCount) / 2;
    for (var e in this._bufs) {
        var buf = this._bufs[e];
        if (buf.access <= clearCount) {
            this.curSize -= buf.length;
            delete this._bufs[e];
        }
    }
    this._lastClearCount = clearCount;
};

var fileCache = new Cache(config.cacheSize.MaxSingleSize);

////////////////////////////动态服务器//////////////////////////////////////////
function dynamicServer(request, response, action){
	/*
	var pathname = url.parse(request.url).pathname;
	if(config.debug) console.log(request.url);
	var _url = pathname.split("/");
	if(config.debug) console.log(pathname);
	
	// 动态服务器
	// HTTP Get方法提交的数据以[a1, a2, ... , an]形式存到request.get中
	// URL: http://domain/application/controller/action/a1/a2/.../an
	request.get = [];
	var action = [];        // ['application', 'controller', 'action']
	// 从URL中解析出application, controller, action
	if(_url.length >= 3){
		action = _url.slice(1,4);
		if(config.debug) console.log(action);
	}
	//解析URL中提交的参数
	if(_url.length > 3){
		request.get = _url.slice(4);
		if(config.debug) console.log(request.get);
	}
	*/
	
	//处理会话
	if(config.status){
		var cookies = qs.parse(request.headers.cookie,';');
		if(config.debug) console.log(cookies);
		if(cookies['sid']){
			if(session.exist(cookies['sid'])){
				session.flush(cookies['sid']);
			}
			else{
				session.restoreSession(cookies['sid']);
			}
			
			session.setSID(cookies['sid']);
		}
		else{
			var sid = session.createSession(action[0]);
			session.setSID(sid);
			response.setHeader('Set-Cookie', ['sid='+sid]);
		}
		
		if(config.debug) 
			console.log("Session=" + JSON.stringify(session.getSession()));
	}
	
	// HTTP Post方法提交的数据以{"k1":v1, "k2":v2, ... , "kn":vn}形式
	// 存到request.post
	request.post = {};
	// ?k1=v1&k2=v2&...&kn=vn
	var _args = {};
	/*
	var _args0 = [];
	if(request.url.indexOf("?") != -1){
		var _tmp = request.url.split("?");
		var _tmp0 = _tmp[1].split("&");
		for(var i = 0; i < _tmp0.length; i++){
			var _tmp1 = _tmp0[i].split("=");
			_args[_tmp1[0]] = _tmp1[1];
			_args0[i] = [_tmp1[0], _tmp1[1]];
		}
	}
	*/
	
	// 处理Post方法
	if(request.method.toLowerCase() == 'post'){
		var form = new formidable.IncomingForm();
		var files = {};
		request.files = {};
		
		form.uploadDir = './webapps/' + action[0] + '/upload/';
		
		form.on('field', function(field, value) {
			if(config.debug) console.log(field, value);
			_args[field] = value;
		})
		.on('file', function(field, file) {
			if(config.debug) console.log(field, file);
			if(config.debug) console.log("size="+file.size);
			files[field] = file;
		})
		.on('end', function() {
			if(config.debug) console.log('-> upload done');
			if(config.debug) console.log(files);
			if(config.debug) console.log(_args);
			
			request.files = files;
			request.post = _args;
			
			if(action.length == 3){
				fs.exists('./webapps/' + action[0] + '/controllers/' + 
					action[1] + '.js',function (exists){
					if (!exists) {
						// 控制器不存在
						response.writeHead(404, {
							'Content-Type': 'text/plain'
						});

						response.write("The " + action[1] + 
							" controller was not found on this server.");
						response.end();
					} else {
						// 调用Action
						var m = './webapps/' + action[0] + '/controllers/' + action[1]+ '.js';
						var controller = require(m);
						
						//热点升级
						//if(debug) console.log(require.cache);
						if(config.debug) delete require.cache[require.resolve(m)];
						if(config.debug) 
							console.log(require.cache[require.resolve(m)]);
							
						if(controller[action[2]]){
							// 动态调用action,通过函数的call方法或直接调用
							// 传递request,response,session对象
							if(config.status)
								controller[action[2]].call(null, request, 
								response, session);	//有状态模式
								//controller[action[2]](request,response,session);
							else
								controller[action[2]].call(null, request, 
								response);	//无状态模式
								//controller[action[2]](request,response);
						}
						else{
							// Action不存在
							response.writeHead(500, {
								'Content-Type': 'text/plain'
							});

							response.write("The " + action[1] + 
								" controller without " + action[2] + " action.");
							response.end();
						}
					}
				});
			}
		});
		form.parse(request);
	}
	// 处理Get方法
	else if(request.method.toLowerCase() == 'get'){
		var _postData = '';
		request.on('data', function(chunk)
		{
			_postData += chunk;
		})
		.on('end', function()
		{
			request.post = qs.parse(_postData);
			/*
			for(var i = 0; i < _args0.length; i++){
				request.post[_args0[i][0]] = _args0[i][0];
			}
			*/
			if(config.debug) console.log(request.post);
			
			if(_args["page"])
				request.post["page"] = _args["page"];
			
			if(action.length == 3){
				fs.exists('./webapps/' + action[0] + '/controllers/' + 
					action[1] + '.js',function (exists){
					if (!exists) {
						// 控制器不存在
						response.writeHead(404, {
							'Content-Type': 'text/plain'
						});

						response.write("The " + action[1] + 
							" controller was not found on this server.");
						response.end();
					} else {
						// 调用Action
						var m = './webapps/' + action[0] + '/controllers/' + action[1]+ '.js';
						var controller = require(m);
						//热点升级
						//if(config.debug) console.log(require.cache);
						
						if(config.debug) delete require.cache[require.resolve(m)];
						if(config.debug) 
							console.log(require.cache[require.resolve(m)]);
						
						/* 监控Controller，修改时重新加载？
						fs.watchFile('./webapps/' + action[0] + 
							'/controllers/' + action[1] + ".js", function (curr, prev) {
							console.log('the current mtime is: ' + curr.mtime);
							console.log('the previous mtime was: ' + prev.mtime);
							controller = require('./webapps/' + action[0] + 
							'/controllers/' + action[1]);
						});
						*/
						
						if(controller[action[2]]){
							// 动态调用action,通过函数的call方法
							// 传递request,response,session对象
							if(config.status)
								controller[action[2]].call(null, request,
								response,session); //有状态模式
								//controller[action[2]](request,response,session);
							else
								controller[action[2]].call(null, request,
								response);  	//无状态模式
								//controller[action[2]](request,response);
						}
						else{
							// Action不存在
							response.writeHead(500, {
								'Content-Type': 'text/plain'
							});

							response.write("The " + action[1] + 
								" controller without " + action[2] + " action.");
							response.end();
						}
					}
				});
			}
		});
	}
}

////////////////////////////带缓存静态服务器////////////////////////////////////
/* HTTP缓存类（mtime不可更改） */
function HttpCache(mtime,obuf,gbuf,dbuf){
    this.mtime = mtime; //修改时间
    this.obuf = obuf; //原始数据
    this.gbuf = gbuf; //gzip数据
    this.dbuf = dbuf; //deflate数据
    this.length = (obuf?obuf.length:0) + (dbuf?dbuf.length:0) + (gbuf?gbuf.length:0);
}

/*
HttpCache.prototype.setObuf = function(obuf){
    this.length += obuf.length - (this.obuf?this.obuf.length:0);
    this.obuf = obuf;
};
*/

HttpCache.prototype.setGbuf = function(gbuf){
    this.length += gbuf.length - (this.gbuf?this.gbuf.length:0);
    this.gbuf = gbuf;
};

HttpCache.prototype.setDbuf = function(dbuf){
    this.length += dbuf.length - (this.dbuf?this.dbuf.length:0);
    this.dbuf = dbuf;
};

function cacheStaticServer(request, response){
	//解析Range:bytes=[start]-[end][,[start]-[end]]
	var parseRange = function (str, size) {
		if (str.indexOf(",") != -1) {
			return;
		}

		var range = str.split("-"),
			start = parseInt(range[0], 10),
			end = parseInt(range[1], 10);

		// Case: -100
		if (isNaN(start)) {
			start = size - end;
			end = size - 1;
		// Case: 100-
		} else if (isNaN(end)) {
			end = size - 1;
		}

		// Invalid
		if (isNaN(start) || isNaN(end) || start > end || end > size) {
			return;
		}

		return {start: start, end: end};
	};
	
	var error = function(response,id,err){ //返回错误
        response.writeHeader(id, {'Content-Type': 'text/html'});
        var txt;
        switch(id){
            case 404:
                txt = '<h3>404: Not Found</h3>';
                break;
            case 403:
                txt = '<h3>403: Forbidden</h3>';
                break;
            case 416:
                txt = '<h3>416: Requested Range not satisfiable</h3>';
                break;
            case 500:
                txt = '<h3>500: Internal Server Error</h3>';
                break;
        }
        if(err) txt += err;
        response.end(txt);
    };
	
	var cache = function(response,lastModified,ext){ //写客户端Cache
        response.setHeader('Last-Modified', lastModified);
        if(ext && ext.search(config.expiresFile.fileMatch)!=-1){
            var expires = new Date();
            expires.setTime(expires.getTime() + config.expiresFile.maxAge * 1000);
            response.setHeader('Expires', expires.toUTCString());
            response.setHeader('Cache-Control', 'max-age=' + config.expiresFile.maxAge);
        }
    };
	
	var compressHandle = function(request,response,raw,ext,contentType,statusCode){ //流压缩处理
        var stream = raw;
        var acceptEncoding = request.headers['accept-encoding'] || '';
        var matched = ext.match(conf.Compress.match);
        if (matched && acceptEncoding.match(/\bgzip\b/)) {
            response.setHeader('Content-Encoding', 'gzip');
            stream = raw.pipe(zlib.createGzip());
        } else if (matched && acceptEncoding.match(/\bdeflate\b/)) {
            response.setHeader('Content-Encoding', 'deflate');
            stream = raw.pipe(zlib.createDeflate());
        }
        response.setHeader('Content-Type', contentType);
        response.writeHead(statusCode);
        stream.pipe(response);
    };
	
	var flush = function(request,response,cache,ext,contentType){ //Cache输出
        var acceptEncoding = request.headers['accept-encoding'] || "";
        var matched = ext.match(config.compressFile.match);
        if (matched && acceptEncoding.match(/\bgzip\b/)) {
            if(cache.gbuf){
                response.writeHead(200, {'Content-Encoding': 'gzip','Content-Type': contentType});
                response.end(cache.gbuf);
            }
            else{
                zlib.gzip(cache.obuf,function(err,buf){
                    if(err) error(response,500,'<h4>Error : ' + err + '</h4>');
                    else{
                        response.writeHead(200, {'Content-Encoding': 'gzip','Content-Type': contentType});
                        response.end(buf);
                        cache.setGbuf(buf);
                    }
                });
            }
        } else if (matched && acceptEncoding.match(/\bdeflate\b/)) {
            if(cache.dbuf){
                response.writeHead(200, {'Content-Encoding': 'deflate','Content-Type': contentType});
                response.end(cache.dbuf);
            }
            else{
                zlib.deflate(cache.obuf,function(err,buf){
                    if(err) error(response,500,'<h4>Error : ' + err + '</h4>');
                    else{
                        response.writeHead(200, {'Content-Encoding': 'deflate','Content-Type': contentType});
                        response.end(buf);
                        cache.setDbuf(buf);
                    }
                });
            }
        } else {
            response.writeHead(200,{'Content-Type': contentType});
            response.end(cache.obuf);
        }
    };
	
	var pathHandle = function(request,response,realpath,httppath){
		fs.exists(realPath, function (exists) {	
			if (!exists) {
				// 文件不存在
				response.writeHead(404, {
					'Content-Type': 'text/plain'
				});

				response.write("This request URL was't found on this server.");
				response.end();
			} else {
				fs.stat(realpath,function(err,stats){
					var lastModified = stats.mtime.toUTCString();
					//304 客户端有Cache，且木有改动
					var ifModifiedSince = "If-Modified-Since".toLowerCase();
					if(request.headers[ifModifiedSince] && lastModified == request.headers[ifModifiedSince]){
						response.writeHead(304);
						response.end();
						return;
					}
					var ext = path.extname(realpath);
					ext = ext?ext.slice(1):'unknown';
					ext = stats.isDirectory()?'html':ext;
					var contentType = mimes[ext];
					var cacheServer = fileCache.get(realpath);
					//服务端有Cache，且没有改动
					if(cacheServer && cacheServer.mtime == stats.mtime.getTime()){
						cache(response,lastModified,ext);
						flush(request,response,cacheServer,ext,contentType);
						fileCache.put(realpath,cacheServer);
						return;
					}					
					//不合法的MIME
					if(!contentType){
						error(response,403);
						return;
					}
					cache(response,lastModified,ext);
					//文件太大，服务端不Cache
					if(stats.size > config.cacheSize.MaxSingleSize){
						if(request.headers['range']){
							var range = parseRange(request.headers['range'], stats.size);
							if(range){
								response.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + stats.size);
								response.setHeader('Content-Length', (range.end - range.start + 1));
								var raw = fs.createReadStream(realpath, {'start': range.start,'end': range.end});
								compressHandle(request,response,raw,ext,contentType,206);
							}
							else
								error(response,416);
						}
						else{
							var raw = fs.createReadStream(realpath);
							compressHandle(request,response,raw,ext,contentType,200);
						}
					}
					else{
						fs.readFile(realpath,function(err,data){
							if(err) error(response,500,'<h4>Error : ' + err + '</h4>');
							else{
								var buf = new HttpCache(stats.mtime.getTime(),data);
								flush(request,response,buf,ext,contentType);
								fileCache.put(realpath,buf);
							}
						});
					}
				});
			}
		});
    };
	
	var httppath = url.parse(request.url).pathname.replace(/\.\./g,'');
	
	var ref = /\/favicon.ico$/i;
	if(ref.test(httppath)){
		if(config.debug) console.log("favicon.ico not found!");
		response.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		response.write("This favicon.ico was't found on this server.");
		response.end();
	}
	
	var readDir = config.getReadDir();
	
	var realPath = "./webapps" + httppath;
	
	//console.log(realPath);
	//console.log(httppath);
	
	var readDir = config.getReadDir();
	
	// 判断读权限
	if(readDir.test(realPath)){
		pathHandle(request, response,realPath,httppath);
	}
	else{
		// 无权限访问文件
		response.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		response.write("This request URL was no privelige.");
		response.end();
	}
}

////////////////////////////静态服务器//////////////////////////////////////////
function staticServer(request, response){
	var pathname = url.parse(request.url).pathname;
	
	var ref = /\/favicon.ico$/i;
	if(ref.test(pathname)){
		if(config.debug) console.log("favicon.ico not found!");
		response.writeHead(404, {
			'Content-Type': 'text/plain'
		});

		response.write("This favicon.ico was't found on this server.");
		response.end();
	}
	
	var readDir = config.getReadDir();
	
	var realPath = "./webapps/" + pathname;
	if(config.debug) console.log(realPath);
	var ext = path.extname(realPath);
	ext = ext ? ext.slice(1) : 'unknown';
	fs.exists(realPath, function (exists) {
		if (!exists) {
			// 文件不存在
			response.writeHead(404, {
				'Content-Type': 'text/plain'
			});

			response.write("This request URL " + pathname + 
				" was not found on this server.");
			response.end();
		} else {
			// 判断读权限
			if(readDir.test(realPath)){
				//if(realPath.indexOf("statics") != -1 || 
				//	realPath.indexOf("upload") != -1){
				
				//前端缓存功能：判断文件是否过期或修改，如果过期或修改重新发送
				fs.stat(realPath, function (err, stat) {

					var lastModified = stat.mtime.toUTCString();
					var ifModifiedSince = "If-Modified-Since".toLowerCase();
					response.setHeader("Last-Modified", lastModified);
					response.setHeader('Accept-Ranges', 'bytes');

					// 设置文件的过期时间
					if (ext.match(config.expiresFile.fileMatch)) {
						var expires = new Date();
						expires.setTime(expires.getTime() + config.expiresFile.maxAge * 1000);
						response.setHeader("Expires", expires.toUTCString());
						response.setHeader("Cache-Control", "max-age=" + config.expiresFile.maxAge);
					}

					// 判断是否修改
					if (request.headers[ifModifiedSince] && lastModified == request.headers[ifModifiedSince]) {
						response.writeHead(304, "Not Modified");
						response.end();
					} 
					else{
						var compressHandle = function (raw, statusCode, reasonPhrase) {
							var stream = raw;
							var acceptEncoding = request.headers['accept-encoding'] || "";
							var matched = ext.match(config.compressFile.match);

							if (matched && acceptEncoding.match(/\bgzip\b/)) {
								response.setHeader("Content-Encoding", "gzip");
								stream = raw.pipe(zlib.createGzip());
							} else if (matched && acceptEncoding.match(/\bdeflate\b/)) {
								response.setHeader("Content-Encoding", "deflate");
								stream = raw.pipe(zlib.createDeflate());
							}
							response.writeHead(statusCode, reasonPhrase);
							stream.pipe(response);
						};
						//解析Range:bytes=[start]-[end][,[start]-[end]]
						var parseRange = function (str, size) {
							if (str.indexOf(",") != -1) {
								return;
							}

							var range = str.split("-"),
								start = parseInt(range[0], 10),
								end = parseInt(range[1], 10);

							// Case: -100
							if (isNaN(start)) {
								start = size - end;
								end = size - 1;
							// Case: 100-
							} else if (isNaN(end)) {
								end = size - 1;
							}

							// Invalid
							if (isNaN(start) || isNaN(end) || start > end || end > size) {
								return;
							}

							return {start: start, end: end};
						};
						
						// 断点继续
						if (request.headers["range"]) {
                            var range = parseRange(request.headers["range"], stat.size);
                            if (range) {
                                response.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + stat.size);
                                response.setHeader("Content-Length", (range.end - range.start + 1));
                                var raw = fs.createReadStream(realPath, {"start": range.start, "end": range.end});
                                compressHandle(raw, 206, "Partial Content");
                            } else {
                                response.removeHeader("Content-Length");
                                response.writeHead(416, "Request Range Not Satisfiable");
                                response.end();
                            }
						
                        } 
						//普通传输
						else {
							
                            var raw = fs.createReadStream(realPath);
                            compressHandle(raw, 200, "Ok");
                        }
					
						/* 文件流形式发送
						var raw = fs.createReadStream(realPath);
						var acceptEncoding = request.headers['accept-encoding'] || "";
						var matched = ext.match(compressFile.match);

						if (matched && acceptEncoding.match(/\bgzip\b/)) {
							response.writeHead(200, "Ok", {'Content-Encoding': 'gzip'});
							raw.pipe(zlib.createGzip()).pipe(response);
						} 
						else if (matched && acceptEncoding.match(/\bdeflate\b/)) {
							response.writeHead(200, "Ok", {'Content-Encoding': 'deflate'});
							raw.pipe(zlib.createDeflate()).pipe(response);
						} else {
							response.writeHead(200, "Ok");
							raw.pipe(response);
						}
						*/
						
						/* Old Style
						fs.readFile(realPath, "binary", function (err, file) {
							if (err) {
								// 服务器内部错误
								response.writeHead(500, {
									'Content-Type': 'text/plain'
								});

								response.end(err);
							} else {
								var contentType = mimes[ext] || "text/plain";
								response.writeHead(200, {'Content-Type': contentType});

								response.write(file, "binary");

								response.end();
							}
						});
						*/
					}
				});
			}
			else{
				// 无权限访问文件
				response.writeHead(404, {
					'Content-Type': 'text/plain'
				});

				response.write("This request URL " + pathname + 
					" was no privelige.");
				response.end();
			}
		}
	});
}

////////////////////////////控制器模块//////////////////////////////////////////

exports.control = function (request, response) {
	// 控制器Controller
	var re = /[.]/;
	
	// 动态与静态服务器靠.区分，只有静态服务器给出文件名，文件名含有.
	if(request.url.indexOf(".") == -1){
	//if(!re.test(request.url)){
		//动态服务器
		var pathname = url.parse(request.url).pathname;
		if(config.debug) console.log("path="+request.url);
		var _url = pathname.split("/");
		if(config.debug) console.log(pathname);
		// HTTP Get方法提交的数据以[a1, a2, ... , an]形式存到request.get中
		// URL: http://domain/application/controller/action/a1/a2/.../an
		// 并解析出['application', 'controller', 'action']
		request.get = [];
		var action = [];        // ['application', 'controller', 'action']
		// 从URL中解析出application, controller, action
		if(_url.length > 3){
			action = _url.slice(1,4);
			if(config.debug) console.log(action);
		}
		else{
			// 路径不完整，采用默认['application', 'controller', 'action']
			action = config.def;
		}
		//解析URL中提交的参数
		if(_url.length > 3){
			request.get = _url.slice(4);
			if(config.debug) console.log(request.get);
		}
		
		//动态服务器
		dynamicServer(request, response, action);
	}
	// 静态服务器
	else{
		if(config.debug)
			staticServer(request, response);
		else
			cacheStaticServer(request, response);
	}

///////////////////////////////视图模块/////////////////////////////////////////

	/* 1. 字符串渲染：发送数据到客户端
	 * data：发送的数据
	 */
	response.send = function (data) {
		this.writeHead(200, {'Content-type' : 'text/html'});
		this.write(data);
		this.end();
		
		return this;
	};
	
	/* 2. 文件渲染：发送指定文件到客户端
	 * ext: 扩展名，不带.
	 * file: 文件内容
	 */
	response.file = function (ext, file){
		var contentType = mimes[ext] || "text/plain";
		this.writeHead(200, {'Content-Type': contentType});

		this.write(file, "binary");

		this.end();
		
		return this;
	}
	
	/* 3. JSON渲染：发送JSON数据到客户端
	 * data：需要发送的数据，可以是Array, Object或是已经编码的JSON字符串
	 */ 
	response.JSON = function (data) {
		switch (typeof data) {
			case "string":
				this.charset = "application/json";
				response.writeHead(200, {'Content-Type' : this.charset});
				response.write(data,"utf-8");
				response.end();
				break;
			case "array":
			case "object":
				var sJSON = JSON.stringify(data);
				this.charset = "application/json";
				response.writeHead(200, {'Content-Type' : this.charset});
				response.write(sJSON,"utf-8");
				response.end();
				break;
		}
	};
	
	/* 4. 重定向渲染：使客户端重定向到指定页面
	 * url：指定的页面
	 */
	response.redirect = function (url) {
		response.writeHead(302, {'Location': url});
		response.end();
		if(config.debug) console.log('Refresh to ' + url);
				
		return this;
	}
	
	/* 5. 模板渲染:根据模板HTML渲染
	 * v：html页面模板
	 * d：渲染数据
	 * p: 分页数据
	 */
	response.view = function (v, d, p) {
		var rPath = './webapps/' + action[0] + '/views/' + v;
		
		// 调用Config
		var m = './webapps/' + action[0] + '/config.js';
		var cfg = require(m);
		
		//热点升级
		//if(debug) console.log(require.cache);
		if(config.debug) delete require.cache[require.resolve(m)];
		
		//模板缓存功能
		if(!fileCache.get(rPath)){
			//没有缓存时，读取文件存入缓存并处理发送客户
			fs.exists(rPath, function (exists) {
				if (!exists) {
					response.writeHead(404, {
						'Content-Type': 'text/plain'
					});

					response.write("The " + v + " view was not found on this server.");
					response.end();
				} else {	
					fs.readFile(rPath,"utf-8", function (err, file) {
						if (err) {
							response.writeHead(500, {
								'Content-Type': 'text/plain'
							});

							response.end(err);
						} 
						else {
							response.writeHead(200, {'Content-Type': 'text/html'});
							
							//file = file.toString();
							//if(config.debug) console.log(file);
							
							fileCache.put(rPath, file);
							//if(config.debug) console.log("cache="+fileCache.get(rPath));
							
							file = file.toString();
							//服务器端生成
							if(cfg.temp){
								file = mustache.render(file, d)
							}
							//客户端生成:
							// 1. 在<head></head>中加入<%view%>标签
							// 2. 在<body>标签中加入<%callview%>标签
							else{
								file = file.replace(/<%view%>/ig, 
								"<script language=\"javascript\" src=\"/"+action[0]+"/statics/mustache.js\"></script>"+
								"<script language=\"javascript\" src=\"/"+action[0]+"/statics/jquery-1.8.0.min.js\"></script>"+
								"<script language=\"javascript\">"+
								"function view(){"+
								"	var template = document.body.innerHTML;"+
								"	var model = <%data%>;"+
								"	document.body.innerHTML = Mustache.render(template,model);"+
								"}"+
								"$(document).ready(view);"+
								"</script>"
								);
								//file = file.replace(/<%callview%>/ig, "onload=\"view();\"");
								// 数据串化
								var data = "";
								switch (typeof d) {
									case "string": data = d; break;
									case "array":
									case "object":
										var data = JSON.stringify(d);
								}
								
								file = file.replace(/<%data%>/ig, data);
							}
							
							// 生成页面导航
							if(p.hasOwnProperty("currPage")){
								file = file.replace(/<%page%>/ig, page( 
									p["currPage"], p["pageSize"], p["pageCount"], 
									p["totalRecord"]));
							}
							
							response.writeHead(200, {'Content-Type': 'text/html'});
							response.write(file,"utf-8");

							response.end();
						}
					});
				}
			});
		}
		else{
			// 从缓存读取模板
			file = fileCache.get(rPath);
			//file = file.toString();
					
			//服务器端生成
			if(cfg.temp){
				file = mustache.render(file, d)
			}
			//客户端生成:
			// 1. 在<head></head>中加入<%view%>标签
			// 2. 在<body>标签中加入<%callview%>标签
			else{
				file = file.replace(/<%view%>/ig, 
				"<script language=\"javascript\" src=\"/"+action[0]+"/statics/mustache.js\"></script>"+
				"<script language=\"javascript\" src=\"/"+action[0]+"/statics/jquery-1.8.0.min.js\"></script>"+
				"<script language=\"javascript\">"+
				"function view(){"+
				"	var template = document.body.innerHTML;"+
				"	var model = <%data%>;"+
				"	document.body.innerHTML = Mustache.render(template,model);"+
				"}"+
				"$(document).ready(view);"+
				"</script>"
				);
				//file = file.replace(/<%callview%>/ig, "onload=\"view();\"");
				// 数据串化
				var data = "";
				switch (typeof d) {
					case "string": data = d; break;
					case "array":
					case "object":
						var data = JSON.stringify(d);
				}
				
				file = file.replace(/<%data%>/ig, data);
			}
			
			// 生成页面导航
			if(p.hasOwnProperty("currPage")){
				file = file.replace(/<%page%>/ig, page( 
					p["currPage"], p["pageSize"], p["pageCount"], 
					p["totalRecord"]));
			}
			if(config.debug) console.log(file);
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(file,"utf-8");

			response.end();
		}
		
		return response;
	};
};
	
//////////////////////////////分页组件//////////////////////////////////////////

/**
 *  分页导航组件
 *  currPage: 当前页数
 *  pageSize: 页大小
 *  pageCount: 总页数
 *  totalRecord:总记录数
 *  返回字符串：分页导航字符串
 */
function page(currPage, pageSize, pageCount, totalRecord){
	var style = " style='display:block;overflow:hidden;float:left;margin: 0 5px 0 0;text-align:center;border:1px solid #0000FF;text-decoration:none;padding: 3px 6px;'";
	var style1 = " style='display:block;overflow:hidden;float:left;margin: 0 5px 0 0;text-align:center;padding: 3px 6px;'";
	var addr = "<table width=100% border=0 align=center cellpadding=0 cellspacing=0>\n"+
		   "<tr><td><div align=right><form method=Post name=navigatorForm id=navigatorForm>\n"+
		   "<div "+style1+"><strong><font color=red>" + currPage + "</font></strong>/" +
		   "<strong><font color=red>" + pageCount + "</font></strong> "+
		   "<strong><font color=red>" + pageSize + "</font></strong>/"+
		   "<strong><font color=red>" + totalRecord + "</font></strong></div>\n ";
	
	if(currPage > pageCount){
		currPage = pageCount;
	}
	if(currPage < 1){
		currPage = 1;
	}

	if(currPage < 2){
		addr += "<div"+style1+">|< << </div>";
	}
	else{
		addr += "<a href='javascript:self.document.navigatorForm.page.value=1;self.document.navigatorForm.submit();'"+ style +
			">|<</a> \n";
		addr += "<a href='javascript:self.document.navigatorForm.page.value="+ (currPage - 1) +
			";self.document.navigatorForm.submit();'"+style+"><<</a> \n";
	}

	var step = 2;
	var start = (currPage - step) >0 ? currPage - step: 1;
	var end = (currPage + step) < pageCount?currPage + step: pageCount;
	if(currPage <= step) end = 2* step + 1;
	if(end > pageCount) end = pageCount;
	if(pageCount - currPage <= step) start = pageCount - 2*step;
	if(start <= 0) start = 1;
	if(start != 1){
		addr += "<a href='javascript:self.document.navigatorForm.page.value=1;self.document.navigatorForm.submit();'"+style+">1</a> \n";
		if(start != 2) addr += "<div"+style1+">... </div>";
	}
	for(var i = start; i <= end; i++)
	{
		if(i != currPage)
			addr += " <a href='javascript:self.document.navigatorForm.page.value="+ i +
				";self.document.navigatorForm.submit();'"+style+">"+i+"</a> \n";
		else
			addr += " <div"+style1+">"+i+"</div> ";
	}
	if(end != pageCount){
		if(end != pageCount - 1) addr += " <div"+style1+">...</div>";
		addr += " <a href='javascript:self.document.navigatorForm.page.value="+ pageCount +
			";self.document.navigatorForm.submit();'"+style+">"+pageCount+"</a> \n";
	}

	if(currPage >= pageCount){
		addr += "<div"+style1+">>> >|</div> ";
	}
	else{
		addr += "<a href='javascript:self.document.navigatorForm.page.value="+ (currPage + 1) +
			";self.document.navigatorForm.submit();'"+style+">>></a> \n";
		addr += "<a href='javascript:self.document.navigatorForm.page.value="+ pageCount +
			";self.document.navigatorForm.submit();'"+style+">>|</a> \n";
	}

	addr += "<input id='page' name='page' type='hidden' size='1' style='font-size: 9pt' onChange='javascript:self.document.navigatorForm.submit();'> \n";
	addr += "</form></div></td></tr></table>\n";

	return addr;
}

//////////////////////////HTTP状态//////////////////////////////////////////////

var httpstatus = {
	'304':  'Not Modified',
	'400':  'Bad Request',
	'401':  'Unauthorized',
	'402':  'Payment Required',
	'403':  'Forbidden',
	'404':  'Not Found',
	'405':  'Method Not Allowed',
	'406':  'Not Acceptable',
	'407':  'Proxy Authentication Required',
	'408':  'Request Timeout',
	'409':  'Conflict',
	'410':  'Gone',
	'411':  'Length Required',
	'412':  'Precondition Failed',
	'413':  'Request Entity Too Large',
	'414':  'Request-URI Too Long',
	'415':  'Unsupported Media Type',
	'416':  'Requested Range Not Satisfiable',
	'417':  'Expectation Failed',
	'421':  'There are too many connections from your internet address',
	'422':  'Unprocessable Entity',
	'424':  'Failed Dependency',
	'425':  'Unordered Collection',
	'426':  'Upgrade Required',
	'449':  'Retry With',
	'500':  'Internal Server Error',
	'501':  'Not Implemented',
	'502':  'Bad Gateway',
	'503':  'Service Unavailable',
	'504':  'Gateway Timeout',
	'505':  'HTTP Version Not Supported',
	'506':  'Variant Also Negotiate',
	'507':  'Insufficient Storage',
	'509':  'Bandwidth Limit Exceeded',
	'510':  'Not Extended'
};

///////////////////////////////媒体类型/////////////////////////////////////////
var mimes = {
	"123": "application/vnd.lotus-1-2-3",
	"ez": "application/andrew-inset",
	"aw": "application/applixware",
	"atom": "application/atom+xml",
	"atomcat": "application/atomcat+xml",
	"atomsvc": "application/atomsvc+xml",
	"ccxml": "application/ccxml+xml",
	"cdmia": "application/cdmi-capability",
	"cdmic": "application/cdmi-container",
	"cdmid": "application/cdmi-domain",
	"cdmio": "application/cdmi-object",
	"cdmiq": "application/cdmi-queue",
	"cu": "application/cu-seeme",
	"davmount": "application/davmount+xml",
	"dssc": "application/dssc+der",
	"xdssc": "application/dssc+xml",
	"ecma": "application/ecmascript",
	"emma": "application/emma+xml",
	"epub": "application/epub+zip",
	"exi": "application/exi",
	"pfr": "application/font-tdpfr",
	"stk": "application/hyperstudio",
	"ipfix": "application/ipfix",
	"jar": "application/java-archive",
	"ser": "application/java-serialized-object",
	"class": "application/java-vm",
	"js": "application/javascript",
	"json": "application/json",
	"lostxml": "application/lost+xml",
	"hqx": "application/mac-binhex40",
	"cpt": "application/mac-compactpro",
	"mads": "application/mads+xml",
	"mrc": "application/marc",
	"mrcx": "application/marcxml+xml",
	"ma": "application/mathematica",
	"nb": "application/mathematica",
	"mb": "application/mathematica",
	"mathml": "application/mathml+xml",
	"mbox": "application/mbox",
	"mscml": "application/mediaservercontrol+xml",
	"meta4": "application/metalink4+xml",
	"mets": "application/mets+xml",
	"mods": "application/mods+xml",
	"m21": "application/mp21",
	"mp21": "application/mp21",
	"mp4s": "application/mp4",
	"doc": "application/msword",
	"dot": "application/msword",
	"mxf": "application/mxf",
	"bin": "application/octet-stream",
	"dms": "application/octet-stream",
	"lha": "application/octet-stream",
	"lrf": "application/octet-stream",
	"lzh": "application/octet-stream",
	"so": "application/octet-stream",
	"iso": "application/octet-stream",
	"dmg": "application/octet-stream",
	"dist": "application/octet-stream",
	"distz": "application/octet-stream",
	"pkg": "application/octet-stream",
	"bpk": "application/octet-stream",
	"dump": "application/octet-stream",
	"elc": "application/octet-stream",
	"deploy": "application/octet-stream",
	"oda": "application/oda",
	"opf": "application/oebps-package+xml",
	"ogx": "application/ogg",
	"onetoc": "application/onenote",
	"onetoc2": "application/onenote",
	"onetmp": "application/onenote",
	"onepkg": "application/onenote",
	"xer": "application/patch-ops-error+xml",
	"pdf": "application/pdf",
	"pgp": "application/pgp-encrypted",
	"asc": "application/pgp-signature",
	"sig": "application/pgp-signature",
	"prf": "application/pics-rules",
	"p10": "application/pkcs10",
	"p7m": "application/pkcs7-mime",
	"p7c": "application/pkcs7-mime",
	"p7s": "application/pkcs7-signature",
	"p8": "application/pkcs8",
	"ac": "application/pkix-attr-cert",
	"cer": "application/pkix-cert",
	"crl": "application/pkix-crl",
	"pkipath": "application/pkix-pkipath",
	"pki": "application/pkixcmp",
	"pls": "application/pls+xml",
	"ai": "application/postscript",
	"eps": "application/postscript",
	"ps": "application/postscript",
	"cww": "application/prs.cww",
	"pskcxml": "application/pskc+xml",
	"rdf": "application/rdf+xml",
	"rif": "application/reginfo+xml",
	"rnc": "application/relax-ng-compact-syntax",
	"rl": "application/resource-lists+xml",
	"rld": "application/resource-lists-diff+xml",
	"rs": "application/rls-services+xml",
	"rsd": "application/rsd+xml",
	"rss": "application/rss+xml",
	"rtf": "application/rtf",
	"sbml": "application/sbml+xml",
	"scq": "application/scvp-cv-request",
	"scs": "application/scvp-cv-response",
	"spq": "application/scvp-vp-request",
	"spp": "application/scvp-vp-response",
	"sdp": "application/sdp",
	"setpay": "application/set-payment-initiation",
	"setreg": "application/set-registration-initiation",
	"shf": "application/shf+xml",
	"smi": "application/smil+xml",
	"smil": "application/smil+xml",
	"rq": "application/sparql-query",
	"srx": "application/sparql-results+xml",
	"gram": "application/srgs",
	"grxml": "application/srgs+xml",
	"sru": "application/sru+xml",
	"ssml": "application/ssml+xml",
	"tei": "application/tei+xml",
	"teicorpus": "application/tei+xml",
	"tfi": "application/thraud+xml",
	"tsd": "application/timestamped-data",
	"plb": "application/vnd.3gpp.pic-bw-large",
	"psb": "application/vnd.3gpp.pic-bw-small",
	"pvb": "application/vnd.3gpp.pic-bw-var",
	"tcap": "application/vnd.3gpp2.tcap",
	"pwn": "application/vnd.3m.post-it-notes",
	"aso": "application/vnd.accpac.simply.aso",
	"imp": "application/vnd.accpac.simply.imp",
	"acu": "application/vnd.acucobol",
	"atc": "application/vnd.acucorp",
	"acutc": "application/vnd.acucorp",
	"air": "application/vnd.adobe.air-application-installer-package+zip",
	"fxp": "application/vnd.adobe.fxp",
	"fxpl": "application/vnd.adobe.fxp",
	"xdp": "application/vnd.adobe.xdp+xml",
	"xfdf": "application/vnd.adobe.xfdf",
	"ahead": "application/vnd.ahead.space",
	"azf": "application/vnd.airzip.filesecure.azf",
	"azs": "application/vnd.airzip.filesecure.azs",
	"azw": "application/vnd.amazon.ebook",
	"acc": "application/vnd.americandynamics.acc",
	"ami": "application/vnd.amiga.ami",
	"apk": "application/vnd.android.package-archive",
	"cii": "application/vnd.anser-web-certificate-issue-initiation",
	"fti": "application/vnd.anser-web-funds-transfer-initiation",
	"atx": "application/vnd.antix.game-component",
	"mpkg": "application/vnd.apple.installer+xml",
	"m3u8": "application/vnd.apple.mpegurl",
	"swi": "application/vnd.aristanetworks.swi",
	"aep": "application/vnd.audiograph",
	"mpm": "application/vnd.blueice.multipass",
	"bmi": "application/vnd.bmi",
	"rep": "application/vnd.businessobjects",
	"cdxml": "application/vnd.chemdraw+xml",
	"mmd": "application/vnd.chipnuts.karaoke-mmd",
	"cdy": "application/vnd.cinderella",
	"cla": "application/vnd.claymore",
	"rp9": "application/vnd.cloanto.rp9",
	"c4g": "application/vnd.clonk.c4group",
	"c4d": "application/vnd.clonk.c4group",
	"c4f": "application/vnd.clonk.c4group",
	"c4p": "application/vnd.clonk.c4group",
	"c4u": "application/vnd.clonk.c4group",
	"c11amc": "application/vnd.cluetrust.cartomobile-config",
	"c11amz": "application/vnd.cluetrust.cartomobile-config-pkg",
	"csp": "application/vnd.commonspace",
	"cdbcmsg": "application/vnd.contact.cmsg",
	"cmc": "application/vnd.cosmocaller",
	"clkx": "application/vnd.crick.clicker",
	"clkk": "application/vnd.crick.clicker.keyboard",
	"clkp": "application/vnd.crick.clicker.palette",
	"clkt": "application/vnd.crick.clicker.template",
	"clkw": "application/vnd.crick.clicker.wordbank",
	"wbs": "application/vnd.criticaltools.wbs+xml",
	"pml": "application/vnd.ctc-posml",
	"ppd": "application/vnd.cups-ppd",
	"car": "application/vnd.curl.car",
	"pcurl": "application/vnd.curl.pcurl",
	"rdz": "application/vnd.data-vision.rdz",
	"uvf": "application/vnd.dece.data",
	"uvvf": "application/vnd.dece.data",
	"uvd": "application/vnd.dece.data",
	"uvvd": "application/vnd.dece.data",
	"uvt": "application/vnd.dece.ttml+xml",
	"uvvt": "application/vnd.dece.ttml+xml",
	"uvx": "application/vnd.dece.unspecified",
	"uvvx": "application/vnd.dece.unspecified",
	"fe_launch": "application/vnd.denovo.fcselayout-link",
	"dna": "application/vnd.dna",
	"mlp": "application/vnd.dolby.mlp",
	"dpg": "application/vnd.dpgraph",
	"dfac": "application/vnd.dreamfactory",
	"ait": "application/vnd.dvb.ait",
	"svc": "application/vnd.dvb.service",
	"geo": "application/vnd.dynageo",
	"mag": "application/vnd.ecowin.chart",
	"nml": "application/vnd.enliven",
	"esf": "application/vnd.epson.esf",
	"msf": "application/vnd.epson.msf",
	"qam": "application/vnd.epson.quickanime",
	"slt": "application/vnd.epson.salt",
	"ssf": "application/vnd.epson.ssf",
	"es3": "application/vnd.eszigno3+xml",
	"et3": "application/vnd.eszigno3+xml",
	"ez2": "application/vnd.ezpix-album",
	"ez3": "application/vnd.ezpix-package",
	"fdf": "application/vnd.fdf",
	"mseed": "application/vnd.fdsn.mseed",
	"seed": "application/vnd.fdsn.seed",
	"dataless": "application/vnd.fdsn.seed",
	"gph": "application/vnd.flographit",
	"ftc": "application/vnd.fluxtime.clip",
	"fm": "application/vnd.framemaker",
	"frame": "application/vnd.framemaker",
	"maker": "application/vnd.framemaker",
	"book": "application/vnd.framemaker",
	"fnc": "application/vnd.frogans.fnc",
	"ltf": "application/vnd.frogans.ltf",
	"fsc": "application/vnd.fsc.weblaunch",
	"oas": "application/vnd.fujitsu.oasys",
	"oa2": "application/vnd.fujitsu.oasys2",
	"oa3": "application/vnd.fujitsu.oasys3",
	"fg5": "application/vnd.fujitsu.oasysgp",
	"bh2": "application/vnd.fujitsu.oasysprs",
	"ddd": "application/vnd.fujixerox.ddd",
	"xdw": "application/vnd.fujixerox.docuworks",
	"xbd": "application/vnd.fujixerox.docuworks.binder",
	"fzs": "application/vnd.fuzzysheet",
	"txd": "application/vnd.genomatix.tuxedo",
	"ggb": "application/vnd.geogebra.file",
	"ggt": "application/vnd.geogebra.tool",
	"gex": "application/vnd.geometry-explorer",
	"gre": "application/vnd.geometry-explorer",
	"gxt": "application/vnd.geonext",
	"g2w": "application/vnd.geoplan",
	"g3w": "application/vnd.geospace",
	"gmx": "application/vnd.gmx",
	"kml": "application/vnd.google-earth.kml+xml",
	"kmz": "application/vnd.google-earth.kmz",
	"gqf": "application/vnd.grafeq",
	"gqs": "application/vnd.grafeq",
	"gac": "application/vnd.groove-account",
	"ghf": "application/vnd.groove-help",
	"gim": "application/vnd.groove-identity-message",
	"grv": "application/vnd.groove-injector",
	"gtm": "application/vnd.groove-tool-message",
	"tpl": "application/vnd.groove-tool-template",
	"vcg": "application/vnd.groove-vcard",
	"hal": "application/vnd.hal+xml",
	"zmm": "application/vnd.handheld-entertainment+xml",
	"hbci": "application/vnd.hbci",
	"les": "application/vnd.hhe.lesson-player",
	"hpgl": "application/vnd.hp-hpgl",
	"hpid": "application/vnd.hp-hpid",
	"hps": "application/vnd.hp-hps",
	"jlt": "application/vnd.hp-jlyt",
	"pcl": "application/vnd.hp-pcl",
	"pclxl": "application/vnd.hp-pclxl",
	"sfd-hdstx": "application/vnd.hydrostatix.sof-data",
	"x3d": "application/vnd.hzn-3d-crossword",
	"mpy": "application/vnd.ibm.minipay",
	"afp": "application/vnd.ibm.modcap",
	"listafp": "application/vnd.ibm.modcap",
	"list3820": "application/vnd.ibm.modcap",
	"irm": "application/vnd.ibm.rights-management",
	"sc": "application/vnd.ibm.secure-container",
	"icc": "application/vnd.iccprofile",
	"icm": "application/vnd.iccprofile",
	"igl": "application/vnd.igloader",
	"ivp": "application/vnd.immervision-ivp",
	"ivu": "application/vnd.immervision-ivu",
	"igm": "application/vnd.insors.igm",
	"xpw": "application/vnd.intercon.formnet",
	"xpx": "application/vnd.intercon.formnet",
	"i2g": "application/vnd.intergeo",
	"qbo": "application/vnd.intu.qbo",
	"qfx": "application/vnd.intu.qfx",
	"rcprofile": "application/vnd.ipunplugged.rcprofile",
	"irp": "application/vnd.irepository.package+xml",
	"xpr": "application/vnd.is-xpr",
	"fcs": "application/vnd.isac.fcs",
	"jam": "application/vnd.jam",
	"rms": "application/vnd.jcp.javame.midlet-rms",
	"jisp": "application/vnd.jisp",
	"joda": "application/vnd.joost.joda-archive",
	"ktz": "application/vnd.kahootz",
	"ktr": "application/vnd.kahootz",
	"karbon": "application/vnd.kde.karbon",
	"chrt": "application/vnd.kde.kchart",
	"kfo": "application/vnd.kde.kformula",
	"flw": "application/vnd.kde.kivio",
	"kon": "application/vnd.kde.kontour",
	"kpr": "application/vnd.kde.kpresenter",
	"kpt": "application/vnd.kde.kpresenter",
	"ksp": "application/vnd.kde.kspread",
	"kwd": "application/vnd.kde.kword",
	"kwt": "application/vnd.kde.kword",
	"htke": "application/vnd.kenameaapp",
	"kia": "application/vnd.kidspiration",
	"kne": "application/vnd.kinar",
	"knp": "application/vnd.kinar",
	"skp": "application/vnd.koan",
	"skd": "application/vnd.koan",
	"skt": "application/vnd.koan",
	"skm": "application/vnd.koan",
	"sse": "application/vnd.kodak-descriptor",
	"lasxml": "application/vnd.las.las+xml",
	"lbd": "application/vnd.llamagraphics.life-balance.desktop",
	"lbe": "application/vnd.llamagraphics.life-balance.exchange+xml",
	"apr": "application/vnd.lotus-approach",
	"pre": "application/vnd.lotus-freelance",
	"nsf": "application/vnd.lotus-notes",
	"org": "application/vnd.lotus-organizer",
	"scm": "application/vnd.lotus-screencam",
	"lwp": "application/vnd.lotus-wordpro",
	"portpkg": "application/vnd.macports.portpkg",
	"mcd": "application/vnd.mcd",
	"mc1": "application/vnd.medcalcdata",
	"cdkey": "application/vnd.mediastation.cdkey",
	"mwf": "application/vnd.mfer",
	"mfm": "application/vnd.mfmp",
	"flo": "application/vnd.micrografx.flo",
	"igx": "application/vnd.micrografx.igx",
	"mif": "application/vnd.mif",
	"daf": "application/vnd.mobius.daf",
	"dis": "application/vnd.mobius.dis",
	"mbk": "application/vnd.mobius.mbk",
	"mqy": "application/vnd.mobius.mqy",
	"msl": "application/vnd.mobius.msl",
	"plc": "application/vnd.mobius.plc",
	"txf": "application/vnd.mobius.txf",
	"mpn": "application/vnd.mophun.application",
	"mpc": "application/vnd.mophun.certificate",
	"xul": "application/vnd.mozilla.xul+xml",
	"cil": "application/vnd.ms-artgalry",
	"cab": "application/vnd.ms-cab-compressed",
	"xls": "application/vnd.ms-excel",
	"xlm": "application/vnd.ms-excel",
	"xla": "application/vnd.ms-excel",
	"xlc": "application/vnd.ms-excel",
	"xlt": "application/vnd.ms-excel",
	"xlw": "application/vnd.ms-excel",
	"xlam": "application/vnd.ms-excel.addin.macroenabled.12",
	"xlsb": "application/vnd.ms-excel.sheet.binary.macroenabled.12",
	"xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
	"xltm": "application/vnd.ms-excel.template.macroenabled.12",
	"eot": "application/vnd.ms-fontobject",
	"chm": "application/vnd.ms-htmlhelp",
	"ims": "application/vnd.ms-ims",
	"lrm": "application/vnd.ms-lrm",
	"thmx": "application/vnd.ms-officetheme",
	"cat": "application/vnd.ms-pki.seccat",
	"stl": "application/vnd.ms-pki.stl",
	"ppt": "application/vnd.ms-powerpoint",
	"pps": "application/vnd.ms-powerpoint",
	"pot": "application/vnd.ms-powerpoint",
	"ppam": "application/vnd.ms-powerpoint.addin.macroenabled.12",
	"pptm": "application/vnd.ms-powerpoint.presentation.macroenabled.12",
	"sldm": "application/vnd.ms-powerpoint.slide.macroenabled.12",
	"ppsm": "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
	"potm": "application/vnd.ms-powerpoint.template.macroenabled.12",
	"mpp": "application/vnd.ms-project",
	"mpt": "application/vnd.ms-project",
	"docm": "application/vnd.ms-word.document.macroenabled.12",
	"dotm": "application/vnd.ms-word.template.macroenabled.12",
	"wps": "application/vnd.ms-works",
	"wks": "application/vnd.ms-works",
	"wcm": "application/vnd.ms-works",
	"wdb": "application/vnd.ms-works",
	"wpl": "application/vnd.ms-wpl",
	"xps": "application/vnd.ms-xpsdocument",
	"mseq": "application/vnd.mseq",
	"mus": "application/vnd.musician",
	"msty": "application/vnd.muvee.style",
	"nlu": "application/vnd.neurolanguage.nlu",
	"nnd": "application/vnd.noblenet-directory",
	"nns": "application/vnd.noblenet-sealer",
	"nnw": "application/vnd.noblenet-web",
	"ngdat": "application/vnd.nokia.n-gage.data",
	"n-gage": "application/vnd.nokia.n-gage.symbian.install",
	"rpst": "application/vnd.nokia.radio-preset",
	"rpss": "application/vnd.nokia.radio-presets",
	"edm": "application/vnd.novadigm.edm",
	"edx": "application/vnd.novadigm.edx",
	"ext": "application/vnd.novadigm.ext",
	"odc": "application/vnd.oasis.opendocument.chart",
	"otc": "application/vnd.oasis.opendocument.chart-template",
	"odb": "application/vnd.oasis.opendocument.database",
	"odf": "application/vnd.oasis.opendocument.formula",
	"odft": "application/vnd.oasis.opendocument.formula-template",
	"odg": "application/vnd.oasis.opendocument.graphics",
	"otg": "application/vnd.oasis.opendocument.graphics-template",
	"odi": "application/vnd.oasis.opendocument.image",
	"oti": "application/vnd.oasis.opendocument.image-template",
	"odp": "application/vnd.oasis.opendocument.presentation",
	"otp": "application/vnd.oasis.opendocument.presentation-template",
	"ods": "application/vnd.oasis.opendocument.spreadsheet",
	"ots": "application/vnd.oasis.opendocument.spreadsheet-template",
	"odt": "application/vnd.oasis.opendocument.text",
	"odm": "application/vnd.oasis.opendocument.text-master",
	"ott": "application/vnd.oasis.opendocument.text-template",
	"oth": "application/vnd.oasis.opendocument.text-web",
	"xo": "application/vnd.olpc-sugar",
	"dd2": "application/vnd.oma.dd2+xml",
	"oxt": "application/vnd.openofficeorg.extension",
	"pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"sldx": "application/vnd.openxmlformats-officedocument.presentationml.slide",
	"ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
	"potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
	"xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
	"docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
	"mgp": "application/vnd.osgeo.mapguide.package",
	"dp": "application/vnd.osgi.dp",
	"pdb": "application/vnd.palm",
	"pqa": "application/vnd.palm",
	"oprc": "application/vnd.palm",
	"paw": "application/vnd.pawaafile",
	"str": "application/vnd.pg.format",
	"ei6": "application/vnd.pg.osasli",
	"efif": "application/vnd.picsel",
	"wg": "application/vnd.pmi.widget",
	"plf": "application/vnd.pocketlearn",
	"pbd": "application/vnd.powerbuilder6",
	"box": "application/vnd.previewsystems.box",
	"mgz": "application/vnd.proteus.magazine",
	"qps": "application/vnd.publishare-delta-tree",
	"ptid": "application/vnd.pvi.ptid1",
	"qxd": "application/vnd.quark.quarkxpress",
	"qxt": "application/vnd.quark.quarkxpress",
	"qwd": "application/vnd.quark.quarkxpress",
	"qwt": "application/vnd.quark.quarkxpress",
	"qxl": "application/vnd.quark.quarkxpress",
	"qxb": "application/vnd.quark.quarkxpress",
	"bed": "application/vnd.realvnc.bed",
	"mxl": "application/vnd.recordare.musicxml",
	"musicxml": "application/vnd.recordare.musicxml+xml",
	"cryptonote": "application/vnd.rig.cryptonote",
	"cod": "application/vnd.rim.cod",
	"rm": "application/vnd.rn-realmedia",
	"link66": "application/vnd.route66.link66+xml",
	"st": "application/vnd.sailingtracker.track",
	"see": "application/vnd.seemail",
	"sema": "application/vnd.sema",
	"semd": "application/vnd.semd",
	"semf": "application/vnd.semf",
	"ifm": "application/vnd.shana.informed.formdata",
	"itp": "application/vnd.shana.informed.formtemplate",
	"iif": "application/vnd.shana.informed.interchange",
	"ipk": "application/vnd.shana.informed.package",
	"twd": "application/vnd.simtech-mindmapper",
	"twds": "application/vnd.simtech-mindmapper",
	"mmf": "application/vnd.smaf",
	"teacher": "application/vnd.smart.teacher",
	"sdkm": "application/vnd.solent.sdkm+xml",
	"sdkd": "application/vnd.solent.sdkm+xml",
	"dxp": "application/vnd.spotfire.dxp",
	"sfs": "application/vnd.spotfire.sfs",
	"sdc": "application/vnd.stardivision.calc",
	"sda": "application/vnd.stardivision.draw",
	"sdd": "application/vnd.stardivision.impress",
	"smf": "application/vnd.stardivision.math",
	"sdw": "application/vnd.stardivision.writer",
	"vor": "application/vnd.stardivision.writer",
	"sgl": "application/vnd.stardivision.writer-global",
	"sm": "application/vnd.stepmania.stepchart",
	"sxc": "application/vnd.sun.xml.calc",
	"stc": "application/vnd.sun.xml.calc.template",
	"sxd": "application/vnd.sun.xml.draw",
	"std": "application/vnd.sun.xml.draw.template",
	"sxi": "application/vnd.sun.xml.impress",
	"sti": "application/vnd.sun.xml.impress.template",
	"sxm": "application/vnd.sun.xml.math",
	"sxw": "application/vnd.sun.xml.writer",
	"sxg": "application/vnd.sun.xml.writer.global",
	"stw": "application/vnd.sun.xml.writer.template",
	"sus": "application/vnd.sus-calendar",
	"susp": "application/vnd.sus-calendar",
	"svd": "application/vnd.svd",
	"sis": "application/vnd.symbian.install",
	"sisx": "application/vnd.symbian.install",
	"xsm": "application/vnd.syncml+xml",
	"bdm": "application/vnd.syncml.dm+wbxml",
	"xdm": "application/vnd.syncml.dm+xml",
	"tao": "application/vnd.tao.intent-module-archive",
	"tmo": "application/vnd.tmobile-livetv",
	"tpt": "application/vnd.trid.tpt",
	"mxs": "application/vnd.triscape.mxs",
	"tra": "application/vnd.trueapp",
	"ufd": "application/vnd.ufdl",
	"ufdl": "application/vnd.ufdl",
	"utz": "application/vnd.uiq.theme",
	"umj": "application/vnd.umajin",
	"unityweb": "application/vnd.unity",
	"uoml": "application/vnd.uoml+xml",
	"vcx": "application/vnd.vcx",
	"vsd": "application/vnd.visio",
	"vst": "application/vnd.visio",
	"vss": "application/vnd.visio",
	"vsw": "application/vnd.visio",
	"vis": "application/vnd.visionary",
	"vsf": "application/vnd.vsf",
	"wbxml": "application/vnd.wap.wbxml",
	"wmlc": "application/vnd.wap.wmlc",
	"wmlsc": "application/vnd.wap.wmlscriptc",
	"wtb": "application/vnd.webturbo",
	"nbp": "application/vnd.wolfram.player",
	"wpd": "application/vnd.wordperfect",
	"wqd": "application/vnd.wqd",
	"stf": "application/vnd.wt.stf",
	"xar": "application/vnd.xara",
	"xfdl": "application/vnd.xfdl",
	"hvd": "application/vnd.yamaha.hv-dic",
	"hvs": "application/vnd.yamaha.hv-script",
	"hvp": "application/vnd.yamaha.hv-voice",
	"osf": "application/vnd.yamaha.openscoreformat",
	"osfpvg": "application/vnd.yamaha.openscoreformat.osfpvg+xml",
	"saf": "application/vnd.yamaha.smaf-audio",
	"spf": "application/vnd.yamaha.smaf-phrase",
	"cmp": "application/vnd.yellowriver-custom-menu",
	"zir": "application/vnd.zul",
	"zirz": "application/vnd.zul",
	"zaz": "application/vnd.zzazz.deck+xml",
	"vxml": "application/voicexml+xml",
	"wgt": "application/widget",
	"hlp": "application/winhlp",
	"wsdl": "application/wsdl+xml",
	"wspolicy": "application/wspolicy+xml",
	"7z": "application/x-7z-compressed",
	"abw": "application/x-abiword",
	"ace": "application/x-ace-compressed",
	"aab": "application/x-authorware-bin",
	"x32": "application/x-authorware-bin",
	"u32": "application/x-authorware-bin",
	"vox": "application/x-authorware-bin",
	"aam": "application/x-authorware-map",
	"aas": "application/x-authorware-seg",
	"bcpio": "application/x-bcpio",
	"torrent": "application/x-bittorrent",
	"bz": "application/x-bzip",
	"bz2": "application/x-bzip2",
	"boz": "application/x-bzip2",
	"vcd": "application/x-cdlink",
	"chat": "application/x-chat",
	"pgn": "application/x-chess-pgn",
	"cpio": "application/x-cpio",
	"csh": "application/x-csh",
	"deb": "application/x-debian-package",
	"udeb": "application/x-debian-package",
	"dir": "application/x-director",
	"dcr": "application/x-director",
	"dxr": "application/x-director",
	"cst": "application/x-director",
	"cct": "application/x-director",
	"cxt": "application/x-director",
	"w3d": "application/x-director",
	"fgd": "application/x-director",
	"swa": "application/x-director",
	"wad": "application/x-doom",
	"ncx": "application/x-dtbncx+xml",
	"dtb": "application/x-dtbook+xml",
	"res": "application/x-dtbresource+xml",
	"dvi": "application/x-dvi",
	"bdf": "application/x-font-bdf",
	"gsf": "application/x-font-ghostscript",
	"psf": "application/x-font-linux-psf",
	"otf": "application/x-font-otf",
	"pcf": "application/x-font-pcf",
	"snf": "application/x-font-snf",
	"ttf": "application/x-font-ttf",
	"ttc": "application/x-font-ttf",
	"pfa": "application/x-font-type1",
	"pfb": "application/x-font-type1",
	"pfm": "application/x-font-type1",
	"afm": "application/x-font-type1",
	"woff": "application/x-font-woff",
	"spl": "application/x-futuresplash",
	"gnumeric": "application/x-gnumeric",
	"gtar": "application/x-gtar",
	"hdf": "application/x-hdf",
	"jnlp": "application/x-java-jnlp-file",
	"latex": "application/x-latex",
	"prc": "application/x-mobipocket-ebook",
	"mobi": "application/x-mobipocket-ebook",
	"application": "application/x-ms-application",
	"wmd": "application/x-ms-wmd",
	"wmz": "application/x-ms-wmz",
	"xbap": "application/x-ms-xbap",
	"mdb": "application/x-msaccess",
	"obd": "application/x-msbinder",
	"crd": "application/x-mscardfile",
	"clp": "application/x-msclip",
	"exe": "application/x-msdownload",
	"dll": "application/x-msdownload",
	"com": "application/x-msdownload",
	"bat": "application/x-msdownload",
	"msi": "application/x-msdownload",
	"mvb": "application/x-msmediaview",
	"m13": "application/x-msmediaview",
	"m14": "application/x-msmediaview",
	"wmf": "application/x-msmetafile",
	"mny": "application/x-msmoney",
	"pub": "application/x-mspublisher",
	"scd": "application/x-msschedule",
	"trm": "application/x-msterminal",
	"wri": "application/x-mswrite",
	"nc": "application/x-netcdf",
	"cdf": "application/x-netcdf",
	"p12": "application/x-pkcs12",
	"pfx": "application/x-pkcs12",
	"p7b": "application/x-pkcs7-certificates",
	"spc": "application/x-pkcs7-certificates",
	"p7r": "application/x-pkcs7-certreqresp",
	"rar": "application/x-rar-compressed",
	"sh": "application/x-sh",
	"shar": "application/x-shar",
	"swf": "application/x-shockwave-flash",
	"xap": "application/x-silverlight-app",
	"sit": "application/x-stuffit",
	"sitx": "application/x-stuffitx",
	"sv4cpio": "application/x-sv4cpio",
	"sv4crc": "application/x-sv4crc",
	"tar": "application/x-tar",
	"tcl": "application/x-tcl",
	"tex": "application/x-tex",
	"tfm": "application/x-tex-tfm",
	"texinfo": "application/x-texinfo",
	"texi": "application/x-texinfo",
	"ustar": "application/x-ustar",
	"src": "application/x-wais-source",
	"der": "application/x-x509-ca-cert",
	"crt": "application/x-x509-ca-cert",
	"fig": "application/x-xfig",
	"xpi": "application/x-xpinstall",
	"xdf": "application/xcap-diff+xml",
	"xenc": "application/xenc+xml",
	"xhtml": "application/xhtml+xml",
	"xht": "application/xhtml+xml",
	"xml": "application/xml",
	"xsl": "application/xml",
	"dtd": "application/xml-dtd",
	"xop": "application/xop+xml",
	"xslt": "application/xslt+xml",
	"xspf": "application/xspf+xml",
	"mxml": "application/xv+xml",
	"xhvml": "application/xv+xml",
	"xvml": "application/xv+xml",
	"xvm": "application/xv+xml",
	"yang": "application/yang",
	"yin": "application/yin+xml",
	"zip": "application/zip",
	"adp": "audio/adpcm",
	"au": "audio/basic",
	"snd": "audio/basic",
	"mid": "audio/midi",
	"midi": "audio/midi",
	"kar": "audio/midi",
	"rmi": "audio/midi",
	"mp4a": "audio/mp4",
	"mpga": "audio/mpeg",
	"mp2": "audio/mpeg",
	"mp2a": "audio/mpeg",
	"mp3": "audio/mpeg",
	"m2a": "audio/mpeg",
	"m3a": "audio/mpeg",
	"oga": "audio/ogg",
	"ogg": "audio/ogg",
	"spx": "audio/ogg",
	"uva": "audio/vnd.dece.audio",
	"uvva": "audio/vnd.dece.audio",
	"eol": "audio/vnd.digital-winds",
	"dra": "audio/vnd.dra",
	"dts": "audio/vnd.dts",
	"dtshd": "audio/vnd.dts.hd",
	"lvp": "audio/vnd.lucent.voice",
	"pya": "audio/vnd.ms-playready.media.pya",
	"ecelp4800": "audio/vnd.nuera.ecelp4800",
	"ecelp7470": "audio/vnd.nuera.ecelp7470",
	"ecelp9600": "audio/vnd.nuera.ecelp9600",
	"rip": "audio/vnd.rip",
	"weba": "audio/webm",
	"aac": "audio/x-aac",
	"aif": "audio/x-aiff",
	"aiff": "audio/x-aiff",
	"aifc": "audio/x-aiff",
	"m3u": "audio/x-mpegurl",
	"wax": "audio/x-ms-wax",
	"wma": "audio/x-ms-wma",
	"ram": "audio/x-pn-realaudio",
	"ra": "audio/x-pn-realaudio",
	"rmp": "audio/x-pn-realaudio-plugin",
	"wav": "audio/x-wav",
	"cdx": "chemical/x-cdx",
	"cif": "chemical/x-cif",
	"cmdf": "chemical/x-cmdf",
	"cml": "chemical/x-cml",
	"csml": "chemical/x-csml",
	"xyz": "chemical/x-xyz",
	"bmp": "image/bmp",
	"cgm": "image/cgm",
	"g3": "image/g3fax",
	"gif": "image/gif",
	"ief": "image/ief",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"jpe": "image/jpeg",
	"ktx": "image/ktx",
	"png": "image/png",
	"btif": "image/prs.btif",
	"svg": "image/svg+xml",
	"svgz": "image/svg+xml",
	"tiff": "image/tiff",
	"tif": "image/tiff",
	"psd": "image/vnd.adobe.photoshop",
	"uvi": "image/vnd.dece.graphic",
	"uvvi": "image/vnd.dece.graphic",
	"uvg": "image/vnd.dece.graphic",
	"uvvg": "image/vnd.dece.graphic",
	"sub": "image/vnd.dvb.subtitle",
	"djvu": "image/vnd.djvu",
	"djv": "image/vnd.djvu",
	"dwg": "image/vnd.dwg",
	"dxf": "image/vnd.dxf",
	"fbs": "image/vnd.fastbidsheet",
	"fpx": "image/vnd.fpx",
	"fst": "image/vnd.fst",
	"mmr": "image/vnd.fujixerox.edmics-mmr",
	"rlc": "image/vnd.fujixerox.edmics-rlc",
	"mdi": "image/vnd.ms-modi",
	"npx": "image/vnd.net-fpx",
	"wbmp": "image/vnd.wap.wbmp",
	"xif": "image/vnd.xiff",
	"webp": "image/webp",
	"ras": "image/x-cmu-raster",
	"cmx": "image/x-cmx",
	"fh": "image/x-freehand",
	"fhc": "image/x-freehand",
	"fh4": "image/x-freehand",
	"fh5": "image/x-freehand",
	"fh7": "image/x-freehand",
	"ico": "image/x-icon",
	"pcx": "image/x-pcx",
	"pic": "image/x-pict",
	"pct": "image/x-pict",
	"pnm": "image/x-portable-anymap",
	"pbm": "image/x-portable-bitmap",
	"pgm": "image/x-portable-graymap",
	"ppm": "image/x-portable-pixmap",
	"rgb": "image/x-rgb",
	"xbm": "image/x-xbitmap",
	"xpm": "image/x-xpixmap",
	"xwd": "image/x-xwindowdump",
	"eml": "message/rfc822",
	"mime": "message/rfc822",
	"igs": "model/iges",
	"iges": "model/iges",
	"msh": "model/mesh",
	"mesh": "model/mesh",
	"silo": "model/mesh",
	"dae": "model/vnd.collada+xml",
	"dwf": "model/vnd.dwf",
	"gdl": "model/vnd.gdl",
	"gtw": "model/vnd.gtw",
	"mts": "model/vnd.mts",
	"vtu": "model/vnd.vtu",
	"wrl": "model/vrml",
	"vrml": "model/vrml",
	"ics": "text/calendar",
	"ifb": "text/calendar",
	"css": "text/css",
	"csv": "text/csv",
	"html": "text/html",
	"htm": "text/html",
	"n3": "text/n3",
	"txt": "text/plain",
	"text": "text/plain",
	"conf": "text/plain",
	"def": "text/plain",
	"list": "text/plain",
	"log": "text/plain",
	"in": "text/plain",
	"dsc": "text/prs.lines.tag",
	"rtx": "text/richtext",
	"sgml": "text/sgml",
	"sgm": "text/sgml",
	"tsv": "text/tab-separated-values",
	"t": "text/troff",
	"tr": "text/troff",
	"roff": "text/troff",
	"man": "text/troff",
	"me": "text/troff",
	"ms": "text/troff",
	"ttl": "text/turtle",
	"uri": "text/uri-list",
	"uris": "text/uri-list",
	"urls": "text/uri-list",
	"curl": "text/vnd.curl",
	"dcurl": "text/vnd.curl.dcurl",
	"scurl": "text/vnd.curl.scurl",
	"mcurl": "text/vnd.curl.mcurl",
	"fly": "text/vnd.fly",
	"flx": "text/vnd.fmi.flexstor",
	"gv": "text/vnd.graphviz",
	"3dml": "text/vnd.in3d.3dml",
	"spot": "text/vnd.in3d.spot",
	"jad": "text/vnd.sun.j2me.app-descriptor",
	"wml": "text/vnd.wap.wml",
	"wmls": "text/vnd.wap.wmlscript",
	"s": "text/x-asm",
	"asm": "text/x-asm",
	"c": "text/x-c",
	"cc": "text/x-c",
	"cxx": "text/x-c",
	"cpp": "text/x-c",
	"h": "text/x-c",
	"hh": "text/x-c",
	"dic": "text/x-c",
	"f": "text/x-fortran",
	"for": "text/x-fortran",
	"f77": "text/x-fortran",
	"f90": "text/x-fortran",
	"p": "text/x-pascal",
	"pas": "text/x-pascal",
	"java": "text/x-java-source",
	"etx": "text/x-setext",
	"uu": "text/x-uuencode",
	"vcs": "text/x-vcalendar",
	"vcf": "text/x-vcard",
	"3gp": "video/3gpp",
	"3g2": "video/3gpp2",
	"h261": "video/h261",
	"h263": "video/h263",
	"h264": "video/h264",
	"jpgv": "video/jpeg",
	"jpm": "video/jpm",
	"jpgm": "video/jpm",
	"mj2": "video/mj2",
	"mjp2": "video/mj2",
	"mp4": "video/mp4",
	"mp4v": "video/mp4",
	"mpg4": "video/mp4",
	"mpeg": "video/mpeg",
	"mpg": "video/mpeg",
	"mpe": "video/mpeg",
	"m1v": "video/mpeg",
	"m2v": "video/mpeg",
	"ogv": "video/ogg",
	"qt": "video/quicktime",
	"mov": "video/quicktime",
	"uvh": "video/vnd.dece.hd",
	"uvvh": "video/vnd.dece.hd",
	"uvm": "video/vnd.dece.mobile",
	"uvvm": "video/vnd.dece.mobile",
	"uvp": "video/vnd.dece.pd",
	"uvvp": "video/vnd.dece.pd",
	"uvs": "video/vnd.dece.sd",
	"uvvs": "video/vnd.dece.sd",
	"uvv": "video/vnd.dece.video",
	"uvvv": "video/vnd.dece.video",
	"fvt": "video/vnd.fvt",
	"mxu": "video/vnd.mpegurl",
	"m4u": "video/vnd.mpegurl",
	"pyv": "video/vnd.ms-playready.media.pyv",
	"uvu": "video/vnd.uvvu.mp4",
	"uvvu": "video/vnd.uvvu.mp4",
	"viv": "video/vnd.vivo",
	"webm": "video/webm",
	"f4v": "video/x-f4v",
	"fli": "video/x-fli",
	"flv": "video/x-flv",
	"m4v": "video/x-m4v",
	"asf": "video/x-ms-asf",
	"asx": "video/x-ms-asf",
	"wm": "video/x-ms-wm",
	"wmv": "video/x-ms-wmv",
	"wmx": "video/x-ms-wmx",
	"wvx": "video/x-ms-wvx",
	"avi": "video/x-msvideo",
	"movie": "video/x-sgi-movie",
	"ice": "x-conference/x-cooltalk"
};
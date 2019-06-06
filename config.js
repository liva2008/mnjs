var config = exports;
///////////////////////软件信息/////////////////////////////////////////////////
// 开发者
config.AUTHOR = "liva";
// 初始版本
config.FIRSTVERSION = "0.1.20120113";
// 当前版本
config.CURRENTVERSION = "1.0.20130219";
// 联系邮箱
config.EMAIL = "liva2008@qq.com";

///////////////////////配置选项/////////////////////////////////////////////////
// 服务器监听端口
config.PORT = 8000;

// 调试信息开关,开发过程建议设置为true,生产过程建议设置为false
config.debug = true;
// 模板视图客户端或服务端渲染开关:服务器为true,客户端为flase
config.temp = true;
// 有状态或无状态开关,即有状态开启Session会话true，无状态则不开启false
config.status = false;
// Web服务器是否多核CPU运行
config.multi = false;

// 设置应用中只有statics和upload目录用户可读静态目录
config.getReadDir = function() {
	return /\/(upload|statics)\//i;
};

// 会话失效时间(默认1天时间)毫秒
config.sessionExpiredTime = 3000;

// 设置默认的['application', 'controller', 'action']
config.def = ['test', 'user', 'list'];

// 指定后缀文件和过期日期
config.expiresFile = {
    fileMatch: /gif|png|jpg|js|css/ig,
    maxAge: 60*60*24*365
};

// 配置压缩的列表
config.compressFile = {
    match: /css|js|html/ig
};

// 缓存CACHE大小设置，单位为字节，主要缓存静态资源和模板文件
config.cacheSize = {
        MaxSingleSize: 1024*1024,	//单个文件最大尺寸
        MaxTotalSize: 30*1024*1024 //整个文件Cache最大尺寸
};
//构造函数法:生成实例的时候，使用new关键字exports.UserEntity = function (){	this.username = "";	this.password = "";	this.email = "";	this.type = 1;	this.status = 0;	this.image = "";}//Object.create()法:直接用Object.create()生成实例，不需要用到newexports.UserEntity1 = {	username:"", 	password:"",	email:"",	type:1,	status:0,	image:""};//极简主义法:在createNew()里面，定义一个实例对象，把这个实例对象作为返回值。//然后，在createNew()里面，定义一个实例对象，把这个实例对象作为返回值。exports.UserEntity2 = {	createNew: function (){		var data = {};		data.username = "";		data.password = "";		data.email = "";		data.type = 1;		data.status = 0;		data.image = "";				return data;	}};
var MongoClient = require('mongodb').MongoClient;  
var format = require('util').format;
var mongo = require('mongoskin');

exports.url = format(
	"mongodb://%s:%s@%s:%s/%s?maxPoolSize=1"
    , "test", "test", "127.0.0.1", 27017, "test");

exports.db = mongo.db('test:test@localhost:27017/test?auto_reconnect=true&poolSize=1000',
	{safe:true});
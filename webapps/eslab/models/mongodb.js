var MongoClient = require('mongodb').MongoClient;  
var format = require('util').format;
var mongo = require('mongoskin');

exports.url = format(
	"mongodb://%s:%s@%s:%s/%s?maxPoolSize=1"
    , "eslab", "eslab", "localhost", 27017, "eslab");
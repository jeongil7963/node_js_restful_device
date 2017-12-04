var http = require('http');
http.post = require('http-post');
var user_token = '839ca2c5d60342309677f6f65ffc809c'
var api_key = '58a7ff45425f4d6d809c023ee1790aa2'

http.post('http://192.168.0.6:3000/setting/search', { "user_token" : user_token, "api_key" : api_key }, function(res){
	res.setEncoding('utf8');
	res.on('data', function(chunk) {
		console.log(chunk);
	});
});

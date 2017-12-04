var http = require('http');
http.post = require('http-post');

http.post('http://192.168.0.6:3000/setting/search', { user_token: '839ca2c5d60342309677f6f65ffc809c', api_key: '58a7ff45425f4d6d809c023ee1790aa2' }, function(res){
	res.setEncoding('utf8');
	res.on('data', function(chunk) {
		console.log(chunk);
	});
});

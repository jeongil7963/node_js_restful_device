//user_token
var user_token = '839ca2c5d60342309677f6f65ffc809c'
var api_key = '58a7ff45425f4d6d809c023ee1790aa2'

var http = require('http');
http.post = require('http-post');
var config = require('./config.json');
var water_stop_time = config.water_stop_time; // water_stop_time 값 설정
var shooting_time = config.shooting_time; //shooting time 값 설정
var current_min; // 현재 시각 '분'
var sub_min; // 촬영 시작 전 시간
var camera_interval; // camera 모듈 반복 제어


http.post('http://192.168.0.6:3000/setting/search', { "user_token" : user_token, "api_key" : api_key }, function(res){
	res.setEncoding('utf8');
	res.on('data', function(res) {
		console.log(res);
		var resObj = JSON.parse(res);
		console.log(resObj);
		water_stop_time = res[0];
		shooting_time = res[4];
		console.log(water_stop_time);
		console.log(shooting_time);
	});
});

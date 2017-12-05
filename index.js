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

//설정 및 촬영 소켓 모듈
var socket2 = require('socket.io-client')('http://13.124.28.87:3000');

//카메라 사용자 촬영 설정
var timeInMs;
var exec_photo = require('child_process').exec;
var photo_path;
var cmd_photo;

var socket = require('socket.io-client')('http://13.124.28.87:5001'); // 소켓서버에 연결
var dl = require('delivery'); // 파일 전송 모듈
var moment = require('moment'); // moment 시간 모듈
var mqtt = require('mqtt'); // mqtt 모듈
var client = mqtt.connect('mqtt://13.124.28.87'); // mqtt 서버 접속
var http = require('http'); // http socket
var delivery; // delivery 전역 설정
var temp = {}; //소켓통신으로 이미지 파일을 서버로 전송

//관수 모듈//
var GPIO = require('onoff').Gpio;
var onoffcontroller = new GPIO(21, 'out');

//수분 측정 모듈//
var SerialPort = require('serialport'); //아두이노와 시리얼 통신할 수 있는 모듈
var parsers = SerialPort.parsers;
var parser = new parsers.Readline({
  delimiter: '\r\n'
});

//라즈베리파이와 연결된 디바이스 주소
var port = new SerialPort('/dev/ttyACM0', {
  baudrate: 9600
});

// user_token, api_key 유효성 검사
// 설정 시간 받기
http.post('http://192.168.0.6:3000/setting/search', {
  "user_token": user_token,
  "api_key": api_key
}, function(res) {
  res.setEncoding('utf8');
  res.on('data', function(res) {
    var resObj = JSON.parse(res);

    if (resObj.resultmsg == 'setting search success') {
      console.log(resObj);
      water_stop_time = resObj.ras_watering_operatingtime;
      shooting_time = resObj.ras_camera_operatingtime;
      //module_start();
    } else {
      console.log('user_token or api_key are wrong');
    }

  });
});

/*

//통신 후 db 재설정 및 카메라 모듈 재시작
function rederection() {
  // user_token, api_key 유효성 검사
  // 설정 시간 받기
  http.post('http://192.168.0.6:3000/setting/search', {
    "user_token": user_token,
    "api_key": api_key
  }, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(res) {
      var resObj = JSON.parse(res);
      if (resObj.resultmsg == 'setting search success') {
        console.log(resObj);
        water_stop_time = resObj.ras_watering_operatingtime;
        shooting_time = resObj.ras_camera_operatingtime;
        //module_start();
      } else {
        console.log('user_token or api_key are wrong');
      }
    });
  });
}


//카메라 모듈 시작
function module_start() {
  current_min = moment().format('m'); // 현재 시간 분 설정
  console.log("current_min : " + current_min);

  if ((current_min % shooting_time) == 0) { // 만약 0이면 바로 촬영 시작
    sub_min = 0;
  } else { // 0이 아닐시 남은 시간 설정 후 촬영 시작
    sub_min = shooting_time - (current_min % shooting_time);
  }
  console.log('sub_min : ' + sub_min);

  setTimeout(() => {
    console.log('timeout ' + sub_min + ' minute');
    camera_starting();
  }, 1000 * 60 * sub_min); // 제한된 시간 후에 촬영 시작
};

//소켓 연결 및 전송 모듈 설정
socket.on('connect', function() {
  console.log("Socket1 connected");
  //delivery 패키지 이용
  delivery = dl.listen(socket);
  delivery.connect();
  delivery.on('delivery.connect', function(delivery) {
    delivery.on('send.success', function(file) {
      console.log('File sent successfully!');
    });
  });
});

// 카메라 설정 시간 간격 마다 촬영 실행
function camera_starting() {
  camera_setting(); // 처음 한번 촬영
  camera_interval = setInterval(camera_setting, 1000 * 60 * shooting_time); // 설정 시간 후에 반복 촬영
};

// 현재 시간으로 카메라 설정 세팅
function camera_setting() {
  timeInMs = moment().format('YYYYMMDDHHmmss');
  photo_path = __dirname + "/images/" + timeInMs + ".jpg";
  cmd_photo = 'raspistill -vf -t 1 -w 600 -h 420 -o ' + photo_path;
  setTimeout(() => {
    camera_shooting();
  }, 500);
};

// 설정된 값으로 카메라 촬영
function camera_shooting() {
  exec_photo(cmd_photo, function(err, stdout, stderr) {
    if (err) {
      console.log('child process exited with shooting_photo error code', err.code);
      return;
    }
    console.log("photo captured with filename: " + timeInMs);
    camera_sending();
  });
}

// 촬영 이미지 전송
function camera_sending() {
  delivery.send({
    name: timeInMs,
    path: __dirname + '/images/' + timeInMs + ".jpg",
    params: {
      channel: field_id,
      img_name: timeInMs + ".jpg"
    }
  });
};

// 관수
// MQTT pub/sub
client.on('connect', function() {
  client.subscribe('/' + field_id + '/onoff');
});

//callback
client.on('message', function(topic, message) {
  // message is Buffer
  console.log(message.toString());
  if (message.toString() === '1') {
    console.log('watering on');
    onoffcontroller.writeSync(1);
    watering_stop();
  } else if (message.toString() === '0') {
    console.log('watering off');
    onoffcontroller.writeSync(0);
  } else {
    console.log('watering error ');
    var error_time = new Date.toString();
    var get_message = message.toString();
    var error_temp = {
      error_time: get_message
    };
    temp.add(error_temp);
  }
  //port.write(message.toString(), function(err) {});
});

// 설정된 시간으로 관수 정지
function watering_stop() {
  setTimeout(() => {
    console.log('water_stop_time : ' + water_stop_time);
    console.log('watering off');
    onoffcontroller.writeSync(0);
  }, water_stop_time * 1000);
};

*/

// 수분 측정
port.pipe(parser);

//포트 열기
port.on('open', function() {
  console.log('port open');
});

// open errors will be emitted as an error event
port.on('error', function(err) {
  console.log('Error: ', err.message);
});

parser.on('data', function(data) {
  console.log('Read and Send Data : ' + data);

  var sensorObj = data.toString(); // json 형식 data를 객체형식으로 저장
  var insert_url = 'http://localhost:3000/insert?'
  insert_url += 'user_token=' + user_token
  insert_url += '&api_key=' + api_key
  insert_url += '&sv_sensor1=' + sensorObj;
  
  http.post(insert_url, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      //console.log(JSON.parse(data).explanation);
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
});

// 설정 버튼, 사용자 카메라 촬영
// 소켓 연결
socket2.on('connect', function() {
  console.log('socket2 connected');
});

socket2.on(field_id, function(data) {
  //shoot일 때 카메라 직접 촬영
  if (data == "shoot") {
    console.log('client camera shoot');
    camera_setting();
  }
  //데이터베이스 설정 재연결
  else {
    console.log('web_socket : ' + data);
    if (camera_interval != null) {
      clearInterval(camera_interval);

    } else {
      console.log('camera setting before starting shot')
    }
    rederection();
  }
});

socket2.on('disconnect', function() {
  console.log('socket2 disconnected');
});

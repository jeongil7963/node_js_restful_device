//user_token, api_key 설정
var user_token = '839ca2c5d60342309677f6f65ffc809c';
var api_key = '58a7ff45425f4d6d809c023ee1790aa2';


var http = require('http');
http.post = require('http-post');
var async = require('async');
var fs = require("fs"); //Load the filesystem module
var path = require('path');

//option 설정
var config = require('./config.json');
var water_stop_time = config.water_stop_time; // water_stop_time 값 설정
var shooting_time = config.shooting_time; //shooting time 값 설정
var current_min; // 현재 시각 '분'
var sub_min; // 촬영 시작 전 시간
var camera_interval; // camera 모듈 반복 제어

//설정 및 촬영 소켓 모듈
var dl = require('delivery');
var socket2 = require('socket.io-client')('http://192.168.0.6:5000');

//카메라 사용자 촬영 설정
var timeInMs;
var exec_photo = require('child_process').exec;
var photo_path;
var cmd_photo;
var moment = require('moment'); // moment 시간 모듈

var Horizontal = ""; // 수평
var Vertical = ""; // 수직
var brightness = "50"; // 밝기
var saturation = "0"; // 채도
var iso  = "400"; // 감도
var contrast = "0"; //명암

//관수 모듈
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
  baudRate: 9600
});

var imgFolder = path.resolve(__dirname);
var postFolder = path.resolve(__dirname);
var folderArr = ['images'];

// user_token, api_key 유효성 검사
// 설정 시간 받기
http.post('http://192.168.0.6:3000/device', {
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
      arryCreateFolder(postFolder, folderArr);
      module_start();
      console.log("camera_start");
    } else {
      console.log('user_token or api_key are wrong');
    }
  });
});

/* 배열로 된 폴더명을 받아서 하위폴더를 구성해준다. -- main */
function arryCreateFolder(imgFolder, folderArr) {
  var nFolder = imgFolder;
  for (folder in folderArr) {
    var status = searchFolder(nFolder, folderArr[folder]);
    if (!status) {
      var createStatus = createFolder(nFolder, folderArr[folder]);
      nFolder = path.join(nFolder, folderArr[folder]);
    }
  }
}

// 폴더를 생성하는 역할을 맡는다.
function createFolder(folder, createFolder) {
  var tgFolder = path.join(folder, createFolder);
  console.log("createFolder ==> " + tgFolder);
  fs.mkdir(tgFolder, 0777, function(err) {
    if (err) {
      return false;
    } else {
      console.log('create newDir');
      return true;
    }
  });
}

// 폴더가 존재하는지 찾는다. 있다면 폴더위치를 리턴하고, 없다면 false를 리턴한다.
function searchFolder(folder, srhFolder) {
  var rtnFolder;
  fs.readdir(folder, function(err, files) {
    if (err) throw err;
    files.forEach(function(file) {
      if (file == srhFolder) {
        fs.stat(path.join(folder, file), function(err, stats) {
          if (stats.isDirectory()) {
            return path.join(folder, file);
          }
        });
      }
    });
  });
  return false;
}


//통신 후 db 재설정 및 카메라 모듈 재시작
function rederection() {
  // user_token, api_key 유효성 검사
  // 설정 시간 받기
  http.post('http://192.168.0.6:3000/device', {
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
        module_start();
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

// 카메라 설정 시간 간격 마다 촬영 실행
function camera_starting() {
  camera_setting(); // 처음 한번 촬영
  camera_interval = setInterval(camera_setting, 1000 * 60 * shooting_time); // 설정 시간 후에 반복 촬영
};

function camera_setting() {
  async.waterfall([
      function(callback) {
        timeInMs = moment().format('YYYYMMDDHHmmss');
        photo_path = __dirname + "/images/" + timeInMs + ".jpg";
        cmd_photo = 'raspistill ';
        cmd_photo += Vertical;
        cmd_photo += Horizontal;
        cmd_photo += ' -br ' + brightness;
        cmd_photo += ' -sa ' + saturation;
        //cmd_photo += ' -ISO ' + iso;
        cmd_photo += ' -co ' + contrast;
        cmd_photo += ' -t 1 -w 1600 -h 900 -o ' + photo_path;
        callback(null, '1');
      },
      function(arg, callback) {
        console.log("cmd_photo " + cmd_photo);
        exec_photo(cmd_photo, function(err, stdout, stderr) {
          if (err) {
            console.log('child process exited with shooting_photo error code', err.code);
            return;
          }
          console.log("photo captured with filename: " + timeInMs);
          callback(null, '2');
        });
      },
      function(arg, callback) {
        var stats = fs.statSync(photo_path);
        var ci_imgsize = stats.size;
        console.log("image trnasmit function call")
        http.post('http://192.168.0.6:3000/device/camera', {
          "user_token": user_token,
          "api_key": api_key,
          "ci_imgsize": ci_imgsize,
          "ci_imgname": timeInMs
        }, function(res) {
          res.setEncoding('utf8');
          res.on('data', function(res) {
            var resObj = JSON.parse(res);
            console.log(resObj);
            callback(null, resObj);
          });
        });
      },
      function(arg, callback) {
        delivery.send({
          name: timeInMs + '.jpg',
          path: __dirname + '/images/' + timeInMs + ".jpg",
          params: {
            path: arg.ci_imgpath
          }
        });
        callback(null, '4');
      }
    ],
    function(err, result) {
      if (err) {
        console.log(err);
      }
      console.log("camera shot complete : " + result)
    });
}

// 수분 측정
port.pipe(parser);
//포트 열기
port.on('open', function() {
  console.log('port open');
});
//포트 열기 에러 처리
port.on('error', function(err) {
  console.log('Error: ', err.message);
});
//측정 데이터 보내기
parser.on('data', function(data) {
  console.log('Read and Send Data : ' + data);
  var sensorObj = data.toString(); // json 형식 data를 객체형식으로 저장
  http.post('http://192.168.0.6:3000/device/moisture', {
    "user_token": user_token,
    "api_key": api_key,
    "sv_sensor1": sensorObj
  }, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(res) {
      var resObj = JSON.parse(res);
      console.log(resObj);
    });
  });
});


// 설정 버튼, 사용자 카메라 촬영
// 소켓 연결
socket2.on('connect', function() {
  console.log('socket2 connected');
  delivery = dl.listen(socket2);
  delivery.connect();

  delivery.on('delivery.connect', function(delivery) {

    delivery.on('send.success', function(file) {
      console.log('File sent successfully!');
    });
  });
});

socket2.on(user_token, function(data) {
  console.log('user_token : ' + data.user_token);
  console.log('api_key : ' + data.api_key);
  console.log('msg : ' + data.msg);
  if (data.api_key == api_key && data.user_token == user_token) {
    if (data.msg == "shoot") {
      //shoot일 때 카메라 직접 촬영
      camera_setting();
    } else if (data.msg == "option") {
      //옵션 재설정
      if (camera_interval != null) {
        clearInterval(camera_interval);
      } else {
        console.log('camera setting before starting shot')
      }
      rederection();
    } else if (data.msg == "water_start") {
      onoffcontroller.writeSync(1);
      watering_insert();
      watering_stop();
    } else if (data.msg == "water_stop") {
      console.log('watering off');
      onoffcontroller.writeSync(0);
      http.post('http://192.168.0.6:3000/device/watering', {
        "user_token": user_token,
        "api_key": api_key,
        "wc_type": 'stop',
        "wc_operatingtime": water_stop_time
      }, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(res) {
          var resObj = JSON.parse(res);
          console.log(resObj);
        });
      });
      var obj = {
        user_token: "839ca2c5d60342309677f6f65ffc809c",
        api_key: "58a7ff45425f4d6d809c023ee1790aa2",
        msg: "water_stop_time"
      };
      socket2.emit(user_token, obj);
    }
  }

});

socket2.on('disconnect', function() {
  console.log('socket2 disconnected');
});

// 설정된 시간으로 관수 정지
function watering_stop() {
  setTimeout(() => {
    console.log('water_stop_time : ' + water_stop_time);
    console.log('watering off');
    onoffcontroller.writeSync(0);
    http.post('http://192.168.0.6:3000/device/watering', {
      "user_token": user_token,
      "api_key": api_key,
      "wc_type": 'stop',
      "wc_operatingtime": water_stop_time
    }, function(res) {
      res.setEncoding('utf8');
      res.on('data', function(res) {
        var resObj = JSON.parse(res);
        console.log(resObj);
      });
    });
  }, water_stop_time * 1000);
};

// rest_api에 관수 시간 삽입
function watering_insert() {
  http.post('http://192.168.0.6:3000/device/watering', {
    "user_token": user_token,
    "api_key": api_key,
    "wc_type": 'start',
    "wc_operatingtime": water_stop_time
  }, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(res) {
      var resObj = JSON.parse(res);
      console.log(resObj);
    });
  });
};

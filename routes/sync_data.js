/**
 * Created by YS on 2016-04-11.
 */
var express = require('express');
var request = require('request');
var xml2js = require('xml2js');
var fs = require('fs');
var http = require('http');
var async = require('async');
// EUC-KR 컨버터 생성
var iconv = require('iconv-lite');
iconv.encodingExists("EUC-KR");

var router = express.Router();


/* GET users listing. */
router.get('/', function(req, res, next) {

    // 현재 날짜 얻어오기
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; //January is 0!
    var yyyy = today.getFullYear();
    if(dd<10) {
        dd='0'+dd
    }
    if(mm<10) {
        mm='0'+mm
    }
    today = yyyy + mm + dd;

    function writeFile(str) {
        str += "\n";
        fs.appendFile('base_info/test1.csv', str, function (err) {
            if (err) throw err;
        });
    }

    // csv 파일에 적기위한 최종 문자열
    var csv_file_str = '';

    // 기반 정보 가져옴
    var url = "http://smart.gbis.go.kr/ws/download?routestation"+today+".txt";
    console.log("데이터를 요청합니다.");
    http.get(url, function(response) {
        //console.log(response);
        var serverData = '';
        var restStr = '';
        console.log("데이터를 파싱하는 중입니다.....");
        response.on('data', function (chunk) {
            serverData = chunk;
            // 문자열을 행단위로 나눔
            var split_data = iconv.decode(chunk, 'EUC-KR').split('^');
            var temp_data = [];
            // 이전 문자열에서 남은게 있다면 가장 상위 문자열에 붙임
            if (restStr.length > 0) {
                split_data[0] = restStr + split_data[0];
            }
            async.waterfall([
                function(callback) {
                    var length = 1;
                    split_data.forEach(function (val, index, arr) {
                        if (index == split_data.length - 1) {
                            // 남는 문자열을 다음 문자열로 넘기기 위해
                            restStr = val;
                        } else {
                            // 문자열을 열단위로 나눔
                            var temp_str = val.split('|');
                            temp_data.push(temp_str.toString());
                        }

                        if (length == split_data.length) {
                            return callback(null);
                        }
                        length = length + 1;
                    });
                }, function(callback) {
                    var length = 1;
                    // 열단위 문자열 쉼표(,)로 구분하여 파일 문자열에 추가
                    temp_data.forEach(function (val, index, arr) {
                        csv_file_str = csv_file_str + "\n" + val; // 행마다 \n로 구분
                        if (length == temp_data.length) {
                            return callback(null);
                        }
                        length = length + 1;
                    });
                }
            ], function(err, result) {

            });
        });
        response.on('end', function () {
            console.log("완료");
            writeFile(csv_file_str);
        });
    });

    res.send('respond with a resource');
});

module.exports = router;

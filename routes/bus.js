/**
 * Created by YS on 2016-04-11.
 */
var express = require('express');
var request = require('request');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var credentials = require('../credentials');
var router = express.Router();

/* GET users listing. */
router.get('/arrival/:bus_num/:station_name', function(req, res, next) {
    var data = {
        'bus_num': req.params.bus_num,
        'station_name': req.params.station_name
    };

    // 해당 버스의 기반정보를 가져옴
    var bus_model = require('../models/bus_model');
    bus_model.get_bus_station_id(data, function(result_data) {
        if (!result_data.result) return res.send({result:false, msg:result_data.msg});

        console.log(result_data.data[0]);
        // 데이터가 있는경우 도착정보 가져오기 실행
        getBusArrivalList(result_data.data[0].STATION_ID);
    });

    var getBusArrivalList = function(station_id) {
        request.get({
            url: 'http://openapi.gbis.go.kr/ws/rest/busarrivalservice/station?serviceKey='+credentials.gbus_key,
            qs: {
                //'serviceKey' : credentials.gbus_key, // 길이가 모자른지 여기다 넣으면 안된다
                'stationId' : station_id
            }
        }, function (err, httpResponse, body) {
            parser.parseString(body, function(err, result) {
                if (result.response.msgHeader[0].resultCode != 0) {
                    console.log(result.response);
                    console.log(result.response.comMsgHeader[0]);
                    res.statusCode = 200;
                    return res.send({
                        result: false,
                        msg: result.response.msgHeader[0].resultMessage
                    });
                }
                var bus_arrival_list = result.response.msgBody[0];

                res.statusCode = 200;
                res.send({
                    result: true,
                    msg: "해당 버스의 도착정보를 가져옴",
                    data: bus_arrival_list.busArrivalList
                });
            });
        });
    }
});

module.exports = router;


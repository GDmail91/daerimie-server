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
        'station_name': req.params.station_name,
        'bus_agency' : req.query.bus_agency
    };

    // TODO bus_agency 별로 서울, 경기 등 운송사별로 가져오는 루틴을 다르게 해야함
    // TODO 현재는 gbus api에 없는 경우 서울순으로 가져옴
    var response_data;
    switch (data.bus_agency) {
        case "서울특별시버스운송사업조합":
            get_seoul_bus_arrival_info(data, function(result) {
                response_data = result;

                // 응답
                res.statusCode = 200;
                return res.send(response_data);
            });
            break;

        case "경기도버스운송사업조합":
            //bus_model.get_bus_station_id(data, function(result_data) {}
            get_gbus_arrival_info(data, function(result) {
                response_data = result;

                // 응답
                res.statusCode = 200;
                return res.send(response_data);
            });
            break;
    }
});

// 경기도 버스 도착정보
var get_gbus_arrival_info = function (data, response_callback) {
    // 해당 버스의 기반정보를 가져옴
    var bus_model = require('../models/bus_model');
    bus_model.get_bus_station_id(data, function (result_data) {
        if (!result_data.result) return response_callback({result: false, msg: result_data.msg});
        console.log(result_data.data[0]);

        // 데이터가 있는경우 도착정보 가져오기 실행
        var async = require('async');
        async.waterfall([
            function (callback) {
                // 정거장에 곧도착하는 버스 정보 가져옴
                var station_id = result_data.data[0].STATION_ID;
                var route_id = result_data.data[0].ROUTE_ID;

                request.get({
                    url: 'http://openapi.gbis.go.kr/ws/rest/busarrivalservice/station?serviceKey=' + credentials.gbus_key,
                    qs: {
                        //'serviceKey' : credentials.gbus_key, // 길이가 모자른지 여기다 넣으면 안된다
                        'stationId': station_id
                    }
                }, function (err, httpResponse, body) {
                    parser.parseString(body, function (err, result) {
                        // GBUS 에서 가져온 데이터에 오류
                        if (result.response.msgHeader[0].resultCode != 0) {
                            return callback(result.response.msgHeader[0].resultMessage);
                        }
                        var bus_arrival_list = result.response.msgBody[0].busArrivalList;

                        // 모든 도착정보 중에서 원하는 버스 노선 가져옴
                        var length = 1;
                        bus_arrival_list.forEach(function (val, index, arr) {
                            if (val.routeId == route_id) {
                                // 가져온 데이터중 필요한 데이터만 넘김
                                temp_data = {
                                    bus_num1: val.plateNo1[0],
                                    bus_num2: val.plateNo2[0],
                                    predict_time1: val.predictTime1[0],
                                    predict_time2: val.predictTime2[0],
                                    route_id: val.routeId[0],
                                    station_id: val.stationId[0],
                                    station_order: val.staOrder[0]
                                };
                                return callback(null, temp_data);
                            }
                            if (length < bus_arrival_list.length) length = length + 1;
                            else {
                                // 해당하는 노선의 도착정보가 아직 없는 경우
                                return callback("아직 도착정보를 가져올 수가 없습니다.");
                            }
                        });
                    });
                });
            }, function (bus_info, callback) {
                var route_id = bus_info.route_id;
                var bus_num1 = bus_info.bus_num1; // 버스1 번호판
                var bus_num2 = bus_info.bus_num2; // 버스2 번호판

                // 해당 노선의 현재 버스들 위치 가져옴
                request.get({
                    url: 'http://openapi.gbis.go.kr/ws/rest/buslocationservice?serviceKey=' + credentials.gbus_key,
                    qs: {
                        //'serviceKey' : credentials.gbus_key, // 길이가 모자른지 여기다 넣으면 안된다
                        'routeId': route_id
                    }
                }, function (err, httpResponse, body) {
                    parser.parseString(body, function (err, result) {
                        // GBUS 에서 가져온 데이터에 오류
                        if (result.response.msgHeader[0].resultCode != 0) {
                            return callback(result.response.msgHeader[0].resultMessage);
                        }

                        var bus_location_list = result.response.msgBody[0].busLocationList;

                        // 모든 노선의 버스중 원하는 버스 차량 가져옴
                        var length = 1;
                        bus_location_list.forEach(function (val) {
                            // 2대의 차량중 해당하는 차량의 정거장 위치 가져옴
                            if (val.plateNo == bus_num1) {
                                bus_info.locate_at1 = bus_info.station_order - val.stationSeq[0];

                            } else if (val.plateNo == bus_num2) {
                                bus_info.locate_at2 = bus_info.station_order - val.stationSeq[0];
                            }

                            if (length < bus_location_list.length) length = length + 1;
                            else {
                                if (typeof bus_info.locate_at1 == 'undefined')
                                    bus_info.locate_at1 = -1;
                                //bus_info.locate_at1 = "현재위치를 가져올 수 없습니다.";
                                if (typeof bus_info.locate_at2 == 'undefined')
                                    bus_info.locate_at2 = -1;
                                //bus_info.locate_at2 = "현재위치를 가져올 수 없습니다.";
                                return callback(null, bus_info);
                            }
                        });
                    });
                });
            }
        ], function (err, result) {
            if (err) {
                return response_callback({
                    result: false,
                    msg: "아직 도착정보를 가져올 수가 없습니다."
                });
            }

            return response_callback ({
                result: true,
                msg: "해당 버스의 도착정보를 가져옴",
                data: result
            });
        });
    });
};


// 서울 버스 도착정보
var get_seoul_bus_arrival_info = function (data, response_callback) {
    var async = require('async');
    async.waterfall([
        function (callback) {
            // 해당 버스의 노선 정보를 가져옴
            request.get({
                url: 'http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList?ServiceKey=' + credentials.seoul_bus_key.route_info_key,
                qs: {
                    //'ServiceKey' : credentials.seoul_bus_key.route_info_key, // 길이가 모자른지 여기다 넣으면 안된다
                    'strSrch': data.bus_num,
                    'numOfRows': 999,
                    'pageNo': 1
                }
            }, function (err, httpResponse, body) {
                parser.parseString(body, function (err, result) {
                    // Seoul Bus 에서 가져온 데이터에 오류
                    if (result.ServiceResult.msgHeader[0].headerCd != 0) {
                        return callback(result.ServiceResult.msgHeader[0].resultMessage);
                    }
                    var bus_item_list = result.ServiceResult.msgBody[0].itemList;

                    // 모든 노선정보 중에서 원하는 버스 노선 가져옴
                    var length = 1;
                    bus_item_list.forEach(function (val, index, arr) {
                        if (val.busRouteNm == data.bus_num) {
                            // 가져온 데이터중 노선 ID 넘김
                            return callback(null, val.busRouteId[0]);
                        }
                        if (length < bus_item_list.length) length = length + 1;
                        else {
                            // 해당하는 노선정보가 없는 경우
                            return callback("해당 노선정보를 가져올 수가 없습니다.");
                        }
                    });
                });
            });
        }, function (route_id, callback) {
            // 해당 버스의 노선 정보를 가져옴
            request.get({
                url: 'http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?ServiceKey=' + credentials.seoul_bus_key.route_info_key,
                qs: {
                    //'ServiceKey' : credentials.seoul_bus_key.route_info_key, // 길이가 모자른지 여기다 넣으면 안된다
                    'busRouteId': route_id,
                    'numOfRows': 999,
                    'pageNo': 1
                }
            }, function (err, httpResponse, body) {
                parser.parseString(body, function (err, result) {
                    // Seoul Bus 에서 가져온 데이터에 오류
                    if (result.ServiceResult.msgHeader[0].headerCd != 0) {
                        return callback(result.ServiceResult.msgHeader[0].resultMessage);
                    }
                    var station_item_list = result.ServiceResult.msgBody[0].itemList;

                    // 모든 노선정보 중에서 원하는 버스 노선 가져옴
                    var length = 1;
                    station_item_list.forEach(function (val) {
                        if (val.stationNm == data.station_name) {
                            // 가져온 데이터중 정거장 고유번호 넘김
                            return callback(null, val.arsId[0]);
                        }
                        if (length < station_item_list.length) length = length + 1;
                        else {
                            // 해당하는 노선정보가 없는 경우
                            return callback("해당 정거장 정보를 가져올 수가 없습니다.");
                        }
                    });
                });
            });
        }, function(ars_id, callback) {
            // 해당 정거장의 도착 정보 가져옴
            request.get({
                url: 'http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?ServiceKey=' + credentials.seoul_bus_key.route_info_key,
                qs: {
                    //'ServiceKey' : credentials.seoul_bus_key.route_info_key, // 길이가 모자른지 여기다 넣으면 안된다
                    'arsId': ars_id,
                    'numOfRows': 999,
                    'pageNo': 1
                }
            }, function (err, httpResponse, body) {
                parser.parseString(body, function (err, result) {
                    // Seoul Bus 에서 가져온 데이터에 오류
                    if (result.ServiceResult.msgHeader[0].headerCd != 0) {
                        return callback(result.ServiceResult.msgHeader[0].resultMessage);
                    }
                    var bus_arrival_list = result.ServiceResult.msgBody[0].itemList;

                    // 모든 노선정보 중에서 원하는 버스 노선 가져옴
                    var length = 1;
                    bus_arrival_list.forEach(function (val) {
                        if (val.rtNm == data.bus_num) {
                            // 가져온 데이터중 필요한 데이터만 넘김
                            var temp_data = {
                                bus_num1: val.plainNo1[0],
                                bus_num2: val.plainNo2[0],
                                predict_time1: Math.ceil(val.traTime1[0]/60),
                                predict_time2: Math.ceil(val.traTime2[0]/60),
                                route_id: val.rtNm[0],
                                station_id: val.arsId[0],
                                station_order: val.staOrd[0],
                                locate_at1: val.staOrd[0] - val.sectOrd1[0],
                                locate_at2: val.staOrd[0] - val.sectOrd2[0]
                            };
                            return callback(null, temp_data);
                        }
                        if (length < bus_arrival_list.length) length = length + 1;
                        else {
                            // 해당하는 노선정보가 없는 경우
                            return callback("해당 정거장 정보를 가져올 수가 없습니다.");
                        }
                    });
                });
            });
        }
    ], function (err, result) {
        if (err) {
            return response_callback({
                result: false,
                msg: "아직 도착정보를 가져올 수가 없습니다."
            });
        }

        return response_callback ({
            result: true,
            msg: "해당 버스의 도착정보를 가져옴",
            data: result
        });
    });
};

module.exports = router;


/**
 * Created by YS on 2016-04-11.
 */
var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/:bus_num/:station_name', function(req, res, next) {
    var data = {
        'bus_num': req.params.bus_num,
        'station_name': req.params.station_name
    };

    var bus_model = require('../models/bus_model');
    bus_model.get_bus_station_id(data, function(result_data) {
        if (!result_data.result) return res.send("{result:false, msg:데이터 검색실패}");

        res.statusCode = 200;
        res.send(result_data);
    });
});

module.exports = router;


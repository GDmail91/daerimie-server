/**
 * Created by YS on 2016-04-12.
 */
var credentials = require('../credentials');
var mysql = require('mysql');
var pool = mysql.createPool({
    host    : credentials.mysql.host,
    port : credentials.mysql.port,
    user : credentials.mysql.user,
    password : credentials.mysql.password,
    database: credentials.mysql.database,
    connectionLimit: 21,
    waitForConnections: false
});

var bus_model = {
    get_bus_station_id: function (data, callback) {
        // 버스정거장 ID 가져옴
        pool.getConnection(function (err, connection) {
            if (err) return callback({result: false, msg: "에러 발생. 원인: " + err});
            var select = [data.bus_num, data.station_name];
            connection.query('SELECT * FROM daelimieDB WHERE ROUTE_NM=? AND STATION_NM=?;', select, function (err, rows) {
                if (err) return callback({result:false, msg:err});
                connection.release();

                var dummy_data = {
                    result: true,
                    msg: "정거장 ID를 가져왔습니다.",
                    data: rows
                };
                return callback(dummy_data);
            });
        });
    },
    /**
     * Update users infomation, input user infomation data
     * @param data (JSON) : kakao_id, username, school, age, major, locate, introduce, exp, access_token
     * @param callback (Function)
     */
    update_info: function (data, callback) {
        // user 정보 수정
        pool.getConnection(function (err, connection) {
            if (err) return callback({result: false, msg: "에러 발생. 원인: " + err});
            var insert = [data.kakao_id, data.username, data.school, data.age, data.major, data.skill, data.locate, data.introduce, data.exp, data.access_token];
            connection.query('UPDATE Users SET ' +
                '`kakao_id` = ?, ' +
                '`username` = ?, ' +
                '`school` = ?, ' +
                '`age` =?, ' +
                '`major` = ?, ' +
                '`skill` = ?, ' +
                '`locate` = ?, ' +
                '`introduce` = ?, ' +
                '`exp` = ? WHERE facebook_access_token= ?', insert, function (err, rows) {
                if (err) {
                    return callback({result: false, msg: "정보 수정에 실패했습니다. 원인: " + err});
                } else if (rows.affectedRows == 0) {
                    return callback({result: false, msg: "정보 수정에 실패했습니다. 원인: 적용되지않음"});
                }
                connection.release();

                var dummy_data = {
                    result: true,
                    msg: "정보 수정에 성공했습니다."
                };
                return callback(dummy_data);
            });
        });
    }
};

module.exports = bus_model;
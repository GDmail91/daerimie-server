var routes = require('./routes/index');
var users = require('./routes/users');
var bus = require('./routes/bus');
var sync_data = require('./routes/sync_data');

module.exports = function(app){
    app.use('/', routes);
    app.use('/bus', bus);
    app.use('/sync_data', sync_data);
};

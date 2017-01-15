const restify = require('restify');
var mongoose = require('mongoose');
var assert = require('assert');
var db = mongoose.connect('mongodb://localhost/deviceData');
mongoose.Promise = require('bluebird');
// var Sequelize = require('sequelize');
// var sequelize = new Sequelize('sotsuron.db.sqlite3', '', '', {dialect: 'sqlite', storage: './sotsuron.db.sqlite3'});
const server = restify.createServer({
	  name: 'myapp',
	  version: '1.0.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/echo/:name', function (req, res, next) {
	  res.send(req.params);
	  return next();
});

// 必要な機能
// 1. 命令を送信
// 2. データを受信->DBへ登録
// 3. 命令を変更
// 1, 2は両方同じ通信で行なう？

// Sequelizeライブラリを利用する際に使う
// var deviceData = sequelize.define('deviceData', {
// 	status: Sequelize.STRING,
// 	id: Sequelize.INTEGER,
// 	request: Sequelize.TEXT,
// 	x: Sequelize.INTEGER,
// 	y: Sequelize.INTEGER,
// 	z: Sequelize.INTEGER
// });
// mongoose
//
// deviceのデータを取得したかった時
// var eventSchema = new mongoose.Schema({
// 	status: {type: String},
// 	id: Number,
// 	request: {type: String},
// 	data: {
// 		x: Number,
// 		y: Number,
// 		z: Number, 
// 		state : String
// 	} 
// });

var eventSchema = new mongoose.Schema({
	device_ID: Number,
	event_type: Number,
	moved_for: Number,
	max_gap: Number
});

var commandSchema = new mongoose.Schema ({
	command: {
		mode: String,
		value: { 
			frequency: Number,
			threshold: Number
		}
	},
	switch: Number,
	pwm: Number 
});

var EarthquakeDBSchema = new mongoose.Schema ({
	isEarthquake: Boolean
});

// db.modelの1つ目の引数がcollection名になる
var EventData = db.model('data', eventSchema);
var CommandInfo = db.model('command', commandSchema);
var EarthquakeDB = db.model('earthquake', EarthquakeDBSchema);

var defaultData = {};
defaultData.status = 0;
defaultData.response = {};
defaultData.response.pwm = 0;
defaultData.response.time = 0;
defaultData.response.reconnect_time = 0;

function insertEventData(req, res, next) {
	var eventDataInstance = new EventData(req.params); 
	eventDataInstance.save(function(err){
		if(err) { return; console.log("error ocured"); }
		console.log("saved to the db.");
	});
}

function sendEarthquakeMsg(res) {
	var isEarthquake = false;
	var promise = EarthquakeDB.find("", {}, {sort: {$natural: -1}, limit: 1}).exec();
	promise.then(function(result) {
		var isEarthquake = result[0].isEarthquake;	
		// callback(res, isEarthquake);
		res.send(generateEarthquakeRespose(isEarthquake));
		console.log("earthquake state:" + isEarthquake);
	}).catch(function(error){
		console.log(error);
	});
} 

function generateEarthquakeRespose(isEarthquake) {
	var earthquakeData = {};
	earthquakeData.status = 0;
	earthquakeData.response = {};
	if(isEarthquake) {
		earthquakeData.response.pwm = 100;
		earthquakeData.response.time = 500;
	} else {
		earthquakeData.response.pwm = 0;
		earthquakeData.response.time = 0;
	}
	earthquakeData.response.reconnect_time = 0;
	return earthquakeData;
} 

server.get('/flashlight/earthquake/:isEarthquake', function(req, res, next) {
	var earthquakeInstance = new EarthquakeDB(req.params); 
	earthquakeInstance.save(function(err){
		if(err) { return; console.log("error ocured"); }
		console.log("saved to the db.");
		res.send({result:"ok"});
	});
});

server.post('/flashlight/event', function (req, res, next) {
	var state = req.params;
	var responseData = {};
	console.log(state)
	// 出来てきたら格納機能もオンにする
	insertEventData(req, res, next);
	switch(state.event_type) {
		case '0': 
			console.log("振動イベントです．");			
			res.send(defaultData);
			break;
		case '1':
			console.log("静置イベントです．");
			// isEarthquake と，外部からの呼び出しの比較が必要．
			sendEarthquakeMsg(res);
			break;
		default:
			console.log("defaultです．");
			res.send(defaultData);
			break;
	}
});

function insertCommand(req, res, next) {
	var commandInstance = new CommandInfo(req.params); 
	commandInstance.save(function(err){
		if(err){ return; console.log("error ocured"); }
		console.log("saved to the db.");
	});
	res.send("ok");
}

function getCommand() {
	// 最新のdataを取得する
	CommandInfo.find("", {}, {sort: {$natural: -1}, limit: 1}, function(err, data){
		if (err) {
			console.log(err);
		}
		console.log(data);
	});
}

server.post('/flashlight/command', function (req, res, next) {
	var state = req.params;
	insertCommand(req, res, next);
});

server.listen(7894, function () {
	  console.log('%s listening at %s', server.name, server.url);
	  getCommand();
});

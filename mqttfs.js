var mqtt = require('mqttjs'),
	fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	util = require('util');

var nop = function() {};
var debug_on = process.env['debug'] || process.env['DEBUG'] || false;

var argv = require('optimist')
	.usage('Explore an MQTT hierarchy as a file system\nUsage: $0 -p <broker port> -h <broker hostname> -b <base directory>')
	.options('p', {
		alias: 'port',
		describe: 'Broker port',
		default: 1883,
	})
	.options('h', {
		alias: 'host',
		describe: 'Broker host',
		default: 'localhost'
	})
	.options('t', {
		alias: 'topics',
		describe: 'Subscription paths, comma delimited',
		default: '/#,#'
	})
	.options('b', {
		alias: 'path',
		describe: 'filesystem base path',
		default: __dirname + '/mqttfs'
	})
	.argv


var base = argv.b + '/',
	port = argv.p,
	host = argv.h,
	topics = argv.t.split(',');

function debug() {
	if (debug_on) console.log.apply(this, arguments);
}

debug('Starting mqttfs with arguments %j', argv);


function createBaseDir(base, cb) {
	path.exists(base, function(exists) {
		if (!exists) {
			fs.mkdir(base, function(err) {
				if (!err) return cb(null, base + ' created');
				return cb(err);
			});
		} else {
			cb(null, 'Base directory already exists');
		}
	});
}

function mkdir(dir, cb) {
	var dir = (dir[0] === '/' ? dir.substr(1) : dir),
		cb = cb || nop;

	path.exists(base + dir, function(exists) {
		if (exists) return cb(null, base + dir + ' already exists');

		var mkdir = spawn('mkdir', ['-p', base + dir]);

		mkdir.stderr.setEncoding('utf8');
		mkdir.stderr.on('data', function(data) {
			if (mkdir.errors) mkdir.errors = [];
			mkdir.errors.push(data);
		});

		mkdir.on('exit', function(code, signal) {
			if (code === 0) return cb(null, base + dir + ' created');

			return cb(mkdir.errors.join('\nCode: ' + code));
		});

	});
}

function onpublish(topic, payload) {
	var psplit = topic.split('/'),
		dir = psplit.slice(0, psplit.length - 1).join('/');
		file = psplit[psplit.length - 1];

	mkdir(dir, function(err, result) {
		var stream = fs.createWriteStream(base + topic, {
			flags: 'a',
			encoding: 'utf8',
			mode: 0777
		});

		stream.on('open', function(fd) {
			stream.write(util.format('[%s] Topic: %s, Payload: %s\n', ''+new Date(), topic, payload));
		});
	});

}
	
mqtt.createClient(port, host, function(client) {
	client.connect({
	});

	client.on('connack', function(packet) {
		debug('Connected');
		client.subscribe({
			subscriptions: topics.map(function(x) { return {topic: x}; })
		});

		setInterval(function() {
			client.pingreq();
		});
	});

	client.on('publish', function(packet) {
		debug('Publish received: %s %s', packet.topic, packet.payload);
		onpublish(packet.topic, packet.payload);
	});
});

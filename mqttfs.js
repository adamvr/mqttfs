var mqtt = require('mqttjs'),
	fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	util = require('util');

var nop = function() {};
var debug_on = process.env['debug'] || process.env['DEBUG'] || false;

var argv = require('optimist')
	.usage('Explore an MQTT hierarchy as a file system\nUsage: $0 -p <broker port> -h <broker hostname> -b <base directory>')
	.describe('help', 'print this message')
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
		default: './mqttfs'
	})
	.argv


var base = argv.b,
	port = argv.p,
	host = argv.h,
	topics = argv.t.split(',');

if (argv.help) {
	require('optimist').showHelp();
	process.exit(1);
}

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
	var cb = cb || nop,
		joined = path.join(base, dir);

	path.exists(joined, function(exists) {
		if (exists) return cb(null, joined + ' already exists');

		var mkdir = spawn('mkdir', ['-p', joined]);

		mkdir.stderr.setEncoding('utf8');
		mkdir.stderr.on('data', function(data) {
			if (mkdir.errors) mkdir.errors = [];
			mkdir.errors.push(data);
		});

		mkdir.on('exit', function(code, signal) {
			if (code === 0) return cb(null, joined + ' created');

			return cb(mkdir.errors.join('\nCode: ' + code));
		});

	});
}

function onpublish(topic, payload) {
	var dir = path.dirname(topic),
		file = path.join(base, topic);

	mkdir(dir, function(err, result) {
		if (err) return debug(err);
		debug('Opening %s', file);
		var stream = fs.createWriteStream(file, {
			flags: 'a',
			encoding: 'utf8',
			mode: 0777
		});

		stream.on('open', function(fd) {
			debug('Writing'); 
			stream.write(util.format('[%s] Topic: %s, Payload: %s\n', ''+new Date(), topic, payload));
		});
	});

}
	
mqtt.createClient(port, host, function(client) {
	client.connect({
	});

	client.on('connack', function(packet) {
		debug('Connected');
		createBaseDir(base, debug);
		debug('Subscribing to %j', topics);
		debug('Subscribe: %s', '' + client.subscribe({
			subscriptions: topics
		}));

		setInterval(function() {
			client.pingreq();
		});
	});

	client.on('publish', function(packet) {
		debug('Publish received: %s %s', packet.topic, packet.payload);
		onpublish(packet.topic, packet.payload);
	});
});

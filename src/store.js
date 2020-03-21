const debug = require('debug')('store');
const redis = require("redis");
const client = redis.createClient(process.env.REDIS_URL);
const subscriptionClient = redis.createClient(process.env.REDIS_URL);
const callbacks = {};
subscriptionClient.on("message", function(channel, message) {
	callbacks[channel](message);
});

const {promisify} = require('util');

function getObject(key, def) {
	return new Promise((fulfill, reject) => {
		client.get(key, (err, val) => {
			if (err) return reject(err);
			if (!val) {
				return fulfill(def);
			}
			return fulfill(JSON.parse(val));
		});
	});
}

function setObject(key, val) {
	return promisify(client.set).bind(client)(key, JSON.stringify(val));
}

function set(key, value) {
	return promisify(client.set).bind(client)(key, value);
}

function get(key) {
	return promisify(client.get).bind(client)(key);
}

function expire(key, seconds) {
	return promisify(client.expire).bind(client)(key, seconds);
}

function del(key) {
	return promisify(client.del).bind(client)(key);
}

function keys() {
	return promisify(client.keys).bind(client)('*');
}

function incr(key) {
	return promisify(client.incr).bind(client)(key);
}

function decr(key) {
	return promisify(client.decr).bind(client)(key);
}

function subscribe(channel, cb) {
	callbacks[channel] = cb;
	subscriptionClient.subscribe(channel);
}

function publish(channel, message) {
	client.publish(channel, message);
}

client.on("error", function (err) {
	debug("Error " + err);
});

module.exports = {
	getObject: getObject,
	setObject: setObject,
	del: del,
	keys: keys,
	expire: expire,
	incr: incr,
	decr: decr,
	subscribe,
	publish,
	get,
	set
};
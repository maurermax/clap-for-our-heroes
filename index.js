const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const debug = require('debug')('clap-for-our-heroes');
const store = require('./src/store');
const USERS_ACTIVE_KEY = 'USERS_ACTIVE';
const CLAPS_KEY = 'CLAPS_KEY';
const CLAPS_KEY_CHANNEL = 'CLAPS_KEY_CHANNEL';
const CLAPPER_CLAPS_KEY = 'CLAPPER_CLAPS_CLAPS';
const _ = require('lodash');

// https://coolors.co/963484-f7f1f6-4e4d5c-223843-f2efe9

if (process.env.NODE_ENV === 'production') {
    app.use(require('./src/service/forceSsl'));
}

app.use(express.static('public'));
app.set('view engine', 'pug');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/imprint', function (req, res) {
    res.render('imprint');
});

store.subscribe(CLAPS_KEY_CHANNEL, (clapChange) => {
    throttledSendStats();
});

let lastClaps;
let lastClapTime;
async function sendStats() {
    const claps = parseInt(await store.get(CLAPS_KEY), 10);
    const connections = parseInt(await store.get(USERS_ACTIVE_KEY), 10);
    let clapsPerSecond = null;
    if (lastClapTime) {
        const timeDelta = (new Date()).getTime() - lastClapTime;
        const clapDelta = claps - lastClaps;
        clapsPerSecond = clapDelta/(timeDelta/1000);
    }
    lastClaps = claps;
    lastClapTime = (new Date()).getTime();
    io.sockets.emit('stats', {
        claps,
        connections,
        clapsPerSecond
    });
}

const throttledSendStats = _.throttle(sendStats, 100);

io.on('connection', async function (socket) {
    debug('connection');
    await store.incr(USERS_ACTIVE_KEY);
    const claps = parseInt(await store.get(CLAPS_KEY), 10);
    const connections = parseInt(await store.get(USERS_ACTIVE_KEY), 10);
    socket.emit('stats', {
        claps,
        connections
    });
    socket.on('clap', async function() {
        await submitClap();
    });
    socket.on('disconnect', async function() {
        await store.decr(USERS_ACTIVE_KEY);
    });
});

async function submitClap() {
    await store.incr(CLAPS_KEY);
    throttledSendChange();
}

function sendChange() {
    store.publish(CLAPS_KEY_CHANNEL, 'changed');
}


const throttledSendChange = _.throttle(sendChange, 100);

function Clapper() {
}

Clapper.prototype.init = async function() {
    debug('starting virtual clapper');
    await store.incr(USERS_ACTIVE_KEY);
    this.clap();
    return this; // https://stackoverflow.com/questions/49205519/nodejs-async-function-prototype-chain-error
};

Clapper.prototype.clap = async function () {
    await submitClap();
    await store.incr(CLAPPER_CLAPS_KEY);
    if (Math.random() > 0.01) {
        setTimeout(() => {this.clap()}, Math.random() * 1000);
    } else {
        await store.decr(USERS_ACTIVE_KEY);
        debug('tearing down virtual clapper');
    }
    return this;
};

if (process.env.ENABLE_CLAPPERS === 'true') {
    setInterval(async () => {
        const connections = parseInt(await store.get(USERS_ACTIVE_KEY), 10);
        if (connections < 3 && Math.random() < .1) {
            const c = new Clapper();
            c.init();
        }
    }, 3000);
}

if (process.env.RESET_ACTIVE_ON_START === 'true') {
    store.set(USERS_ACTIVE_KEY, 0);
}

const s = server.listen(process.env.PORT || 5001, function () {
    let host = s.address().address;
    let port = s.address().port;

    console.log('Listening at http://%s:%s', host, port);
});

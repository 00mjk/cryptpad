/*
    globals require console
*/
var Express = require('express');
var Http = require('http');
var Https = require('https');
var Fs = require('fs');
var WebSocketServer = require('ws').Server;
var ChainPadSrv = require('./ChainPadSrv');
var NetfluxSrv = require('./NetFluxWebsocketServer');
var WebRTCSrv = require('./WebRTCSrv');

var config = require('./config');
config.websocketPort = config.websocketPort || config.httpPort;

// support multiple storage back ends
var Storage = require(config.storage||'./storage/mongo');

var app = Express();
app.use(Express.static(__dirname + '/www'));

// Bower is broken and does not allow components nested within components...
// And jquery.sheet expects it!
// *Workaround*
app.use("/bower_components/jquery.sheet/bower_components",
    Express.static(__dirname + '/www/bower_components'));

var customize = "/customize";
if (!Fs.existsSync(__dirname + "/customize")) {
    customize = "/customize.dist";
    console.log("Cryptpad is customizable, see customize.dist/readme.md for details");
}
app.use("/customize/", Express.static(__dirname + customize));
app.get("/", function(req, res) { res.sendFile(__dirname + customize + '/index.html'); });

var httpsOpts;
if (config.privKeyAndCertFiles) {
    var privKeyAndCerts = '';
    config.privKeyAndCertFiles.forEach(function (file) {
        privKeyAndCerts = privKeyAndCerts + Fs.readFileSync(file);
    });
    var array = privKeyAndCerts.split('\n-----BEGIN ');
    for (var i = 1; i < array.length; i++) { array[i] = '-----BEGIN ' + array[i]; }
    var privKey;
    for (var i = 0; i < array.length; i++) {
        if (array[i].indexOf('PRIVATE KEY-----\n') !== -1) {
            privKey = array[i];
            array.splice(i, 1);
            break;
        }
    }
    if (!privKey) { throw new Error("cannot find private key"); }
    httpsOpts = {
        cert: array.shift(),
        key: privKey,
        ca: array
    };
}

app.get('/api/config', function(req, res){
    var host = req.headers.host.replace(/\:[0-9]+/, '');
    res.setHeader('Content-Type', 'text/javascript');
    res.send('define(' + JSON.stringify({
        websocketURL:'ws' + ((httpsOpts) ? 's' : '') + '://' + host + ':' +
            config.websocketPort + '/cryptpad_websocket',
        webrtcURL: (config.webrtcPort) ? 'ws' + ((httpsOpts) ? 's' : '') + '://' + host + ':' +
            config.webrtcPort : ''
    }) + ');');
});

var httpServer = httpsOpts ? Https.createServer(httpsOpts, app) : Http.createServer(app);

httpServer.listen(config.httpPort,config.httpAddress,function(){
    console.log('listening on %s',config.httpPort);
});

if(config.websocketPort) {
    var wsConfig = { server: httpServer };
    if (config.websocketPort !== config.httpPort) {
        console.log("setting up a new websocket server");
        wsConfig = { port: config.websocketPort};
    }
    var wsSrv = new WebSocketServer(wsConfig);
    Storage.create(config, function (store) {
        console.log('DB connected');
        // ChainPadSrv.create(wsSrv, store);
        NetfluxSrv.run(store, wsSrv);
        //WebRTCSrv.run(store, wsSrv);
    });
}
if(config.webrtcPort) {
    var wrConfig = { server: httpServer };
    if (config.webrtcPort !== config.httpPort) {
        console.log("setting up a new webrtc server");
        wrConfig = { port: config.webrtcPort};
    }
    var wrSrv = new WebSocketServer(wrConfig);
    WebRTCSrv.run(wrSrv);
    // Storage.create(config, function (store) {
        // console.log('DB connected for WebRTC');
        // ChainPadSrv.create(wsSrv, store);
        //NetfluxSrv.run(store, wsSrv);
    // });
}

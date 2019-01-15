// Load #1, load as little as possible because we are in a race to get the loading screen up.
define([
    '/bower_components/nthen/index.js',
    '/api/config',
    '/common/dom-ready.js',
    '/common/requireconfig.js',
    '/common/sframe-common-outer.js'
], function (nThen, ApiConfig, DomReady, RequireConfig, SFCommonO) {
    var requireConfig = RequireConfig();

    // Loaded in load #2
    nThen(function (waitFor) {
        DomReady.onReady(waitFor());
    }).nThen(function (waitFor) {
        var req = {
            cfg: requireConfig,
            req: [ '/common/loading.js' ],
            pfx: window.location.origin
        };
        window.rc = requireConfig;
        window.apiconf = ApiConfig;
        document.getElementById('sbox-iframe').setAttribute('src',
            ApiConfig.httpSafeOrigin + window.location.pathname + 'inner.html?' +
                requireConfig.urlArgs + '#' + encodeURIComponent(JSON.stringify(req)));

        // This is a cheap trick to avoid loading sframe-channel in parallel with the
        // loading screen setup.
        var done = waitFor();
        var onMsg = function (msg) {
            var data = JSON.parse(msg.data);
            if (data.q !== 'READY') { return; }
            window.removeEventListener('message', onMsg);
            var _done = done;
            done = function () { };
            _done();
        };
        window.addEventListener('message', onMsg);
    }).nThen(function (/*waitFor*/) {
        var addData = function (obj) {
            obj.ooType = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
        };
        var addRpc = function (sframeChan, Cryptpad, Utils) {
            var crypto = Utils.Crypto.createEncryptor(Utils.secret.keys);

            sframeChan.on('Q_OO_SAVE', function (data, cb) {
                var chanId = Utils.Hash.hrefToHexChannelId(data.url);
                Cryptpad.getPadAttribute('lastVersion', function (err, data) {
                    if (data) {
                        var oldChanId = Utils.Hash.hrefToHexChannelId(data);
                        if (oldChanId !== chanId) { Cryptpad.unpinPads([oldChanId], function () {}); }
                    }
                });
                Cryptpad.pinPads([chanId], function (e) {
                    if (e) { return void cb(e); }
                    Cryptpad.setPadAttribute('lastVersion', data.url, cb);
                });
            });
            sframeChan.on('Q_OO_OPENCHANNEL', function (data, cb) {
                console.log(data);
                Cryptpad.onlyoffice.execCommand({
                    cmd: 'OPEN_CHANNEL',
                    data: {
                        // XXX add owners?
                        // owners: something...
                        channel: data.channel,
                        lastCp: data.lastCp,
                        padChan: Utils.secret.channel,
                        validateKey: Utils.secret.keys.validateKey
                    }
                }, cb);
            });
            sframeChan.on('Q_OO_COMMAND', function (obj, cb) {
                if (obj.cmd === 'SEND_MESSAGE') {
                    if (obj.data.isCp) {
                        obj.data.isCp += '|' + crypto.encrypt('cp');
                    } else {
                        obj.data.msg = crypto.encrypt(JSON.stringify(obj.data.msg));
                    }
                }
                Cryptpad.onlyoffice.execCommand(obj, cb);
            });
            Cryptpad.onlyoffice.onEvent.reg(function (obj) {
                if (obj.ev === 'MESSAGE') {
                    try {
                        obj.data = JSON.parse(crypto.decrypt(obj.data, Utils.secret.keys.validateKey));
                    } catch (e) {
                        console.error(e);
                    }
                }
                sframeChan.event('EV_OO_EVENT', obj);
            });
        };
        SFCommonO.start({
            type: 'oo',
            addData: addData,
            addRpc: addRpc
        });
    });
});

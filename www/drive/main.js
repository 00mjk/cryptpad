// Load #1, load as little as possible because we are in a race to get the loading screen up.
define([
    '/bower_components/nthen/index.js',
    '/api/config',
    'jquery',
    '/common/requireconfig.js',
    '/common/sframe-common-outer.js',
    '/common/outer/network-config.js',
    '/bower_components/netflux-websocket/netflux-client.js',
], function (nThen, ApiConfig, $, RequireConfig, SFCommonO, NetConfig, Netflux) {
    var requireConfig = RequireConfig();

    // Loaded in load #2
    nThen(function (waitFor) {
        $(waitFor());
    }).nThen(function (waitFor) {
        var req = {
            cfg: requireConfig,
            req: [ '/common/loading.js' ],
            pfx: window.location.origin
        };
        window.rc = requireConfig;
        window.apiconf = ApiConfig;
        $('#sbox-iframe').attr('src',
            ApiConfig.httpSafeOrigin + '/drive/inner.html?' + requireConfig.urlArgs +
                '#' + encodeURIComponent(JSON.stringify(req)));

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
        var getSecrets = function (Cryptpad, Utils) {
            var hash = window.location.hash.slice(1) || Utils.LocalStore.getUserHash() ||
                        Utils.LocalStore.getFSHash();
            return Utils.Hash.getSecrets('drive', hash);
        };
        Netflux.connect(NetConfig.getWebsocketURL()).then(function (network) {
            SFCommonO.start({
                getSecrets: getSecrets,
                newNetwork: network,
                noHash: true
            });
        }, function (err) { console.error(err); });
    });
});

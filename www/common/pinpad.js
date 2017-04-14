define([
    '/common/rpc.js',
], function (Rpc) {
    var create = function (network, proxy, cb) {
        if (!network) {
            window.setTimeout(function () {
                cb('INVALID_NETWORK');
            });
            return;
        }
        if (!proxy) {
            window.setTimeout(function () {
                cb('INVALID_PROXY');
            });
            return;
        }

        var edPrivate = proxy.edPrivate;
        var edPublic = proxy.edPublic;

        if (!(edPrivate && edPublic)) {
            window.setTimeout(function () {
                cb('INVALID_KEYS');
            });
            return;
        }

        Rpc.create(network, edPrivate, edPublic, function (e, rpc) {
            if (e) { return void cb(e); }

            var exp = {};

            // expose the supplied publicKey as an identifier
            exp.publicKey = edPublic;

            // expose the RPC module's raw 'send' command
            exp.send = rpc.send;

            // you can ask the server to pin a particular channel for you
            exp.pin = function (channels, cb) {
                // TODO use isArray if it's safe
                if (!channels && channels.length) {
                    window.setTimeout(function () {
                        cb('[TypeError] pin expects an array');
                    });
                    return;
                }
                rpc.send('PIN', channels, cb);
            };

            // you can also ask to unpin a particular channel
            exp.unpin = function (channels, cb) {
                // TODO use isArray if it's safe
                if (!channels && channels.length) {
                    window.setTimeout(function () {
                        cb('[TypeError] pin expects an array');
                    });
                    return;
                }
                rpc.send('UNPIN', channels, cb);
            };

            // ask the server what it thinks your hash is
            exp.getServerHash = function (cb) {
                rpc.send('GET_HASH', edPublic, function (e, hash) {
                    if (!(hash && hash[0])) {
                        return void cb('NO_HASH_RETURNED');
                    }
                    cb(e, hash[0]);
                });
            };

            // if local and remote hashes don't match, send a reset
            exp.reset = function (channels, cb) {
                // TODO use isArray if it's safe
                if (!channels && channels.length) {
                    window.setTimeout(function () {
                        cb('[TypeError] pin expects an array');
                    });
                    return;
                }
                rpc.send('RESET', channels, function (e, response) {
                    cb(e, response[0]);
                });
            };

            // get the total stored size of a channel's patches (in bytes)
            exp.getFileSize = function (file, cb) {
                rpc.send('GET_FILE_SIZE', file, cb);
            };

            // get the combined size of all channels (in bytes) for all the
            // channels which the server has pinned for your publicKey
            exp.getFileListSize = function (cb) {
                rpc.send('GET_TOTAL_SIZE', undefined, function (e, response) {
                    if (e) { return void cb(e); }
                    if (response && response.length) {
                        cb(void 0, response[0]);
                    }
                });
            };

            cb(e, exp);
        });
    };

    return { create: create };
});

define([
    '/common/rpc.js',
    '/bower_components/tweetnacl/nacl-fast.min.js'
], function (Rpc) {
    var Nacl = window.nacl;

    var create = function (network, proxy, cb) {
        if (!network) { return void cb('INVALID_NETWORK'); }
        if (!proxy) { return void cb('INVALID_PROXY'); }

        var edPrivate = proxy.edPrivate;
        var edPublic = proxy.edPublic;

        if (!(edPrivate && edPublic)) { return void cb('INVALID_KEYS'); }

        Rpc.create(network, edPrivate, edPublic, function (e, rpc) {
            if (e) { return void cb(e); }

            var exp = {};

            // expose the supplied publicKey as an identifier
            exp.publicKey = edPublic;

            // expose the RPC module's raw 'send' command
            exp.send = rpc.send;

            // you can ask the server to pin a particular channel for you
            exp.pin = function (channel, cb) {
                rpc.send('PIN', channel, cb);
            };

            // you can also ask to unpin a particular channel
            exp.unpin = function (channel, cb) {
                rpc.send('UNPIN', channel, cb);
            };

            // This implementation must match that on the server
            // it's used for a checksum
            exp.hashChannelList = function (list) {
                return Nacl.util.encodeBase64(Nacl.hash(Nacl.util
                    .decodeUTF8(JSON.stringify(list))));
            };

            // ask the server what it thinks your hash is
            exp.getServerHash = function (cb) {
                rpc.send('GET_HASH', edPublic, function (e, hash) {
                    cb(e, hash[0]);
                });
            };

            // if local and remote hashes don't match, send a reset
            exp.reset = function (list, cb) {
                rpc.send('RESET', list, function (e, response) {
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
                rpc.send('GET_TOTAL_SIZE', undefined, cb);
            };

            cb(e, exp);
        });
    };

    return { create: create };
});

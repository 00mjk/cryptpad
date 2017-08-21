define([
    '/api/config',
    'jquery',
    '/common/requireconfig.js',
    '/common/cryptget.js'
], function (ApiConfig, $, RequireConfig, Cryptget) {
    $(function () {
        var req = {
            cfg: RequireConfig,
            req: [ '/common/loading.js' ],
            pfx: window.location.origin
        };
        $('#sbox-iframe').attr('src',
            ApiConfig.httpSafeOrigin + '/pad2/inner.html?' + ApiConfig.requireConf.urlArgs +
                '#' + encodeURIComponent(JSON.stringify(req)));
    });
    require([
        '/common/sframe-channel.js',
        '/common/sframe-chainpad-netflux-outer.js',
        '/bower_components/nthen/index.js',
        '/common/cryptpad-common.js',
        '/bower_components/chainpad-crypto/crypto.js'
    ], function (SFrameChannel, CpNfOuter, nThen, Cryptpad, Crypto) {
        console.log('xxx');
        var sframeChan;
        var hashes;
        var secret;
        nThen(function (waitFor) {
            $(waitFor());
        }).nThen(function (waitFor) {
            SFrameChannel.create($('#sbox-iframe')[0].contentWindow, waitFor(function (sfc) {
                sframeChan = sfc;
                console.log('sframe initialized');
            }));
            Cryptpad.ready(waitFor());
        }).nThen(function (waitFor) {
            secret = Cryptpad.getSecrets();
            if (!secret.channel) {
                // New pad: create a new random channel id
                secret.channel = Cryptpad.createChannelId();
            }
            Cryptpad.getShareHashes(secret, waitFor(function (err, h) { hashes = h; }));
        }).nThen(function (waitFor) {
            var readOnly = secret.keys && !secret.keys.editKeyStr;
            if (!secret.keys) { secret.keys = secret.key; }
            var parsed = Cryptpad.parsePadUrl(window.location.href);
            parsed.type = parsed.type.replace('pad2', 'pad');
            if (!parsed.type) { throw new Error(); }
            var defaultTitle = Cryptpad.getDefaultName(parsed);
            var updateMeta = function () {
                //console.log('EV_METADATA_UPDATE');
                var name;
                nThen(function (waitFor) {
                    Cryptpad.getLastName(waitFor(function (err, n) {
                        if (err) { console.log(err); }
                        name = n;
                    }));
                }).nThen(function (waitFor) {
                    sframeChan.event('EV_METADATA_UPDATE', {
                        doc: {
                            defaultTitle: defaultTitle,
                            type: parsed.type
                        },
                        user: {
                            name: name,
                            uid: Cryptpad.getUid(),
                            avatar: Cryptpad.getAvatarUrl(),
                            profile: Cryptpad.getProfileUrl(),
                            curvePublic: Cryptpad.getProxy().curvePublic,
                            netfluxId: Cryptpad.getNetwork().webChannels[0].myID,
                        },
                        priv: {
                            accountName: Cryptpad.getAccountName(),
                            origin: window.location.origin,
                            pathname: window.location.pathname,
                            readOnly: readOnly,
                            availableHashes: hashes
                        }
                    });
                });
            };
            Cryptpad.onDisplayNameChanged(updateMeta);
            sframeChan.onReg('EV_METADATA_UPDATE', updateMeta);

            Cryptpad.onError(function (info) {
                console.log('error');
                console.log(info);
                if (info && info.type === "store") {
                    //onConnectError();
                }
            });

            sframeChan.on('Q_ANON_RPC_MESSAGE', function (data, cb) {
                Cryptpad.anonRpcMsg(data.msg, data.content, function (err, response) {
                    cb({error: err, response: response});
                });
            });

            sframeChan.on('Q_SET_PAD_TITLE_IN_DRIVE', function (newTitle, cb) {
                Cryptpad.renamePad(newTitle, undefined, function (err) {
                    if (err) { cb('ERROR'); } else { cb(); }
                });
            });

            sframeChan.on('Q_SETTINGS_SET_DISPLAY_NAME', function (newName, cb) {
                Cryptpad.setAttribute('username', newName, function (err) {
                    if (err) {
                        console.log("Couldn't set username");
                        console.error(err);
                        cb('ERROR');
                        return;
                    }
                    Cryptpad.changeDisplayName(newName, true);
                    cb();
                });
            });

            sframeChan.on('Q_LOGOUT', function (data, cb) {
                Cryptpad.logout(cb);
            });

            sframeChan.on('Q_SET_LOGIN_REDIRECT', function (data, cb) {
                sessionStorage.redirectTo = window.location.href;
                cb();
            });

            sframeChan.on('Q_GET_PIN_LIMIT_STATUS', function (data, cb) {
                Cryptpad.isOverPinLimit(function (e, overLimit, limits) {
                    cb({
                        error: e,
                        overLimit: overLimit,
                        limits: limits
                    });
                });
            });

            sframeChan.on('Q_MOVE_TO_TRASH', function (data, cb) {
                Cryptpad.moveToTrash(cb);
            });


            sframeChan.on('Q_SAVE_AS_TEMPLATE', function (data, cb) {
                Cryptpad.saveAsTemplate(Cryptget.put, data, cb);
            });

            sframeChan.on('Q_GET_FULL_HISTORY', function (data, cb) {
                var network = Cryptpad.getNetwork();
                var hkn = network.historyKeeper;
                var crypto = Crypto.createEncryptor(secret.keys);
                // Get the history messages and send them to the iframe
                var parse = function (msg) {
                    try {
                        return JSON.parse(msg);
                    } catch (e) {
                        return null;
                    }
                };
                var onMsg = function (msg) {
                    var parsed = parse(msg);
                    if (parsed[0] === 'FULL_HISTORY_END') {
                        console.log('END');
                        cb();
                        return;
                    }
                    if (parsed[0] !== 'FULL_HISTORY') { return; }
                    if (parsed[1] && parsed[1].validateKey) { // First message
                        secret.keys.validateKey = parsed[1].validateKey;
                        return;
                    }
                    msg = parsed[1][4];
                    if (msg) {
                        msg = msg.replace(/^cp\|/, '');
                        var decryptedMsg = crypto.decrypt(msg, secret.keys.validateKey);
                        sframeChan.event('EV_RT_HIST_MESSAGE', decryptedMsg);
                    }
                };
                network.on('message', onMsg);
                network.sendto(hkn, JSON.stringify(['GET_FULL_HISTORY', secret.channel, secret.keys.validateKey]));
            });

            CpNfOuter.start({
                sframeChan: sframeChan,
                channel: secret.channel,
                network: Cryptpad.getNetwork(),
                validateKey: secret.keys.validateKey || undefined,
                readOnly: readOnly,
                crypto: Crypto.createEncryptor(secret.keys),
                onConnect: function (wc) {
                    if (readOnly) { return; }
                    Cryptpad.replaceHash(Cryptpad.getEditHashFromKeys(wc.id, secret.keys));
                }
            });
        });
    });
});

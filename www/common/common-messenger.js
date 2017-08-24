define([
    'jquery',
    '/bower_components/chainpad-crypto/crypto.js',
    '/common/curve.js',
    '/common/common-hash.js',
    '/common/common-realtime.js'
//  '/bower_components/marked/marked.min.js'
], function ($, Crypto, Curve, Hash, Realtime) {
    var Msg = {
        inputs: [],
    };

    var Types = {
        message: 'MSG',
        update: 'UPDATE',
        unfriend: 'UNFRIEND',
        mapId: 'MAP_ID',
        mapIdAck: 'MAP_ID_ACK'
    };

    var clone = function (o) {
        return JSON.parse(JSON.stringify(o));
    };

    // TODO
    // - mute a channel (hide notifications or don't open it?)
    var pending = {};

    var createData = Msg.createData = function (proxy, hash) {
        return {
            channel: hash || Hash.createChannelId(),
            displayName: proxy['cryptpad.username'],
            profile: proxy.profile && proxy.profile.view,
            edPublic: proxy.edPublic,
            curvePublic: proxy.curvePublic,
            avatar: proxy.profile && proxy.profile.avatar
        };
    };

    // TODO make this async
    var getFriend = function (proxy, pubkey) {
        if (pubkey === proxy.curvePublic) {
            var data = createData(proxy);
            delete data.channel;
            return data;
        }
        return proxy.friends ? proxy.friends[pubkey] : undefined;
    };

    // TODO make this async
    var removeFromFriendList = function (proxy, realtime, curvePublic, cb) {
        if (!proxy.friends) { return; }
        var friends = proxy.friends;
        delete friends[curvePublic];
        Realtime.whenRealtimeSyncs(realtime, cb);
    };

    // TODO make this async
    var getFriendList = Msg.getFriendList = function (proxy) {
        if (!proxy.friends) { proxy.friends = {}; }
        return proxy.friends;
    };

    var eachFriend = function (friends, cb) {
        Object.keys(friends).forEach(function (id) {
            if (id === 'me') { return; }
            cb(friends[id], id, friends);
        });
    };

    Msg.getFriendChannelsList = function (proxy) {
        var list = [];
        eachFriend(proxy, function (friend) {
            list.push(friend.channel);
        });
        return list;
    };

    var msgAlreadyKnown = function (channel, sig) {
        return channel.messages.some(function (message) {
            return message[0] === sig;
        });
    };

    // Invitation
    // FIXME there are too many functions with this name
    var addToFriendList = Msg.addToFriendList = function (common, data, cb) {
        var proxy = common.getProxy();
        var friends = getFriendList(proxy);
        var pubKey = data.curvePublic;

        if (pubKey === proxy.curvePublic) { return void cb("E_MYKEY"); }

        friends[pubKey] = data;

        Realtime.whenRealtimeSyncs(common.getRealtime(), function () {
            cb();
            common.pinPads([data.channel]);
        });
        common.changeDisplayName(proxy[common.displayNameKey]);
    };

    var pendingRequests = [];

    /*  Used to accept friend requests within apps other than /contacts/ */
    // TODO move this into MSG.messenger
    // as _openGroupChannel_
    Msg.addDirectMessageHandler = function (common) {
        var network = common.getNetwork();
        var proxy = common.getProxy();
        if (!network) { return void console.error('Network not ready'); }
        network.on('message', function (message, sender) {
            var msg;
            if (sender === network.historyKeeper) { return; }
            try {
                var parsed = common.parsePadUrl(window.location.href);
                if (!parsed.hashData) { return; }
                var chan = parsed.hashData.channel;
                // Decrypt
                var keyStr = parsed.hashData.key;
                var cryptor = Crypto.createEditCryptor(keyStr);
                var key = cryptor.cryptKey;
                var decryptMsg;
                try {
                    decryptMsg = Crypto.decrypt(message, key);
                } catch (e) {
                    // If we can't decrypt, it means it is not a friend request message
                }
                if (!decryptMsg) { return; }
                // Parse
                msg = JSON.parse(decryptMsg);
                if (msg[1] !== parsed.hashData.channel) { return; }
                var msgData = msg[2];
                var msgStr;
                if (msg[0] === "FRIEND_REQ") {
                    msg = ["FRIEND_REQ_NOK", chan];
                    var todo = function (yes) {
                        if (yes) {
                            pending[sender] = msgData;
                            msg = ["FRIEND_REQ_OK", chan, createData(common, msgData.channel)];
                        }
                        msgStr = Crypto.encrypt(JSON.stringify(msg), key);
                        network.sendto(sender, msgStr);
                    };
                    var existing = getFriend(proxy, msgData.curvePublic);
                    if (existing) {
                        todo(true);
                        return;
                    }
                    var confirmMsg = common.Messages._getKey('contacts_request', [
                        common.fixHTML(msgData.displayName)
                    ]);
                    common.confirm(confirmMsg, todo, null, true);
                    return;
                }
                if (msg[0] === "FRIEND_REQ_OK") {
                    var idx = pendingRequests.indexOf(sender);
                    if (idx !== -1) { pendingRequests.splice(idx, 1); }

                    // FIXME clarify this function's name
                    addToFriendList(common, msgData, function (err) {
                        if (err) {
                            return void common.log(common.Messages.contacts_addError);
                        }
                        common.log(common.Messages.contacts_added);
                        var msg = ["FRIEND_REQ_ACK", chan];
                        var msgStr = Crypto.encrypt(JSON.stringify(msg), key);
                        network.sendto(sender, msgStr);
                    });
                    return;
                }
                if (msg[0] === "FRIEND_REQ_NOK") {
                    var i = pendingRequests.indexOf(sender);
                    if (i !== -1) { pendingRequests.splice(i, 1); }
                    common.log(common.Messages.contacts_rejected);
                    common.changeDisplayName(proxy[common.displayNameKey]);
                    return;
                }
                if (msg[0] === "FRIEND_REQ_ACK") {
                    var data = pending[sender];
                    if (!data) { return; }
                    addToFriendList(common, data, function (err) {
                        if (err) {
                            return void common.log(common.Messages.contacts_addError);
                        }
                        common.log(common.Messages.contacts_added);
                    });
                    return;
                }
                // TODO: timeout ACK: warn the user
            } catch (e) {
                console.error("Cannot parse direct message", msg || message, "from", sender, e);
            }
        });
    };

    // TODO somehow fold this into openGroupChannel
    Msg.inviteFromUserlist = function (common, netfluxId) {
        var network = common.getNetwork();
        var parsed = common.parsePadUrl(window.location.href);
        if (!parsed.hashData) { return; }
        // Message
        var chan = parsed.hashData.channel;
        var myData = createData(common);
        var msg = ["FRIEND_REQ", chan, myData];
        // Encryption
        var keyStr = parsed.hashData.key;
        var cryptor = Crypto.createEditCryptor(keyStr);
        var key = cryptor.cryptKey;
        var msgStr = Crypto.encrypt(JSON.stringify(msg), key);
        // Send encrypted message
        if (pendingRequests.indexOf(netfluxId) === -1) {
            pendingRequests.push(netfluxId);
            var proxy = common.getProxy();
            // this redraws the userlist after a change has occurred
            // TODO rename this function to reflect its purpose
            common.changeDisplayName(proxy[common.displayNameKey]);
        }
        network.sendto(netfluxId, msgStr);
    };

    Msg.messenger = function (common) {
        'use strict';
        var messenger = {
            handlers: {
                message: [],
                join: [],
                leave: [],
                update: [],
                new_friend: [],
            },
            range_requests: {},
        };

        var eachHandler = function (type, g) {
            messenger.handlers[type].forEach(g);
        };

        messenger.on = function (type, f) {
            var stack = messenger.handlers[type];
            if (!Array.isArray(stack)) {
                return void console.error('unsupported message type');
            }
            if (typeof(f) !== 'function') {
                return void console.error('expected function');
            }
            stack.push(f);
        };

        // TODO openGroupChannel
        messenger.openGroupChannel = function (hash, cb) {
            // sets up infrastructure for a one to one channel using curve cryptography
            cb = cb;
        };

        //var ready = messenger.ready = [];

        var DEBUG = function (label) {
            console.log('event:' + label);
        };
        DEBUG = DEBUG; // FIXME

        var channels = messenger.channels = {};

        var joining = {};

        // declare common variables
        var network = common.getNetwork();
        var proxy = common.getProxy();
        var realtime = common.getRealtime();
        Msg.hk = network.historyKeeper;
        var friends = getFriendList(proxy);

        var getChannel = function (curvePublic) {
            var friend = friends[curvePublic];
            if (!friend) { return; }
            var chanId = friend.channel;
            if (!chanId) { return; }
            return channels[chanId];
        };

        var initRangeRequest = function (txid, curvePublic, sig, cb) {
            messenger.range_requests[txid] = {
                messages: [],
                cb: cb,
                curvePublic: curvePublic,
                sig: sig,
            };
        };

        var getRangeRequest = function (txid) {
            return messenger.range_requests[txid];
        };

        messenger.getMoreHistory = function (curvePublic, hash, count, cb) {
            if (typeof(cb) !== 'function') { return; }
            var chan = getChannel(curvePublic);
            var txid = common.uid();
            initRangeRequest(txid, curvePublic, hash, cb);
            // FIXME hash is not necessarily defined.
            var msg = [ 'GET_HISTORY_RANGE', chan.id, {
                    from: hash,
                    count: count,
                    txid: txid,
                }
            ];

            network.sendto(network.historyKeeper, JSON.stringify(msg)).then(function () {
            }, function (err) {
                throw new Error(err);
            });
        };

        var getCurveForChannel = function (id) {
            var channel = channels[id];
            if (!channel) { return; }
            return channel.curve;
        };

        messenger.getChannelHead = function (curvePublic, cb) {
            var friend = friends[curvePublic];
            if (!friend) { return void cb('NO_SUCH_FRIEND'); }
            cb(void 0, friend.lastKnownHash);
        };

        messenger.setChannelHead = function (curvePublic, hash, cb) {
            var friend = friends[curvePublic];
            if (!friend) { return void cb('NO_SUCH_FRIEND'); }
            friend.lastKnownHash = hash;
            cb();
        };

        // Id message allows us to map a netfluxId with a public curve key
        var onIdMessage = function (msg, sender) {
            var channel;
            var isId = Object.keys(channels).some(function (chanId) {
                if (channels[chanId].userList.indexOf(sender) !== -1) {
                    channel = channels[chanId];
                    return true;
                }
            });

            if (!isId) { return; }

            var decryptedMsg = channel.encryptor.decrypt(msg);

            if (decryptedMsg === null) {
                // console.error('unable to decrypt message');
                // console.error('potentially meant for yourself');

                // message failed to parse, meaning somebody sent it to you but
                // encrypted it with the wrong key, or you're sending a message to
                // yourself in a different tab.
                return;
            }

            if (!decryptedMsg) {
                console.error('decrypted message was falsey but not null');
                return;
            }

            var parsed;
            try {
                parsed = JSON.parse(decryptedMsg);
            } catch (e) {
                console.error(decryptedMsg);
                return;
            }
            if (parsed[0] !== Types.mapId && parsed[0] !== Types.mapIdAck) { return; }

            // check that the responding peer's encrypted netflux id matches
            // the sender field. This is to prevent replay attacks.
            if (parsed[2] !== sender || !parsed[1]) { return; }
            channel.mapId[sender] = parsed[1]; // HERE
            messenger.handlers.join.forEach(function (f) {
                f(parsed[1], channel.id);
            });

            if (parsed[0] !== Types.mapId) { return; } // Don't send your key if it's already an ACK
            // Answer with your own key
            var rMsg = [Types.mapIdAck, proxy.curvePublic, channel.wc.myID];
            var rMsgStr = JSON.stringify(rMsg);
            var cryptMsg = channel.encryptor.encrypt(rMsgStr);
            network.sendto(sender, cryptMsg);
        };

        var orderMessages = function (curvePublic, new_messages, sig) {
            var channel = getChannel(curvePublic);
            var messages = channel.messages;
            var idx;
            messages.some(function (msg, i) {
                if (msg.sig === sig) { idx = i; }
                return true;
            });

            if (typeof(idx) !== 'undefined') {
                console.error('found old message at %s', idx);
            } else {
                console.error("did not find desired message");
            }

            // TODO improve performance
            new_messages.reverse().forEach(function (msg) {
                messages.unshift(msg);
            });
        };

        var pushMsg = function (channel, cryptMsg) {
            var msg = channel.encryptor.decrypt(cryptMsg);

            // TODO emit new message event or something
            // extension point for other apps
            //console.log(msg);

            var sig = cryptMsg.slice(0, 64);
            if (msgAlreadyKnown(channel, sig)) { return; }

            var parsedMsg = JSON.parse(msg);
            if (parsedMsg[0] === Types.message) {
                // TODO validate messages here
                var res = {
                    type: parsedMsg[0],
                    sig: sig,
                    channel: parsedMsg[1],
                    time: parsedMsg[2],
                    text: parsedMsg[3],
                    // this makes debugging a whole lot easier
                    curve: getCurveForChannel(channel.id),
                };

                // TODO emit message event
                channel.messages.push(res);

                messenger.handlers.message.forEach(function (f) {
                    f(res);
                });

                return true;
            }
            if (parsedMsg[0] === Types.update) {
                // TODO emit update event

                if (parsedMsg[1] === proxy.curvePublic) { return; }
                var newdata = parsedMsg[3];
                var data = getFriend(proxy, parsedMsg[1]);
                var types = [];
                Object.keys(newdata).forEach(function (k) {
                    if (data[k] !== newdata[k]) {
                        types.push(k);
                        data[k] = newdata[k];
                    }
                });
                //channel.updateUI(types);
                return;
            }
            if (parsedMsg[0] === Types.unfriend) {
                removeFromFriendList(proxy, realtime, channel.friendEd, function () {
                    channel.wc.leave(Types.unfriend);
                    //channel.removeUI();
                });
                return;
            }
        };

        /*  Broadcast a display name, profile, or avatar change to all contacts
        */

        // TODO send event...
        messenger.updateMyData = function () {
            var friends = getFriendList(proxy);
            var mySyncData = friends.me;
            var myData = createData(proxy);
            if (!mySyncData || mySyncData.displayName !== myData.displayName
                 || mySyncData.profile !== myData.profile
                 || mySyncData.avatar !== myData.avatar) {
                delete myData.channel;
                Object.keys(channels).forEach(function (chan) {
                    var channel = channels[chan];
                    var msg = [Types.update, myData.curvePublic, +new Date(), myData];
                    var msgStr = JSON.stringify(msg);
                    var cryptMsg = channel.encryptor.encrypt(msgStr);
                    channel.wc.bcast(cryptMsg).then(function () {
                        // TODO send event
                        //channel.refresh();
                    }, function (err) {
                        console.error(err);
                    });
                });
                friends.me = myData;
            }
        };

        var onChannelReady = function (chanId) {
            var cb = joining[chanId];
            if (typeof(cb) !== 'function') {
                return void console.log('channel ready without callback');
            }
            delete joining[chanId];
            return cb();
        };

        var onDirectMessage = function (common, msg, sender) {
            if (sender !== Msg.hk) { return void onIdMessage(msg, sender); }
            var parsed = JSON.parse(msg);

            if (/HISTORY_RANGE/.test(parsed[0])) {
                //console.log(parsed);
                var txid = parsed[1];
                var req = getRangeRequest(txid);
                var type = parsed[0];
                if (!req) {
                    return void console.error("received response to unknown request");
                }

                if (type === 'HISTORY_RANGE') {
                    //console.log(parsed);
                    req.messages.push(parsed[2]); // TODO use pushMsg instead
                } else if (type === 'HISTORY_RANGE_END') {
                    // process all the messages (decrypt)
                    var curvePublic = req.curvePublic;
                    var channel = getChannel(curvePublic);

                    var decrypted = req.messages.map(function (msg) {
                        if (msg[2] !== 'MSG') { return; }
                        try {
                            return {
                                d: JSON.parse(channel.encryptor.decrypt(msg[4])),
                                sig: msg[4].slice(0, 64),
                            };
                        } catch (e) {
                            console.log('failed to decrypt');
                            return null;
                        }
                    }).filter(function (decrypted) {
                        return decrypted;
                    }).map(function (O) {
                        return {
                            type: O.d[0],
                            sig: O.sig,
                            channel: O.d[1],
                            time: O.d[2],
                            text: O.d[3],
                            curve: curvePublic,
                        };
                    });

                    orderMessages(curvePublic, decrypted, req.sig);
                    return void req.cb(void 0, decrypted);
                } else {
                    console.log(parsed);
                }
                return;
            }

            if ((parsed.validateKey || parsed.owners) && parsed.channel) {
                return;
            }
            if (parsed.state && parsed.state === 1 && parsed.channel) {
                if (channels[parsed.channel]) {
                    // parsed.channel is Ready
                    // channel[parsed.channel].ready();
                    channels[parsed.channel].ready = true;
                    onChannelReady(parsed.channel);
                    var updateTypes = channels[parsed.channel].updateOnReady;
                    if (updateTypes) {

                        //channels[parsed.channel].updateUI(updateTypes);
                    }
                }
                return;
            }
            var chan = parsed[3];
            if (!chan || !channels[chan]) { return; }
            pushMsg(channels[chan], parsed[4]);
        };

        var onMessage = function (common, msg, sender, chan) {
            if (!channels[chan.id]) { return; }

            var isMessage = pushMsg(channels[chan.id], msg);
            if (isMessage) {
                if (channels[chan.id].wc.myID !== sender) {
                    // Don't notify for your own messages
                    //channels[chan.id].notify();
                }
                //channels[chan.id].refresh();
                // TODO emit message event
            }
        };

        // listen for messages...
        network.on('message', function(msg, sender) {
            onDirectMessage(common, msg, sender);
        });

        messenger.removeFriend = function (curvePublic, cb) {
            if (typeof(cb) !== 'function') { throw new Error('NO_CALLBACK'); }
            var data = getFriend(proxy, curvePublic);
            var channel = channels[data.channel];
            var msg = [Types.unfriend, proxy.curvePublic, +new Date()];
            var msgStr = JSON.stringify(msg);
            var cryptMsg = channel.encryptor.encrypt(msgStr);

            // TODO emit remove_friend event?
            channel.wc.bcast(cryptMsg).then(function () {
                delete friends[curvePublic];
                Realtime.whenRealtimeSyncs(realtime, function () {
                    cb();
                });
            }, function (err) {
                console.error(err);
                cb(err);
            });
        };

        var getChannelMessagesSince = function (chan, data, keys) {
            console.log('Fetching [%s] messages since [%s]', data.curvePublic, data.lastKnownHash || '');
            var cfg = {
                validateKey: keys.validateKey,
                owners: [proxy.edPublic, data.edPublic],
                lastKnownHash: data.lastKnownHash
            };
            var msg = ['GET_HISTORY', chan.id, cfg];
            network.sendto(network.historyKeeper, JSON.stringify(msg))
              .then($.noop, function (err) {
                throw new Error(err);
            });
        };

        var openFriendChannel = function (data, f) {
            var keys = Curve.deriveKeys(data.curvePublic, proxy.curvePrivate);
            var encryptor = Curve.createEncryptor(keys);
            network.join(data.channel).then(function (chan) {
                var channel = channels[data.channel] = {
                    id: data.channel,
                    sending: false,
                    friendEd: f,
                    keys: keys,
                    curve: data.curvePublic,
                    encryptor: encryptor,
                    messages: [],
                    wc: chan,
                    userList: [],
                    mapId: {},
                    send: function (payload, cb) {
                        if (!network.webChannels.some(function (wc) {
                            if (wc.id === channel.wc.id) { return true; }
                        })) {
                            return void cb('NO_SUCH_CHANNEL');
                        }

                        var msg = [Types.message, proxy.curvePublic, +new Date(), payload];
                        var msgStr = JSON.stringify(msg);
                        var cryptMsg = channel.encryptor.encrypt(msgStr);

                        channel.wc.bcast(cryptMsg).then(function () {
                            pushMsg(channel, cryptMsg);
                            cb();
                        }, function (err) {
                            cb(err);
                        });
                    }
                };
                chan.on('message', function (msg, sender) {
                    onMessage(common, msg, sender, chan);
                });

                var onJoining = function (peer) {
                    if (peer === Msg.hk) { return; }
                    if (channel.userList.indexOf(peer) !== -1) { return; }

                    // FIXME this doesn't seem to be mapping correctly
                    channel.userList.push(peer);
                    var msg = [Types.mapId, proxy.curvePublic, chan.myID];
                    var msgStr = JSON.stringify(msg);
                    var cryptMsg = channel.encryptor.encrypt(msgStr);
                    network.sendto(peer, cryptMsg);
                };
                chan.members.forEach(function (peer) {
                    if (peer === Msg.hk) { return; }
                    if (channel.userList.indexOf(peer) !== -1) { return; }
                    channel.userList.push(peer);
                });
                chan.on('join', onJoining);
                chan.on('leave', function (peer) {
                    var curvePublic = channel.mapId[peer];
                    console.log(curvePublic); // FIXME

                    var i = channel.userList.indexOf(peer);
                    while (i !== -1) {
                        channel.userList.splice(i, 1);
                        i = channel.userList.indexOf(peer);
                    }
                    // update status
                    if (!curvePublic) { return; }
                    messenger.handlers.leave.forEach(function (f) {
                        f(curvePublic, channel.id);
                    });
                });

                // FIXME don't subscribe to the channel implicitly
                getChannelMessagesSince(chan, data, keys);
            }, function (err) {
                console.error(err);
            });
        };

        // FIXME don't do this implicitly.
        // get messages when a channel is opened, and if it reconnects
        /*
        messenger.getLatestMessages = function () {
            Object.keys(channels).forEach(function (id) {
                if (id === 'me') { return; }
                var friend = channels[id];
                //friend.getMessagesSinceDisconnect();
                //friend.refresh();
            });
        };*/

        // FIXME this shouldn't be necessary
        /*
        messenger.cleanFriendChannels = function () {
            Object.keys(channels).forEach(function (id) {
                delete channels[id];
            });
        };*/

        messenger.getFriendList = function (cb) {
            var friends = proxy.friends;
            if (!friends) { return void cb(void 0, []); }

            cb(void 0, Object.keys(proxy.friends).filter(function (k) {
                return k !== 'me';
            }));
        };

/*
        messenger.openFriendChannels = function () {
            eachFriend(friends, openFriendChannel);
        };*/

        messenger.openFriendChannel = function (curvePublic, cb) {
            if (typeof(curvePublic) !== 'string') { return void cb('INVALID_ID'); }
            if (typeof(cb) !== 'function') { throw new Error('expected callback'); }

            var friend = clone(friends[curvePublic]);
            if (typeof(friend) !== 'object') {
                return void cb('NO_FRIEND_DATA');
            }
            var channel = friend.channel;
            if (!channel) { return void cb('E_NO_CHANNEL'); }
            joining[channel] = cb;
            openFriendChannel(friend, curvePublic);
        };

        messenger.sendMessage = function (curvePublic, payload, cb) {
            var channel = getChannel(curvePublic);
            if (!channel) { return void cb('NO_CHANNEL'); }
            if (!network.webChannels.some(function (wc) {
                if (wc.id === channel.wc.id) { return true; }
            })) {
                return void cb('NO_SUCH_CHANNEL');
            }

            var msg = [Types.message, proxy.curvePublic, +new Date(), payload];
            var msgStr = JSON.stringify(msg);
            var cryptMsg = channel.encryptor.encrypt(msgStr);

            channel.wc.bcast(cryptMsg).then(function () {
                pushMsg(channel, cryptMsg);
                cb();
            }, function (err) {
                cb(err);
            });
        };

        messenger.getStatus = function (curvePublic, cb) {
            var channel = getChannel(curvePublic);
            if (!channel) { return void cb('NO_SUCH_CHANNEL'); }
            var online = channel.userList.some(function (nId) {
                return channel.mapId[nId] === curvePublic;
            });
            cb(void 0, online);
        };

        // TODO emit friend-list-changed event
        messenger.checkNewFriends = function () {
            eachFriend(friends, function (friend, id) {
                if (!channels[id]) {
                    openFriendChannel(friend, id);
                }
            });
        };

        messenger.getFriendInfo = function (curvePublic, cb) {
            var friend = friends[curvePublic];
            if (!friend) { return void cb('NO_SUCH_FRIEND'); }
            // this clone will be redundant when ui uses postmessage
            cb(void 0, clone(friend));
        };

        messenger.getMyInfo = function (cb) {
            cb(void 0, {
                curvePublic: proxy.curvePublic,
                displayName: common.getDisplayName(),
            });
        };

        // TODO listen for changes to your friend list
        // emit 'update' events for clients

        //var update = function (curvePublic
        proxy.on('change', ['friends'], function (o, n, p) {
            var curvePublic;
            if (o === undefined) {
                // new friend added
                curvePublic = p.slice(-1)[0];
                eachHandler('new_friend', function (f) {
                    f(clone(n), curvePublic);
                });
                return;
            }

            console.error(o, n, p);
        }).on('remove', ['friends'], function (o, p) {
            console.error(o, p);
        });

        Object.freeze(messenger);

        return messenger;
    };

    return Msg;
});

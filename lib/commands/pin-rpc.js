/*jshint esversion: 6 */
const Core = require("./core");

const BatchRead = require("../batch-read");
const Pins = require("../pins");

const Pinning = module.exports;
const Nacl = require("tweetnacl/nacl-fast");
const Util = require("../common-util");
const nThen = require("nthen");

//const escapeKeyCharacters = Util.escapeKeyCharacters;
const unescapeKeyCharacters = Util.unescapeKeyCharacters;

var sumChannelSizes = function (sizes) {
    return Object.keys(sizes).map(function (id) { return sizes[id]; })
        .filter(function (x) {
            // only allow positive numbers
            return !(typeof(x) !== 'number' || x <= 0);
        })
        .reduce(function (a, b) { return a + b; }, 0);
};

// XXX it's possible for this to respond before the server has had a chance
// to fetch the limits. Maybe we should respond with an error...
// or wait until we actually know the limits before responding
var getLimit = Pinning.getLimit = function (Env, publicKey, cb) {
    var unescapedKey = unescapeKeyCharacters(publicKey);
    var limit = Env.limits[unescapedKey];
    var defaultLimit = typeof(Env.defaultStorageLimit) === 'number'?
        Env.defaultStorageLimit: Core.DEFAULT_LIMIT;

    var toSend = limit && typeof(limit.limit) === "number"?
        [limit.limit, limit.plan, limit.note] : [defaultLimit, '', ''];

    cb(void 0, toSend);
};

var addPinned = function (
    Env,
    publicKey /*:string*/,
    channelList /*Array<string>*/,
    cb /*:()=>void*/)
{
    Env.evPinnedPadsReady.reg(() => {
        channelList.forEach((c) => {
            const x = Env.pinnedPads[c] = Env.pinnedPads[c] || {};
            x[publicKey] = 1;
        });
        cb();
    });
};
var removePinned = function (
    Env,
    publicKey /*:string*/,
    channelList /*Array<string>*/,
    cb /*:()=>void*/)
{
    Env.evPinnedPadsReady.reg(() => {
        channelList.forEach((c) => {
            const x = Env.pinnedPads[c];
            if (!x) { return; }
            delete x[publicKey];
        });
        cb();
    });
};

var getMultipleFileSize = function (Env, channels, cb) {
    if (!Array.isArray(channels)) { return cb('INVALID_PIN_LIST'); }
    if (typeof(Env.msgStore.getChannelSize) !== 'function') {
        return cb('GET_CHANNEL_SIZE_UNSUPPORTED');
    }

    var i = channels.length;
    var counts = {};

    var done = function () {
        i--;
        if (i === 0) { return cb(void 0, counts); }
    };

    channels.forEach(function (channel) {
        Pinning.getFileSize(Env, channel, function (e, size) {
            if (e) {
                // most likely error here is that a file no longer exists
                // but a user still has it in their drive, and wants to know
                // its size. We should find a way to inform them of this in
                // the future. For now we can just tell them it has no size.

                //WARN('getFileSize', e);
                counts[channel] = 0;
                return done();
            }
            counts[channel] = size;
            done();
        });
    });
};

const batchUserPins = BatchRead("LOAD_USER_PINS");
var loadUserPins = function (Env, publicKey, cb) {
    var session = Core.getSession(Env.Sessions, publicKey);

    if (session.channels) {
        return cb(session.channels);
    }

    batchUserPins(publicKey, cb, function (done) {
        var ref = {};
        var lineHandler = Pins.createLineHandler(ref, function (label, data) {
            Env.Log.error(label, {
                log: publicKey,
                data: data,
            });
        });

        // if channels aren't in memory. load them from disk
        Env.pinStore.getMessages(publicKey, lineHandler, function () {
            // no more messages

            // only put this into the cache if it completes
            session.channels = ref.pins;
            done(ref.pins); // FIXME no error handling?
        });
    });
};

var truthyKeys = function (O) {
    return Object.keys(O).filter(function (k) {
        return O[k];
    });
};

var getChannelList = Pinning.getChannelList = function (Env, publicKey, _cb) {
    var cb = Util.once(Util.mkAsync(_cb));
    loadUserPins(Env, publicKey, function (pins) {
        cb(truthyKeys(pins));
    });
};

const batchTotalSize = BatchRead("GET_TOTAL_SIZE");
Pinning.getTotalSize = function (Env, publicKey, cb) {
    var unescapedKey = unescapeKeyCharacters(publicKey);
    var limit = Env.limits[unescapedKey];

    // Get a common key if multiple users share the same quota, otherwise take the public key
    var batchKey = (limit && Array.isArray(limit.users)) ? limit.users.join('') : publicKey;

    batchTotalSize(batchKey, cb, function (done) {
        var channels = [];
        var bytes = 0;
        nThen(function (waitFor) {
            // Get the channels list for our user account
            Pinning.getChannelList(Env, publicKey, waitFor(function (_channels) {
                if (!_channels) {
                    waitFor.abort();
                    return done('INVALID_PIN_LIST');
                }
                Array.prototype.push.apply(channels, _channels);
            }));
            // Get the channels list for users sharing our quota
            if (limit && Array.isArray(limit.users) && limit.users.length > 1) {
                limit.users.forEach(function (key) {
                    if (key === unescapedKey) { return; } // Don't count ourselves twice
                    getChannelList(Env, key, waitFor(function (_channels) {
                        if (!_channels) { return; } // Broken user, don't count their quota
                        Array.prototype.push.apply(channels, _channels);
                    }));
                });
            }
        }).nThen(function (waitFor) {
            // Get size of the channels
            var list = []; // Contains the channels already counted in the quota to avoid duplicates
            channels.forEach(function (channel) { // TODO semaphore?
                if (list.indexOf(channel) !== -1) { return; }
                list.push(channel);
                Pinning.getFileSize(Env, channel, waitFor(function (e, size) {
                    if (!e) { bytes += size; }
                }));
            });
        }).nThen(function () {
            done(void 0, bytes);
        });
    });
};

/*  Users should be able to clear their own pin log with an authenticated RPC
*/
Pinning.removePins = function (Env, safeKey, cb) {
    if (typeof(Env.pinStore.removeChannel) !== 'function') {
        return void cb("E_NOT_IMPLEMENTED");
    }
    Env.pinStore.removeChannel(safeKey, function (err) {
        Env.Log.info('DELETION_PIN_BY_OWNER_RPC', {
            safeKey: safeKey,
            status: err? String(err): 'SUCCESS',
        });

        cb(err);
    });
};

Pinning.trimPins = function (Env, safeKey, cb) {
    // XXX trim to latest pin checkpoint
    cb("NOT_IMPLEMENTED");
};

var getFreeSpace = Pinning.getFreeSpace = function (Env, publicKey, cb) {
    getLimit(Env, publicKey, function (e, limit) {
        if (e) { return void cb(e); }
        Pinning.getTotalSize(Env, publicKey, function (e, size) {
            if (typeof(size) === 'undefined') { return void cb(e); }

            var rem = limit[0] - size;
            if (typeof(rem) !== 'number') {
                return void cb('invalid_response');
            }
            cb(void 0, rem);
        });
    });
};

var hashChannelList = function (A) {
    var uniques = [];

    A.forEach(function (a) {
        if (uniques.indexOf(a) === -1) { uniques.push(a); }
    });
    uniques.sort();

    var hash = Nacl.util.encodeBase64(Nacl.hash(Nacl
        .util.decodeUTF8(JSON.stringify(uniques))));

    return hash;
};

var getHash = Pinning.getHash = function (Env, publicKey, cb) {
    getChannelList(Env, publicKey, function (channels) {
        cb(void 0, hashChannelList(channels));
    });
};

Pinning.pinChannel = function (Env, publicKey, channels, cb) {
    if (!channels && channels.filter) {
        return void cb('INVALID_PIN_LIST');
    }

    // get channel list ensures your session has a cached channel list
    getChannelList(Env, publicKey, function (pinned) {
        var session = Core.getSession(Env.Sessions, publicKey);

        // only pin channels which are not already pinned
        var toStore = channels.filter(function (channel) {
            return pinned.indexOf(channel) === -1;
        });

        if (toStore.length === 0) {
            return void getHash(Env, publicKey, cb);
        }

        getMultipleFileSize(Env, toStore, function (e, sizes) {
            if (typeof(sizes) === 'undefined') { return void cb(e); }
            var pinSize = sumChannelSizes(sizes);

            getFreeSpace(Env, publicKey, function (e, free) {
                if (typeof(free) === 'undefined') {
                    Env.WARN('getFreeSpace', e);
                    return void cb(e);
                }
                if (pinSize > free) { return void cb('E_OVER_LIMIT'); }

                Env.pinStore.message(publicKey, JSON.stringify(['PIN', toStore, +new Date()]),
                    function (e) {
                    if (e) { return void cb(e); }
                    toStore.forEach(function (channel) {
                        session.channels[channel] = true;
                    });
                    addPinned(Env, publicKey, toStore, () => {});
                    getHash(Env, publicKey, cb);
                });
            });
        });
    });
};

Pinning.unpinChannel = function (Env, publicKey, channels, cb) {
    if (!channels && channels.filter) {
        // expected array
        return void cb('INVALID_PIN_LIST');
    }

    getChannelList(Env, publicKey, function (pinned) {
        var session = Core.getSession(Env.Sessions, publicKey);

        // only unpin channels which are pinned
        var toStore = channels.filter(function (channel) {
            return pinned.indexOf(channel) !== -1;
        });

        if (toStore.length === 0) {
            return void getHash(Env, publicKey, cb);
        }

        Env.pinStore.message(publicKey, JSON.stringify(['UNPIN', toStore, +new Date()]),
            function (e) {
            if (e) { return void cb(e); }
            toStore.forEach(function (channel) {
                delete session.channels[channel];
            });
            removePinned(Env, publicKey, toStore, () => {});
            getHash(Env, publicKey, cb);
        });
    });
};

Pinning.resetUserPins = function (Env, publicKey, channelList, cb) {
    if (!Array.isArray(channelList)) { return void cb('INVALID_PIN_LIST'); }
    var session = Core.getSession(Env.Sessions, publicKey);

    if (!channelList.length) {
        return void getHash(Env, publicKey, function (e, hash) {
            if (e) { return cb(e); }
            cb(void 0, hash);
        });
    }

    var pins = {};
    getMultipleFileSize(Env, channelList, function (e, sizes) {
        if (typeof(sizes) === 'undefined') { return void cb(e); }
        var pinSize = sumChannelSizes(sizes);


        getLimit(Env, publicKey, function (e, limit) {
            if (e) {
                Env.WARN('[RESET_ERR]', e);
                return void cb(e);
            }

            /*  we want to let people pin, even if they are over their limit,
                but they should only be able to do this once.

                This prevents data loss in the case that someone registers, but
                does not have enough free space to pin their migrated data.

                They will not be able to pin additional pads until they upgrade
                or delete enough files to go back under their limit. */
            if (pinSize > limit[0] && session.hasPinned) { return void(cb('E_OVER_LIMIT')); }
            Env.pinStore.message(publicKey, JSON.stringify(['RESET', channelList, +new Date()]),
                function (e) {
                if (e) { return void cb(e); }
                channelList.forEach(function (channel) {
                    pins[channel] = true;
                });

                var oldChannels;
                if (session.channels && typeof(session.channels) === 'object') {
                    oldChannels = Object.keys(session.channels);
                } else {
                    oldChannels = [];
                }
                removePinned(Env, publicKey, oldChannels, () => {
                    addPinned(Env, publicKey, channelList, ()=>{});
                });

                // update in-memory cache IFF the reset was allowed.
                session.channels = pins;
                getHash(Env, publicKey, function (e, hash) {
                    cb(e, hash);
                });
            });
        });
    });
};

Pinning.getFileSize = function (Env, channel, _cb) {
    var cb = Util.once(Util.mkAsync(_cb));
    if (!Core.isValidId(channel)) { return void cb('INVALID_CHAN'); }
    if (channel.length === 32) {
        if (typeof(Env.msgStore.getChannelSize) !== 'function') {
            return cb('GET_CHANNEL_SIZE_UNSUPPORTED');
        }

        return void Env.msgStore.getChannelSize(channel, function (e, size /*:number*/) {
            if (e) {
                if (e.code === 'ENOENT') { return void cb(void 0, 0); }
                return void cb(e.code);
            }
            cb(void 0, size);
        });
    }

    // 'channel' refers to a file, so you need another API
    Env.blobStore.size(channel, function (e, size) {
        if (typeof(size) === 'undefined') { return void cb(e); }
        cb(void 0, size);
    });
};


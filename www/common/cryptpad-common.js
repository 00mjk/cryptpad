define([
    '/api/config',
    '/customize/messages.js',
    '/common/common-util.js',
    '/common/common-hash.js',
    '/common/common-messaging.js',
    '/common/common-constants.js',
    '/common/common-feedback.js',
    '/common/outer/local-store.js',
    '/common/outer/worker-channel.js',
    '/common/outer/login-block.js',

    '/customize/application_config.js',
    '/bower_components/nthen/index.js',
], function (Config, Messages, Util, Hash,
            Messaging, Constants, Feedback, LocalStore, Channel, Block,
            AppConfig, Nthen) {

/*  This file exposes functionality which is specific to Cryptpad, but not to
    any particular pad type. This includes functions for committing metadata
    about pads to your local storage for future use and improved usability.

    Additionally, there is some basic functionality for import/export.
*/
    var urlArgs = Util.find(Config, ['requireConf', 'urlArgs']) || '';

    var postMessage = function (/*cmd, data, cb*/) {
        /*setTimeout(function () {
            AStore.query(cmd, data, cb);
        });*/
        console.error('NOT_READY');
    };
    var tryParsing = function (x) {
        try { return JSON.parse(x); }
        catch (e) {
            console.error(e);
            return null;
        }
    };

    var origin = encodeURIComponent(window.location.hostname);
    var common = window.Cryptpad = {
        Messages: Messages,
        donateURL: 'https://accounts.cryptpad.fr/#/donate?on=' + origin,
        upgradeURL: 'https://accounts.cryptpad.fr/#/?on=' + origin,
        account: {},
    };

    var PINNING_ENABLED = AppConfig.enablePinning;

    // COMMON
    common.getLanguage = function () {
        return Messages._languageUsed;
    };
    common.setLanguage = function (l, cb) {
        var LS_LANG = "CRYPTPAD_LANG";
        localStorage.setItem(LS_LANG, l);
        cb();
    };


    // RESTRICTED
    // Settings only
    common.resetDrive = function (cb) {
        postMessage("RESET_DRIVE", null, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            cb();
        });
    };
    common.logoutFromAll = function (cb) {
        var token = Math.floor(Math.random()*Number.MAX_SAFE_INTEGER);
        localStorage.setItem(Constants.tokenKey, token);
        postMessage("SET", {
            key: [Constants.tokenKey],
            value: token
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb();
        });
    };
    // Settings and drive and auth
    common.getUserObject = function (cb) {
        postMessage("GET", [], function (obj) {
            cb(obj);
        });
    };
    // Settings and ready
    common.mergeAnonDrive = function (cb) {
        var data = {
            anonHash: LocalStore.getFSHash()
        };
        postMessage("MIGRATE_ANON_DRIVE", data, cb);
    };
    // Settings
    common.deleteAccount = function (cb) {
        postMessage("DELETE_ACCOUNT", null, cb);
    };
    // Drive
    common.userObjectCommand = function (data, cb) {
        postMessage("DRIVE_USEROBJECT", data, cb);
    };
    common.drive = {};
    common.drive.onLog = Util.mkEvent();
    common.drive.onChange = Util.mkEvent();
    common.drive.onRemove = Util.mkEvent();
    // Profile
    common.getProfileEditUrl = function (cb) {
        postMessage("GET", ['profile', 'edit'], function (obj) {
            cb(obj);
        });
    };
    common.setNewProfile = function (profile) {
        postMessage("SET", {
            key: ['profile'],
            value: profile
        }, function () {});
    };
    common.setAvatar = function (data, cb) {
        var postData = {
            key: ['profile', 'avatar']
        };
        // If we don't have "data", it means we want to remove the avatar and we should not have a
        // "postData.value", even set to undefined (JSON.stringify transforms undefined to null)
        if (data) { postData.value = data; }
        postMessage("SET", postData, cb);
    };
    // Todo
    common.getTodoHash = function (cb) {
        postMessage("GET", ['todo'], function (obj) {
            cb(obj);
        });
    };
    common.setTodoHash = function (hash) {
        postMessage("SET", {
            key: ['todo'],
            value: hash
        }, function () {});
    };


    // RPC
    common.pinPads = function (pads, cb) {
        postMessage("PIN_PADS", pads, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj.hash);
        });
    };

    common.unpinPads = function (pads, cb) {
        postMessage("UNPIN_PADS", pads, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj.hash);
        });
    };

    common.getPinnedUsage = function (cb) {
        postMessage("GET_PINNED_USAGE", null, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            cb(null, obj.bytes);
        });
    };

    common.updatePinLimit = function (cb) {
        postMessage("UPDATE_PIN_LIMIT", null, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            cb(undefined, obj.limit, obj.plan, obj.note);
        });
    };

    common.getPinLimit = function (cb) {
        postMessage("GET_PIN_LIMIT", null, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            cb(undefined, obj.limit, obj.plan, obj.note);
        });
    };

    common.isOverPinLimit = function (cb) {
        if (!LocalStore.isLoggedIn()) { return void cb(null, false); }
        var usage;
        var andThen = function (e, limit, plan) {
            if (e) { return void cb(e); }
            var data = {usage: usage, limit: limit, plan: plan};
            if (usage > limit) {
                return void cb (null, true, data);
            }
            return void cb (null, false, data);
        };
        var todo = function (e, used) {
            if (e) { return void cb(e); }
            usage = used;
            common.getPinLimit(andThen);
        };
        common.getPinnedUsage(todo);
    };

    common.clearOwnedChannel = function (channel, cb) {
        postMessage("CLEAR_OWNED_CHANNEL", channel, cb);
    };
    common.removeOwnedChannel = function (channel, cb) {
        postMessage("REMOVE_OWNED_CHANNEL", channel, cb);
    };

    common.getDeletedPads = function (cb) {
        postMessage("GET_DELETED_PADS", null, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.uploadComplete = function (id, owned, cb) {
        postMessage("UPLOAD_COMPLETE", {id: id, owned: owned}, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.uploadStatus = function (size, cb) {
        postMessage("UPLOAD_STATUS", {size: size}, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.uploadCancel = function (size, cb) {
        postMessage("UPLOAD_CANCEL", {size: size}, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.uploadChunk = function (data, cb) {
        postMessage("UPLOAD_CHUNK", {chunk: data}, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.writeLoginBlock = function (data, cb) {
        postMessage('WRITE_LOGIN_BLOCK', data, function (obj) {
            cb(obj);
        });
    };

    common.removeLoginBlock = function (data, cb) {
        postMessage('REMOVE_LOGIN_BLOCK', data, function (obj) {
            cb(obj);
        });
    };

    // ANON RPC

    // SFRAME: talk to anon_rpc from the iframe
    common.anonRpcMsg = function (msg, data, cb) {
        if (!msg) { return; }
        postMessage("ANON_RPC_MESSAGE", {
            msg: msg,
            data: data
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.getFileSize = function (href, password, cb) {
        postMessage("GET_FILE_SIZE", {href: href, password: password}, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(undefined, obj.size);
        });
    };

    common.getMultipleFileSize = function (files, cb) {
        postMessage("GET_MULTIPLE_FILE_SIZE", {files:files}, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            cb(undefined, obj.size);
        });
    };

    common.isNewChannel = function (href, password, cb) {
        postMessage('IS_NEW_CHANNEL', {href: href, password: password}, function (obj) {
            if (obj.error) { return void cb(obj.error); }
            if (!obj) { return void cb('INVALID_RESPONSE'); }
            cb(undefined, obj.isNew);
        });
    };

    // Store



    common.getMetadata = function (cb) {
        postMessage("GET_METADATA", null, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    common.setDisplayName = function (value, cb) {
        postMessage("SET_DISPLAY_NAME", value, cb);
    };

    common.setPadAttribute = function (attr, value, cb, href) {
        cb = cb || function () {};
        href = Hash.getRelativeHref(href || window.location.href);
        postMessage("SET_PAD_ATTRIBUTE", {
            href: href,
            attr: attr,
            value: value
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb();
        });
    };
    common.getPadAttribute = function (attr, cb, href) {
        href = Hash.getRelativeHref(href || window.location.href);
        postMessage("GET_PAD_ATTRIBUTE", {
            href: href,
            attr: attr,
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };
    common.setAttribute = function (attr, value, cb) {
        cb = cb || function () {};
        postMessage("SET_ATTRIBUTE", {
            attr: attr,
            value: value
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb();
        });
    };
    common.getAttribute = function (attr, cb) {
        postMessage("GET_ATTRIBUTE", {
            attr: attr
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(null, obj);
        });
    };

    // Tags
    common.resetTags = function (href, tags, cb) {
        // set pad attribute
        cb = cb || function () {};
        if (!Array.isArray(tags)) { return void cb('INVALID_TAGS'); }
        common.setPadAttribute('tags', tags.slice(), cb, href);
    };
    common.tagPad = function (href, tag, cb) {
        if (typeof(cb) !== 'function') {
            return void console.error('EXPECTED_CALLBACK');
        }
        if (typeof(tag) !== 'string') { return void cb('INVALID_TAG'); }
        common.getPadAttribute('tags', function (e, tags) {
            if (e) { return void cb(e); }
            var newTags;
            if (!tags) {
                newTags = [tag];
            } else if (tags.indexOf(tag) === -1) {
                newTags = tags.slice();
                newTags.push(tag);
            }
            common.setPadAttribute('tags', newTags, cb, href);
        }, href);
    };
    common.untagPad = function (href, tag, cb) {
        if (typeof(cb) !== 'function') {
            return void console.error('EXPECTED_CALLBACK');
        }
        if (typeof(tag) !== 'string') { return void cb('INVALID_TAG'); }
        common.getPadAttribute('tags', function (e, tags) {
            if (e) { return void cb(e); }
            if (!tags) { return void cb(); }
            var idx = tags.indexOf(tag);
            if (idx === -1) { return void cb(); }
            var newTags = tags.slice();
            newTags.splice(idx, 1);
            common.setPadAttribute('tags', newTags, cb, href);
        }, href);
    };
    common.getPadTags = function (href, cb) {
        if (typeof(cb) !== 'function') { return; }
        common.getPadAttribute('tags', function (e, tags) {
            if (e) { return void cb(e); }
            cb(void 0, tags ? tags.slice() : []);
        }, href);
    };
    common.listAllTags = function (cb) {
        postMessage("LIST_ALL_TAGS", null, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb(void 0, obj);
        });
    };

    // STORAGE - TEMPLATES
    common.listTemplates = function (type, cb) {
        postMessage("GET_TEMPLATES", null, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            if (!Array.isArray(obj)) { return void cb ('NOT_AN_ARRAY'); }
            if (!type) { return void cb(null, obj); }

            var templates = obj.filter(function (f) {
                var parsed = Hash.parsePadUrl(f.href);
                return parsed.type === type;
            });
            cb(null, templates);
        });
    };

    common.saveAsTemplate = function (Cryptput, data, cb) {
        var p = Hash.parsePadUrl(window.location.href);
        if (!p.type) { return; }
        // PPP: password for the new template?
        var hash = Hash.createRandomHash(p.type);
        var href = '/' + p.type + '/#' + hash;
        // PPP: add password as cryptput option
        Cryptput(hash, data.toSave, function (e) {
            if (e) { throw new Error(e); }
            postMessage("ADD_PAD", {
                href: href,
                title: data.title,
                path: ['template']
            }, function (obj) {
                if (obj && obj.error) { return void cb(obj.error); }
                cb();
            });
        });
    };

    common.isTemplate = function (href, cb) {
        var rhref = Hash.getRelativeHref(href);
        common.listTemplates(null, function (err, templates) {
            cb(void 0, templates.some(function (t) {
                return t.href === rhref;
            }));
        });
    };

    common.useTemplate = function (href, Crypt, cb, optsPut) {
        // opts is used to overrides options for chainpad-netflux in cryptput
        // it allows us to add owners and expiration time if it is a new file

        var parsed = Hash.parsePadUrl(href);
        var parsed2 = Hash.parsePadUrl(window.location.href);
        if(!parsed) { throw new Error("Cannot get template hash"); }
        postMessage("INCREMENT_TEMPLATE_USE", href);

        optsPut = optsPut || {};
        var optsGet = {};
        Nthen(function (waitFor) {
            if (parsed.hashData && parsed.hashData.password) {
                common.getPadAttribute('password', waitFor(function (err, password) {
                    optsGet.password = password;
                }), href);
            }
            if (parsed2.hashData && parsed2.hashData.password && !optsPut.password) {
                common.getPadAttribute('password', waitFor(function (err, password) {
                    optsPut.password = password;
                }));
            }
        }).nThen(function () {
            Crypt.get(parsed.hash, function (err, val) {
                if (err) { throw new Error(err); }
                try {
                    // Try to fix the title before importing the template
                    var parsed = JSON.parse(val);
                    var meta;
                    if (Array.isArray(parsed) && typeof(parsed[3]) === "object") {
                        meta = parsed[3].metadata; // pad
                    } else if (parsed.info) {
                        meta = parsed.info; // poll
                    } else {
                        meta = parsed.metadata;
                    }
                    if (typeof(meta) === "object") {
                        meta.defaultTitle = meta.title || meta.defaultTitle;
                        delete meta.users;
                        meta.title = "";
                    }
                    val = JSON.stringify(parsed);
                } catch (e) {
                    console.log("Can't fix template title", e);
                }
                Crypt.put(parsed2.hash, val, cb, optsPut);
            }, optsGet);
        });
    };

    // Forget button
    common.moveToTrash = function (cb, href) {
        href = href || window.location.href;
        postMessage("MOVE_TO_TRASH", { href: href }, cb);
    };

    // When opening a new pad or renaming it, store the new title
    common.setPadTitle = function (data, cb) {
        if (!data || typeof (data) !== "object") { return cb ('Data is not an object'); }

        var href = data.href || window.location.href;
        var parsed = Hash.parsePadUrl(href);
        if (!parsed.hash) { return cb ('Invalid hash'); }
        data.href = parsed.getUrl({present: parsed.present});

        if (typeof (data.title) !== "string") { return cb('Missing title'); }
        if (data.title.trim() === "") { data.title = Hash.getDefaultName(parsed); }

        if (common.initialPath) {
            if (!data.path) {
                data.path = common.initialPath;
                delete common.initialPath;
            }
        }

        postMessage("SET_PAD_TITLE", data, function (obj) {
            if (obj && obj.error) {
                console.log("unable to set pad title");
                return void cb(obj.error);
            }
            cb();
        });
    };

    // Needed for the secure filepicker app
    common.getSecureFilesList = function (query, cb) {
        postMessage("GET_SECURE_FILES_LIST", query, function (list) {
            cb(void 0, list);
        });
    };
    // Get a template href from its id
    common.getPadData = function (id, cb) {
        postMessage("GET_PAD_DATA", id, function (data) {
            cb(void 0, data);
        });
    };

    // Messaging (manage friends from the userlist)
    common.inviteFromUserlist = function (netfluxId, cb) {
        postMessage("INVITE_FROM_USERLIST", {
            netfluxId: netfluxId,
            href: window.location.href
        }, function (obj) {
            if (obj && obj.error) { return void cb(obj.error); }
            cb();
        });
    };

    // Network
    common.onNetworkDisconnect = Util.mkEvent();
    common.onNetworkReconnect = Util.mkEvent();
    common.onNewVersionReconnect = Util.mkEvent();

    // Messaging
    var messaging = common.messaging = {};
    messaging.onFriendRequest = Util.mkEvent();
    messaging.onFriendComplete = Util.mkEvent();
    messaging.addHandlers = function (href) {
        postMessage("ADD_DIRECT_MESSAGE_HANDLERS", {
            href: href
        });
    };

    // Messenger
    var messenger = common.messenger = {};
    messenger.getFriendList = function (cb) {
        postMessage("CONTACTS_GET_FRIEND_LIST", null, cb);
    };
    messenger.getMyInfo = function (cb) {
        postMessage("CONTACTS_GET_MY_INFO", null, cb);
    };
    messenger.getFriendInfo = function (curvePublic, cb) {
        postMessage("CONTACTS_GET_FRIEND_INFO", curvePublic, cb);
    };
    messenger.removeFriend = function (curvePublic, cb) {
        postMessage("CONTACTS_REMOVE_FRIEND", curvePublic, cb);
    };
    messenger.openFriendChannel = function (curvePublic, cb) {
        postMessage("CONTACTS_OPEN_FRIEND_CHANNEL", curvePublic, cb);
    };
    messenger.getFriendStatus = function (curvePublic, cb) {
        postMessage("CONTACTS_GET_FRIEND_STATUS", curvePublic, cb);
    };
    messenger.getMoreHistory = function (data, cb) {
        postMessage("CONTACTS_GET_MORE_HISTORY", data, cb);
    };
    messenger.sendMessage = function (data, cb) {
        postMessage("CONTACTS_SEND_MESSAGE", data, cb);
    };
    messenger.setChannelHead = function (data, cb) {
        postMessage("CONTACTS_SET_CHANNEL_HEAD", data, cb);
    };
    messenger.onMessageEvent = Util.mkEvent();
    messenger.onJoinEvent = Util.mkEvent();
    messenger.onLeaveEvent = Util.mkEvent();
    messenger.onUpdateEvent = Util.mkEvent();
    messenger.onFriendEvent = Util.mkEvent();
    messenger.onUnfriendEvent = Util.mkEvent();

    // Pad RPC
    var pad = common.padRpc = {};
    pad.joinPad = function (data) {
        postMessage("JOIN_PAD", data);
    };
    pad.leavePad = function (data, cb) {
        postMessage("LEAVE_PAD", data, cb);
    };
    pad.sendPadMsg = function (data, cb) {
        postMessage("SEND_PAD_MSG", data, cb);
    };
    pad.onReadyEvent = Util.mkEvent();
    pad.onMessageEvent = Util.mkEvent();
    pad.onJoinEvent = Util.mkEvent();
    pad.onLeaveEvent = Util.mkEvent();
    pad.onDisconnectEvent = Util.mkEvent();
    pad.onConnectEvent = Util.mkEvent();
    pad.onErrorEvent = Util.mkEvent();

    common.changePadPassword = function (Crypt, href, newPassword, edPublic, cb) {
        if (!href) { return void cb({ error: 'EINVAL_HREF' }); }
        var parsed = Hash.parsePadUrl(href);
        if (!parsed.hash) { return void cb({ error: 'EINVAL_HREF' }); }

        var warning = false;
        var newHash;
        var oldChannel;
        if (parsed.hashData.password) {
            newHash = parsed.hash;
        } else {
            newHash = Hash.createRandomHash(parsed.type, newPassword);
        }
        var newHref = '/' + parsed.type + '/#' + newHash;

        var optsGet = {};
        var optsPut = {
            password: newPassword
        };
        Nthen(function (waitFor) {
            if (parsed.hashData && parsed.hashData.password) {
                common.getPadAttribute('password', waitFor(function (err, password) {
                    optsGet.password = password;
                }), href);
            }
            common.getPadAttribute('owners', waitFor(function (err, owners) {
                if (!Array.isArray(owners) || owners.indexOf(edPublic) === -1) {
                    // We're not an owner, we shouldn't be able to change the password!
                    waitFor.abort();
                    return void cb({ error: 'EPERM' });
                }
                optsPut.owners = owners;
            }), href);
            common.getPadAttribute('expire', waitFor(function (err, expire) {
                optsPut.expire = (expire - (+new Date())) / 1000; // Lifetime in seconds
            }), href);
        }).nThen(function (waitFor) {
            Crypt.get(parsed.hash, waitFor(function (err, val) {
                if (err) {
                    waitFor.abort();
                    return void cb({ error: err });
                }
                Crypt.put(newHash, val, waitFor(function (err) {
                    if (err) {
                        waitFor.abort();
                        return void cb({ error: err });
                    }
                }), optsPut);
            }), optsGet);
        }).nThen(function (waitFor) {
            var secret = Hash.getSecrets(parsed.type, parsed.hash, optsGet.password);
            oldChannel = secret.channel;
            pad.leavePad({
                channel: oldChannel
            }, waitFor());
            pad.onDisconnectEvent.fire(true);
        }).nThen(function (waitFor) {
            common.removeOwnedChannel(oldChannel, waitFor(function (obj) {
                if (obj && obj.error) {
                    waitFor.abort();
                    return void cb(obj);
                }
            }));
        }).nThen(function (waitFor) {
            common.setPadAttribute('password', newPassword, waitFor(function (err) {
                if (err) { warning = true; }
            }), href);
            var secret = Hash.getSecrets(parsed.type, newHash, newPassword);
            common.setPadAttribute('channel', secret.channel, waitFor(function (err) {
                if (err) { warning = true; }
            }), href);

            if (parsed.hashData.password) { return; } // same hash
            common.setPadAttribute('href', newHref, waitFor(function (err) {
                if (err) { warning = true; }
            }), href);
        }).nThen(function () {
            cb({
                warning: warning,
                hash: newHash,
                href: newHref
            });
        });
    };

    // Loading events
    common.loading = {};
    common.loading.onDriveEvent = Util.mkEvent();

    common.getFullHistory = function (data, cb) {
        postMessage("GET_FULL_HISTORY", data, cb);
    };
    common.getHistoryRange = function (data, cb) {
        postMessage("GET_HISTORY_RANGE", data, cb);
    };

    common.getShareHashes = function (secret, cb) {
        var hashes;
        if (!window.location.hash) {
            hashes = Hash.getHashes(secret);
            return void cb(null, hashes);
        }
        var parsed = Hash.parsePadUrl(window.location.href);
        if (!parsed.type || !parsed.hashData) { return void cb('E_INVALID_HREF'); }
        hashes = Hash.getHashes(secret);

        if (secret.version === 0) {
            // It means we're using an old hash
            hashes.editHash = window.location.hash.slice(1);
            return void cb(null, hashes);
        }

        if (hashes.editHash) {
            // no need to find stronger if we already have edit hash
            return void cb(null, hashes);
        }

        postMessage("GET_STRONGER_HASH", {
            href: window.location.href,
            channel: secret.channel,
            password: secret.password
        }, function (hash) {
            if (hash) { hashes.editHash = hash; }
            cb(null, hashes);
        });
    };

    var CRYPTPAD_VERSION = 'cryptpad-version';
    var currentVersion = localStorage[CRYPTPAD_VERSION];
    var updateLocalVersion = function (newUrlArgs) {
        // Check for CryptPad updates
        var urlArgs = newUrlArgs || (Config.requireConf ? Config.requireConf.urlArgs : null);
        if (!urlArgs) { return; }
        var arr = /ver=([0-9.]+)(-[0-9]*)?/.exec(urlArgs);
        var ver = arr[1];
        if (!ver) { return; }
        var verArr = ver.split('.');
        verArr[2] = 0;
        if (verArr.length !== 3) { return; }
        var stored = currentVersion || '0.0.0';
        var storedArr = stored.split('.');
        storedArr[2] = 0;
        var shouldUpdate = parseInt(verArr[0]) > parseInt(storedArr[0]) ||
                           (parseInt(verArr[0]) === parseInt(storedArr[0]) &&
                            parseInt(verArr[1]) > parseInt(storedArr[1]));
        if (!shouldUpdate) { return; }
        currentVersion = ver;
        localStorage[CRYPTPAD_VERSION] = ver;
        if (newUrlArgs) {
            // It's a reconnect
            common.onNewVersionReconnect.fire();
        }
        return true;
    };

    var _onMetadataChanged = [];
    common.onMetadataChanged = function (h) {
        if (typeof(h) !== "function") { return; }
        if (_onMetadataChanged.indexOf(h) !== -1) { return; }
        _onMetadataChanged.push(h);
    };
    common.changeMetadata = function () {
        _onMetadataChanged.forEach(function (h) { h(); });
    };

    var requestLogin = function () {
        // log out so that you don't go into an endless loop...
        LocalStore.logout();

        // redirect them to log in, and come back when they're done.
        sessionStorage.redirectTo = window.location.href;
        window.location.href = '/login/';
    };

    common.startAccountDeletion = function (data, cb) {
        // Logout other tabs
        LocalStore.logout(null, true);
        cb();
    };

    var queries = {
        REQUEST_LOGIN: requestLogin,
        UPDATE_METADATA: common.changeMetadata,
        UPDATE_TOKEN: function (data) {
            var localToken = tryParsing(localStorage.getItem(Constants.tokenKey));
            if (localToken !== data.token) { requestLogin(); }
        },
        // Messaging
        Q_FRIEND_REQUEST: common.messaging.onFriendRequest.fire,
        EV_FIREND_COMPLETE: common.messaging.onFriendComplete.fire,
        // Network
        NETWORK_DISCONNECT: common.onNetworkDisconnect.fire,
        NETWORK_RECONNECT: function (data) {
            require(['/api/config?' + (+new Date())], function (NewConfig) {
                var update = updateLocalVersion(NewConfig.requireConf && NewConfig.requireConf.urlArgs);
                if (update) {
                    postMessage('DISCONNECT');
                    return;
                }
                common.onNetworkReconnect.fire(data);
            });
        },
        // Messenger
        CONTACTS_MESSAGE: common.messenger.onMessageEvent.fire,
        CONTACTS_JOIN: common.messenger.onJoinEvent.fire,
        CONTACTS_LEAVE: common.messenger.onLeaveEvent.fire,
        CONTACTS_UPDATE: common.messenger.onUpdateEvent.fire,
        CONTACTS_FRIEND: common.messenger.onFriendEvent.fire,
        CONTACTS_UNFRIEND: common.messenger.onUnfriendEvent.fire,
        // Pad
        PAD_READY: common.padRpc.onReadyEvent.fire,
        PAD_MESSAGE: common.padRpc.onMessageEvent.fire,
        PAD_JOIN: common.padRpc.onJoinEvent.fire,
        PAD_LEAVE: common.padRpc.onLeaveEvent.fire,
        PAD_DISCONNECT: common.padRpc.onDisconnectEvent.fire,
        PAD_CONNECT: common.padRpc.onConnectEvent.fire,
        PAD_ERROR: common.padRpc.onErrorEvent.fire,
        // Drive
        DRIVE_LOG: common.drive.onLog.fire,
        DRIVE_CHANGE: common.drive.onChange.fire,
        DRIVE_REMOVE: common.drive.onRemove.fire,
        // Account deletion
        DELETE_ACCOUNT: common.startAccountDeletion,
        // Loading
        LOADING_DRIVE: common.loading.onDriveEvent.fire
    };

    common.ready = (function () {
        var env = {};
        var initialized = false;

    return function (f, rdyCfg) {
        rdyCfg = rdyCfg || {};
        if (initialized) {
            return void setTimeout(function () { f(void 0, env); });
        }

        var provideFeedback = function () {
            if (typeof(window.Proxy) === 'undefined') {
                Feedback.send("NO_PROXIES");
            }

            var shimPattern = /CRYPTPAD_SHIM/;
            if (shimPattern.test(Array.isArray.toString())) {
                Feedback.send("NO_ISARRAY");
            }

            if (shimPattern.test(Array.prototype.fill.toString())) {
                Feedback.send("NO_ARRAYFILL");
            }

            if (typeof(Symbol) === 'undefined') {
                Feedback.send('NO_SYMBOL');
            }

            if (typeof(SharedWorker) === "undefined") {
                Feedback.send('NO_SHAREDWORKER');
            } else {
                Feedback.send('SHAREDWORKER');
            }
            if (typeof(Worker) === "undefined") {
                Feedback.send('NO_WEBWORKER');
            }
            if (typeof(ServiceWorker) === "undefined") {
                Feedback.send('NO_SERVICEWORKER');
            }

            Feedback.reportScreenDimensions();
            Feedback.reportLanguage();
        };
        var initFeedback = function (feedback) {
            // Initialize feedback
            Feedback.init(feedback);
            provideFeedback();
        };

        Nthen(function (waitFor) {
            if (AppConfig.beforeLogin) {
                AppConfig.beforeLogin(LocalStore.isLoggedIn(), waitFor());
            }

        }).nThen(function (waitFor) {
            var blockHash = LocalStore.getBlockHash();
            if (blockHash) {
                console.log(blockHash);
                var parsed = Hash.parseBlockHash(blockHash);

                if (typeof(parsed) !== 'object') {
                    console.error("Failed to parse blockHash");
                    console.log(parsed);
                    return;
                } else {
                    console.log(parsed);
                }
                Util.fetch(parsed.href, waitFor(function (err, arraybuffer) {
                    if (err) { return void console.log(err); }

                    // use the results to load your user hash and
                    // put your userhash into localStorage
                    try {
                        var block_info = Block.decrypt(arraybuffer, parsed.keys);
                        if (block_info[Constants.userHashKey]) { LocalStore.setUserHash(block_info[Constants.userHashKey]); }
                    } catch (e) {
                        console.error(e);
                        return void console.error("failed to decrypt or decode block content");
                    }
                }));
            }
        }).nThen(function (waitFor) {
            // XXX debugging
            if (LocalStore.getUserHash()) {
                console.log('User_hash detected');
            } else {
                console.log("User_hash not detected");
            }

            var cfg = {
                init: true,
                //query: onMessage, // TODO temporary, will be replaced by a webworker channel
                userHash: LocalStore.getUserHash(),
                anonHash: LocalStore.getFSHash(),
                localToken: tryParsing(localStorage.getItem(Constants.tokenKey)),
                language: common.getLanguage(),
                messenger: rdyCfg.messenger, // Boolean
                driveEvents: rdyCfg.driveEvents // Boolean
            };
            if (sessionStorage[Constants.newPadPathKey]) {
                common.initialPath = sessionStorage[Constants.newPadPathKey];
                delete sessionStorage[Constants.newPadPathKey];
            }

            var channelIsReady = waitFor();

            var msgEv = Util.mkEvent();
            var postMsg, worker;
            Nthen(function (waitFor2) {
                if (typeof(SharedWorker) !== "undefined") {
                    worker = new SharedWorker('/common/outer/sharedworker.js?' + urlArgs);
                    worker.onerror = function (e) {
                        console.error(e);
                    };
                    worker.port.onmessage = function (ev) {
                        if (ev.data === "SW_READY") {
                            return;
                        }
                        msgEv.fire(ev);
                    };
                    postMsg = function (data) {
                        worker.port.postMessage(data);
                    };
                    postMsg('INIT');

                    window.addEventListener('beforeunload', function () {
                        postMsg('CLOSE');
                    });
                } else if (false && 'serviceWorker' in navigator) {
                    var initializing = true;
                    var stopWaiting = waitFor2(); // Call this function when we're ready

                    postMsg = function (data) {
                        if (worker) { return void worker.postMessage(data); }
                    };

                    navigator.serviceWorker.register('/common/outer/serviceworker.js?' + urlArgs, {scope: '/'})
                        .then(function(reg) {
                            // Add handler for receiving messages from the service worker
                            navigator.serviceWorker.addEventListener('message', function (ev) {
                                if (initializing && ev.data === "SW_READY") {
                                    initializing = false;
                                } else {
                                    msgEv.fire(ev);
                                }
                            });

                            // Initialize the worker
                            // If it is active (probably running in another tab), just post INIT
                            if (reg.active) {
                                worker = reg.active;
                                postMsg("INIT");
                            }
                            // If it was not active, wait for the "activated" state and post INIT
                            reg.onupdatefound = function () {
                                if (initializing) {
                                    var w = reg.installing;
                                    var onStateChange = function () {
                                        if (w.state === "activated") {
                                            worker = w;
                                            postMsg("INIT");
                                            w.removeEventListener("statechange", onStateChange);
                                        }
                                    };
                                    w.addEventListener('statechange', onStateChange);
                                    return;
                                }
                                // New version detected (from another tab): kill?
                                console.error('New version detected: ABORT?');
                            };
                            return void stopWaiting();
                        }).catch(function(error) {
                            /**/console.log('Registration failed with ' + error);
                        });

                    window.addEventListener('beforeunload', function () {
                        postMsg('CLOSE');
                    });
                } else if (Worker) {
                    worker = new Worker('/common/outer/webworker.js?' + urlArgs);
                    worker.onmessage = function (ev) {
                        msgEv.fire(ev);
                    };
                    postMsg = function (data) {
                        worker.postMessage(data);
                    };
                } else {
                    require(['/common/outer/noworker.js'], waitFor2(function (NoWorker) {
                        NoWorker.onMessage(function (data) {
                            msgEv.fire({data: data});
                        });
                        postMsg = function (d) { setTimeout(function () { NoWorker.query(d); }); };
                        NoWorker.create();
                    }));
                }
            }).nThen(function () {
                Channel.create(msgEv, postMsg, function (chan) {
                    console.log('Outer ready');
                    Object.keys(queries).forEach(function (q) {
                        chan.on(q, function (data, cb) {
                            try {
                                queries[q](data, cb);
                            } catch (e) {
                                console.error("Error in outer when executing query " + q);
                                console.error(e);
                                console.log(data);
                            }
                        });
                    });

                    postMessage = function (cmd, data, cb) {
                        cb = cb || function () {};
                        chan.query(cmd, data, function (err, data) {
                            if (err) { return void cb ({error: err}); }
                            cb(data);
                        });
                    };

                    console.log('Posting CONNECT');
                    postMessage('CONNECT', cfg, function (data) {
                        if (data.error) { throw new Error(data.error); }
                        if (data.state === 'ALREADY_INIT') {
                            data = data.returned;
                        }

                        if (data.anonHash && !cfg.userHash) { LocalStore.setFSHash(data.anonHash); }

                        /*if (cfg.userHash && sessionStorage) {
                            // copy User_hash into sessionStorage because cross-domain iframes
                            // on safari replaces localStorage with sessionStorage or something
                            sessionStorage.setItem(Constants.userHashKey, cfg.userHash);
                        }*/

                        if (cfg.userHash) {
                            var localToken = tryParsing(localStorage.getItem(Constants.tokenKey));
                            if (localToken === null) {
                                // if that number hasn't been set to localStorage, do so.
                                localStorage.setItem(Constants.tokenKey, data[Constants.tokenKey]);
                            }
                        }

                        initFeedback(data.feedback);
                        initialized = true;
                        channelIsReady();
                    });

                }, false);
            });

        }).nThen(function (waitFor) {
            // Load the new pad when the hash has changed
            var oldHref  = document.location.href;
            window.onhashchange = function (ev) {
                if (ev && ev.reset) { oldHref = document.location.href; return; }
                var newHref = document.location.href;

                // Compare the URLs without /embed and /present
                var parsedOld = Hash.parsePadUrl(oldHref);
                var parsedNew = Hash.parsePadUrl(newHref);
                if (parsedOld.hashData && parsedNew.hashData &&
                    parsedOld.getUrl() !== parsedNew.getUrl()) {
                    if (!parsedOld.hashData.key) { oldHref = newHref; return; }
                    // If different, reload
                    document.location.reload();
                    return;
                }
                if (parsedNew.hashData) { oldHref = newHref; }
            };
            // Listen for login/logout in other tabs
            window.addEventListener('storage', function (e) {
                if (e.key !== Constants.userHashKey) { return; }
                var o = e.oldValue;
                var n = e.newValue;
                if (!o && n) {
                    document.location.reload();
                } else if (o && !n) {
                    LocalStore.logout();
                }
            });
            LocalStore.onLogout(function () {
                console.log('onLogout: disconnect');
                postMessage("DISCONNECT");
            });

            if (PINNING_ENABLED && LocalStore.isLoggedIn()) {
                console.log("logged in. pads will be pinned");
                postMessage("INIT_RPC", null, waitFor(function (obj) {
                    console.log('RPC handshake complete');
                    if (obj.error) { return; }
                    localStorage.plan = obj.plan;
                }));
            } else if (PINNING_ENABLED) {
                console.log('not logged in. pads will not be pinned');
            } else {
                console.log('pinning disabled');
            }

            postMessage("INIT_ANON_RPC", null, waitFor(function () {
                console.log('Anonymous RPC ready');
            }));
        }).nThen(function (waitFor) {
            if (sessionStorage.createReadme) {
                var data = {
                    driveReadme: Messages.driveReadme,
                    driveReadmeTitle: Messages.driveReadmeTitle,
                };
                postMessage("CREATE_README", data, waitFor(function (e) {
                    if (e && e.error) { return void console.error(e.error); }
                    delete sessionStorage.createReadme;
                }));
            }
        }).nThen(function (waitFor) {
            if (sessionStorage.migrateAnonDrive) {
                common.mergeAnonDrive(waitFor(function() {
                    delete sessionStorage.migrateAnonDrive;
                }));
            }
        }).nThen(function (waitFor) {
            if (AppConfig.afterLogin) {
                AppConfig.afterLogin(common, waitFor());
            }
        }).nThen(function () {
            updateLocalVersion();
            f(void 0, env);
            if (typeof(window.onhashchange) === 'function') { window.onhashchange(); }
        });
    };

    }());

    return common;
});

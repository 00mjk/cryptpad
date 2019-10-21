define([
    '/common/common-hash.js',
    '/common/common-util.js',
    '/common/userObject.js',

    '/bower_components/nthen/index.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/bower_components/chainpad-listmap/chainpad-listmap.js',
    '/bower_components/chainpad/chainpad.dist.js',
], function (Hash, Util, UserObject,
             nThen, Crypto, Listmap, ChainPad) {
    var SF = {};

    /* load
        create and load a proxy using listmap for a given shared folder
        - config: network and "manager" (either the user one or a team manager)
        - id: shared folder id
    */

    var allSharedFolders = {};

    SF.load = function (config, id, data, cb) {
        var network = config.network;
        var store = config.store;
        var isNew = config.isNew;
        var isNewChannel = config.isNewChannel;
        var teamId = store.id;
        var handler = store.handleSharedFolder;

        var parsed = Hash.parsePadUrl(data.href);
        var secret = Hash.getSecrets('drive', parsed.hash, data.password);

        // If we try to load en existing shared folder (isNew === false) but this folder
        // doesn't exist in the database, abort and cb
        nThen(function (waitFor) {
            isNewChannel(null, { channel: secret.channel }, waitFor(function (obj) {
                if (obj.isNew && !isNew) {
                    store.manager.deprecateProxy(id, secret.channel);
                    waitFor.abort();
                    return void cb(null);
                }
            }));
        }).nThen(function () {
            var sf = allSharedFolders[secret.channel];
            if (sf && sf.ready && sf.rt) {
                // The shared folder is already loaded, return its data
                setTimeout(function () {
                    var leave = function () { SF.leave(secret.channel, teamId); };
                    store.manager.addProxy(id, sf.rt.proxy, leave);
                    cb(sf.rt, sf.metadata);
                });
                sf.teams.push(store);
                if (handler) { handler(id, sf.rt); }
                return sf.rt;
            }
            if (sf && sf.queue && sf.rt) {
                // The shared folder is loading, add our callbacks to the queue
                sf.queue.push({
                    cb: cb,
                    store: store,
                    id: id
                });
                sf.teams.push(store);
                if (handler) { handler(id, sf.rt); }
                return sf.rt;
            }

            sf = allSharedFolders[secret.channel] = {
                queue: [{
                    cb: cb,
                    store: store,
                    id: id
                }],
                teams: [store]
            };

            var owners = data.owners;
            var listmapConfig = {
                data: {},
                channel: secret.channel,
                readOnly: false,
                crypto: Crypto.createEncryptor(secret.keys),
                userName: 'sharedFolder',
                logLevel: 1,
                ChainPad: ChainPad,
                classic: true,
                network: network,
                metadata: {
                    validateKey: secret.keys.validateKey || undefined,
                    owners: owners
                }
            };
            var rt = sf.rt = Listmap.create(listmapConfig);
            rt.proxy.on('ready', function (info) {
                if (!sf.queue) {
                    return;
                }
                sf.queue.forEach(function (obj) {
                    var leave = function () { SF.leave(secret.channel, teamId); };
                    obj.store.manager.addProxy(obj.id, rt.proxy, leave);
                    obj.cb(rt, info.metadata);
                });
                sf.metadata = info.metadata;
                sf.ready = true;
                delete sf.queue;
            });
            rt.proxy.on('error', function (info) {
                if (info && info.error) {
                    if (info.error === "EDELETED" ) {
                        try {
                            // Deprecate the shared folder from each team
                            sf.teams.forEach(function (store) {
                                store.manager.deprecateProxy(id, secret.channel);
                            });
                        } catch (e) {}
                        delete allSharedFolders[secret.channel];
                    }
                }
            });

            if (handler) { handler(id, rt); }
        });
    };

    SF.leave = function (channel, teamId) {
        var sf = allSharedFolders[channel];
        if (!sf) { return; }
        var clients = sf.teams;
        if (!Array.isArray(clients)) { return; }
        var idx;
        clients.some(function (store, i) {
            if (store.id === teamId) {
                idx = i;
                return true;
            }
        });
        if (typeof (idx) === "undefined") { return; }
        // Remove the selected team
        clients.splice(idx, 1);

        //If all the teams have closed this shared folder, stop it
        if (clients.length) { return; }
        if (sf.rt && sf.rt.stop) {
            sf.rt.stop();
        }
    };

    SF.updatePassword = function (Store, data, network, cb) {
        var oldChannel = data.oldChannel;
        var href = data.href;
        var password = data.password;
        var parsed = Hash.parsePadUrl(href);
        var secret = Hash.getSecrets(parsed.type, parsed.hash, password);
        var sf = allSharedFolders[oldChannel];
        if (!sf) { return void cb({ error: 'ENOTFOUND' }); }
        if (sf.rt && sf.rt.stop) {
            sf.rt.stop();
        }
        var nt = nThen;
        sf.teams.forEach(function (s) {
            nt = nt(function (waitFor) {
                var sfId = s.manager.user.userObject.getSFIdFromHref(href);
                var shared = Util.find(s.proxy, ['drive', UserObject.SHARED_FOLDERS]) || {};
                if (!sfId || !shared[sfId]) { return; }
                var sf = JSON.parse(JSON.stringify(shared[sfId]));
                sf.password = password;
                SF.load({
                    network: network,
                    store: s,
                    isNewChannel: Store.isNewChannel
                }, sfId, sf, waitFor());
                if (!s.rpc) { return; }
                s.rpc.unpin([oldChannel], waitFor());
                s.rpc.pin([secret.channel], waitFor());
            }).nThen;
        });
        nt(cb);
    };

    /* loadSharedFolders
        load all shared folder stored in a given drive
        - store: user or team main store
        - userObject: userObject associated to the main drive
        - handler: a function (sfid, rt) called for each shared folder loaded
    */
    SF.loadSharedFolders = function (Store, network, store, userObject, waitFor) {
        var shared = Util.find(store.proxy, ['drive', UserObject.SHARED_FOLDERS]) || {};
        nThen(function (waitFor) {
            Object.keys(shared).forEach(function (id) {
                var sf = shared[id];
                SF.load({
                    network: network,
                    store: store,
                    isNewChannel: Store.isNewChannel
                }, id, sf, waitFor());
            });
        }).nThen(waitFor());
    };

    return SF;
});

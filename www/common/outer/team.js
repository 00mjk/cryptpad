define([
    '/common/common-util.js',
    '/common/common-hash.js',
    '/common/common-constants.js',
    '/common/common-realtime.js',

    '/common/outer/sharedfolder.js',

    '/bower_components/chainpad-listmap/chainpad-listmap.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/bower_components/chainpad/chainpad.dist.js',
], function (Util, Hash, Constants, Realtime,
             SF,
             Listmap, Crypto, ChainPad) {
    var Team = {};

    var initializeTeams = function (ctx, cb) {
        // XXX ?
        cb();
    };

    var handleSharedFolder = function (ctx, id, sfId, rt) {
        var t = ctx.teams[id];
        if (!t) { return; }
        t.sharedFolders[sfId] = rt;
        // XXX register events
        // rt.proxy.on('change',...  emit change event
        // TODO: pin or unpin document added to a shared folder from someone who is not a member of the team
    };

    var onReady = function (ctx, team, id, cb) {
        // XXX
        // sanity check: do we have all the required keys?
        // initialize team rpc with pin, unpin, ...
        // team.rpc = rpc
        // load manager with userObject
        //   team.manager =... team.userObject = ....
        // load shared folders
        //   register event for these folders
        // ~resetPins for the team?
        // getPinLimit
        ctx.teams[id] = team;
        cb();
    };

    var openChannel = function (ctx, teamData, id, cb) {
        // XXX team password?
        var secret = Hash.getSecrets('team', teamData.href);
        var crypto = Crypto.createEncryptor(secret.keys);

        var cfg = {
            data: {},
            network: ctx.store.network,
            channel: secret.channel,
            crypto: crypto,
            ChainPad: ChainPad,
            metadata: {
                validateKey: secret.keys.validateKey || undefined,
            },
            userName: 'team',
            classic: true
        };
        var lm = Listmap.create(cfg);
        lm.proxy.on('create', function () {
        }).on('ready', function () {
            var sendEvent = function (type, data, sender) {
                type = type;
                data = data;
                sender = sender;
                // XXX emit UPDATE event to the inner iframe
                // don't send the event back to the sender
                // types are DRIVE_CHANGE, DRIVE_REMOVE and DRIVE_LOG
            };

            var team = {
                id: id,
                proxy: lm.proxy,
                listmap: lm,
                clients: [],
                manager: undefined, // XXX
                userObject: undefined, // XXX
                realtime: lm.realtime,
                handleSharedFolder: function (sfId, rt) { handleSharedFolder(ctx, id, sfId, rt); },
                sharedFolders: {}, // equivalent of store.sharedFolders in async-store
                sendEvent: sendEvent
            };

            onReady(ctx, team, id, function () {
                // TODO
                cb();
            });
            if (ctx.onReadyHandlers.length) {
                ctx.onReadyHandlers.forEach(function (f) {
                    try {
                        f(lm.proxy);
                    } catch (e) { console.error(e); }
                });
                ctx.onReadyHandlers = [];
            }
        }).on('change', [], function () {
            // XXX team app event
            //ctx.emit('UPDATE', lm.proxy, ctx.clients);
        });
    };

    var subscribe = function (ctx, id, cId, cb) {
        // Subscribe to new notifications
        if (!id || !ctx.teams[id]) {
            return void cb({error: 'EINVAL'});
        }
        var clients = ctx.teams[id].clients;
        var idx = clients.indexOf(cId);
        if (idx === -1) {
            clients.push(cId);
        }
        cb();
    };

    // Remove a client from all the team they're subscribed to
    var removeClient = function (ctx, cId) {
        Object.keys(ctx.teams).forEach(function (id) {
            var clients = ctx.teams[id].clients;
            var idx = clients.indexOf(cId);
            clients.splice(idx, 1);
        });
    };

    Team.init = function (cfg, waitFor, emit) {
        var team = {};
        var store = cfg.store;
        if (!store.loggedIn || !store.proxy.edPublic) { return; }
        var ctx = {
            store: store,
            pinPads: cfg.pinPads,
            updateMetadata: cfg.updateMetadata,
            emit: emit,
            onReadyHandlers: [],
            teams: {}
        };

        var teams = store.proxy.teams = store.proxy.teams || {};

        initializeTeams(ctx, waitFor(function (err) {
            if (err) { return; }
        }));

        Object.keys(teams).forEach(function (id) {
            // XXX waitFor?
            // only if we want to make sure teams are loaded before remore the loading screen
            openChannel(ctx, teams[id], id, function () {
                console.error('team '+id+' ready');
            });
        });

        team.getTeam = function (id) {
            return ctx.teams[id];
        };
        team.getTeams = function () {
            return Object.keys(ctx.teams);
        };
        team.removeClient = function (clientId) {
            removeClient(ctx, clientId);
        };
        team.execCommand = function (clientId, obj, cb) {
            console.log(obj);
            var cmd = obj.cmd;
            var data = obj.data;
            if (cmd === 'SUBSCRIBE') {
                // Only the team app will subscribe to events?
                return void subscribe(ctx, data, clientId, cb);
            }
        };

        return team;
    };

    return Team;
});




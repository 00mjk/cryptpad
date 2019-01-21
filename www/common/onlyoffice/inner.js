define([
    'jquery',
    '/common/toolbar3.js',
    'json.sortify',
    '/bower_components/nthen/index.js',
    '/common/sframe-common.js',
    '/common/common-interface.js',
    '/common/common-hash.js',
    '/common/common-util.js',
    '/api/config',
    '/customize/messages.js',
    '/customize/application_config.js',
    '/bower_components/chainpad/chainpad.dist.js',
    '/file/file-crypto.js',
    '/common/onlyoffice/oocell_base.js',
    '/common/onlyoffice/oodoc_base.js',
    '/common/onlyoffice/ooslide_base.js',
    '/common/outer/worker-channel.js',

    '/bower_components/tweetnacl/nacl-fast.min.js',
    '/bower_components/file-saver/FileSaver.min.js',

    'css!/bower_components/bootstrap/dist/css/bootstrap.min.css',
    'less!/bower_components/components-font-awesome/css/font-awesome.min.css',
    'less!/common/onlyoffice/app-oo.less',
], function (
    $,
    Toolbar,
    JSONSortify,
    nThen,
    SFCommon,
    UI,
    Hash,
    Util,
    ApiConfig,
    Messages,
    AppConfig,
    ChainPad,
    FileCrypto,
    EmptyCell,
    EmptyDoc,
    EmptySlide,
    Channel)
{
    var saveAs = window.saveAs;
    var Nacl = window.nacl;

    var APP = window.APP = {
        $: $
    };

    var CHECKPOINT_INTERVAL = 50;

    var stringify = function (obj) {
        return JSONSortify(obj);
    };

    var toolbar;

    var andThen = function (common) {
        var sframeChan = common.getSframeChannel();
        var metadataMgr = common.getMetadataMgr();
        var privateData = metadataMgr.getPrivateData();
        var readOnly = false;
        //var locked = false;
        var config = {};
        var content = {
            hashes: {},
            ids: {}
        };
        var myOOId;

        var deleteOffline = function () {
            var ids = content.ids;
            var users = Object.keys(metadataMgr.getMetadata().users);
            Object.keys(ids).forEach(function (id) {
                var nId = id.slice(0,32);
                if (users.indexOf(nId) === -1) {
                    delete ids[id];
                }
            });
            APP.onLocal();
        };

        var isUserOnline = function (ooid) {
            // Remove ids for users that have left the channel
            deleteOffline();
            var ids = content.ids;
            // Check if the provided id is in the ID list
            return Object.keys(ids).some(function (id) {
                return ooid === ids[id];
            });
        };

        var setMyId = function (netfluxId) {
            // Remove ids for users that have left the channel
            deleteOffline();
            var ids = content.ids;
            if (!myOOId) {
                myOOId = Util.createRandomInteger();
                while (Object.keys(ids).some(function (id) {
                    return ids[id] === myOOId;
                })) {
                    myOOId = Util.createRandomInteger();
                }
            }
            var myId = (netfluxId || metadataMgr.getNetfluxId()) + '-' + privateData.clientId;
            ids[myId] = myOOId;
            APP.onLocal();
        };

        // Another tab from our worker has left: remove its id from the list
        var removeClient = function (obj) {
            var tabId = metadataMgr.getNetfluxId() + '-' + obj.id;
            console.log(tabId);
            if (content.ids[tabId]) {
                console.log('delete');
                delete content.ids[tabId];
                APP.onLocal();
                console.log(content.ids);
            }
        };

        var getFileType = function () {
            var type = common.getMetadataMgr().getPrivateData().ooType;
            var title = common.getMetadataMgr().getMetadataLazy().title;
            var file = {};
            switch(type) {
                case 'oodoc':
                    file.type = 'docx';
                    file.title = title + '.docx' || 'document.docx';
                    file.doc = 'text';
                    break;
                case 'oocell':
                    file.type = 'xlsx';
                    file.title = title + '.xlsx' || 'spreadsheet.xlsx';
                    file.doc = 'spreadsheet';
                    break;
                case 'ooslide':
                    file.type = 'pptx';
                    file.title = title + '.pptx' || 'presentation.pptx';
                    file.doc = 'presentation';
                    break;
            }
            return file;
        };

        var now = function () { return +new Date(); };

        var getLastCp = function () {
            var hashes = content.hashes;
            if (!hashes || !Object.keys(hashes).length) { return {}; }
            var lastIndex = Math.max.apply(null, Object.keys(hashes).map(Number));
            // TODO check if hashes[lastIndex] is undefined?
            var last = JSON.parse(JSON.stringify(hashes[lastIndex]));
            return last;
        };

        var rtChannel = {
            ready: false,
            readyCb: undefined,
            sendCmd: function (data, cb) {
                sframeChan.query('Q_OO_COMMAND', data, cb);
            },
            sendMsg: function (msg, cp, cb) {
                rtChannel.sendCmd({
                    cmd: 'SEND_MESSAGE',
                    data: {
                        msg: msg,
                        isCp: cp
                    }
                }, cb);
            },
        };

        var ooChannel = {
            ready: false,
            queue: [],
            send: function () {},
            cpIndex: 0
        };

        var getContent = APP.getContent = function () {
            try {
                return window.frames[0].editor.asc_nativeGetFile();
            } catch (e) {
                console.error(e);
                return;
            }
        };

        var fmConfig = {
            noHandlers: true,
            noStore: true,
            body: $('body'),
            onUploaded: function (ev, data) {
                if (!data || !data.url) { return; }
                sframeChan.query('Q_OO_SAVE', data, function (err) {
                    if (err) {
                        console.error(err);
                        return void UI.alert(Messages.oo_saveError);
                    }
                    var i = Math.floor(ev.index / CHECKPOINT_INTERVAL);
                    // XXX check if content.hashes[i] already exists?
                    content.hashes[i] = {
                        file: data.url,
                        hash: ev.hash,
                        index: ev.index
                    };
                    content.saveLock = undefined;
                    APP.onLocal();
                    sframeChan.query('Q_OO_COMMAND', {
                        cmd: 'UPDATE_HASH',
                        data: ev.hash
                    }, function (err, obj) {
                        if (err || (obj && obj.error)) { console.error(err || obj.error); }
                    });
                    UI.log(Messages.saved);
                });
            }
        };
        APP.FM = common.createFileManager(fmConfig);

        var saveToServer = function () {
            var text = getContent();
            var blob = new Blob([text], {type: 'plain/text'});
            var file = getFileType();
            blob.name = (metadataMgr.getMetadataLazy().title || file.doc) + '.' + file.type;
            var data = {
                hash: ooChannel.lastHash,
                index: ooChannel.cpIndex
            };
            APP.FM.handleFile(blob, data);
        };
        var makeCheckpoint = function (force) {
            var locked = content.saveLock;
            if (!locked || !isUserOnline(locked) || force) {
                content.saveLock = myOOId;
                APP.onLocal();
                APP.realtime.onSettle(function () {
                    saveToServer();
                });
                return;
            }
            // The save is locked by someone else. If no new checkpoint is created
            // in the next 20 to 40 secondes and the lock is kept by the same user,
            // force the lock and make a checkpoint.
            var saved = stringify(content.hashes);
            var to = 20000 + (Math.random() * 20000)
            setTimeout(function () {
                if (stringify(content.hashes) === saved && locked === content.saveLock) {
                    makeCheckpoint(force);
                }
            }, to);
        };

        var openRtChannel = function (cb) {
            if (rtChannel.ready) { return void cb(); }
            var chan = content.channel || Hash.createChannelId();
            if (!content.channel) {
                content.channel = chan;
                APP.onLocal();
            }
            sframeChan.query('Q_OO_OPENCHANNEL', {
                channel: content.channel,
                lastCpHash: getLastCp().hash
            }, function (err, obj) {
                if (err || (obj && obj.error)) { console.error(err || (obj && obj.error)); }
            });
            sframeChan.on('EV_OO_EVENT', function (obj) {
                switch (obj.ev) {
                    case 'READY':
                        rtChannel.ready = true;
                        break;
                    case 'LEAVE':
                        removeClient(obj.data);
                        break;
                    case 'MESSAGE':
                        if (ooChannel.ready) {
                            ooChannel.send(obj.data.msg);
                            ooChannel.lastHash = obj.data.hash;
                            ooChannel.cpIndex++;
                        } else {
                            ooChannel.queue.push(obj.data);
                        }
                        break;
                }
            });
            cb();
        };

        var parseChanges = function (changes) {
            try {
                changes = JSON.parse(changes);
            } catch (e) {
                return [];
            }
            return changes.map(function (change) {
                return {
                    docid: "fresh",
                    change: '"' + change + '"',
                    time: now(),
                    user: "test", // XXX get username
                    useridoriginal: "test" // get user id from worker?
                };
            });
        };
        var makeChannel = function () {
            var msgEv = Util.mkEvent();
            var iframe = $('#cp-app-oo-container > iframe')[0].contentWindow;
            window.addEventListener('message', function (msg) {
                if (msg.source !== iframe) { return; }
                msgEv.fire(msg);
            });
            var postMsg = function (data) {
                iframe.postMessage(data, '*');
            };
            Channel.create(msgEv, postMsg, function (chan) {
                APP.chan = chan;

                var send = ooChannel.send = function (obj) {
                    chan.event('CMD', obj);
                };

                chan.on('CMD', function (obj) {
                    var msg, msg2;
                    switch (obj.type) {
                        case "auth":
                            ooChannel.ready = true;
                            send({
                                type: "auth",
                                result: 1,
                                sessionId: "08e77705-dc5c-477d-b73a-b1a7cbca1e9b",
                                participants: [{
                                    id: "myid1",
                                    idOriginal: "myid",
                                    username: "User",
                                    indexUser: 1,
                                    view: false
                                }],
                                locks: [],
                                changes: [],
                                changesIndex: 0,
                                indexUser: 1,
                                "g_cAscSpellCheckUrl": "/spellchecker"
                            });
                            send({
                                type: "documentOpen",
                                data: {"type":"open","status":"ok","data":{"Editor.bin":obj.openCmd.url}}
                            });
                            setTimeout(function () {
                                if (ooChannel.queue) {
                                    ooChannel.queue.forEach(function (data) {
                                        send(data.msg);
                                        ooChannel.lastHash = data.hash;
                                        ooChannel.cpIndex++;
                                    });
                                }
                            }, 2000);
                            break;
                        case "isSaveLock":
                            msg = {
                                type: "saveLock",
                                saveLock: false
                            }
                            send(msg);
                            break;
                        case "getLock":
                            msg = {
                                type: "getLock",
                                locks: [{
                                    time: now(),
                                    user: "myid1",
                                    block: obj.block && obj.block[0],
                                    sessionId: "08e77705-dc5c-477d-b73a-b1a7cbca1e9b"
                                }]
                            }
                            send(msg);
                            break;
                        case "getMessages":
                            send({ type: "message" });
                            break;
                        case "saveChanges":
                            // XXX lock
                            send({
                                type: "unSaveLock",
                                index: ooChannel.cpIndex,
                            });
                            rtChannel.sendMsg({
                                type: "saveChanges",
                                changes: parseChanges(obj.changes),
                                changesIndex: ooChannel.cpIndex || 0,
                                locks: [], // XXX take from userdoc?
                                excelAdditionalInfo: null
                            }, null, function (err, hash) {
                                ooChannel.cpIndex++;
                                ooChannel.lastHash = hash;
                                if (ooChannel.cpIndex % CHECKPOINT_INTERVAL === 0) {
                                    makeCheckpoint();
                                }
                            });
                            break;
                    }
                });
            });
        };

        var ooLoaded = false;
        var startOO = function (blob, file) {
            if (APP.ooconfig) { return void console.error('already started'); }
            var url = URL.createObjectURL(blob);
            var lock = readOnly || !common.isLoggedIn();

            // Config
            APP.ooconfig = {
                "document": {
                    "fileType": file.type,
                    "key": "fresh",
                    "title": file.title,
                    "url": url,
                    "permissions": {
                        "download": false, // FIXME: download/export is not working, so we use false
                                           // to remove the button
                    }
                },
                "documentType": file.doc,
                "editorConfig": {
                    customization: {
                        chat: false,
                        logo: {
                            url: "/bounce/#" + encodeURIComponent('https://www.onlyoffice.com')
                        }
                    },
                    "user": {
                        "id": "myid", //"c0c3bf82-20d7-4663-bf6d-7fa39c598b1d",
                        "name": "User", //"John Smith"
                    },
                    "mode": readOnly || lock ? "view" : "edit"
                },
                "events": {
                    "onAppReady": function(/*evt*/) {
                        var $tb = $('iframe[name="frameEditor"]').contents().find('head');
                        var css = '#id-toolbar-full .toolbar-group:nth-child(2), #id-toolbar-full .separator:nth-child(3) { display: none; }' +
                                  '#fm-btn-save { display: none !important; }' +
                                  '#header { display: none !important; }';
                        $('<style>').text(css).appendTo($tb);
                        if (UI.findOKButton().length) {
                            UI.findOKButton().on('focusout', function () {
                                window.setTimeout(function () { UI.findOKButton().focus(); });
                            });
                        }
                    },
                }
            };
            window.onbeforeunload = function () {
                var ifr = document.getElementsByTagName('iframe')[0];
                if (ifr) { ifr.remove(); }
            };
            APP.docEditor = new DocsAPI.DocEditor("cp-app-oo-placeholder", APP.ooconfig);
            ooLoaded = true;
            makeChannel();
        };

        var loadLastDocument = function () {
            var lastCp = getLastCp();
            if (!lastCp) { return; }
            ooChannel.cpIndex = lastCp.index || 0;
            var parsed = Hash.parsePadUrl(lastCp.file);
            var secret = Hash.getSecrets('file', parsed.hash);
            if (!secret || !secret.channel) { return; }
            var hexFileName = secret.channel;
            var src = Hash.getBlobPathFromHex(hexFileName);
            var key = secret.keys && secret.keys.cryptKey;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', src, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function () {
                if (/^4/.test('' + this.status)) {
                    return void console.error('XHR error', this.status);
                }
                var arrayBuffer = xhr.response;
                if (arrayBuffer) {
                    var u8 = new Uint8Array(arrayBuffer);
                    FileCrypto.decrypt(u8, key, function (err, decrypted) {
                        if (err) { return void console.error(err); }
                        var blob = new Blob([decrypted.content], {type: 'plain/text'});
                        startOO(blob, getFileType());
                    });
                }
            };
            xhr.send(null);
        };
        var loadDocument = function (newPad) {
            if (ooLoaded) { return; }
            var type = common.getMetadataMgr().getPrivateData().ooType;
            var file = getFileType();
            if (!newPad) {
                return void loadLastDocument();
            }
            var newText;
            switch (type) {
                case 'oocell' :
                    newText = EmptyCell();
                    break;
                case 'oodoc':
                    newText = EmptyDoc();
                    break;
                case 'ooslide':
                    newText = EmptySlide();
                    break;
                default:
                    newText = '';
            }
            var blob = new Blob([newText], {type: 'text/plain'});
            startOO(blob, file);
        };

        var initializing = true;
        var $bar = $('#cp-toolbar');
        var Title;
        var cpNfInner;

        config = {
            patchTransformer: ChainPad.NaiveJSONTransformer,
            // cryptpad debug logging (default is 1)
            // logLevel: 0,
            validateContent: function (content) {
                try {
                    JSON.parse(content);
                    return true;
                } catch (e) {
                    console.log("Failed to parse, rejecting patch");
                    return false;
                }
            }
        };

        var setEditable = function (state) {
            console.log(state);
        };

        var stringifyInner = function () {
            var obj = {
                content: content,
                metadata: metadataMgr.getMetadataLazy()
            };
            // stringify the json and send it into chainpad
            return stringify(obj);
        };

        APP.getContent = function () { return content; };

        APP.onLocal = config.onLocal = function () {
            if (initializing) { return; }
            if (readOnly) { return; }

            console.log('onLocal, data avalable');
            // Update metadata
            var content = stringifyInner();
            APP.realtime.contentUpdate(content);
        };

        config.onInit = function (info) {
            readOnly = metadataMgr.getPrivateData().readOnly;

            Title = common.createTitle({});

            var configTb = {
                displayed: [
                    'userlist',
                    'title',
                    'useradmin',
                    'spinner',
                    'newpad',
                    'share',
                    'limit',
                    'unpinnedWarning'
                ],
                title: Title.getTitleConfig(),
                metadataMgr: metadataMgr,
                readOnly: readOnly,
                realtime: info.realtime,
                sfCommon: common,
                $container: $bar,
                $contentContainer: $('#cp-app-oo-container')
            };
            toolbar = APP.toolbar = Toolbar.create(configTb);
            Title.setToolbar(toolbar);

            var $rightside = toolbar.$rightside;

            var $save = common.createButton('save', true, {}, function () {
                saveToServer();
            });
            $save.appendTo($rightside);

            if (common.isLoggedIn()) {
                common.createButton('hashtag', true).appendTo($rightside);
            }

            var $forget = common.createButton('forget', true, {}, function (err) {
                if (err) { return; }
                setEditable(false);
            });
            $rightside.append($forget);
        };

        config.onReady = function (info) {
            if (APP.realtime !== info.realtime) {
                APP.realtime = info.realtime;
            }

            var userDoc = APP.realtime.getUserDoc();
            console.log(userDoc);
            var isNew = false;
            var newDoc = true;
            if (userDoc === "" || userDoc === "{}") { isNew = true; }

            if (userDoc !== "") {
                var hjson = JSON.parse(userDoc);

                if (hjson && hjson.metadata) {
                    metadataMgr.updateMetadata(hjson.metadata);
                }
                if (typeof (hjson) !== 'object' || Array.isArray(hjson) ||
                    (hjson.metadata && typeof(hjson.metadata.type) !== 'undefined' &&
                     hjson.metadata.type !== 'oo')) {
                    var errorText = Messages.typeError;
                    UI.errorLoadingScreen(errorText);
                    throw new Error(errorText);
                }
                content = hjson.content || content;
                newDoc = !content.hashes || Object.keys(content.hashes).length === 0;
            } else {
                Title.updateTitle(Title.defaultTitle);
            }

            if (!readOnly) {
                // Check if the editor has left
                /*var me = common.getMetadataMgr().getNetfluxId();
                var members = common.getMetadataMgr().getChannelMembers();
                if (locked) {
                    if (members.indexOf(locked) === -1) {
                        locked = me;
                        APP.onLocal();
                    }
                } else {
                    locked = me;
                    APP.onLocal();
                }

                if (!common.isLoggedIn()) {
                    UI.alert(Messages.oo_locked + Messages.oo_locked_unregistered);
                } else if (locked !== me) {
                    UI.alert(Messages.oo_locked + Messages.oo_locked_edited);
                }*/
            }

            openRtChannel(function () {
                loadDocument(newDoc);
                initializing = false;
                setMyId();
                setEditable(!readOnly);
                UI.removeLoadingScreen();
            });

        };

        config.onRemote = function () {
            if (initializing) { return; }
            var userDoc = APP.realtime.getUserDoc();
            var json = JSON.parse(userDoc);
            if (json.metadata) {
                metadataMgr.updateMetadata(json.metadata);
            }
            content = json.content;
        };

        config.onAbort = function () {
            // inform of network disconnect
            setEditable(false);
            toolbar.failed();
            UI.alert(Messages.common_connectionLost, undefined, true);
        };

        config.onConnectionChange = function (info) {
            setEditable(info.state);
            if (info.state) {
                initializing = true;
                UI.findOKButton().click();
            } else {
                UI.alert(Messages.common_connectionLost, undefined, true);
            }
        };

        cpNfInner = common.startRealtime(config);

        cpNfInner.onInfiniteSpinner(function () {
            setEditable(false);
            UI.confirm(Messages.realtime_unrecoverableError, function (yes) {
                if (!yes) { return; }
                common.gotoURL();
            });
        });

        common.onLogout(function () { setEditable(false); });
    };

    var main = function () {
        var common;

        nThen(function (waitFor) {
            $(waitFor(function () {
                UI.addLoadingScreen();
            }));
            SFCommon.create(waitFor(function (c) { APP.common = common = c; }));
        }).nThen(function (/*waitFor*/) {
            andThen(common);
        });
    };
    main();
});

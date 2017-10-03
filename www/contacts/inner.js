define([
    'jquery',
    '/bower_components/chainpad-crypto/crypto.js',
    '/common/toolbar3.js',
    '/bower_components/chainpad-json-validator/json-ot.js',
    '/common/cryptpad-common.js',
    '/bower_components/nthen/index.js',
    '/common/sframe-common.js',
    '/common/hyperscript.js',
    '/contacts/messenger-ui.js',
    '/common/sframe-messenger-inner.js',

    'css!/bower_components/bootstrap/dist/css/bootstrap.min.css',
    'less!/bower_components/components-font-awesome/css/font-awesome.min.css',
    'less!/customize/src/less2/main.less',
], function (
    $,
    Crypto,
    Toolbar,
    JsonOT,
    Cryptpad,
    nThen,
    SFCommon,
    h,
    UI,
    Messenger
    )
{
    var Messages = Cryptpad.Messages;
    var APP = {};
    var onConnectError = function () {
        Cryptpad.errorLoadingScreen(Messages.websocketError);
    };

    var common;
    var sFrameChan;
    nThen(function (waitFor) {
        $(waitFor(Cryptpad.addLoadingScreen));
        SFCommon.create(waitFor(function (c) { APP.common = common = c; }));
    }).nThen(function (waitFor) {
        sFrameChan = common.getSframeChannel();
        sFrameChan.onReady(waitFor());
    }).nThen(function (/*waitFor*/) {
        Cryptpad.onError(function (info) {
            if (info && info.type === "store") {
                onConnectError();
            }
        });

        var toolbarElement = h('div#toolbar.cp-toolbar-container');

        document.body.appendChild(toolbarElement);

        var messaging = h('div#messaging', [
            h('div.info', [
                h('h2', Messages.contacts_info1),
                h('ul', [
                    h('li', Messages.contacts_info2),
                    h('li', Messages.contacts_info3),
                ])
            ])
        ]);

        var friendList = h('div#friendList');

        var appElement = h('div#app', [
            friendList,
            messaging,
        ]);

        document.body.appendChild(appElement);

        var displayed = ['useradmin', 'newpad', 'limit', 'pageTitle'];
        var configTb = {
            displayed: displayed,
            common: Cryptpad,
            sfCommon: common,
            $container: $(toolbarElement),
            network: Cryptpad.getNetwork(),
            pageTitle: Messages.contacts_title,
            metadataMgr: common.getMetadataMgr(),
        };
        APP.toolbar = Toolbar.create(configTb);
        APP.toolbar.$rightside.hide();

        var messenger = Messenger.create(sFrameChan);

        UI.create(messenger, $(friendList), $(messaging), common);

        Cryptpad.removeLoadingScreen();

/*
        sFrameChan.query('Q_HEY_BUDDY', null, function (err, data) {
            if (!data) { return; }
            if (data.error) {
                Cryptpad.warn(data.error);
            } else {
                Cryptpad.log(data.response);
            }
        });*/
    });
});

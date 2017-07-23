define([
    'jquery',
    '/bower_components/chainpad-crypto/crypto.js',
    '/bower_components/chainpad-listmap/chainpad-listmap.js',
    '/common/toolbar2.js',
    '/common/cryptpad-common.js',
    '/common/visible.js',
    '/common/notify.js',

    //'/common/media-tag.js',
    //'/bower_components/file-saver/FileSaver.min.js',

    'css!/bower_components/components-font-awesome/css/font-awesome.min.css',
    'less!/customize/src/less/cryptpad.less',
], function ($, Crypto, Listmap, Toolbar, Cryptpad /*, Visible, Notify*/) {
    var Messages = Cryptpad.Messages;

    var APP = window.APP = {};
    $(function () {

    var andThen = function () {
        var ifrw = $('#pad-iframe')[0].contentWindow;
        var $iframe = $('#pad-iframe').contents();
        var $body = $iframe.find('body');

        $body.on('dragover', function (e) { e.preventDefault(); });
        $body.on('drop', function (e) { e.preventDefault(); });

        Cryptpad.addLoadingScreen();

        var Title;
        var $bar = $iframe.find('.toolbar-container');

        var secret;
        if (window.location.hash) {
            secret = Cryptpad.getSecrets();
            if (!secret.keys) { throw new Error("You need a hash"); } // TODO
        }

        Title = Cryptpad.createTitle({}, function(){}, Cryptpad);

        var configTb = {
            displayed: ['useradmin', 'newpad', 'limit', 'upgrade', 'pageTitle'],
            ifrw: ifrw,
            common: Cryptpad,
            //hideDisplayName: true,
            $container: $bar,
            pageTitle: Messages.todo_title
        };

        APP.toolbar = Toolbar.create(configTb);
        APP.toolbar.$rightside.html(''); // Remove the drawer if we don't use it to hide the toolbar

        // we're in upload mode
        Cryptpad.removeLoadingScreen();
    };

    var createTodo = function() {
        var obj = Cryptpad.getProxy();
        var hash = Cryptpad.createRandomHash();

        if(obj.todo) {
            hash = obj.todo;
        }

        Cryptpad.getSecrets('todo', hash);

        var listmapConfig = {
            data: {},
            websocketURL: Cryptpad.getWebsocketURL(),
            channel: secret.channel,
            validateKey: secret.keys.validateKey || undefined,
            crypto: Crypto.createEncryptor(secret.keys),
            userName: 'todo',
            logLevel: 1,
        };
        var lm = Listmap.create(listmapConfig);
    }

    Cryptpad.ready(function () {
        andThen();
        //Cryptpad.reportAppUsage();
    });

    });
});

define([
    'jquery',
    '/bower_components/chainpad-crypto/crypto.js',
    '/common/toolbar2.js',
    '/common/cryptpad-common.js',

    'css!/bower_components/components-font-awesome/css/font-awesome.min.css',
    'less!/customize/src/less/cryptpad.less',
], function ($, Crypto, Toolbar, Cryptpad) {
    var Messages = Cryptpad.Messages;

    var APP = {
        Cryptpad: Cryptpad
    };

    $(function () {

    var andThen = function () {
        Cryptpad.addLoadingScreen();

        var ifrw = $('#pad-iframe')[0].contentWindow;
        var $iframe = $('#pad-iframe').contents();
        var $appContainer = $iframe.find('#app');
        var $list = $iframe.find('#friendList');
        var $messages = $iframe.find('#messaging');
        var $bar = $iframe.find('.toolbar-container');

        var displayed = ['useradmin', 'newpad', 'limit', 'lag', 'spinner'];

        var configTb = {
            displayed: displayed,
            ifrw: ifrw,
            common: Cryptpad,
            $container: $bar,
            network: Cryptpad.getNetwork()
        };
        var toolbar = APP.toolbar = Toolbar.create(configTb);
        toolbar.$rightside.html(''); // Remove the drawer if we don't use it to hide the toolbar
        

        Cryptpad.removeLoadingScreen();
    };

    Cryptpad.ready(function () {
        andThen();
        Cryptpad.reportAppUsage();
    });

    });
});

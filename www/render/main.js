define([
    '/api/config?cb=' + Math.random().toString(16).substring(2),
    '/bower_components/chainpad-netflux/chainpad-netflux.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/bower_components/marked/marked.min.js',
    '/bower_components/hyperjson/hyperjson.js',
    //'/common/convert.js',
    '/bower_components/jquery/dist/jquery.min.js',
    '/bower_components/diff-dom/diffDOM.js',
    '/customize/pad.js'
], function (Config, Realtime, Crypto, Marked, Hyperjson) {
    var $ = window.jQuery;
    var DiffDom = window.diffDOM;

    var key;
    var channel = '';
    var hash = false;
    if (!/#/.test(window.location.href)) {
        key = Crypto.genKey();
    } else {
        hash = window.location.hash.slice(1);
        channel = hash.slice(0, 32);
        key = hash.slice(32);
    }

    // set markdown rendering options :: strip html to prevent XSS
    Marked.setOptions({
        //sanitize: true
    });

    var module = window.APP = { };

    var $target = module.$target = $('#target');

    var config = {
        websocketURL: Config.websocketURL,
        channel: channel,
        cryptKey: key,
        crypto: Crypto
    };

    var draw = window.draw = (function () {
        var target = $target[0],
            inner = $target.find('#inner')[0];

        if (!target) { throw new Error(); }
        var DD = new DiffDom({});

        return function (md) {
            var rendered = Marked(md||"");
            // make a dom
            var New = $('<div id="inner">'+rendered+'</div>')[0];

            var patches = (DD).diff(inner, New);
            DD.apply(inner, patches);
            Previous = New;
            return patches;
        };
    }());

    var $inner = $('#inner');
    var redrawTimeout;
    var lazyDraw = function (md) {
        if (redrawTimeout) { clearTimeout(redrawTimeout); }
        redrawTimeout = setTimeout(function () {
            draw(md);
        }, 450);
    };

    var initializing = true;

    var onInit = config.onInit = function (info) {
        window.location.hash = info.channel + key;
        module.realtime = info.realtime;
    };

    // when your editor is ready
    var onReady = config.onReady = function (info) {
        console.log("Realtime is ready!");
        var userDoc = module.realtime.getUserDoc();
        lazyDraw(userDoc);
        initializing = false;
    };

    // when remote editors do things...
    var onRemote = config.onRemote = function () {
        if (initializing) { return; }
        var userDoc = module.realtime.getUserDoc();
        lazyDraw(userDoc);
    };

    var onLocal = config.onLocal = function () {
        // we're not really expecting any local events for this editor...
        /*  but we might add a second pane in the future so that you don't need
            a second window to edit your markdown */
        if (initializing) { return; }
        var userDoc = module.realtime.getUserDoc();
        lazyDraw(userDoc);
    };

    var onAbort = config.onAbort = function () {
        window.alert("Network Connection Lost");
    };

    var rts = Realtime.start(config);
});

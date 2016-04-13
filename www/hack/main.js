define([
    '/api/config?cb=' + Math.random().toString(16).substring(2),
    '/common/realtime-input.js',
    '/common/messages.js',
    '/common/crypto.js',
    '/common/cursor.js',
    '/bower_components/jquery/dist/jquery.min.js',
    '/customize/pad.js'
], function (Config, Realtime, Messages, Crypto, Cursor) { 
    var $ = window.jQuery;
    $(window).on('hashchange', function() {
        window.location.reload();
    });
    if (window.location.href.indexOf('#') === -1) {
        window.location.href = window.location.href + '#' + Crypto.genKey();
        return;
    }

    var key = Crypto.parseKey(window.location.hash.substring(1));

    var $textarea = $('textarea'),
        $run = $('#run');

    /*
        onRemote
        onInit
        onReady
        onAbort
        transformFunction
    */

    var config = {
        textarea: $textarea[0],
        websocketURL: Config.websocketURL,
        userName: Crypto.rand64(8),
        channel: key.channel,
        cryptKey: key.cryptKey,
    };
    var initializing = true;

    $textarea.attr('disabled', true);

    var onInit = config.onInit = function (info) { };

    var onRemote = config.onRemote = function (contents) {
        if (initializing) { return; }
        // TODO do something on external messages
        // http://webdesign.tutsplus.com/tutorials/how-to-display-update-notifications-in-the-browser-tab--cms-23458
    };

    var onReady = config.onReady = function (info) {
        initializing = false;
        $textarea.attr('disabled', false);
    };

    var onAbort = config.onAbort = function (info) {
        $textarea.attr('disabled', true);
        window.alert("Server Connection Lost");
    };

    var rt = window.rt = Realtime.start(config);

    var cursor = Cursor($textarea[0]);

    var splice = function (str, index, chars) {
        var count = chars.length;
        return str.slice(0, index) + chars + str.slice((index -1) + count);
    };

    var setSelectionRange = function (input, start, end) {
        if (input.setSelectionRange) {
            input.focus();
            input.setSelectionRange(start, end);
        } else if (input.createTextRange) {
            var range = input.createTextRange();
            range.collapse(true);
            range.moveEnd('character', end);
            range.moveStart('character', start);
            range.select();
        }
    };

    var setCursor = function (el, pos) {
        setSelectionRange(el, pos, pos);
    };

    var state = {};

    // TODO
    $textarea.on('keydown', function (e) {
        // track when control keys are pushed down
        //switch (e.key) { }
    });

    // TODO
    $textarea.on('keyup', function (e) {
        // track when control keys are released
    });

    $textarea.on('keypress', function (e) {
        switch (e.key) {
            case 'Tab':
                // insert a tab wherever the cursor is...
                var start = $textarea.prop('selectionStart');
                var end = $textarea.prop('selectionEnd');
                if (typeof start !== 'undefined') {
                    if (start === end) {
                        $textarea.val(function (i, val) {
                            return splice(val, start, "\t");
                        });
                        setCursor($textarea[0], start +1);
                    } else {
                        // indentation?? this ought to be fun.

                    }
                }
                // simulate a keypress so the event goes through..
                // prevent default behaviour for tab
                e.preventDefault();
                rt.bumpSharejs();
                break;
            default:
                break;
        }
    });

    $textarea.on('change', function () {
        rt.bumpSharejs();
    });

    $run.click(function (e) {
        e.preventDefault();
        var content = $textarea.val();

        try {
            eval(content); // jshint ignore:line
        } catch (err) {
            // FIXME don't use alert, make an errorbox
            window.alert(err.message);
            console.error(err);
        }
    });
});

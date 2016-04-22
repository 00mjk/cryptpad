define([
    '/api/config?cb=' + Math.random().toString(16).substring(2),
    '/common/realtime-input.js',
    '/common/crypto.js',
    '/common/TextPatcher.js',
    '/bower_components/jquery/dist/jquery.min.js'
], function (Config, Realtime, Crypto, TextPatcher) {
    var $ = window.jQuery;
    /*
    $(window).on('hashchange', function() {
        window.location.reload();
    });*/

    var key;
    var channel = '';
    if (window.location.href.indexOf('#') === -1) {
        key = Crypto.genKey();
        //window.location.href = window.location.href + '#' + Crypto.genKey();
        //return;
    } else {
        var hash = window.location.hash.substr(1);
        channel = hash.substr(0,32);
        key = hash.substr(32);
    }

    var $textarea = $('textarea'),
        $run = $('#run');

    var module = {};

    /*
        onRemote
        onInit
        onReady
        onAbort
        transformFunction
    */

    var userName = Crypto.rand64(8);

    var config = {
        initialState: '',
        websocketURL: Config.websocketURL,
        userName: userName,
        channel: channel,
        cryptKey: key,
    };
    var initializing = true;

    var setEditable = function (bool) { $textarea.attr('disabled', !bool); };
    var canonicalize = function (text) { return text.replace(/\r\n/g, '\n'); };

    setEditable(false);

    var onInit = config.onInit = function (info) {
        window.location.hash = info.channel + key;
    };

    var onRemote = config.onRemote = function (info) {
        if (initializing) { return; }

        var userDoc = info.realtime.getUserDoc();
        var current = canonicalize($textarea.val());

        var op = TextPatcher.diff(current, userDoc);

        var elem = $textarea[0];

        var selects = ['selectionStart', 'selectionEnd'].map(function (attr) {
            return TextPatcher.transformCursor(elem[attr], op);
        });

        $textarea.val(userDoc);
        elem.selectionStart = selects[0];
        elem.selectionEnd = selects[1];

        // TODO do something on external messages
        // http://webdesign.tutsplus.com/tutorials/how-to-display-update-notifications-in-the-browser-tab--cms-23458
    };

    var onReady = config.onReady = function (info) {
        module.patchText = TextPatcher.create({
            realtime: info.realtime
        //    logging: true
        });
        initializing = false;
        setEditable(true);
        $textarea.val(info.realtime.getUserDoc());
    };

    var onAbort = config.onAbort = function (info) {
        setEditable(false);
        window.alert("Server Connection Lost");
    };

    var onLocal = config.onLocal = function () {
        if (initializing) { return; }
        module.patchText(canonicalize($textarea.val()));
    };

    var rt = window.rt = Realtime.start(config);

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

    //$textarea.on('change', onLocal);
    $textarea.on('keypress', function (e) {
        onLocal();
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

                onLocal();
                break;
            default:
                break;
        }
    });

    ['cut', 'paste', 'change', 'keyup', 'keydown', 'select', 'textInput']
        .forEach(function (evt) {
            $textarea.on(evt, onLocal);
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

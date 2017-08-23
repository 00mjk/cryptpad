define([
    '/customize/application_config.js',
    '/customize/messages.js',
], function (AppConfig, Messages) {
    var common = {};

    common.infiniteSpinnerDetected = false;
    var BAD_STATE_TIMEOUT = typeof(AppConfig.badStateTimeout) === 'number'?
        AppConfig.badStateTimeout: 30000;

    var connected = false;

    /*
        TODO make this not blow up when disconnected or lagging...
    */
    common.whenRealtimeSyncs = function (Cryptpad, realtime, cb) {
        realtime.sync();

        window.setTimeout(function () {
            if (realtime.getAuthDoc() === realtime.getUserDoc()) {
                return void cb();
            }

            var to = setTimeout(function () {
                if (!connected) { return; }
                realtime.abort();
                // don't launch more than one popup
                if (common.infiniteSpinnerDetected) { return; }

                // inform the user their session is in a bad state
                Cryptpad.confirm(Messages.realtime_unrecoverableError, function (yes) {
                    if (!yes) { return; }
                    window.location.reload();
                });
                common.infiniteSpinnerDetected = true;
            }, BAD_STATE_TIMEOUT);
            realtime.onSettle(function () {
                clearTimeout(to);
                cb();
            });
        }, 0);
    };

    common.setConnectionState = function (bool) {
        if (typeof(bool) !== 'boolean') { return; }
        connected = bool;
    };

    return common;
});

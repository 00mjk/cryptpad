// Stage 0, this gets cached which means we can't change it. boot2-sframe.js is changable.
// Note that this file is meant to be executed only inside of a sandbox iframe.
//
// IF YOU EDIT THIS FILE, bump the version (replace 1.3 in the following command with the next version.)
// grep -nr '/common/sframe-boot.js?ver=' | sed 's/:.*$//' | while read x; do \
//    sed -i -e 's@/common/sframe-boot.js?ver=[^"]*@/common/sframe-boot.js?ver=1.3@' $x; done
;(function () {
var afterLoaded = function (req) {
    var localStorage = {};
    if (req.cfg && req.cfg.urlArgs) {
        try {
            localStorage = window.localStorage;
            if (localStorage['CRYPTPAD_VERSION'] !== req.cfg.urlArgs) {
                // new version, flush
                Object.keys(localStorage).forEach(function (k) {
                    if (!k.indexOf('CRYPTPAD_CACHE_')) { delete localStorage[k]; }
                });
                localStorage['CRYPTPAD_VERSION'] = req.cfg.urlArgs;
            }
        } catch (e) {
            console.error(e);
            localStorage = {};
        }
    }
    window.cryptpadCache = Object.freeze({
        put: function (k, v, cb) {
            cb = cb || function () { };
            setTimeout(function () { localStorage['CRYPTPAD_CACHE_' + k] = v; cb(); });
        },
        get: function (k, cb) {
            if (!cb) { throw new Error(); }
            setTimeout(function () { cb(localStorage['CRYPTPAD_CACHE_' + k]); });
        }
    });
    req.cfg = req.cfg || {};
    if (req.pfx) {
        req.cfg.onNodeCreated = function (node /*, config, module, path*/) {
            node.setAttribute('src', req.pfx + node.getAttribute('src'));
        };
    }
    require.config(req.cfg);
    var txid = Math.random().toString(16).replace('0.', '');
    var intr;
    var ready = function () {
        intr = setInterval(function () {
            if (typeof(txid) !== 'string') { return; }
            window.parent.postMessage(JSON.stringify({ q: 'READY', txid: txid }), '*');
        }, 1);
    };
    if (req.req) { require(req.req, ready); } else { ready(); }
    var onReply = function (msg) {
        var data = JSON.parse(msg.data);
        if (data.txid !== txid) { return; }
        clearInterval(intr);
        txid = {};
        window.removeEventListener('message', onReply);
        require(['/common/sframe-boot2.js'], function () { });
    };
    window.addEventListener('message', onReply);
};

var intr = setInterval(function () {
    try {
        var req = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
        clearInterval(intr);
        afterLoaded(req);
    } catch (e) { console.error(e); }
}, 100);

}());

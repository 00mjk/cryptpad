// This is stage 1, it can be changed but you must bump the version of the project.
// Note: This must only be loaded from inside of a sandbox-iframe.
define([
    '/common/requireconfig.js',
    '/common/test.js'
], function (RequireConfig, Test) {
    require.config(RequireConfig());

    // most of CryptPad breaks if you don't support isArray
    if (!Array.isArray) {
        Array.isArray = function(arg) { // CRYPTPAD_SHIM
            return Object.prototype.toString.call(arg) === '[object Array]';
        };
    }

    // RPC breaks if you don't support Number.MAX_SAFE_INTEGER
    if (Number && !Number.MAX_SAFE_INTEGER) {
        Number.MAX_SAFE_INTEGER = 9007199254740991;
    }

    if (typeof(window.Symbol) !== 'function') {
        var idCounter = 0;
        var Symbol = window.Symbol = function Symbol(key) {
            return '__' + key + '_' + Math.floor(Math.random() * 1e9) + '_' + (++idCounter) + '__';
        };
        Symbol.iterator = Symbol('Symbol.iterator');
    }

    var mkFakeStore = function () {
        var fakeStorage = {
            getItem: function (k) { return fakeStorage[k]; },
            setItem: function (k, v) { fakeStorage[k] = v; return v; },
            removeItem: function (k) { delete fakeStorage[k]; }
        };
        return fakeStorage;
    };
    window.__defineGetter__('localStorage', function () { return mkFakeStore(); });
    window.__defineGetter__('sessionStorage', function () { return mkFakeStore(); });

    window.CRYPTPAD_INSIDE = true;

    // This test is for keeping the testing infrastructure operating
    // until all tests have been registered.
    // This test is completed in common-interface.js
    Test(function (t) { Test.__ASYNC_BLOCKER__ = t; });

    require([document.querySelector('script[data-bootload]').getAttribute('data-bootload')]);
});

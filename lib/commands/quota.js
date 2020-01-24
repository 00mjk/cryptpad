/*jshint esversion: 6 */
/* globals Buffer*/
const Quota = module.exports;

const Core = require("./core");
const Util = require("../common-util");
const Package = require('../../package.json');
const Https = require("https");

Quota.applyCustomLimits = function (Env, config) {
    var isLimit = function (o) {
        var valid = o && typeof(o) === 'object' &&
            typeof(o.limit) === 'number' &&
            typeof(o.plan) === 'string' &&
            typeof(o.note) === 'string';
        return valid;
    };

    // read custom limits from the config
    var customLimits = (function (custom) {
        var limits = {};
        Object.keys(custom).forEach(function (k) {
            k.replace(/\/([^\/]+)$/, function (all, safeKey) {
                var id = Util.unescapeKeyCharacters(safeKey || '');
                limits[id] = custom[k];
                return '';
            });
        });
        return limits;
    }(config.customLimits || {}));

    Object.keys(customLimits).forEach(function (k) {
        if (!isLimit(customLimits[k])) { return; }
        Env.limits[k] = customLimits[k];
    });
};

// The limits object contains storage limits for all the publicKey that have paid
// To each key is associated an object containing the 'limit' value and a 'note' explaining that limit
Quota.updateLimits = function (Env, config, publicKey, cb) { // FIXME BATCH?S

    if (config.adminEmail === false) {
        Quota.applyCustomLimits(Env, config);
        if (config.allowSubscriptions === false) { return; }
        throw new Error("allowSubscriptions must be false if adminEmail is false");
    }
    if (typeof cb !== "function") { cb = function () {}; }

    var defaultLimit = typeof(config.defaultStorageLimit) === 'number'?
        config.defaultStorageLimit: Core.DEFAULT_LIMIT;

    var userId;
    if (publicKey) {
        userId = Util.unescapeKeyCharacters(publicKey);
    }

    var body = JSON.stringify({
        domain: config.myDomain,
        subdomain: config.mySubdomain || null,
        adminEmail: config.adminEmail,
        version: Package.version
    });
    var options = {
        host: 'accounts.cryptpad.fr',
        path: '/api/getauthorized',
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
        }
    };

    var req = Https.request(options, function (response) {
        if (!('' + response.statusCode).match(/^2\d\d$/)) {
            return void cb('SERVER ERROR ' + response.statusCode);
        }
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            try {
                var json = JSON.parse(str);
                Env.limits = json;
                Quota.applyCustomLimits(Env, config);

                var l;
                if (userId) {
                    var limit = Env.limits[userId];
                    l = limit && typeof limit.limit === "number" ?
                            [limit.limit, limit.plan, limit.note] : [defaultLimit, '', ''];
                }
                cb(void 0, l);
            } catch (e) {
                cb(e);
            }
        });
    });

    req.on('error', function (e) {
        Quota.applyCustomLimits(Env, config);
        if (!config.domain) { return cb(); }
        cb(e);
    });

    req.end(body);
};



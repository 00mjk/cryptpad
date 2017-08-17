define([
    '/bower_components/nthen/index.js',
    '/common/sframe-chainpad-netflux-inner.js',
    '/common/sframe-channel.js'
], function (nThen, CpNfInner, SFrameChannel) {

    // Chainpad Netflux Inner
    var funcs = {};
    var ctx = {};

    funcs.startRealtime = function (options) {
        if (ctx.cpNfInner) { return ctx.cpNfInner; }
        options.sframeChan = ctx.sframeChan;
        ctx.cpNfInner = CpNfInner.start(options);
        return ctx.cpNfInner;
    };

    funcs.isLoggedIn = function () {
        if (!ctx.cpNfInner) { throw new Error("cpNfInner is not ready!"); }
        return ctx.cpNfInner.metadataMgr.getPrivateData().accountName;
    };

    funcs.setTitle = function (title /*:string*/, cb) {

    };

    Object.freeze(funcs);
    return { create: function (cb) {
        nThen(function (waitFor) {
            SFrameChannel.create(window.top, waitFor(function (sfc) { ctx.sframeChan = sfc; }));
            // CpNfInner.start() should be here....
        }).nThen(function (waitFor) {
            cb(funcs);
        });
    } };
});

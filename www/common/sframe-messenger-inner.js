define([], function () {
    var MI = {};

    MI.create = function (sFrameChan) {
        var messenger = {};

        var _handlers = {
            message: [],
            join: [],
            leave: [],
            update: [],
            friend: [],
            unfriend: []
        };

        messenger.on = function (key, f) {
            if (!_handlers[key]) { throw new Error('invalid event'); }
            _handlers[key].push(f);
        };

        sFrameChan.on('EV_CONTACTS_MESSAGE', function (err, data) {
            //if (err || data.error) { return void console.error(err || data.error); }
            _handlers.message.forEach(function (f) {
                f(err || data.error, data);
            });
        });
        sFrameChan.on('EV_CONTACTS_JOIN', function (err, data) {
            if (err || data.error) { return void console.error(err || data.error); }
            _handlers.join.forEach(function (f) {
                f(data.curvePublic, data.channel)
            });
        });
        sFrameChan.on('EV_CONTACTS_LEAVE', function (err, data) {
            if (err || data.error) { return void console.error(err || data.error); }
            _handlers.leave.forEach(function (f) {
                f(data.curvePublic, data.channel);
            });
        });
        sFrameChan.on('EV_CONTACTS_UPDATE', function (err, data) {
            if (err || data.error) { return void console.error(err || data.error); }
            _handlers.update.forEach(function (f) {
                f(data.info, data.curvePublic);
            });
        });
        sFrameChan.on('EV_CONTACTS_FRIEND', function (err, data) {
            if (err || data.error) { return void console.error(err || data.error); }
            _handlers.friend.forEach(function (f) {
                f(data.curvePublic);
            });
        });
        sFrameChan.on('EV_CONTACTS_UNFRIEND', function (err, data) {
            if (err || data.error) { return void console.error(err || data.error); }
            _handlers.unfriend.forEach(function (f) {
                f(data.curvePublic);
            });
        });

        /*** QUERIES ***/
        messenger.getFriendList = function (cb) {
            sFrameChan.query('Q_CONTACTS_GET_FRIEND_LIST', null, function (err, data) {
                console.error('GET FRIEND LIST');
                cb(err || data.error, data.data);
            });
        };
        messenger.getMyInfo = function (cb) {
            sFrameChan.query('Q_CONTACTS_GET_MY_INFO', null, function (err, data) {
                cb(err || data.error, data.data);
            });
        };
        messenger.getFriendInfo = function (curvePublic, cb) {
            sFrameChan.query('Q_CONTACTS_GET_FRIEND_INFO', curvePublic, function (err, data) {
                cb(err || data.error, data.data);
                //cb({ error: err, data: data, });
            });
        };
        messenger.openFriendChannel = function (curvePublic, cb) {
            sFrameChan.query('Q_CONTACTS_OPEN_FRIEND_CHANNEL', curvePublic, function (err, data) {
                cb(err || data.error);
            });
        };
        messenger.getStatus = function (curvePublic, cb) {
            sFrameChan.query('Q_CONTACTS_GET_STATUS', curvePublic, function (err, data) {
                cb(err || data.error, data.data);
            });
        };

        messenger.getMoreHistory = function (curvePublic, sig, count, cb) {
            sFrameChan.query('Q_CONTACTS_GET_MORE_HISTORY', {
                curvePublic: curvePublic,
                sig: sig,
                count: count
            }, function (err, data) {
                cb(err || data.error, data.data);
            });
        };
        messenger.sendMessage = function (curvePublic, content, cb) {
            sFrameChan.query('Q_CONTACTS_SEND_MESSAGE', {
                content: content,
                curvePublic: curvePublic,
            }, function (err, data) {
                cb(err || data.error);
            });
        };
        messenger.setChannelHead = function (curvePublic, sig, cb) {
            sFrameChan.query('Q_CONTACTS_SET_CHANNEL_HEAD', {
                curvePublic: curvePublic,
                sig: sig,
            }, function (e, data) {
                cb(e || data.error);
            });
        };

        return messenger;
    };

    return MI;
});

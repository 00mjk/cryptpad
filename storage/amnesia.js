console.log("Loading amnesiadb. This is a horrible idea in production, as data *will not* persist\n");

/*
    As the comment says, this module does nothing to make your data persist
    across sessions. If your process crashes for any reason, all pads will die.

    This might be useful if you want to debug other parts of the codebase, if
    you want to test out cryptpad without installing mongodb locally, or if
    you don't want to rely on a remote db like the one at mongolab.com.

    Maybe you just like the idea of a forgetful pad? To use this module, edit
    config.js to include a directive `storage: './storage/amnesia'

    Enjoy!
*/

var db=[],
    index=0;

var insert = function(channelName, content, cb){
    var val = {
        id:index++,
        chan: channelName,
        msg: content,
        time: new Date().getTime(),
    };
    db.push(val);
    cb();
};

var getMessages = function(channelName, cb){
    db.sort(function(a,b){
        return a.id - b.id;
    });
    db.filter(function(val){
        return val.chan == channelName;
    }).forEach(function(doc){
        cb(doc.msg);
    });
};

module.exports.create = function(conf, cb){
    cb({
        message: insert,
        getMessages: getMessages,
    });
};

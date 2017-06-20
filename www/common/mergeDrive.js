define([
    '/common/cryptpad-common.js',
    '/common/cryptget.js',
    '/common/userObject.js',
], function (Cryptpad, Crypt, FO) {
    var exp = {};

    var getType = function (el) {
        if (el === null) { return "null"; }
        return Array.isArray(el) ? "array" : typeof(el);
    };

    var findAvailableKey = function (obj, key) {
        if (typeof (obj[key]) === "undefined") { return key; }
        var i = 1;
        var nkey = key;
        while (typeof (obj[nkey]) !== "undefined") {
            nkey = key + '_' + i;
            i++;
        }
        return nkey;
    };

    var createFromPath = function (proxy, oldFo, path, id) {
        var root = proxy.drive;

        if (!oldFo.isFile(id)) { return; }

        var error = function (msg) {
            console.error(msg || "Unable to find that path", path);
        };

        if (oldFo.isInTrashRoot(path)) {
            id = oldFo.find(path.slice(0,3));
            path.pop();
        }

        var next, nextRoot;
        path.forEach(function (p, i) {
            if (!root) { return; }
            if (typeof(p) === "string") {
                if (getType(root) !== "object") { root = undefined; error(); return; }
                if (i === path.length - 1) {
                    root[Cryptpad.createChannelId()] = id;
                    return;
                }
                next = getType(path[i+1]);
                nextRoot = getType(root[p]);
                if (nextRoot !== "undefined") {
                    if (next === "string" && nextRoot === "object" || next === "number" && nextRoot === "array") {
                        root = root[p];
                        return;
                    }
                    p = findAvailableKey(root, p);
                }
                if (next === "number") {
                    root[p] = [];
                    root = root[p];
                    return;
                }
                root[p] = {};
                root = root[p];
                return;
            }
            // Path contains a non-string element: it's an array index
            if (typeof(p) !== "number") { root = undefined; error(); return; }
            if (getType(root) !== "array") { root = undefined; error(); return; }
            if (i === path.length - 1) {
                if (root.indexOf(id) === -1) { root.push(id); }
                return;
            }
            next = getType(path[i+1]);
            if (next === "number") {
                error('2 consecutives arrays in the user object');
                root = undefined;
                //root.push([]);
                //root = root[root.length - 1];
                return;
            }
            root.push({});
            root = root[root.length - 1];
            return;
        });
    };

    exp.anonDriveIntoUser = function (proxy, cb) {
        // Make sure we have an FS_hash and we don't use it, otherwise just stop the migration and cb
        if (!localStorage.FS_hash || !Cryptpad.isLoggedIn()) {
            if (typeof(cb) === "function") { cb(); }
        }
        // Get the content of FS_hash and then merge the objects, remove the migration key and cb
        var todo = function (err, doc) {
            if (err) { console.error("Cannot migrate recent pads", err); return; }
            var parsed;
            if (!doc) {
                if (typeof(cb) === "function") { cb(); }
                return;
            }
            try { parsed = JSON.parse(doc); } catch (e) {
                if (typeof(cb) === "function") { cb(); }
                console.error("Cannot parsed recent pads", e);
                return;
            }
            if (parsed) {
                var oldFo = FO.init(parsed.drive, {
                    Cryptpad: Cryptpad
                });
                var onMigrated = function () {
                    oldFo.fixFiles();
                    var newData = Cryptpad.getStore().getProxy();
                    var newFo = newData.fo;
                    var oldRecentPads = parsed.drive[newFo.FILES_DATA];
                    var newRecentPads = proxy.drive[newFo.FILES_DATA];
                    var newFiles = newFo.getFiles([newFo.FILES_DATA]);
                    var oldFiles = oldFo.getFiles([newFo.FILES_DATA]);
                    oldFiles.forEach(function (id) {
                        var href = oldRecentPads[id].href;
                        // Do not migrate a pad if we already have it, it would create a duplicate in the drive
                        if (newFiles.indexOf(id) !== -1) { return; }
                        // If we have a stronger version, do not add the current href
                        if (Cryptpad.findStronger(href, newRecentPads)) { return; }
                        // If we have a weaker version, replace the href by the new one
                        // NOTE: if that weaker version is in the trash, the strong one will be put in unsorted
                        var weaker = Cryptpad.findWeaker(href, newRecentPads);
                        if (weaker) {
                            // Update RECENTPADS
                            newRecentPads.some(function (pad) {
                                if (pad.href === weaker) {
                                    pad.href = href;
                                    return true;
                                }
                                return;
                            });
                            // Update the file in the drive
                            newFo.replace(weaker, href);
                            return;
                        }
                        // Here it means we have a new href, so we should add it to the drive at its old location
                        var paths = oldFo.findFile(id);
                        if (paths.length === 0) { return; }
                        // Add the file data in our array and use the id to add the file
                        var data = oldFo.getFileData(id);
                        if (data) {
                            newFo.pushData(data, function (err, id) {
                                if (err) { return void console.error("Cannot import file:", data, err); }
                                createFromPath(proxy, oldFo, paths[0], id);
                            });
                        }
                    });
                    if (!proxy.FS_hashes || !Array.isArray(proxy.FS_hashes)) {
                        proxy.FS_hashes = [];
                    }
                    proxy.FS_hashes.push(localStorage.FS_hash);
                    if (typeof(cb) === "function") { cb(); }
                };
                oldFo.migrate(onMigrated);
                return;
            }
            if (typeof(cb) === "function") { cb(); }
        };
        Crypt.get(localStorage.FS_hash, todo);
    };

    return exp;
});

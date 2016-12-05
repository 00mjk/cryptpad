define([
    '/api/config?cb=' + Math.random().toString(16).substring(2),
    '/customize/messages.js?app=poll',
    '/bower_components/textpatcher/TextPatcher.js',
    '/bower_components/chainpad-listmap/chainpad-listmap.js',
    '/bower_components/chainpad-crypto/crypto.js',
    '/common/cryptpad-common.js',
    '/bower_components/hyperjson/hyperjson.js',
    '/poll/test/render.js',
    '/common/toolbar.js',
    '/common/visible.js',
    '/common/notify.js',
    '/bower_components/file-saver/FileSaver.min.js',
    '/bower_components/jquery/dist/jquery.min.js',
    //'/customize/pad.js'
], function (Config, Messages, TextPatcher, Listmap, Crypto, Cryptpad, Hyperjson, Render, Toolbar) {
    var $ = window.jQuery;

    var HIDE_INTRODUCTION_TEXT = "hide_poll_text";
    var defaultName;

    var secret = Cryptpad.getSecrets();
    var readOnly = secret.keys && !secret.keys.editKeyStr;

    var APP = window.APP = {
        Toolbar: Toolbar,
        Hyperjson: Hyperjson,
        Render: Render,
        $bar: $('#toolbar').css({ border: '1px solid white', background: 'grey', 'margin-bottom': '1vh', }),
        editable: {
            row: [],
            col: []
        }
    };

    var sortColumns = function (order, firstcol) {
        var colsOrder = order.slice();
        colsOrder.sort(function (a, b) {
            return (a === firstcol) ? -1 :
                        ((b === firstcol) ? 1 : 0);
        });
        return colsOrder;
    };

    var isOwnColumnCommitted = function () {
        return APP.proxy && APP.proxy.table.colsOrder.indexOf(APP.userid) !== -1;
    };

    var mergeUncommitted = function (proxy, uncommitted, commit) {
        var newObj;
        if (commit) {
            newObj = proxy;
        } else {
            newObj = $.extend(true, {}, proxy);
        }
        // We have uncommitted data only if the user's column is not in the proxy
        // If it is already is the proxy, nothing to merge
        if (isOwnColumnCommitted()) {
            return newObj;
        }
        // Merge uncommitted into the proxy
        uncommitted.table.colsOrder.forEach(function (x) {
            if (newObj.table.colsOrder.indexOf(x) !== -1) { return; }
            newObj.table.colsOrder.push(x);
        });
        for (var k in uncommitted.table.cols) {
            if (!newObj.table.cols[k]) {
                newObj.table.cols[k] = uncommitted.table.cols[k];
            }
        }
        for (var k in uncommitted.table.cells) {
            if (!newObj.table.cells[k]) {
                newObj.table.cells[k] = uncommitted.table.cells[k];
            }
        }
        return newObj;
    };

    var setColumnDisabled = function (id, state) {
        if (!state) {
            $('input[data-rt-id^="' + id + '"]').removeAttr('disabled');
            return;
        }
        $('input[data-rt-id^="' + id + '"]').attr('disabled', 'disabled');
    };

    var styleUncommittedColumn = function () {
        var id = APP.userid;

        // Enable the checkboxes for the user's column (committed or not)
        $('input[disabled="disabled"][data-rt-id^="' + id + '"]').removeAttr('disabled');
        $('input[type="checkbox"][data-rt-id^="' + id + '"]').addClass('enabled');
        $('[data-rt-id="' + id + '"] ~ .edit').css('visibility', 'hidden');

        if (isOwnColumnCommitted()) { return; }
        $('[data-rt-id^="' + id + '"]').closest('td').addClass("uncommitted");
        $('td.uncommitted .remove, td.uncommitted .edit').css('visibility', 'hidden');
        $('td.uncommitted .cover').addClass("uncommitted");
        $('.uncommitted input[type="text"]').attr("placeholder", "New column here"); //TODO
    };

    var unlockElements = function () {
        APP.editable.row.forEach(function (id) {
            $('input[type="text"][disabled="disabled"][data-rt-id="' + id + '"]').removeAttr('disabled');
            $('span.edit[data-rt-id="' + id + '"]').css('visibility', 'hidden');
        });
        APP.editable.col.forEach(function (id) {
            $('input[disabled="disabled"][data-rt-id^="' + id + '"]').removeAttr('disabled');
            $('input[type="checkbox"][data-rt-id^="' + id + '"]').addClass('enabled');
            $('span.edit[data-rt-id="' + id + '"]').css('visibility', 'hidden');
        });
    };

    var updateTableButtons = function () {
        if ($('.checkbox-cell').length && !isOwnColumnCommitted()) {
            $('#commit').show();
            $('#commit').css('width', $($('.checkbox-cell')[0]).width());
        }

        var $createOption = APP.$table.find('tfoot tr td:first-child');
        var $commitCell = APP.$table.find('tfoot tr td:nth-child(2)');
        $createOption.append(APP.$createRow);
        $commitCell.append(APP.$commit);
        $('#create-user, #create-option').css('display', 'inline-block');
        if (!APP.proxy || !APP.proxy.table.rowsOrder || APP.proxy.table.rowsOrder.length === 0) { $('#create-user').hide(); }
        var width = $('#table').outerWidth();
        if (width) {
            //$('#create-user').css('left', width + 30 + 'px');
        }
    };

    var updateDisplayedTable = function () {
        styleUncommittedColumn();
        unlockElements();
        updateTableButtons();
    };

    var unlockColumn = function (id, cb) {
        if (APP.editable.col.indexOf(id) === -1) {
            APP.editable.col.push(id);
        }
        if (typeof(cb) === "function") {
            cb();
        }
    };
    var unlockRow = function (id, cb) {
        if (APP.editable.row.indexOf(id) === -1) {
            APP.editable.row.push(id);
        }
        if (typeof(cb) === "function") {
            cb();
        }
    };

    /*  Any time the realtime object changes, call this function */
    var change = function (o, n, path) {
        if (path && path.join) {
            console.log("Change from [%s] to [%s] at [%s]",
                o, n, path.join(', '));
        }

        var table = APP.$table[0];

        var displayedObj = mergeUncommitted(APP.proxy, APP.uncommitted);

        var colsOrder = sortColumns(displayedObj.table.colsOrder, APP.userid);
        var conf = {
            cols: colsOrder,
            readOnly: readOnly
        };

        //Render.updateTable(table, displayedObj, conf);

        /*  FIXME browser autocomplete fills in new fields sometimes
            calling updateTable twice removes the autofilled in values
            setting autocomplete="off" is not reliable

            https://developer.mozilla.org/en-US/docs/Web/Security/Securing_your_site/Turning_off_form_autocompletion
        */
        window.setTimeout(function () {
            var displayedObj2 = mergeUncommitted(APP.proxy, APP.uncommitted);
            Render.updateTable(table, displayedObj2, conf);
            updateDisplayedTable();
        });
    };

    var getRealtimeId = function (input) {
        return input.getAttribute && input.getAttribute('data-rt-id');
    };

    /*  Called whenever an event is fired on an input element */
    var handleInput = function (input) {
        var type = input.type.toLowerCase();
        var id = getRealtimeId(input);

        console.log(input);

        var object = APP.proxy;

        var x = Render.getCoordinates(id)[0];
        if (type !== "row" && x === APP.userid && APP.proxy.table.colsOrder.indexOf(x) === -1) {
            object = APP.uncommitted;
        }

        switch (type) {
            case 'text':
                console.log("text[rt-id='%s'] [%s]", id, input.value);
                if (!input.value) { return void console.log("Hit enter?"); }
                Render.setValue(object, id, input.value);
                change();
                break;
            case 'checkbox':
                console.log("checkbox[tr-id='%s'] %s", id, input.checked);
                if ($(input).hasClass('enabled')) {
                    Render.setValue(object, id, input.checked);
                    change();
                } else {
                    console.log('checkbox locked');
                }
                break;
            default:
                console.log("Input[type='%s']", type);
                break;
        }
    };

    /*  Called whenever an event is fired on a span */
    var handleSpan = function (span) {
        var id = span.getAttribute('data-rt-id');
        var type = Render.typeofId(id);
        if (type === 'row') {
            var isRemove = span.className && span.className.split(' ').indexOf('remove') !== -1;
            var isEdit = span.className && span.className.split(' ').indexOf('edit') !== -1;
            if (isRemove) {
                Render.removeRow(APP.proxy, id, function () {
                    change();
                });
            } else if (isEdit) {
                unlockRow(id, function () {
                    change();
                });
            }
        } else if (type === 'col') {
            var isRemove = span.className && span.className.split(' ').indexOf('remove') !== -1;
            var isEdit = span.className && span.className.split(' ').indexOf('edit') !== -1;
            if (isRemove) {
                Render.removeColumn(APP.proxy, id, function () {
                    change();
                });
            } else if (isEdit) {
                unlockColumn(id, function () {
                    change();
                });
            }
        } else if (type === 'cell') {
            change();
        } else {
            console.log("UNHANDLED");
        }
    };

    var hideInputs = function (e) {
        if ($(e.target).is('[type="text"]')) {
            return;
        }
        var $cells = APP.$table.find('thead td:not(.uncommitted), tbody td');
        $cells.find('[type="text"][data-rt-id!="' + APP.userid + '"]').attr('disabled', true);
        $cells.find('[data-rt-id!="' + APP.userid + '"] ~ .edit').css('visibility', 'visible');
        APP.editable.col = [APP.userid];
        APP.editable.row = [];
    };

    $(window).click(hideInputs);

    var handleClick = function (e, isKeyup) {
        e.stopPropagation();

        if (!APP.ready) { return; }
        var target = e && e.target;

        if (isKeyup) {
            console.log("Keyup!");
            return;
        }

        if (!target) { return void console.log("NO TARGET"); }

        var nodeName = target && target.nodeName;

        if (!$(target).parents('#table tbody').length) {
            hideInputs(e);
        }

        switch (nodeName) {
            case 'INPUT':
                handleInput(target);
                break;
            case 'SPAN':
            //case 'LABEL':
                handleSpan(target);
                break;
            case undefined:
                //console.error(new Error("C'est pas possible!"));
                break;
            default:
                console.log(target, nodeName);
                break;
        }
    };

    /*
        Make sure that the realtime data structure has all the required fields
    */
    var prepareProxy = function (proxy, schema) {
        if (proxy && proxy.version === 1) { return; }
        console.log("Configuring proxy schema...");

        proxy.info = schema.info;
        proxy.table = schema.table;
        proxy.version = 1;
    };


    /*

    */
    var publish = APP.publish = function (bool) {
        if (!APP.ready) { return; }
        if (APP.proxy.published !== bool) {
            APP.proxy.published = bool;
        }
        if (bool) {
            APP.$publish.hide();
            APP.$admin.show();
            $('#create-option').hide();
            $('.remove[data-rt-id^="y"], .edit[data-rt-id^="y"]').hide();
        } else {
            APP.$publish.show();
            APP.$admin.hide();
            $('#create-option').show();
            $('.remove[data-rt-id^="y"], .edit[data-rt-id^="y"]').show();
        }

        ['textarea'].forEach(function (sel) {
            $(sel).attr('disabled', bool);
        });
    };

            var userData = APP.userData = {}; // List of pretty names for all users (mapped with their ID)
            var userList; // List of users still connected to the channel (server IDs)
            var addToUserData = function(data) {
                var users = userList ? userList.users : undefined;
                //var userData = APP.proxy.info.userData;
                for (var attrname in data) { userData[attrname] = data[attrname]; }

                if (users && users.length) {
                    for (var userKey in userData) {
                        if (users.indexOf(userKey) === -1) { delete userData[userKey]; }
                    }
                }

                if(userList && typeof userList.onChange === "function") {
                    userList.onChange(userData);
                }

                APP.proxy.info.userData = userData;
            };

            //var myData = {};
            var getLastName = function (cb) {
                Cryptpad.getAttribute('username', function (err, userName) {
                    cb(err, userName || '');
                });
            };

            var setName = APP.setName = function (newName) {
                if (typeof(newName) !== 'string') { return; }
                var myUserNameTemp = Cryptpad.fixHTML(newName.trim());
                if(myUserNameTemp.length > 32) {
                    myUserNameTemp = myUserNameTemp.substr(0, 32);
                }
                myUserName = myUserNameTemp;
                var myID = APP.myID;
                var myData = {}
                myData[myID] = {
                    name: myUserName
                };
                addToUserData(myData);
                Cryptpad.setAttribute('username', newName, function (err, data) {
                    if (err) {
                        console.error("Couldn't set username");
                        return;
                    }
                    APP.userName.lastName = myUserName;
                    //change();
                });
            };

            var updateTitle = function (newTitle) {
                if (newTitle === document.title) { return; }
                // Change the title now, and set it back to the old value if there is an error
                var oldTitle = document.title;
                document.title = newTitle;
                Cryptpad.renamePad(newTitle, function (err, data) {
                    if (err) {
                        console.log("Couldn't set pad title");
                        console.error(err);
                        document.title = oldTitle;
                        return;
                    }
                    document.title = data;
                    APP.$bar.find('.' + Toolbar.constants.title).find('span.title').text(data);
                    APP.$bar.find('.' + Toolbar.constants.title).find('input').val(data);
                });
            };

            var updateDefaultTitle = function (defaultTitle) {
                defaultName = defaultTitle;
                APP.$bar.find('.' + Toolbar.constants.title).find('input').attr("placeholder", defaultName);
            };
            var renameCb = function (err, title) {
                if (err) { return; }
                document.title = title;
                APP.proxy.info.title = title;
            };

            var suggestName = function (fallback) {
                return document.title || defaultName || "";
            };


    var copyObject = function (obj) {
        return JSON.parse(JSON.stringify(obj));
    };

    // special UI elements
    //var $title = $('#title').attr('placeholder', Messages.poll_titleHint || 'title'); TODO
    var $description = $('#description').attr('placeholder', Messages.poll_descriptionHint || 'description');

    var ready = function (info, userid, readOnly) {
        console.log("READY");
        console.log('userid: %s', userid);

        var proxy = APP.proxy;
        var uncommitted = APP.uncommitted = {};
        prepareProxy(proxy, copyObject(Render.Example));
        prepareProxy(uncommitted, copyObject(Render.Example));
        if (!readOnly && proxy.table.colsOrder.indexOf(userid) === -1 &&
            uncommitted.table.colsOrder.indexOf(userid) === -1) {
            uncommitted.table.colsOrder.unshift(userid);
        }

        var displayedObj = mergeUncommitted(proxy, uncommitted, false);

        var colsOrder = sortColumns(displayedObj.table.colsOrder, userid);

        var $table = APP.$table = $(Render.asHTML(displayedObj, null, colsOrder, readOnly));
        var $createRow = APP.$createRow = $('#create-option').click(function () {
            //
            console.error("BUTTON CLICKED! LOL");
            Render.createRow(proxy, function () {
                change();
            });
        });

        var $createCol = APP.$createCol = $('#create-user').click(function () {
            Render.createColumn(proxy, function () {
                change();
            });
        });

        // Commit button
        var $commit = APP.$commit = $('#commit').click(function () {
            var uncommittedCopy = JSON.parse(JSON.stringify(APP.uncommitted));
            APP.uncommitted = {};
            prepareProxy(APP.uncommitted, copyObject(Render.Example));
            mergeUncommitted(proxy, uncommittedCopy, true);
            APP.$commit.hide();
            change();
        });

        // Title
        if (APP.proxy.info.defaultTitle) {
            updateDefaultTitle(APP.proxy.info.defaultTitle);
        } else {
            APP.proxy.info.defaultTitle = defaultName
        }
        updateTitle(APP.proxy.info.title || defaultName);

        // Description
        $description.on('change keyup', function () {
            var val = $description.val();
            proxy.info.description = val;
        });
        if (typeof(proxy.info.description) !== 'undefined') {
            $description.val(proxy.info.description);
        }

        $('#tableScroll').prepend($table);
        updateDisplayedTable();

        $table
            .click(handleClick)
            .on('keyup', function (e) { handleClick(e, true); });

        proxy
            .on('change', ['info'], function (o, n, p) {
                if (p[1] === 'title') {
                    updateTitle(n);
                } else if (p[1] === "userData") {
                    addToUserData(APP.proxy.info.userData);
                } else if (p[1] === 'description') {
                    var op = TextPatcher.diff(o, n);
                    var el = $description[0];

                    var selects = ['selectionStart', 'selectionEnd'].map(function (attr) {
                        var before = el[attr];
                        var after = TextPatcher.transformCursor(el[attr], op);
                        return after;
                    });
                    $description.val(n);
                    if (op) {
                        el.selectionStart = selects[0];
                        el.selectionEnd = selects[1];
                    }
                }

                console.log("change: (%s, %s, [%s])", o, n, p.join(', '));
            })
            .on('change', ['table'], change)
            .on('remove', [], change);

        // #publish button is removed in readonly
        var $publish = APP.$publish = $('#publish')
            .click(function () {
                publish(true);
            });

        // #publish button is removed in readonly
        var $admin = APP.$admin = $('#admin')
            .click(function () {
                publish(false);
            });

        addToUserData(APP.proxy.info.userData);

        getLastName(function (err, lastName) {
            APP.ready = true;

            if (!proxy.published) {
                publish(false);
            } else {
                publish(true);
            }

            // Update the toolbar list:
            // Add the current user in the metadata if he has edit rights
            if (readOnly) { return; }
            if (typeof(lastName) === 'string' && lastName.length) {
                setName(lastName);
            } else {
                var myData = {};
                myData[info.myId] = {
                    name: ""
                };
                addToUserData(myData);
                APP.$userNameButton.click();
            }
        });
    };

    var create = function (info) {
        var realtime = APP.realtime = info.realtime;
        var myID = APP.myID = info.myID;

        var editHash;
        var viewHash = Cryptpad.getViewHashFromKeys(info.channel, secret.keys);

        if (!readOnly) {
            editHash = Cryptpad.getEditHashFromKeys(info.channel, secret.keys);
        }

        APP.patchText = TextPatcher.create({
            realtime: realtime,
            logging: true,
        });

        userList = APP.userList = info.userList;
        var config = {
            userData: userData,
            readOnly: readOnly,
            title: {
                onRename: renameCb,
                defaultName: defaultName,
                suggestName: suggestName
            },
            ifrw: window,
            common: Cryptpad
        };
        toolbar = info.realtime.toolbar = Toolbar.create(APP.$bar, info.myID, info.realtime, info.getLag, userList, config);

        var $bar = APP.$bar;
        var $rightside = $bar.find('.' + Toolbar.constants.rightside);
        var $userBlock = $bar.find('.' + Toolbar.constants.username);
        var $editShare = $bar.find('.' + Toolbar.constants.editShare);
        var $viewShare = $bar.find('.' + Toolbar.constants.viewShare);

        // Store the object sent for the "change username" button so that we can update the field value correctly
        var userNameButtonObject = APP.userName = {};
        /* add a "change username" button */
        getLastName(function (err, lastName) {
            userNameButtonObject.lastName = lastName;
            var $username = APP.$userNameButton = Cryptpad.createButton('username', false, userNameButtonObject, setName).hide();
            $userBlock.append($username);
        });

        /* add a forget button */
        var forgetCb = function (err, title) {
            if (err) { return; }
            document.title = title;
        };
        var $forgetPad = Cryptpad.createButton('forget', true, {}, forgetCb);
        $rightside.append($forgetPad);

        if (!readOnly) {
            $editShare.append(Cryptpad.createButton('editshare', false, {editHash: editHash}));
        }
        if (viewHash) {
            /* add a 'links' button */
            $viewShare.append(Cryptpad.createButton('viewshare', false, {viewHash: viewHash}));
            if (!readOnly) {
                $viewShare.append(Cryptpad.createButton('viewopen', false, {viewHash: viewHash}));
            }
        }

        // set the hash
        if (!readOnly) { Cryptpad.replaceHash(editHash); }

        Cryptpad.getPadTitle(function (err, title) {
            if (err) {
                console.error(err);
                console.log("Couldn't get pad title");
                return;
            }
            updateTitle(title || defaultName);
        });
    };

    var disconnect = function () {
        //setEditable(false); // TODO
        //Cryptpad.alert(Messages.common_connectionLost); // TODO
    };

    var config = {
        websocketURL: Cryptpad.getWebsocketURL(),
        channel: secret.channel,
        readOnly: readOnly,
        data: {},
        // our public key
        validateKey: secret.keys.validateKey || undefined,
        //readOnly: readOnly,
        crypto: Crypto.createEncryptor(secret.keys),
    };

    // don't initialize until the store is ready.
    Cryptpad.ready(function () {
        if (readOnly) {
            $('#commit, #create-user, #create-option, #publish').remove();
        }

        var parsedHash = Cryptpad.parsePadUrl(window.location.href);
        defaultName = Cryptpad.getDefaultName(parsedHash);
        var rt = window.rt = APP.rt = Listmap.create(config);
        APP.proxy = rt.proxy;
        rt.proxy
        .on('create', create)
        .on('ready', function (info) {
            Cryptpad.getPadAttribute('userid', function (e, userid) {
                if (e) { console.error(e); }
                if (userid === null) { userid = Render.coluid(); }
                APP.userid = userid;
                Cryptpad.setPadAttribute('userid', userid, function (e) {
                    ready(info, userid, readOnly);
                });
            });
        })
        .on('disconnect', disconnect);

        Cryptpad.getPadAttribute(HIDE_INTRODUCTION_TEXT, function (e, value) {
            if (e) { console.error(e); }
            if (value === null) {
                Cryptpad.setPadAttribute(HIDE_INTRODUCTION_TEXT, "1", function (e) {
                    if (e) { console.error(e) }
                });
            } else if (value === "1") {
                $('#howItWorks').hide();
            }
        });
    });
});


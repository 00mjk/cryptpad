define([
    '/common/messages.js'
], function (Messages) {

    /** Id of the element for getting debug info. */
    var DEBUG_LINK_CLS = 'rtwysiwyg-debug-link';

    /** Id of the div containing the user list. */
    var USER_LIST_CLS = 'rtwysiwyg-user-list';

    /** Id of the button to change my username. */
    var USERNAME_BUTTON_GROUP = 'cryptpad-changeName';

    /** Id of the div containing the lag info. */
    var LAG_ELEM_CLS = 'rtwysiwyg-lag';

    var SAVE_ELEMENT_CLS = 'cryptpad-saveContent';
    var LOAD_ELEMENT_CLS = 'cryptpad-loadContent';

    /** The toolbar class which contains the user list, debug link and lag. */
    var TOOLBAR_CLS = 'rtwysiwyg-toolbar';

    /** Key in the localStore which indicates realtime activity should be disallowed. */
    var LOCALSTORAGE_DISALLOW = 'rtwysiwyg-disallow';

    var SPINNER_DISAPPEAR_TIME = 3000;
    var SPINNER = [ '-', '\\', '|', '/' ];

    var uid = function () {
        return 'rtwysiwyg-uid-' + String(Math.random()).substring(2);
    };

    var createRealtimeToolbar = function ($container) {
        var id = uid();
        $container.prepend(
            '<div class="' + TOOLBAR_CLS + '" id="' + id + '">' +
                '<div class="rtwysiwyg-toolbar-leftside"></div>' +
                '<div class="rtwysiwyg-toolbar-rightside"></div>' +
            '</div>'
        );
        var toolbar = $container.find('#'+id);

        var swap = function (str, dict) {
            return str.replace(/\{\{(.*?)\}\}/g, function (all, block) {
                //console.log(block);
                return dict[block] || block;
            });
        };

        var css = swap(function(){/*
<style>
.{{TOOLBAR_CLS}} {
    color: #666;
    font-weight: bold;
    height: 26px;
    margin-bottom: -3px;
    display: inline-block;
    width: 100%;
}
.{{TOOLBAR_CLS}} a {
    float: right;
}
.{{TOOLBAR_CLS}} div {
    padding: 0 10px;
    height: 1.5em;
    line-height: 25px;
    height: 22px;
}
.{{TOOLBAR_CLS}} div.rtwysiwyg-back {
    padding: 0;
    font-weight: bold;
    cursor: pointer;
    color: #000;
}
.{{USERNAME_BUTTON_GROUP}} {
    float: left;
    cursor: pointer;
}
.{{USERNAME_BUTTON_GROUP}} button {
    padding: 0;
    margin-right: 5px;
}
.rtwysiwyg-toolbar-leftside div {
    float: left;
}
.rtwysiwyg-toolbar-leftside {
    float: left;
}
.rtwysiwyg-toolbar-rightside {
    float: right;
}
.rtwysiwyg-lag {
    float: right;
}
.rtwysiwyg-spinner {
    float: left;
}
.gwt-TabBar {
    display:none;
}
.{{DEBUG_LINK_CLS}}:link {
    color:transparent;
}
.{{DEBUG_LINK_CLS}}:link:hover {
    color:blue;
}
.gwt-TabPanelBottom {
    border-top: 0 none;
}
.{{TOOLBAR_CLS}} button {
    box-sizing: border-box;
    height: 101%;
    background-color: inherit;
    border: 1px solid #A6A6A6;
    border-radius: 5px;
    margin-right: 5px;
    padding-right: 5px;
    padding-left: 5px;
}
.{{TOOLBAR_CLS}} .{{SAVE_ELEMENT_CLS}}, .{{TOOLBAR_CLS}} .{{LOAD_ELEMENT_CLS}} {
    float: right;
    margin-right: 5px;
    cursor: pointer;
}
.{{TOOLBAR_CLS}} .{{SAVE_ELEMENT_CLS}}:after {
    content: 'EXPORT';
}

.{{TOOLBAR_CLS}} .{{LOAD_ELEMENT_CLS}}:after {
    content: 'IMPORT';
}
</style>
        */}.toString().slice(14,-3), {
            TOOLBAR_CLS: TOOLBAR_CLS,
            SAVE_ELEMENT_CLS: SAVE_ELEMENT_CLS,
            LOAD_ELEMENT_CLS: LOAD_ELEMENT_CLS,
            USERNAME_BUTTON_GROUP: USERNAME_BUTTON_GROUP,
            DEBUG_LINK_CLS: DEBUG_LINK_CLS,
        }).trim();

        toolbar.append(css);
        return toolbar;
    };

    var createEscape = function ($container) {
        var id = uid();
        $container.append('<div class="rtwysiwyg-back" id="' + id + '">&#8656; Back</div>');
        var $ret = $container.find('#'+id);
        $ret.on('click', function () {
            window.location.href = '/';
        });
        return $ret[0];
    };

    var createSpinner = function ($container) {
        var id = uid();
        $container.append('<div class="rtwysiwyg-spinner" id="'+id+'"></div>');
        return $container.find('#'+id)[0];
    };

    var kickSpinner = function (spinnerElement, reversed) {
        var txt = spinnerElement.textContent || '-';
        var inc = (reversed) ? -1 : 1;
        spinnerElement.textContent = SPINNER[(SPINNER.indexOf(txt) + inc) % SPINNER.length];
        if (spinnerElement.timeout) { clearTimeout(spinnerElement.timeout); }
        spinnerElement.timeout = setTimeout(function () {
            spinnerElement.textContent = '';
        }, SPINNER_DISAPPEAR_TIME);
    };

    var createUserList = function ($container) {
        var id = uid();
        $container.append('<div class="' + USER_LIST_CLS + '" id="'+id+'"></div>');
        return $container.find('#'+id)[0];
    };

    var getOtherUsers = function(myUserName, userList, userData) {
      var i = 0;
      var list = '';
      userList.forEach(function(user) {
        if(user !== myUserName) {
          var data = (userData) ? (userData[user] || null) : null;
          var userName = (data) ? data.name : null;
          if(userName) {
            if(i === 0) { list = ' : '; }
            list += userName + ', ';
            i++;
          }
        }
      });
      return (i > 0) ? list.slice(0, -2) : list;
    };

    var createChangeName = function($container, userList, buttonID) {
        var id = uid();
        userList.innerHTML = '<button id="' + buttonID + '" class="'+USERNAME_BUTTON_GROUP+'" >Change name</button><span id="' + id + '"></span>';
        return $container.find('#'+id)[0];
    };

    var updateUserList = function (myUserName, listElement, userList, userData) {
        var meIdx = userList.indexOf(myUserName);
        if (meIdx === -1) {
            listElement.textContent = Messages.synchronizing;
            return;
        }
        if (userList.length === 1) {
            listElement.innerHTML = Messages.editingAlone;
        } else if (userList.length === 2) {
            listElement.innerHTML = Messages.editingWithOneOtherPerson + getOtherUsers(myUserName, userList, userData);
        } else {
            listElement.innerHTML = Messages.editingWith + ' ' + (userList.length - 1) + ' ' + Messages.otherPeople + getOtherUsers(myUserName, userList, userData);
        }
    };

    var createLagElement = function ($container) {
        var id = uid();
        $container.append('<div class="' + LAG_ELEM_CLS + '" id="'+id+'"></div>');
        return $container.find('#'+id)[0];
    };

    var createSaveElement = function (id, $container) {
        $container.append('<button class="'+ SAVE_ELEMENT_CLS + '" id="' + id + '"></button>');
        return $container.find('#'+id)[0];
    };

    var createLoadElement = function (id, $container) {
        $container.append('<button class="'+ LOAD_ELEMENT_CLS + '" id="' + id + '"></button>');
        return $container.find('#'+id)[0];
    };

    var checkLag = function (getLag, lagElement) {
        if(typeof getLag !== "function") { return; }
        var lag = getLag();
        var lagMsg = Messages.lag + ' ';
        if(lag) {
          var lagSec = lag/1000;
          if (lag.waiting && lagSec > 1) {
              lagMsg += "?? " + Math.floor(lagSec);
          } else {
              lagMsg += lagSec;
          }
        }
        else {
          lagMsg += "??";
        }
        lagElement.textContent = lagMsg;
    };

    var create = function ($container, myUserName, realtime, getLag, userList, config) {
        var toolbar = createRealtimeToolbar($container);
        createEscape(toolbar.find('.rtwysiwyg-toolbar-leftside'));
        var userListElement = createUserList(toolbar.find('.rtwysiwyg-toolbar-leftside'));
        var spinner = createSpinner(toolbar.find('.rtwysiwyg-toolbar-rightside'));
        var lagElement = createLagElement(toolbar.find('.rtwysiwyg-toolbar-rightside'));
        var userData = config.userData;
        var changeNameID = config.changeNameID;
        var saveContentID = config.saveContentID || config.exportContentID;
        var loadContentID = config.loadContentID || config.importContentID;
        var saveElement;
        var loadElement;

        // Check if the user is allowed to change his name
        if(changeNameID) {
            // Create the button and update the element containing the user list
            userListElement = createChangeName($container, userListElement, changeNameID);
        }

        if (saveContentID) {
            saveElement = createSaveElement(saveContentID, toolbar.find('.rtwysiwyg-toolbar-rightside'));
        }

        if (loadContentID) {
            loadElement = createLoadElement(loadContentID, toolbar.find('.rtwysiwyg-toolbar-rightside'));
        }

        var connected = false;

        userList.onChange = function(newUserData) {
          var users = userList.users;
          if (users.indexOf(myUserName) !== -1) { connected = true; }
          if (!connected) { return; }
          if(newUserData) { // Someone has changed his name/color
            userData = newUserData;
          }
          updateUserList(myUserName, userListElement, users, userData);
        };

        var ks = function () {
            if (connected) { kickSpinner(spinner, false); }
        };

        realtime.onPatch(ks);
        // Try to filter out non-patch messages, doesn't have to be perfect this is just the spinner
        realtime.onMessage(function (msg) { if (msg.indexOf(':[2,') > -1) { ks(); } });

        setInterval(function () {
            if (!connected) { return; }
            checkLag(getLag, lagElement);
        }, 3000);

        return {
            failed: function () {
                connected = false;
                userListElement.textContent = '';
                lagElement.textContent = '';
            },
            reconnecting: function () {
                connected = false;
                userListElement.textContent = Messages.reconnecting;
                lagElement.textContent = '';
            },
            connected: function () {
                connected = true;
            }
        };
    };

    return { create: create };
});

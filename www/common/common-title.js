define(function () {
    var module = {};

    module.create = function (cfg, onLocal, Cryptpad) {
        var exp = {};

        var parsed = exp.parsedHref = Cryptpad.parsePadUrl(window.location.href);
        exp.defaultTitle = Cryptpad.getDefaultName(parsed);

        exp.title = document.title; // TOOD slides

        var getHeadingText = cfg.getHeadingText || function () { return; };
        var updateLocalTitle = function (newTitle) {
            exp.title = newTitle;
            if (typeof cfg.updateLocalTitle === "function") {
                cfg.updateLocalTitle(newTitle);
            } else {
                document.title = newTitle;
            }
        };

        var $title;
        exp.setToolbar = function (toolbar) {
            $title = toolbar && toolbar.title;
        }

        exp.getTitle = function () { return exp.title; };
        var isDefaultTitle = exp.isDefaultTitle = function (){return exp.title === exp.defaultTitle;};

        var suggestTitle = exp.suggestTitle = function (fallback) {
            if (isDefaultTitle()) {
                return getHeadingText() || fallback || "";
            } else {
                return exp.title || getHeadingText() || exp.defaultTitle;
            }
        };

        var renameCb = function (err, newTitle) {
            if (err) { return; }
            updateLocalTitle(newTitle);
            console.log('here');
            onLocal();
        };

        exp.updateTitle = function (newTitle) {
            if (newTitle === exp.title) { return; }
            // Change the title now, and set it back to the old value if there is an error
            var oldTitle = exp.title;
            Cryptpad.renamePad(newTitle, function (err, data) {
                if (err) {
                    console.log("Couldn't set pad title");
                    console.error(err);
                    updateLocalTitle(oldTitle);
                    return;
                }
                updateLocalTitle(data);
                if (!$title) { return; }
                $title.find('span.title').text(data);
                $title.find('input').val(data);
            });
        };

        exp.updateDefaultTitle = function (newDefaultTitle) {
            exp.defaultTitle = newDefaultTitle;
            if (!$title) { return; }
            $title.find('input').attr("placeholder", exp.defaultTitle);
        };

        exp.getTitleConfig = function () {
            return {
                onRename: renameCb,
                suggestName: suggestTitle,
                defaultName: exp.defaultTitle
            }
        };

        return exp;
    };

    return module;
});


define([
    'jquery',
    '/common/diffMarked.js',
],function ($, DiffMd) {

    var Slide = {
        index: 0,
        lastIndex: 0,
        content: [],
        changeHandlers: [],
    };
    var ifrw;
    var $modal;
    var $content;
    var placeholder;
    var options;
    var separator = '<hr data-pewpew="pezpez">';
    var separatorReg = /<hr data\-pewpew="pezpez">/g;
    var slideClass = 'cp-app-slide-frame';
    var Title;
    var Common;

    Slide.onChange = function (f) {
        if (typeof(f) === 'function') {
            Slide.changeHandlers.push(f);
        }
    };

    var getNumberOfSlides = Slide.getNumberOfSlides = function () {
        return $content.find('.' + slideClass).length;
    };

    var change = function (oldIndex, newIndex) {
        if (Slide.changeHandlers.length) {
            Slide.changeHandlers.some(function (f) {
                f(oldIndex, newIndex, getNumberOfSlides());
            });
        }
    };

    var updateFontSize = Slide.updateFontSize = function () {
        // 20vh
        // 20 * 16 / 9vw
        var wbase = 20;
        var vh = 20;
        var $elem = $(window);
        if (!Slide.shown) {
            wbase = 10;
            vh *= $content.height()/$(window).height();
            $elem = $content;
        }
        if ($elem.width() > 16/9*$elem.height()) {
            $content.css('font-size', vh+'vh');
            // $print.css('font-size', '20vh');
            return;
        }
        $content.css('font-size', (wbase*9/16)+'vw');
        // $print.css('font-size', (20*9/16)+'vw');
    };

    var fixCSS = function (css) {
        var append = '.cp #cp-app-slide-print .cp-app-slide-frame ';
        var append2 = '.cp div#cp-app-slide-modal #cp-app-slide-modal-content .cp-app-slide-frame ';
        return css.replace(/(\n*)([^\n}]+)\s*\{/g, '$1' + append + '$2,' + append2 + '$2 {');
    };

    var goTo = Slide.goTo = function (i) {
        i = i || 0;
        Slide.index = i;
        $content.find('.cp-app-slide-container').first().css('margin-left', -(i*100)+'%');
        updateFontSize();
        change(Slide.lastIndex, Slide.index);
        $modal.find('#cp-app-slide-modal-left > span').css({
            opacity: Slide.index === 0? 0: 1
        });
        $modal.find('#cp-app-slide-modal-right > span').css({
            opacity: Slide.index === (getNumberOfSlides() -1)? 0: 1
        });
    };
    var draw = Slide.draw =  function (i) {
        if (typeof(Slide.content) !== 'string') { return; }

        var c = Slide.content;
        var m = '<span class="cp-app-slide-container"><span class="'+slideClass+'">'+DiffMd.render(c).replace(separatorReg, '</span></span><span class="cp-app-slide-container"><span class="'+slideClass+'">')+'</span></span>';

        DiffMd.apply(m, $content);

        var length = getNumberOfSlides();
        $modal.find('style.cp-app-slide-style').remove();
        if (options.style && Slide.shown) {
            $modal.prepend($('<style>', {'class': 'cp-app-slide-style'}).text(fixCSS(options.style)));
        }
        $content.find('.cp-app-slide-frame').each(function (i, el) {
            if (options.slide) {
                $('<div>', {'class': 'cp-app-slide-number'}).text((i+1)+'/'+length).appendTo($(el));
            }
            if (options.date) {
                $('<div>', {'class': 'cp-app-slide-date'}).text(new Date().toLocaleDateString()).appendTo($(el));
            }
            if (options.title) {
                $('<div>', {'class': 'cp-app-slide-title'}).text(Title.title).appendTo($(el));
            }
        });
        $content.removeClass('cp-app-slide-transition');
        if (options.transition || typeof(options.transition) === "undefined") {
            $content.addClass('cp-app-slide-transition');
        }
        //$content.find('.' + slideClass).hide();
        //$content.find('.' + slideClass + ':eq( ' + i + ' )').show();
        //$content.css('margin-left', -(i*100)+'vw');
        goTo(Math.min(i, getNumberOfSlides() - 1));
    };

    Slide.updateOptions = function () {
        draw(Slide.index);
    };

    var show = Slide.show = function (bool, content) {
        Slide.shown = bool;
        if (bool) {
            Slide.update(content);
            Slide.draw(Slide.index);
            $modal.addClass('cp-app-slide-shown');
            $(ifrw).focus();
            change(null, Slide.index);
            Common.setPresentUrl(true);
            $('.cp-app-slide-present-button').hide();
            updateFontSize();
            return;
        }
        Common.setPresentUrl(false);
        change(Slide.index, null);
        $('.cp-app-slide-present-button').show();
        $('.cp-app-slide-source-button').hide();
        $modal.removeClass('cp-app-slide-shown');
        updateFontSize();
    };

    Slide.update = function (content) {
        updateFontSize();
        if (!content) { content = ''; }
        var old = Slide.content;
        Slide.content = content.replace(/\n\s*\-\-\-\s*\n/g, '\n\n'+separator+'\n\n');
        if (old !== Slide.content) {
            draw(Slide.index);
            return;
        }
        change(Slide.lastIndex, Slide.index);
    };

    Slide.left = function () {
        console.log('left');
        Slide.lastIndex = Slide.index;

        var i = Slide.index = Math.max(0, Slide.index - 1);
        Slide.goTo(i);
    };

    Slide.right = function () {
        console.log('right');
        Slide.lastIndex = Slide.index;

        var i = Slide.index = Math.min(getNumberOfSlides() -1, Slide.index + 1);
        Slide.goTo(i);
    };

    Slide.first = function () {
        console.log('first');
        Slide.lastIndex = Slide.index;

        var i = Slide.index = 0;
        Slide.goTo(i);
    };

    Slide.last = function () {
        console.log('end');
        Slide.lastIndex = Slide.index;

        var i = Slide.index = getNumberOfSlides() - 1;
        Slide.goTo(i);
    };

    var addEvent = function () {
        console.log($modal);
        var icon_to;
        $modal.mousemove(function () {
            var $buttons = $modal.find('.cp-app-slide-modal-button');
            $buttons.show();
            if (icon_to) { window.clearTimeout(icon_to); }
            icon_to = window.setTimeout(function() {
                $buttons.fadeOut();
            }, 1000);
        });
        $modal.find('#cp-app-slide-modal-exit').click(function () {
            var ev = $.Event("keyup");
            ev.which = 27;
            $modal.trigger(ev);
        });
        $modal.find('#cp-app-slide-modal-left').click(function () {
            var ev = $.Event("keyup");
            ev.which = 37;
            $modal.trigger(ev);
        });
        $modal.find('#cp-app-slide-modal-right').click(function () {
            console.log('right');
            var ev = $.Event("keyup");
            ev.which = 39;
            $modal.trigger(ev);
        });

        $('.CodeMirror').keyup(function (e) { e.stopPropagation(); });
        $(ifrw).on('keyup', function (e) {
            //if (!Slide.shown) { return; }
            if (e.ctrlKey) { return; }
            switch(e.which) {
                case 33: // pageup
                case 38: // up
                case 37: // left
                    Slide.left();
                    break;
                case 34: // pagedown
                case 32: // space
                case 40: // down
                case 39: // right
                    Slide.right();
                    break;
                case 36: // home
                    Slide.first();
                    break;
                case 35: // end
                    Slide.last();
                    break;
                case 27: // esc
                    show(false);
                    break;
                default:
                    console.log(e.which);
            }
        });
    };

    // Swipe
    var addSwipeEvents = function () {
        var touch = {
            maxTime: 2000,
            minXDist: 150,
            maxYDist: 100
        };

        var resetSwipe = function () {
            touch.x = 0;
            touch.y = 0;
            touch.time = 0;
        };

        $content.on('touchstart', function (e) {
            e.preventDefault();
            resetSwipe();
            var t = e.originalEvent.changedTouches[0];
            touch.x = t.pageX;
            touch.y = t.pageY;
            touch.time = new Date().getTime();
        });

        $content.on('touchend', function (e) {
            e.preventDefault();
            var t = e.originalEvent.changedTouches[0];
            var xDist = t.pageX - touch.x;
            var yDist = t.pageY - touch.y;
            var time = new Date().getTime() - touch.time;
            if (time <= touch.maxTime && Math.abs(xDist) >= touch.minXDist && Math.abs(yDist) <= touch.maxYDist) {
                if (xDist < 0) {
                    Slide.right();
                    return;
                }
                Slide.left();
            }
        });

        $content.on('touchmove', function (e){
            e.preventDefault();
        });
    };


    Slide.setModal = function (common, $m, $c, opt, ph) {
        Common = common;
        $modal = Slide.$modal = $m;
        $content = Slide.$content = $c;
        ifrw = Slide.ifrw = window;
        placeholder = Slide.placeholder = ph;
        options = Slide.options = opt;
        addEvent();
        addSwipeEvents();
        $(window).resize(Slide.updateFontSize);
    };

    Slide.setTitle = function (titleObj) {
        Title = titleObj;
    };

    return Slide;
});

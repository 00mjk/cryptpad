define([
    '/common/treesome.js',
    '/bower_components/rangy/rangy-core.min.js'
], function (Tree, Rangy, saveRestore) {
    window.Rangy = Rangy;
    window.Tree = Tree;
    // do some function for the start and end of the cursor

    var log = function (x) { console.log(x); };
    var error = function (x) { console.log(x); };
    var verbose = function (x) { if (window.verboseMode) { console.log(x); } };

    /* accepts the document used by the editor */
    return function (inner) {
        var cursor = {};

        // there ought to only be one cursor at a time, so let's just
        // keep it internally
        var Range = cursor.Range = {
            start: {
                el: null,
                offset: 0
            },
            end: {
                el: null,
                offset:0
            }
        };

        // assumes a negative index
        var seekLeft = cursor.seekLeft = function (el, delta, current) {
            var textLength;
            var previous;

            // normalize

            if (-delta >= current) {
                delta += current;
                current = 0;
            } else {
                current += delta;
                delta = 0;
            }

            while (delta) {
                previous = el;
                el = Tree.previousNode(el, inner);
                if (el) {
                    textLength = el.textContent.length;
                    if (-delta > textLength) {
                        delta -= textLength;
                    } else {
                        current = textLength + delta;
                        delta = 0;
                    }
                } else {
                    return {
                        el: previous,
                        offset: 0,
                        error: "out of bounds"
                    };
                }
            }
            return {
                el: el,
                offset: current
            };
        };

        // seekRight assumes a positive delta
        var seekRight = cursor.seekRight = function (el, delta, current) {
            var textLength;
            var previous;

            // normalize
            delta += current;
            current = 0;

            while (delta) {
                if (el) {
                    textLength = el.textContent.length;
                    if (delta >= textLength) {
                        delta -= textLength;
                        previous = el;
                        el = Tree.nextNode(el, inner);
                    } else {
                        current = delta;
                        delta = 0;
                    }
                } else {
                    // don't ever return a negative index
                    if (previous.textContent.length) {
                        textLength = previous.textContent.length - 1;
                    } else {
                        textLength = 0;
                    }
                    return {
                        el: previous,
                        offset: textLength,
                        error: "out of bounds"
                    };
                }
            }
            return {
                el: el,
                offset: current
            };
        };

        var seekToDelta = cursor.seekToDelta = function (el, delta, current) {
            var result = null;
            if (el) {
                if (delta < 0)  {
                    return seekLeft(el, delta, current);
                } else if (delta > 0) {
                    return seekRight(el, delta, current);
                } else {
                    result = {
                        el: el,
                        offset: current
                    };
                }
            } else {
                error("[cursor.seekToDelta] el is undefined");
            }
            return result;
        };

        var checkFromEnd = cursor.checkFromEnd = function (root, predicate) {
            var last = Tree.rightmostNode(root);
            var success = false;
            var i = 0;
            while (last && !success) {
                success = predicate(last, i++);
                last = Tree.previousNode(last, root);
            }
            return success;
        };

        /*  uses closure to capture the root node because I'm lazy

        */
        var getTrailingNodes = cursor.getTrailingNodes = function (el) {
            var trailing = [];
            var success = cursor.checkFromEnd(inner, function (cur) {
                if (cur === el) {
                    trailing.push(cur);
                    return true;
                } else { trailing.push(cur); }
            });
            return success && trailing;
        };

        var recoverNodeByTrailing = cursor.recoverNodeByTrailing = function (trailing) {
            // clone the array
            var T = trailing.slice(0);
            var L = T.length;
            var el = null;
            cursor.checkFromEnd(inner, function (cur, i) {
                if (i >= L) {
                    //console.log("[cursor.recoverNodeByTrailing] out of bounds");
                    return true;
                } else {
                    if (cur.nodeName !== T[i].nodeName) {
                        console.log("[cursor.recoverNodeByTrailing] false name");
                        console.log(cur);
                        return true;
                    } else if (cur.nodeName === T[i].nodeName && i === L - 1) {
                        el = cur;
                        return true;
                    } else {
                        return false;
                    }
                }
            });
            return el;
        };

        /* cursor.find uses information produced by side effects of 'update'
            to recover the cursor
        */
        cursor.find = function () {
            ['start', 'end'].forEach(function (pos) {
                // is this metric even reliable?
                var node;
                var trailing = Range[pos].trailing;
                if (Range[pos].lost) {
                    if (trailing.length) {
                        // use the trailing nodes to find the node..
                        node = recoverNodeByTrailing(trailing);
                    }
                    if (node) {
                        // if that worked....great!
                        Range[pos].el = node;

                    } else {
                        // if not, try falling back to the nearest parent?

                    }
                } else {
                    // it wasn't lost, you don't need to do anything.
                }

            });
        };

        /*  cursor.update takes notes about wherever the cursor was last seen
            in the event of a cursor loss, the information produced by side
            effects of this function should be used to recover the cursor

            returns an error string if no range is found
        */
        cursor.update = function (sel, root) {
            verbose("cursor.update");
            root = root || inner;
            sel = sel || Rangy.getSelection(root);
            // FIXME under what circumstances are no ranges found?
            if (!sel.rangeCount) {
                error('[cursor.update] no ranges found');
                //return 'no ranges found';
            }
            var range = sel.getRangeAt(0);

            // Big R Range is caught in closure, and maintains persistent state
            ['start', 'end'].forEach(function (pos) {
                Range[pos].el = range[pos+'Container'];
                Range[pos].offset = range[pos+'Offset'];
            });
        };

        /*  0 -> neither is lost
            1 -> start is lost
            2 -> end is lost
            3 -> both are lost */
        /*  sometimes the selection gets dropped and this doesn't realize it
            figure out why (TODO FIXME) */
        var isLost = cursor.isLost = function () {
            var state = ['start', 'end'].map(function (pos, i) {
                return Tree.contains(Range[pos].el, inner)? 0 : i + 1;
            });
            return state[0] | state[1];
        };

        var exists = cursor.exists = function () {
            return (Range.start.el?1:0) | (Range.end.el?2:0);
        };

        /*
            0 if neither
            1 if start
            2 if end
            3 if start and end
        */
        var inNode = cursor.inNode = function (el) {
            var state = ['start', 'end'].map(function (pos, i) {
                return Tree.contains(el, Range[pos].el)? i +1: 0;
            });
            return state[0] | state[1];
        };

        var confineOffsetToElement = cursor.confineOffsetToElement = function (el, offset) {
            return Math.max(Math.min(offset, el.textContent.length), 0);
        };

        var makeSelection = cursor.makeSelection = function () {
            var sel = Rangy.getSelection(inner);
            return sel;
        };

        var makeRange = cursor.makeRange = function () {
            return Rangy.createRange();
        };

        var fixStart = cursor.fixStart = function (el, offset) {
            Range.start.el = el;
            Range.start.offset = confineOffsetToElement(el, 
                (typeof offset !== 'undefined') ? offset : Range.start.offset);
        };

        var fixEnd = cursor.fixEnd = function (el, offset) {
            Range.end.el = el;
            Range.end.offset = confineOffsetToElement(el,
                (typeof offset !== 'undefined') ? offset : Range.end.offset);
        };

        var fixSelection = cursor.fixSelection = function (sel, range) {
            if (Tree.contains(Range.start.el, inner) && Tree.contains(Range.end.el, inner)) {
                var order = Tree.orderOfNodes(Range.start.el, Range.end.el, inner);
                var backward;

                // this could all be one line but nobody would be able to read it
                if (order === -1) {
                    // definitely backward
                    backward = true;
                } else if (order === 0) {
                    // might be backward, check offsets to know for sure
                    backward = (Range.start.offset > Range.end.offset);
                } else {
                    // definitely not backward
                    backward = false;
                }

                if (backward) {
                    range.setStart(Range.end.el, Range.end.offset);
                    range.setEnd(Range.start.el, Range.start.offset);
                } else {
                    range.setStart(Range.start.el, Range.start.offset);
                    range.setEnd(Range.end.el, Range.end.offset);
                }

                // actually set the cursor to the new range
                sel.setSingleRange(range);
            } else {
                var errText = "[cursor.fixSelection] At least one of the "+
                    "cursor nodes did not exist, could not fix selection";
                console.error(errText);
                return errText;
            }
        };

        var pushDelta = cursor.pushDelta = function (oldVal, newVal, offset) {
            if (oldVal === newVal) { return; }
            var commonStart = 0;
            while (oldVal.charAt(commonStart) === newVal.charAt(commonStart)) {
                commonStart++;
            }

            var commonEnd = 0;
            while (oldVal.charAt(oldVal.length - 1 - commonEnd) === newVal.charAt(newVal.length - 1 - commonEnd) &&
                commonEnd + commonStart < oldVal.length && commonEnd + commonStart < newVal.length) {
                commonEnd++;
            }

            var insert = false, remove = false;
            if (oldVal.length !== commonStart + commonEnd) {
                // there was a removal?
                remove = true;
            }
            if (newVal.length !== commonStart + commonEnd) {
                // there was an insertion?
                insert = true;
            }

            var lengthDelta = newVal.length - oldVal.length;

            return {
                commonStart: commonStart,
                commonEnd: commonEnd,
                delta: lengthDelta,
                insert: insert,
                remove: remove
            };
        };

        /* FIXME for some reason this only works when we pass in 3 */
        var recover = cursor.recover = function (lost) {
            var sel = Rangy.getSelection(inner);

            // create a range to modify
            var range = Rangy.createRange();

            /* FIXME verify offsets as well */
            if (lost & 1) {
                Range.start.el = recoverNodeByTrailing(Range.start.trailing);
            }
            if (lost & 2) {
                Range.end.el = recoverNodeByTrailing(Range.end.trailing);
            }

            // TODO ensure that the nodes actually exist...

            /*  if range is backwards, cursor.delta fails
                so check if they're in the expected order
                before setting the new range */
            var order = Tree.orderOfNodes(Range.start.el, Range.end.el, inner);
            var backward;

            // this could all be one line but nobody would be able to read it
            if (order === -1) {
                // definitely backward
                backward = true;
            } else if (order === 0) {
                // might be backward, check offsets to know for sure
                backward = (Range.start.offset > Range.end.offset);
            } else {
                // definitely not backward
                backward = false;
            }

            if (backward) {
                range.setStart(Range.end.el, Range.end.offset);
                range.setEnd(Range.start.el, Range.start.offset);
            } else {
                range.setStart(Range.start.el, Range.start.offset);
                range.setEnd(Range.end.el, Range.end.offset);
            }

            // actually set the cursor to the new range
            sel.setSingleRange(range);
        };

        /* getLength assumes that both nodes exist inside of the active editor.  */
        var getLength = cursor.getLength = function () {
            if (Range.start.el === Range.end.el) {
                if (Range.start.offset === Range.end.offset) { return 0; }
                if (Range.start.offset < Range.end.offset) {
                    return Range.end.offset - Range.start.offset;
                } else {
                    return Range.start.offset - Range.end.offset;
                }
            } else {
                var order = Tree.orderOfNodes(Range.start.el, Range.end.el, inner);
                var L;
                var cur;

                /*
                    we know that the cursor elements are different, and that we
                    must traverse to find the total length. We also know the
                    order of the nodes (probably 1 or -1)
                */
                if (order === 1) {
                    L = (Range.start.el.textContent.length - Range.start.offset);
                    cur = Tree.nextNode(Range.start.el, inner);
                    while (cur && cur !== Range.end.el) {
                        L += cur.textContent.length;
                        cur = Tree.nextNode(cur, inner);
                    }
                    L += Range.end.offset;
                    return L;
                } else if (order === -1) {
                    L = (Range.end.el.textContent - Range.end.offset);
                    cur = Tree.nextNode(Range.end.el, inner);
                    while (cur && cur !== Range.start.el) {
                        L += cur.textContent.length;
                        cur = Tree.nextNode(cur, inner);
                    }
                    L += Range.start.offset;
                    return -L;
                } else {
                    console.error("unexpected ordering of nodes...");
                    return null;
                    // ???
                }
            }
        };

        cursor.delta = function (delta1, delta2) {
            var sel = Rangy.getSelection(inner);
            delta2 = (typeof delta2 !== 'undefined') ? delta2 : delta1;

            // update returns errors if there are problems
            // and updates the persistent Range object
            var err = cursor.update(sel, inner);
            if (err) { return err; }

            // create a range to modify
            var range = Rangy.createRange();

            /*
                The assumption below is that Range.(start|end).el
                actually exists. This might not be the case.
                TODO check if start and end elements are defined
            */

            // using infromation about wherever you were last...
            // move both parts by some delta
            var start = seekToDelta(Range.start.el, delta1, Range.start.offset);
            var end = seekToDelta(Range.end.el, delta2, Range.end.offset);

            /*  if range is backwards, cursor.delta fails
                so check if they're in the expected order
                before setting the new range */

            var order = Tree.orderOfNodes(start.el, end.el, inner);
            var backward;

            // this could all be one line but nobody would be able to read it
            if (order === -1) {
                // definitely backward
                backward = true;
            } else if (order === 0) {
                // might be backward, check offsets to know for sure
                backward = (start.offset > end.offset);
            } else {
                // definitely not backward
                backward = false;
            }

            if (backward) {
                range.setStart(end.el, end.offset);
                range.setEnd(start.el, start.offset);
            } else {
                range.setStart(start.el, start.offset);
                range.setEnd(end.el, end.offset);
            }

            // actually set the cursor to the new range
            sel.setSingleRange(range);
            return {
                startError: start.error,
                endError: end.error
            };
        };

        return cursor;
    };
});

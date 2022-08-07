(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LayoutConstants = void 0;
var DEFAULT_TIME_SCALE = 60; // Dimensions

var LayoutConstants = {
  LINE_HEIGHT: 26,
  DIAMOND_SIZE: 10,
  MARKER_TRACK_HEIGHT: 60,
  width: 600,
  height: 200,
  TIMELINE_SCROLL_HEIGHT: 0,
  LEFT_PANE_WIDTH: 250,
  time_scale: DEFAULT_TIME_SCALE,
  // number of pixels to 1 second
  default_length: 20,
  // seconds
  DEFAULT_TIME_SCALE: DEFAULT_TIME_SCALE
};
exports.LayoutConstants = LayoutConstants;

},{}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Theme = void 0;
var Theme = {
  // photoshop colors
  a: '#343434',
  b: '#535353',
  c: '#b8b8b8',
  d: '#d6d6d6'
};
exports.Theme = Theme;

},{}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Timeliner = Timeliner;

var _util_undo = require("./utils/util_undo.js");

var _util_dispatcher = require("./utils/util_dispatcher.js");

var _theme = require("./theme.js");

var _layout_constants = require("./layout_constants.js");

var _utils = require("./utils/utils.js");

var _layer_cabinet = require("./views/layer_cabinet.js");

var _panel = require("./views/panel.js");

var _icon_button = require("./ui/icon_button.js");

var _scrollbar = require("./ui/scrollbar.js");

var _util_datastore = require("./utils/util_datastore.js");

var _docking_window = require("./utils/docking_window.js");

/*
 * @author Joshua Koo http://joshuakoo.com
 */
var TIMELINER_VERSION = "2.0.0-dev";
var style = _utils.utils.style;
var saveToFile = _utils.utils.saveToFile;
var openAs = _utils.utils.openAs;
var STORAGE_PREFIX = _utils.utils.STORAGE_PREFIX;
var Z_INDEX = 999;

function LayerProp(name) {
  this.name = name;
  this.values = [];
  this._value = 0;
  this._color = '#' + (Math.random() * 0xffffff | 0).toString(16);
  /*
  this.max
  this.min
  this.step
  */
}

function Timeliner(target) {
  // Dispatcher for coordination
  var dispatcher = new _util_dispatcher.Dispatcher(); // Data

  var data = new _util_datastore.DataStore();
  var layer_store = data.get('layers');
  var layers = layer_store.value;
  window._data = data; // expose it for debugging
  // Undo manager

  var undo_manager = new _util_undo.UndoManager(dispatcher); // Views

  var timeline = new _panel.TimelinePanel(data, dispatcher);
  var layer_panel = new _layer_cabinet.LayerCabinet(data, dispatcher);
  setTimeout(function () {
    // hack!
    undo_manager.save(new _util_undo.UndoState(data, 'Loaded'), true);
  });
  dispatcher.on('keyframe', function (layer, value) {
    var index = layers.indexOf(layer);
    var t = data.get('ui:currentTime').value;

    var v = _utils.utils.findTimeinLayer(layer, t); // console.log(v, '...keyframe index', index, utils.format_friendly_seconds(t), typeof(v));
    // console.log('layer', layer, value);


    if (typeof v === 'number') {
      layer.values.splice(v, 0, {
        time: t,
        value: value,
        _color: '#' + (Math.random() * 0xffffff | 0).toString(16)
      });
      undo_manager.save(new _util_undo.UndoState(data, 'Add Keyframe'));
    } else {
      console.log('remove from index', v);
      layer.values.splice(v.index, 1);
      undo_manager.save(new _util_undo.UndoState(data, 'Remove Keyframe'));
    }

    repaintAll();
  });
  dispatcher.on('keyframe.move', function (layer, value) {
    undo_manager.save(new _util_undo.UndoState(data, 'Move Keyframe'));
  }); // dispatcher.fire('value.change', layer, me.value);

  dispatcher.on('value.change', function (layer, value, dont_save) {
    if (layer._mute) return;
    var t = data.get('ui:currentTime').value;

    var v = _utils.utils.findTimeinLayer(layer, t); // console.log(v, 'value.change', layer, value, utils.format_friendly_seconds(t), typeof(v));


    if (typeof v === 'number') {
      layer.values.splice(v, 0, {
        time: t,
        value: value,
        _color: '#' + (Math.random() * 0xffffff | 0).toString(16)
      });
      if (!dont_save) undo_manager.save(new _util_undo.UndoState(data, 'Add value'));
    } else {
      v.object.value = value;
      if (!dont_save) undo_manager.save(new _util_undo.UndoState(data, 'Update value'));
    }

    repaintAll();
  });
  dispatcher.on('action:solo', function (layer, solo) {
    layer._solo = solo;
    console.log(layer, solo); // When a track is solo-ed, playback only changes values
    // of that layer.
  });
  dispatcher.on('action:mute', function (layer, mute) {
    layer._mute = mute; // When a track is mute, playback does not play
    // frames of those muted layers.
    // also feels like hidden feature in photoshop
    // when values are updated, eg. from slider,
    // no tweens will be created.
    // we can decide also to "lock in" layers
    // no changes to tween will be made etc.
  });
  dispatcher.on('ease', function (layer, ease_type) {
    var t = data.get('ui:currentTime').value;

    var v = _utils.utils.timeAtLayer(layer, t); // console.log('Ease Change > ', layer, value, v);


    if (v && v.entry) {
      v.entry.tween = ease_type;
    }

    undo_manager.save(new _util_undo.UndoState(data, 'Add Ease'));
    repaintAll();
  });
  var start_play = null,
      played_from = 0; // requires some more tweaking

  dispatcher.on('controls.toggle_play', function () {
    if (start_play) {
      pausePlaying();
    } else {
      startPlaying();
    }
  });
  dispatcher.on('controls.restart_play', function () {
    if (!start_play) {
      startPlaying();
    }

    setCurrentTime(played_from);
  });
  dispatcher.on('controls.play', startPlaying);
  dispatcher.on('controls.pause', pausePlaying);

  function startPlaying() {
    // played_from = timeline.current_frame;
    start_play = performance.now() - data.get('ui:currentTime').value * 1000;
    layer_panel.setControlStatus(true); // dispatcher.fire('controls.status', true);
  }

  function pausePlaying() {
    start_play = null;
    layer_panel.setControlStatus(false); // dispatcher.fire('controls.status', false);
  }

  dispatcher.on('controls.stop', function () {
    if (start_play !== null) pausePlaying();
    setCurrentTime(0);
  });
  var currentTimeStore = data.get('ui:currentTime');
  dispatcher.on('time.update', setCurrentTime);
  dispatcher.on('totalTime.update', function (value) {// context.totalTime = value;
    // controller.setDuration(value);
    // timeline.repaint();
  });
  /* update scroll viewport */

  dispatcher.on('update.scrollTime', function (v) {
    v = Math.max(0, v);
    data.get('ui:scrollTime').value = v;
    repaintAll();
  });

  function setCurrentTime(value) {
    value = Math.max(0, value);
    currentTimeStore.value = value;
    if (start_play) start_play = performance.now() - value * 1000;
    repaintAll(); // layer_panel.repaint(s);
  }

  dispatcher.on('target.notify', function (name, value) {
    if (target) target[name] = value;
  });
  dispatcher.on('update.scale', function (v) {
    console.log('range', v);
    data.get('ui:timeScale').value = v;
    timeline.repaint();
  }); // handle undo / redo

  dispatcher.on('controls.undo', function () {
    var history = undo_manager.undo();
    data.setJSONString(history.state);
    updateState();
  });
  dispatcher.on('controls.redo', function () {
    var history = undo_manager.redo();
    data.setJSONString(history.state);
    updateState();
  });
  /*
  	Paint Routines
  */

  function paint() {
    requestAnimationFrame(paint);

    if (start_play) {
      var t = (performance.now() - start_play) / 1000;
      setCurrentTime(t);

      if (t > data.get('ui:totalTime').value) {
        // simple loop
        start_play = performance.now();
      }
    }

    if (needsResize) {
      div.style.width = _layout_constants.LayoutConstants.width + 'px';
      div.style.height = _layout_constants.LayoutConstants.height + 'px';
      restyle(layer_panel.dom, timeline.dom);
      timeline.resize();
      repaintAll();
      needsResize = false;
      dispatcher.fire('resize');
    }

    timeline._paint();
  }

  paint();
  /*
  	End Paint Routines
  */

  function save(name) {
    if (!name) name = 'autosave';
    var json = data.getJSONString();

    try {
      localStorage[STORAGE_PREFIX + name] = json;
      dispatcher.fire('save:done');
    } catch (e) {
      console.log('Cannot save', name, json);
    }
  }

  function saveAs(name) {
    if (!name) name = data.get('name').value;
    name = prompt('Pick a name to save to (localStorage)', name);

    if (name) {
      data.data.name = name;
      save(name);
    }
  }

  function saveSimply() {
    var name = data.get('name').value;

    if (name) {
      save(name);
    } else {
      saveAs(name);
    }
  }

  function exportJSON() {
    var json = data.getJSONString();
    var ret = prompt('Hit OK to download otherwise Copy and Paste JSON', json);
    console.log(JSON.stringify(data.data, null, '\t'));
    if (!ret) return; // make json downloadable

    json = data.getJSONString('\t');
    var fileName = 'timeliner-test' + '.json';
    saveToFile(json, fileName);
  }

  function loadJSONString(o) {
    // should catch and check errors here
    var json = JSON.parse(o);
    load(json);
  }

  function load(o) {
    data.setJSON(o); //

    if (data.getValue('ui') === undefined) {
      data.setValue('ui', {
        currentTime: 0,
        totalTime: _layout_constants.LayoutConstants.default_length,
        scrollTime: 0,
        timeScale: _layout_constants.LayoutConstants.time_scale
      });
    }

    undo_manager.clear();
    undo_manager.save(new _util_undo.UndoState(data, 'Loaded'), true);
    updateState();
  }

  function updateState() {
    layers = layer_store.value; // FIXME: support Arrays

    layer_panel.setState(layer_store);
    timeline.setState(layer_store);
    repaintAll();
  }

  function repaintAll() {
    var content_height = layers.length * _layout_constants.LayoutConstants.LINE_HEIGHT;
    scrollbar.setLength(_layout_constants.LayoutConstants.TIMELINE_SCROLL_HEIGHT / content_height);
    layer_panel.repaint();
    timeline.repaint();
  }

  function promptImport() {
    var json = prompt('Paste JSON in here to Load');
    if (!json) return;
    console.log('Loading.. ', json);
    loadJSONString(json);
  }

  function open(title) {
    if (title) {
      loadJSONString(localStorage[STORAGE_PREFIX + title]);
    }
  }

  this.openLocalSave = open;
  dispatcher.on('import', function () {
    promptImport();
  }.bind(this));
  dispatcher.on('new', function () {
    data.blank();
    updateState();
  });
  dispatcher.on('openfile', function () {
    openAs(function (data) {
      // console.log('loaded ' + data);
      loadJSONString(data);
    }, div);
  });
  dispatcher.on('open', open);
  dispatcher.on('export', exportJSON);
  dispatcher.on('save', saveSimply);
  dispatcher.on('save_as', saveAs); // Expose API

  this.save = save;
  this.load = load;
  /*
  	Start DOM Stuff (should separate file)
  */

  var div = document.createElement('div');
  style(div, {
    textAlign: 'left',
    lineHeight: '1em',
    position: 'absolute',
    top: '22px'
  });
  var pane = document.createElement('div');
  style(pane, {
    position: 'fixed',
    top: '20px',
    left: '20px',
    margin: 0,
    border: '1px solid ' + _theme.Theme.a,
    padding: 0,
    overflow: 'hidden',
    backgroundColor: _theme.Theme.a,
    color: _theme.Theme.d,
    zIndex: Z_INDEX,
    fontFamily: 'monospace',
    fontSize: '12px'
  });
  var header_styles = {
    position: 'absolute',
    top: '0px',
    width: '100%',
    height: '22px',
    lineHeight: '22px',
    overflow: 'hidden'
  };
  var button_styles = {
    width: '20px',
    height: '20px',
    padding: '2px',
    marginRight: '2px'
  };
  var pane_title = document.createElement('div');
  style(pane_title, header_styles, {
    borderBottom: '1px solid ' + _theme.Theme.b,
    textAlign: 'center'
  });
  var title_bar = document.createElement('span');
  pane_title.appendChild(title_bar);
  title_bar.innerHTML = 'Timeliner ' + TIMELINER_VERSION;
  pane_title.appendChild(title_bar);
  var top_right_bar = document.createElement('div');
  style(top_right_bar, header_styles, {
    textAlign: 'right'
  });
  pane_title.appendChild(top_right_bar); // resize minimize
  // var resize_small = new IconButton(10, 'resize_small', 'minimize', dispatcher);
  // top_right_bar.appendChild(resize_small.dom);
  // resize full

  var resize_full = new _icon_button.IconButton(10, 'resize_full', 'maximize', dispatcher);
  style(resize_full.dom, button_styles, {
    marginRight: '2px'
  });
  top_right_bar.appendChild(resize_full.dom);
  var pane_status = document.createElement('div');
  var footer_styles = {
    position: 'absolute',
    width: '100%',
    height: '22px',
    lineHeight: '22px',
    bottom: '0',
    // padding: '2px',
    background: _theme.Theme.a,
    fontSize: '11px'
  };
  style(pane_status, footer_styles, {
    borderTop: '1px solid ' + _theme.Theme.b
  });
  pane.appendChild(div);
  pane.appendChild(pane_status);
  pane.appendChild(pane_title);
  var label_status = document.createElement('span');
  label_status.textContent = 'hello!';
  label_status.style.marginLeft = '10px';

  this.setStatus = function (text) {
    label_status.textContent = text;
  };

  dispatcher.on('state:save', function (description) {
    dispatcher.fire('status', description);
    save('autosave');
  });
  dispatcher.on('status', this.setStatus);
  var bottom_right = document.createElement('div');
  style(bottom_right, footer_styles, {
    textAlign: 'right'
  }); // var button_save = document.createElement('button');
  // style(button_save, button_styles);
  // button_save.textContent = 'Save';
  // button_save.onclick = function() {
  // 	save();
  // };
  // var button_load = document.createElement('button');
  // style(button_load, button_styles);
  // button_load.textContent = 'Import';
  // button_load.onclick = this.promptLoad;
  // var button_open = document.createElement('button');
  // style(button_open, button_styles);
  // button_open.textContent = 'Open';
  // button_open.onclick = this.promptOpen;
  // bottom_right.appendChild(button_load);
  // bottom_right.appendChild(button_save);
  // bottom_right.appendChild(button_open);

  pane_status.appendChild(label_status);
  pane_status.appendChild(bottom_right);
  /**/
  // zoom in

  var zoom_in = new _icon_button.IconButton(12, 'zoom_in', 'zoom in', dispatcher); // zoom out

  var zoom_out = new _icon_button.IconButton(12, 'zoom_out', 'zoom out', dispatcher); // settings

  var cog = new _icon_button.IconButton(12, 'cog', 'settings', dispatcher); // bottom_right.appendChild(zoom_in.dom);
  // bottom_right.appendChild(zoom_out.dom);
  // bottom_right.appendChild(cog.dom);
  // add layer

  var plus = new _icon_button.IconButton(12, 'plus', 'New Layer', dispatcher);
  plus.onClick(function () {
    var name = prompt('Layer name?');
    addLayer(name);
    undo_manager.save(new _util_undo.UndoState(data, 'Layer added'));
    repaintAll();
  });
  style(plus.dom, button_styles);
  bottom_right.appendChild(plus.dom); // trash

  var trash = new _icon_button.IconButton(12, 'trash', 'Delete save', dispatcher);
  trash.onClick(function () {
    var name = data.get('name').value;

    if (name && localStorage[STORAGE_PREFIX + name]) {
      var ok = confirm('Are you sure you wish to delete ' + name + '?');

      if (ok) {
        delete localStorage[STORAGE_PREFIX + name];
        dispatcher.fire('status', name + ' deleted');
        dispatcher.fire('save:done');
      }
    }
  });
  style(trash.dom, button_styles, {
    marginRight: '2px'
  });
  bottom_right.appendChild(trash.dom); // pane_status.appendChild(document.createTextNode(' | TODO <Dock Full | Dock Botton | Snap Window Edges | zoom in | zoom out | Settings | help>'));

  /*
  		End DOM Stuff
  */

  var ghostpane = document.createElement('div');
  ghostpane.id = 'ghostpane';
  style(ghostpane, {
    background: '#999',
    opacity: 0.2,
    position: 'fixed',
    margin: 0,
    padding: 0,
    zIndex: Z_INDEX - 1,
    // transition: 'all 0.25s ease-in-out',
    transitionProperty: 'top, left, width, height, opacity',
    transitionDuration: '0.25s',
    transitionTimingFunction: 'ease-in-out'
  }); //
  // Handle DOM Views
  //
  // Shadow Root

  var root = document.createElement('timeliner');
  document.body.appendChild(root);
  if (root.createShadowRoot) root = root.createShadowRoot();
  window.r = root; // var iframe = document.createElement('iframe');
  // document.body.appendChild(iframe);
  // root = iframe.contentDocument.body;

  root.appendChild(pane);
  root.appendChild(ghostpane);
  div.appendChild(layer_panel.dom);
  div.appendChild(timeline.dom);
  var scrollbar = new _scrollbar.ScrollBar(200, 10);
  div.appendChild(scrollbar.dom); // percentages

  scrollbar.onScroll["do"](function (type, scrollTo) {
    switch (type) {
      case 'scrollto':
        layer_panel.scrollTo(scrollTo);
        timeline.scrollTo(scrollTo);
        break;
      //		case 'pageup':
      // 			scrollTop -= pageOffset;
      // 			me.draw();
      // 			me.updateScrollbar();
      // 			break;
      // 		case 'pagedown':
      // 			scrollTop += pageOffset;
      // 			me.draw();
      // 			me.updateScrollbar();
      // 			break;
    }
  }); // document.addEventListener('keypress', function(e) {
  // 	console.log('kp', e);
  // });
  // document.addEventListener('keyup', function(e) {
  // 	if (undo) console.log('UNDO');
  // 	console.log('kd', e);
  // });
  // TODO: Keyboard Shortcuts
  // Esc - Stop and review to last played from / to the start?
  // Space - play / pause from current position
  // Enter - play all
  // k - keyframe

  document.addEventListener('keydown', function (e) {
    var play = e.keyCode == 32; // space

    var enter = e.keyCode == 13; //

    var undo = e.metaKey && e.keyCode == 91 && !e.shiftKey;
    var active = document.activeElement; // console.log( active.nodeName );

    if (active.nodeName.match(/(INPUT|BUTTON|SELECT|TIMELINER)/)) {
      active.blur();
    }

    if (play) {
      dispatcher.fire('controls.toggle_play');
    } else if (enter) {
      // FIXME: Return should play from the start or last played from?
      dispatcher.fire('controls.restart_play'); // dispatcher.fire('controls.undo');
    } else if (e.keyCode == 27) {
      // Esc = stop. FIXME: should rewind head to last played from or Last pointed from?
      dispatcher.fire('controls.pause');
    } else console.log('keydown', e.keyCode);
  });
  var needsResize = true;

  function resize(width, height) {
    // data.get('ui:bounds').value = {
    // 	width: width,
    // 	height: height
    // };
    // TODO: remove ugly hardcodes
    width -= 4;
    height -= 44;
    _layout_constants.LayoutConstants.width = width - _layout_constants.LayoutConstants.LEFT_PANE_WIDTH;
    _layout_constants.LayoutConstants.height = height;
    _layout_constants.LayoutConstants.TIMELINE_SCROLL_HEIGHT = height - _layout_constants.LayoutConstants.MARKER_TRACK_HEIGHT;
    var scrollable_height = _layout_constants.LayoutConstants.TIMELINE_SCROLL_HEIGHT;
    scrollbar.setHeight(scrollable_height - 2);
    style(scrollbar.dom, {
      top: _layout_constants.LayoutConstants.MARKER_TRACK_HEIGHT + 'px',
      left: width - 16 + 'px'
    });
    needsResize = true;
  }

  function restyle(left, right) {
    left.style.cssText = 'position: absolute; left: 0px; top: 0px; height: ' + _layout_constants.LayoutConstants.height + 'px;';
    style(left, {
      // background: Theme.a,
      overflow: 'hidden'
    });
    left.style.width = _layout_constants.LayoutConstants.LEFT_PANE_WIDTH + 'px'; // right.style.cssText = 'position: absolute; top: 0px;';

    right.style.position = 'absolute';
    right.style.top = '0px';
    right.style.left = _layout_constants.LayoutConstants.LEFT_PANE_WIDTH + 'px';
  }

  function addLayer(name) {
    var layer = new LayerProp(name);
    layers = layer_store.value;
    layers.push(layer);
    layer_panel.setState(layer_store);
  }

  this.addLayer = addLayer;

  this.dispose = function dispose() {
    var domParent = pane.parentElement;
    domParent.removeChild(pane);
    domParent.removeChild(ghostpane);
  };

  this.setTarget = function (t) {
    target = t;
  };

  function getValueRanges(ranges, interval) {
    interval = interval ? interval : 0.15;
    ranges = ranges ? ranges : 2; // not optimized!

    var t = data.get('ui:currentTime').value;
    var values = [];

    for (var u = -ranges; u <= ranges; u++) {
      // if (u == 0) continue;
      var o = {};

      for (var l = 0; l < layers.length; l++) {
        var layer = layers[l];

        var m = _utils.utils.timeAtLayer(layer, t + u * interval);

        o[layer.name] = m.value;
      }

      values.push(o);
    }

    return values;
  }

  this.getValues = getValueRanges;
  /* Integrate pane into docking window */

  var widget = new _docking_window.DockingWindow(pane, ghostpane);
  widget.allowMove(false);
  widget.resizes["do"](resize);
  pane_title.addEventListener('mouseover', function () {
    widget.allowMove(true);
  });
  pane_title.addEventListener('mouseout', function () {
    widget.allowMove(false);
  });
}

window.Timeliner = Timeliner;

},{"./layout_constants.js":1,"./theme.js":2,"./ui/icon_button.js":6,"./ui/scrollbar.js":7,"./utils/docking_window.js":10,"./utils/util_datastore.js":11,"./utils/util_dispatcher.js":12,"./utils/util_undo.js":15,"./utils/utils.js":16,"./views/layer_cabinet.js":17,"./views/panel.js":18}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Canvas = Canvas;

var _util_handle_drag = require("../utils/util_handle_drag.js");

function Canvas(w, h) {
  var canvas, ctx, width, height, dpr;
  var canvasItems = [];
  var child;

  function create() {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  }

  function setSize(w, h) {
    width = w;
    height = h;
    dpr = window.devicePixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (child) child.setSize(w, h);
  }

  function paint(ctx) {
    if (child) {
      if (!child.paint) console.warn('implement repaint()');
      child.paint(ctx);
    }

    var item;

    for (var i = 0; i < canvasItems.length; i++) {
      item = canvasItems[i];
      item.paint();
    }
  }

  function repaint() {
    paint(ctx);
  }

  function add(item) {
    canvasItems.push(item);
  }

  function remove(item) {
    canvasItems.splice(canvasItems.indexOf(item), 1);
  }

  function uses(c) {
    child = c;
    child.add = this.add;
    child.remove = this.remove;
  }

  create();
  setSize(w, h);
  this.setSize = setSize;
  this.repaint = repaint;
  this.uses = uses;
  this.dom = canvas;
  (0, _util_handle_drag.handleDrag)(canvas, function down(e) {
    if (child.onDown) {
      child.onDown(e);
    }
  }, function move(e) {
    if (child.onMove) {
      child.onMove(e);
    }
  }, function up(e) {
    if (child.onUp) {
      child.onUp(e);
    }
  } // function hit(e) {
  // 	if (child.onHit) { child.onHit(e) };
  // }
  );
}
/*
 * Usage: canvas = new Canvas(width, height);
 * canvas.resize();
 */
// children
// 1: override repaint
// 2: add objects
// Canvas.uses(CanvasChild);
// CanvasItem
// width, height, x, y
// allow Drag
// allow Click
// mouseOver
//

},{"../utils/util_handle_drag.js":13}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.font = void 0;
var font = {
  "unitsPerEm": 1792,
  "ascender": 1536,
  "descender": -256,
  "fonts": {
    "plus": {
      "advanceWidth": 1408,
      "commands": "M,1408,800 C,1408,853,1365,896,1312,896 L,896,896 L,896,1312 C,896,1365,853,1408,800,1408 L,608,1408 C,555,1408,512,1365,512,1312 L,512,896 L,96,896 C,43,896,0,853,0,800 L,0,608 C,0,555,43,512,96,512 L,512,512 L,512,96 C,512,43,555,0,608,0 L,800,0 C,853,0,896,43,896,96 L,896,512 L,1312,512 C,1365,512,1408,555,1408,608 Z"
    },
    "minus": {
      "advanceWidth": 1408,
      "commands": "M,1408,800 C,1408,853,1365,896,1312,896 L,96,896 C,43,896,0,853,0,800 L,0,608 C,0,555,43,512,96,512 L,1312,512 C,1365,512,1408,555,1408,608 Z"
    },
    "ok": {
      "advanceWidth": 1792,
      "commands": "M,1671,970 C,1671,995,1661,1020,1643,1038 L,1507,1174 C,1489,1192,1464,1202,1439,1202 C,1414,1202,1389,1192,1371,1174 L,715,517 L,421,812 C,403,830,378,840,353,840 C,328,840,303,830,285,812 L,149,676 C,131,658,121,633,121,608 C,121,583,131,558,149,540 L,511,178 L,647,42 C,665,24,690,14,715,14 C,740,14,765,24,783,42 L,919,178 L,1643,902 C,1661,920,1671,945,1671,970 Z"
    },
    "remove": {
      "advanceWidth": 1408,
      "commands": "M,1298,214 C,1298,239,1288,264,1270,282 L,976,576 L,1270,870 C,1288,888,1298,913,1298,938 C,1298,963,1288,988,1270,1006 L,1134,1142 C,1116,1160,1091,1170,1066,1170 C,1041,1170,1016,1160,998,1142 L,704,848 L,410,1142 C,392,1160,367,1170,342,1170 C,317,1170,292,1160,274,1142 L,138,1006 C,120,988,110,963,110,938 C,110,913,120,888,138,870 L,432,576 L,138,282 C,120,264,110,239,110,214 C,110,189,120,164,138,146 L,274,10 C,292,-8,317,-18,342,-18 C,367,-18,392,-8,410,10 L,704,304 L,998,10 C,1016,-8,1041,-18,1066,-18 C,1091,-18,1116,-8,1134,10 L,1270,146 C,1288,164,1298,189,1298,214 Z"
    },
    "zoom_in": {
      "advanceWidth": 1664,
      "commands": "M,1024,736 C,1024,753,1009,768,992,768 L,768,768 L,768,992 C,768,1009,753,1024,736,1024 L,672,1024 C,655,1024,640,1009,640,992 L,640,768 L,416,768 C,399,768,384,753,384,736 L,384,672 C,384,655,399,640,416,640 L,640,640 L,640,416 C,640,399,655,384,672,384 L,736,384 C,753,384,768,399,768,416 L,768,640 L,992,640 C,1009,640,1024,655,1024,672 M,1152,704 C,1152,457,951,256,704,256 C,457,256,256,457,256,704 C,256,951,457,1152,704,1152 C,951,1152,1152,951,1152,704 M,1664,-128 C,1664,-94,1650,-61,1627,-38 L,1284,305 C,1365,422,1408,562,1408,704 C,1408,1093,1093,1408,704,1408 C,315,1408,0,1093,0,704 C,0,315,315,0,704,0 C,846,0,986,43,1103,124 L,1446,-218 C,1469,-242,1502,-256,1536,-256 C,1607,-256,1664,-199,1664,-128 Z"
    },
    "zoom_out": {
      "advanceWidth": 1664,
      "commands": "M,1024,736 C,1024,753,1009,768,992,768 L,416,768 C,399,768,384,753,384,736 L,384,672 C,384,655,399,640,416,640 L,992,640 C,1009,640,1024,655,1024,672 M,1152,704 C,1152,457,951,256,704,256 C,457,256,256,457,256,704 C,256,951,457,1152,704,1152 C,951,1152,1152,951,1152,704 M,1664,-128 C,1664,-94,1650,-61,1627,-38 L,1284,305 C,1365,422,1408,562,1408,704 C,1408,1093,1093,1408,704,1408 C,315,1408,0,1093,0,704 C,0,315,315,0,704,0 C,846,0,986,43,1103,124 L,1446,-218 C,1469,-242,1502,-256,1536,-256 C,1607,-256,1664,-199,1664,-128 Z"
    },
    "cog": {
      "advanceWidth": 1536,
      "commands": "M,1024,640 C,1024,499,909,384,768,384 C,627,384,512,499,512,640 C,512,781,627,896,768,896 C,909,896,1024,781,1024,640 M,1536,749 C,1536,766,1524,782,1507,785 L,1324,813 C,1314,846,1300,879,1283,911 C,1317,958,1354,1002,1388,1048 C,1393,1055,1396,1062,1396,1071 C,1396,1079,1394,1087,1389,1093 C,1347,1152,1277,1214,1224,1263 C,1217,1269,1208,1273,1199,1273 C,1190,1273,1181,1270,1175,1264 L,1033,1157 C,1004,1172,974,1184,943,1194 L,915,1378 C,913,1395,897,1408,879,1408 L,657,1408 C,639,1408,625,1396,621,1380 C,605,1320,599,1255,592,1194 C,561,1184,530,1171,501,1156 L,363,1263 C,355,1269,346,1273,337,1273 C,303,1273,168,1127,144,1094 C,139,1087,135,1080,135,1071 C,135,1062,139,1054,145,1047 C,182,1002,218,957,252,909 C,236,879,223,849,213,817 L,27,789 C,12,786,0,768,0,753 L,0,531 C,0,514,12,498,29,495 L,212,468 C,222,434,236,401,253,369 C,219,322,182,278,148,232 C,143,225,140,218,140,209 C,140,201,142,193,147,186 C,189,128,259,66,312,18 C,319,11,328,7,337,7 C,346,7,355,10,362,16 L,503,123 C,532,108,562,96,593,86 L,621,-98 C,623,-115,639,-128,657,-128 L,879,-128 C,897,-128,911,-116,915,-100 C,931,-40,937,25,944,86 C,975,96,1006,109,1035,124 L,1173,16 C,1181,11,1190,7,1199,7 C,1233,7,1368,154,1392,186 C,1398,193,1401,200,1401,209 C,1401,218,1397,227,1391,234 C,1354,279,1318,323,1284,372 C,1300,401,1312,431,1323,463 L,1508,491 C,1524,494,1536,512,1536,527 Z"
    },
    "trash": {
      "advanceWidth": 1408,
      "commands": "M,512,800 C,512,818,498,832,480,832 L,416,832 C,398,832,384,818,384,800 L,384,224 C,384,206,398,192,416,192 L,480,192 C,498,192,512,206,512,224 M,768,800 C,768,818,754,832,736,832 L,672,832 C,654,832,640,818,640,800 L,640,224 C,640,206,654,192,672,192 L,736,192 C,754,192,768,206,768,224 M,1024,800 C,1024,818,1010,832,992,832 L,928,832 C,910,832,896,818,896,800 L,896,224 C,896,206,910,192,928,192 L,992,192 C,1010,192,1024,206,1024,224 M,1152,76 C,1152,28,1125,0,1120,0 L,288,0 C,283,0,256,28,256,76 L,256,1024 L,1152,1024 L,1152,76 M,480,1152 L,529,1269 C,532,1273,540,1279,546,1280 L,863,1280 C,868,1279,877,1273,880,1269 L,928,1152 M,1408,1120 C,1408,1138,1394,1152,1376,1152 L,1067,1152 L,997,1319 C,977,1368,917,1408,864,1408 L,544,1408 C,491,1408,431,1368,411,1319 L,341,1152 L,32,1152 C,14,1152,0,1138,0,1120 L,0,1056 C,0,1038,14,1024,32,1024 L,128,1024 L,128,72 C,128,-38,200,-128,288,-128 L,1120,-128 C,1208,-128,1280,-34,1280,76 L,1280,1024 L,1376,1024 C,1394,1024,1408,1038,1408,1056 Z"
    },
    "file_alt": {
      "advanceWidth": 1536,
      "commands": "M,1468,1156 L,1156,1468 C,1119,1505,1045,1536,992,1536 L,96,1536 C,43,1536,0,1493,0,1440 L,0,-160 C,0,-213,43,-256,96,-256 L,1440,-256 C,1493,-256,1536,-213,1536,-160 L,1536,992 C,1536,1045,1505,1119,1468,1156 M,1024,1400 C,1041,1394,1058,1385,1065,1378 L,1378,1065 C,1385,1058,1394,1041,1400,1024 L,1024,1024 M,1408,-128 L,128,-128 L,128,1408 L,896,1408 L,896,992 C,896,939,939,896,992,896 L,1408,896 Z"
    },
    "download_alt": {
      "advanceWidth": 1664,
      "commands": "M,1280,192 C,1280,157,1251,128,1216,128 C,1181,128,1152,157,1152,192 C,1152,227,1181,256,1216,256 C,1251,256,1280,227,1280,192 M,1536,192 C,1536,157,1507,128,1472,128 C,1437,128,1408,157,1408,192 C,1408,227,1437,256,1472,256 C,1507,256,1536,227,1536,192 M,1664,416 C,1664,469,1621,512,1568,512 L,1104,512 L,968,376 C,931,340,883,320,832,320 C,781,320,733,340,696,376 L,561,512 L,96,512 C,43,512,0,469,0,416 L,0,96 C,0,43,43,0,96,0 L,1568,0 C,1621,0,1664,43,1664,96 M,1339,985 C,1329,1008,1306,1024,1280,1024 L,1024,1024 L,1024,1472 C,1024,1507,995,1536,960,1536 L,704,1536 C,669,1536,640,1507,640,1472 L,640,1024 L,384,1024 C,358,1024,335,1008,325,985 C,315,961,320,933,339,915 L,787,467 C,799,454,816,448,832,448 C,848,448,865,454,877,467 L,1325,915 C,1344,933,1349,961,1339,985 Z"
    },
    "repeat": {
      "advanceWidth": 1536,
      "commands": "M,1536,1280 C,1536,1306,1520,1329,1497,1339 C,1473,1349,1445,1344,1427,1325 L,1297,1196 C,1156,1329,965,1408,768,1408 C,345,1408,0,1063,0,640 C,0,217,345,-128,768,-128 C,997,-128,1213,-27,1359,149 C,1369,162,1369,181,1357,192 L,1220,330 C,1213,336,1204,339,1195,339 C,1186,338,1177,334,1172,327 C,1074,200,927,128,768,128 C,486,128,256,358,256,640 C,256,922,486,1152,768,1152 C,899,1152,1023,1102,1117,1015 L,979,877 C,960,859,955,831,965,808 C,975,784,998,768,1024,768 L,1472,768 C,1507,768,1536,797,1536,832 Z"
    },
    "pencil": {
      "advanceWidth": 1536,
      "commands": "M,363,0 L,256,0 L,256,128 L,128,128 L,128,235 L,219,326 L,454,91 M,886,928 C,886,922,884,916,879,911 L,337,369 C,332,364,326,362,320,362 C,307,362,298,371,298,384 C,298,390,300,396,305,401 L,847,943 C,852,948,858,950,864,950 C,877,950,886,941,886,928 M,832,1120 L,0,288 L,0,-128 L,416,-128 L,1248,704 M,1515,1024 C,1515,1058,1501,1091,1478,1115 L,1243,1349 C,1219,1373,1186,1387,1152,1387 C,1118,1387,1085,1373,1062,1349 L,896,1184 L,1312,768 L,1478,934 C,1501,957,1515,990,1515,1024 Z"
    },
    "edit": {
      "advanceWidth": 1792,
      "commands": "M,888,352 L,832,352 L,832,448 L,736,448 L,736,504 L,852,620 L,1004,468 M,1328,1072 C,1337,1063,1336,1048,1327,1039 L,977,689 C,968,680,953,679,944,688 C,935,697,936,712,945,721 L,1295,1071 C,1304,1080,1319,1081,1328,1072 M,1408,478 C,1408,491,1400,502,1388,507 C,1376,512,1363,510,1353,500 L,1289,436 C,1283,430,1280,422,1280,414 L,1280,288 C,1280,200,1208,128,1120,128 L,288,128 C,200,128,128,200,128,288 L,128,1120 C,128,1208,200,1280,288,1280 L,1120,1280 C,1135,1280,1150,1278,1165,1274 C,1176,1270,1188,1273,1197,1282 L,1246,1331 C,1254,1339,1257,1349,1255,1360 C,1253,1370,1246,1379,1237,1383 C,1200,1400,1160,1408,1120,1408 L,288,1408 C,129,1408,0,1279,0,1120 L,0,288 C,0,129,129,0,288,0 L,1120,0 C,1279,0,1408,129,1408,288 M,1312,1216 L,640,544 L,640,256 L,928,256 L,1600,928 M,1756,1084 C,1793,1121,1793,1183,1756,1220 L,1604,1372 C,1567,1409,1505,1409,1468,1372 L,1376,1280 L,1664,992 L,1756,1084 Z"
    },
    "play": {
      "advanceWidth": 1408,
      "commands": "M,1384,609 C,1415,626,1415,654,1384,671 L,56,1409 C,25,1426,0,1411,0,1376 L,0,-96 C,0,-131,25,-146,56,-129 Z"
    },
    "pause": {
      "advanceWidth": 1536,
      "commands": "M,1536,1344 C,1536,1379,1507,1408,1472,1408 L,960,1408 C,925,1408,896,1379,896,1344 L,896,-64 C,896,-99,925,-128,960,-128 L,1472,-128 C,1507,-128,1536,-99,1536,-64 M,640,1344 C,640,1379,611,1408,576,1408 L,64,1408 C,29,1408,0,1379,0,1344 L,0,-64 C,0,-99,29,-128,64,-128 L,576,-128 C,611,-128,640,-99,640,-64 Z"
    },
    "stop": {
      "advanceWidth": 1536,
      "commands": "M,1536,1344 C,1536,1379,1507,1408,1472,1408 L,64,1408 C,29,1408,0,1379,0,1344 L,0,-64 C,0,-99,29,-128,64,-128 L,1472,-128 C,1507,-128,1536,-99,1536,-64 Z"
    },
    "resize_full": {
      "advanceWidth": 1536,
      "commands": "M,755,480 C,755,488,751,497,745,503 L,631,617 C,625,623,616,627,608,627 C,600,627,591,623,585,617 L,253,285 L,109,429 C,97,441,81,448,64,448 C,29,448,0,419,0,384 L,0,-64 C,0,-99,29,-128,64,-128 L,512,-128 C,547,-128,576,-99,576,-64 C,576,-47,569,-31,557,-19 L,413,125 L,745,457 C,751,463,755,472,755,480 M,1536,1344 C,1536,1379,1507,1408,1472,1408 L,1024,1408 C,989,1408,960,1379,960,1344 C,960,1327,967,1311,979,1299 L,1123,1155 L,791,823 C,785,817,781,808,781,800 C,781,792,785,783,791,777 L,905,663 C,911,657,920,653,928,653 C,936,653,945,657,951,663 L,1283,995 L,1427,851 C,1439,839,1455,832,1472,832 C,1507,832,1536,861,1536,896 Z"
    },
    "resize_small": {
      "advanceWidth": 1536,
      "commands": "M,768,576 C,768,611,739,640,704,640 L,256,640 C,221,640,192,611,192,576 C,192,559,199,543,211,531 L,355,387 L,23,55 C,17,49,13,40,13,32 C,13,24,17,15,23,9 L,137,-105 C,143,-111,152,-115,160,-115 C,168,-115,177,-111,183,-105 L,515,227 L,659,83 C,671,71,687,64,704,64 C,739,64,768,93,768,128 M,1523,1248 C,1523,1256,1519,1265,1513,1271 L,1399,1385 C,1393,1391,1384,1395,1376,1395 C,1368,1395,1359,1391,1353,1385 L,1021,1053 L,877,1197 C,865,1209,849,1216,832,1216 C,797,1216,768,1187,768,1152 L,768,704 C,768,669,797,640,832,640 L,1280,640 C,1315,640,1344,669,1344,704 C,1344,721,1337,737,1325,749 L,1181,893 L,1513,1225 C,1519,1231,1523,1240,1523,1248 Z"
    },
    "eye_open": {
      "advanceWidth": 1792,
      "commands": "M,1664,576 C,1493,312,1217,128,896,128 C,575,128,299,312,128,576 C,223,723,353,849,509,929 C,469,861,448,783,448,704 C,448,457,649,256,896,256 C,1143,256,1344,457,1344,704 C,1344,783,1323,861,1283,929 C,1439,849,1569,723,1664,576 M,944,960 C,944,934,922,912,896,912 C,782,912,688,818,688,704 C,688,678,666,656,640,656 C,614,656,592,678,592,704 C,592,871,729,1008,896,1008 C,922,1008,944,986,944,960 M,1792,576 C,1792,601,1784,624,1772,645 C,1588,947,1251,1152,896,1152 C,541,1152,204,947,20,645 C,8,624,0,601,0,576 C,0,551,8,528,20,507 C,204,205,541,0,896,0 C,1251,0,1588,204,1772,507 C,1784,528,1792,551,1792,576 Z"
    },
    "eye_close": {
      "advanceWidth": 1792,
      "commands": "M,555,201 C,379,280,232,415,128,576 C,223,723,353,849,509,929 C,469,861,448,783,448,704 C,448,561,517,426,633,342 M,944,960 C,944,934,922,912,896,912 C,782,912,688,819,688,704 C,688,678,666,656,640,656 C,614,656,592,678,592,704 C,592,871,729,1008,896,1008 C,922,1008,944,986,944,960 M,1307,1151 C,1307,1162,1301,1172,1291,1178 C,1270,1190,1176,1248,1158,1248 C,1146,1248,1136,1242,1130,1232 L,1076,1135 C,1017,1146,956,1152,896,1152 C,527,1152,218,949,20,645 C,7,625,0,600,0,576 C,0,551,7,527,20,507 C,135,327,298,177,492,89 C,482,72,448,18,448,2 C,448,-10,454,-20,464,-26 C,485,-38,580,-96,598,-96 C,609,-96,620,-90,626,-80 L,675,9 C,886,386,1095,765,1306,1142 C,1307,1144,1307,1149,1307,1151 M,1344,704 C,1344,732,1341,760,1336,788 L,1056,286 C,1229,352,1344,518,1344,704 M,1792,576 C,1792,602,1785,623,1772,645 C,1694,774,1569,899,1445,982 L,1382,870 C,1495,792,1590,691,1664,576 C,1508,334,1261,157,970,132 L,896,0 C,1197,0,1467,137,1663,362 C,1702,407,1741,456,1772,507 C,1785,529,1792,550,1792,576 Z"
    },
    "folder_open": {
      "advanceWidth": 1920,
      "commands": "M,1879,584 C,1879,629,1828,640,1792,640 L,704,640 C,616,640,498,586,440,518 L,104,122 C,88,104,73,80,73,56 C,73,11,124,0,160,0 L,1248,0 C,1336,0,1454,54,1512,122 L,1848,518 C,1864,536,1879,560,1879,584 M,1536,928 C,1536,1051,1435,1152,1312,1152 L,768,1152 L,768,1184 C,768,1307,667,1408,544,1408 L,224,1408 C,101,1408,0,1307,0,1184 L,0,224 C,0,216,1,207,1,199 L,6,205 L,343,601 C,424,697,579,768,704,768 L,1536,768 Z"
    },
    "signin": {
      "advanceWidth": 1536,
      "commands": "M,1184,640 C,1184,657,1177,673,1165,685 L,621,1229 C,609,1241,593,1248,576,1248 C,541,1248,512,1219,512,1184 L,512,896 L,64,896 C,29,896,0,867,0,832 L,0,448 C,0,413,29,384,64,384 L,512,384 L,512,96 C,512,61,541,32,576,32 C,593,32,609,39,621,51 L,1165,595 C,1177,607,1184,623,1184,640 M,1536,992 C,1536,1151,1407,1280,1248,1280 L,928,1280 C,883,1280,896,1212,896,1184 C,896,1147,935,1152,960,1152 L,1248,1152 C,1336,1152,1408,1080,1408,992 L,1408,288 C,1408,200,1336,128,1248,128 L,928,128 C,883,128,896,60,896,32 C,896,15,911,0,928,0 L,1248,0 C,1407,0,1536,129,1536,288 Z"
    },
    "upload_alt": {
      "advanceWidth": 1664,
      "commands": "M,1280,64 C,1280,29,1251,0,1216,0 C,1181,0,1152,29,1152,64 C,1152,99,1181,128,1216,128 C,1251,128,1280,99,1280,64 M,1536,64 C,1536,29,1507,0,1472,0 C,1437,0,1408,29,1408,64 C,1408,99,1437,128,1472,128 C,1507,128,1536,99,1536,64 M,1664,288 C,1664,341,1621,384,1568,384 L,1141,384 C,1114,310,1043,256,960,256 L,704,256 C,621,256,550,310,523,384 L,96,384 C,43,384,0,341,0,288 L,0,-32 C,0,-85,43,-128,96,-128 L,1568,-128 C,1621,-128,1664,-85,1664,-32 M,1339,936 C,1349,959,1344,987,1325,1005 L,877,1453 C,865,1466,848,1472,832,1472 C,816,1472,799,1466,787,1453 L,339,1005 C,320,987,315,959,325,936 C,335,912,358,896,384,896 L,640,896 L,640,448 C,640,413,669,384,704,384 L,960,384 C,995,384,1024,413,1024,448 L,1024,896 L,1280,896 C,1306,896,1329,912,1339,936 Z"
    },
    "save": {
      "advanceWidth": 1536,
      "commands": "M,384,0 L,384,384 L,1152,384 L,1152,0 M,1280,0 L,1280,416 C,1280,469,1237,512,1184,512 L,352,512 C,299,512,256,469,256,416 L,256,0 L,128,0 L,128,1280 L,256,1280 L,256,864 C,256,811,299,768,352,768 L,928,768 C,981,768,1024,811,1024,864 L,1024,1280 C,1044,1280,1083,1264,1097,1250 L,1378,969 C,1391,956,1408,915,1408,896 L,1408,0 M,896,928 C,896,911,881,896,864,896 L,672,896 C,655,896,640,911,640,928 L,640,1248 C,640,1265,655,1280,672,1280 L,864,1280 C,881,1280,896,1265,896,1248 L,896,928 M,1536,896 C,1536,949,1506,1022,1468,1060 L,1188,1340 C,1150,1378,1077,1408,1024,1408 L,96,1408 C,43,1408,0,1365,0,1312 L,0,-32 C,0,-85,43,-128,96,-128 L,1440,-128 C,1493,-128,1536,-85,1536,-32 Z"
    },
    "undo": {
      "advanceWidth": 1536,
      "commands": "M,1536,640 C,1536,1063,1191,1408,768,1408 C,571,1408,380,1329,239,1196 L,109,1325 C,91,1344,63,1349,40,1339 C,16,1329,0,1306,0,1280 L,0,832 C,0,797,29,768,64,768 L,512,768 C,538,768,561,784,571,808 C,581,831,576,859,557,877 L,420,1015 C,513,1102,637,1152,768,1152 C,1050,1152,1280,922,1280,640 C,1280,358,1050,128,768,128 C,609,128,462,200,364,327 C,359,334,350,338,341,339 C,332,339,323,336,316,330 L,179,192 C,168,181,167,162,177,149 C,323,-27,539,-128,768,-128 C,1191,-128,1536,217,1536,640 Z"
    },
    "paste": {
      "advanceWidth": 1792,
      "commands": "M,768,-128 L,768,1024 L,1152,1024 L,1152,608 C,1152,555,1195,512,1248,512 L,1664,512 L,1664,-128 M,1024,1312 C,1024,1295,1009,1280,992,1280 L,288,1280 C,271,1280,256,1295,256,1312 L,256,1376 C,256,1393,271,1408,288,1408 L,992,1408 C,1009,1408,1024,1393,1024,1376 L,1024,1312 M,1280,640 L,1280,939 L,1579,640 M,1792,512 C,1792,565,1762,638,1724,676 L,1316,1084 C,1305,1095,1293,1104,1280,1112 L,1280,1440 C,1280,1493,1237,1536,1184,1536 L,96,1536 C,43,1536,0,1493,0,1440 L,0,96 C,0,43,43,0,96,0 L,640,0 L,640,-160 C,640,-213,683,-256,736,-256 L,1696,-256 C,1749,-256,1792,-213,1792,-160 Z"
    },
    "folder_open_alt": {
      "advanceWidth": 1920,
      "commands": "M,1781,605 C,1781,590,1772,577,1763,566 L,1469,203 C,1435,161,1365,128,1312,128 L,224,128 C,202,128,171,135,171,163 C,171,178,180,191,189,203 L,483,566 C,517,607,587,640,640,640 L,1728,640 C,1750,640,1781,633,1781,605 M,640,768 C,549,768,442,717,384,646 L,128,331 L,128,1184 C,128,1237,171,1280,224,1280 L,544,1280 C,597,1280,640,1237,640,1184 L,640,1120 C,640,1067,683,1024,736,1024 L,1312,1024 C,1365,1024,1408,981,1408,928 L,1408,768 M,1909,605 C,1909,629,1904,652,1894,673 C,1864,737,1796,768,1728,768 L,1536,768 L,1536,928 C,1536,1051,1435,1152,1312,1152 L,768,1152 L,768,1184 C,768,1307,667,1408,544,1408 L,224,1408 C,101,1408,0,1307,0,1184 L,0,224 C,0,101,101,0,224,0 L,1312,0 C,1402,0,1511,52,1568,122 L,1863,485 C,1890,519,1909,561,1909,605 Z"
    }
  }
};
exports.font = font;

},{}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IconButton = IconButton;

var _font = require("./font.js");

var _theme = require("../theme.js");

var _utils = require("../utils/utils.js");

var style = _utils.utils.style;

function IconButton(size, icon, tooltip, dispatcher) {
  var iconStyle = {
    padding: '0.2em 0.4em',
    margin: '0em',
    background: 'none',
    outline: 'none',
    fontSize: '16px',
    border: 'none',
    borderRadius: '0.2em'
  };
  var button = document.createElement('button');
  style(button, iconStyle);
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  button.appendChild(canvas);
  this.ctx = ctx;
  this.dom = button;
  this.canvas = canvas;
  var me = this;
  this.size = size;
  var dpr = 1;

  this.resize = function () {
    dpr = window.devicePixelRatio;
    var height = size;
    var glyph = _font.font.fonts[icon];
    canvas.height = height * dpr;
    canvas.style.height = height + 'px';
    var scale = height / _font.font.unitsPerEm;
    var width = glyph.advanceWidth * scale + 0.5 | 0;
    width += 2;
    height += 2;
    canvas.width = width * dpr;
    canvas.style.width = width + 'px';
    ctx.fillStyle = _theme.Theme.c;
    me.draw();
  };

  if (dispatcher) dispatcher.on('resize', this.resize);

  this.setSize = function (s) {
    size = s;
    this.resize();
  };

  this.setIcon = function (icon) {
    me.icon = icon;
    if (!_font.font.fonts[icon]) console.warn('Font icon not found!');
    this.resize();
  };

  this.onClick = function (e) {
    button.addEventListener('click', e);
  };

  var LONG_HOLD_DURATION = 500;
  var longHoldTimer;

  this.onLongHold = function (f) {
    // not most elagent but oh wells.
    function startHold(e) {
      e.preventDefault();
      e.stopPropagation();
      longHoldTimer = setTimeout(function () {
        if (longHoldTimer) {
          console.log('LONG HOLD-ED!');
          f();
        }
      }, LONG_HOLD_DURATION);
    }

    function clearLongHoldTimer() {
      clearTimeout(longHoldTimer);
    }

    button.addEventListener('mousedown', startHold);
    button.addEventListener('touchstart', startHold);
    button.addEventListener('mouseup', clearLongHoldTimer);
    button.addEventListener('mouseout', clearLongHoldTimer);
    button.addEventListener('touchend', clearLongHoldTimer);
  };

  this.setTip = function (tip) {
    tooltip = tip;
  };

  var borders = {
    border: '1px solid ' + _theme.Theme.b // boxShadow: Theme.b + ' 1px 1px'

  };
  var no_borders = {
    border: '1px solid transparent' // boxShadow: 'none'

  };
  var normal = 'none'; // Theme.b;

  var up = _theme.Theme.c;
  var down = _theme.Theme.b;
  button.style.background = normal;
  style(button, no_borders);
  button.addEventListener('mouseover', function () {
    // button.style.background = up;
    style(button, borders);
    ctx.fillStyle = _theme.Theme.d; // me.dropshadow = true;

    ctx.shadowColor = _theme.Theme.b;
    ctx.shadowBlur = 0.5 * dpr;
    ctx.shadowOffsetX = 1 * dpr;
    ctx.shadowOffsetY = 1 * dpr;
    me.draw();
    if (tooltip && dispatcher) dispatcher.fire('status', 'button: ' + tooltip);
  });
  button.addEventListener('mousedown', function () {
    button.style.background = down; // ctx.fillStyle = Theme.b;
    // me.draw();
  });
  button.addEventListener('mouseup', function () {
    // ctx.fillStyle = Theme.d;
    button.style.background = normal;
    style(button, borders); // me.draw();
  });
  button.addEventListener('mouseout', function () {
    // ctx.fillStyle = Theme.c;
    button.style.background = normal;
    style(button, no_borders);
    me.dropshadow = false;
    ctx.fillStyle = _theme.Theme.c;
    ctx.shadowColor = null;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    me.draw();
  });
  if (icon) this.setIcon(icon);
}

IconButton.prototype.CMD_MAP = {
  M: 'moveTo',
  L: 'lineTo',
  Q: 'quadraticCurveTo',
  C: 'bezierCurveTo',
  Z: 'closePath'
};

IconButton.prototype.draw = function () {
  if (!this.icon) return;
  var ctx = this.ctx;
  var glyph = _font.font.fonts[this.icon];
  var height = this.size;
  var dpr = window.devicePixelRatio;
  var scale = height / _font.font.unitsPerEm * dpr;
  var path_commands = glyph.commands.split(' ');
  ctx.save();
  ctx.clearRect(0, 0, this.canvas.width * dpr, this.canvas.height * dpr);

  if (this.dropshadow) {
    ctx.save();
    ctx.fillStyle = _theme.Theme.b;
    ctx.translate(1.5 * dpr, 1.5 * dpr);
    ctx.scale(scale, -scale);
    ctx.translate(0, -_font.font.ascender);
    ctx.beginPath();

    for (var i = 0, il = path_commands.length; i < il; i++) {
      var cmds = path_commands[i].split(',');
      var params = cmds.slice(1);
      ctx[this.CMD_MAP[cmds[0]]].apply(ctx, params);
    }

    ctx.fill();
    ctx.restore();
  }

  ctx.scale(scale, -scale);
  ctx.translate(0, -_font.font.ascender);
  ctx.beginPath();

  for (var _i = 0, _il = path_commands.length; _i < _il; _i++) {
    var _cmds = path_commands[_i].split(',');

    var _params = _cmds.slice(1);

    ctx[this.CMD_MAP[_cmds[0]]].apply(ctx, _params);
  }

  ctx.fill();
  ctx.restore();
  /*
  var triangle = height / 3 * dpr;
  ctx.save();
  // ctx.translate(dpr * 2, 0);
  // ctx.fillRect(this.canvas.width - triangle, this.canvas.height - triangle, triangle, triangle);
  ctx.beginPath();
  ctx.moveTo(this.canvas.width - triangle, this.canvas.height - triangle / 2);
  ctx.lineTo(this.canvas.width, this.canvas.height - triangle / 2);
  ctx.lineTo(this.canvas.width - triangle / 2, this.canvas.height);
  ctx.fill();
  ctx.restore();
  */
};

},{"../theme.js":2,"../utils/utils.js":16,"./font.js":5}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ScrollBar = ScrollBar;

var _do = require("../utils/do.js");

var _utils = require("../utils/utils.js");

// ********** class: ScrollBar ****************** //

/*
	Simple UI widget that displays a scrolltrack
	and slider, that fires some scroll events
*/
// ***********************************************
var scrolltrack_style = {
  // float: 'right',
  position: 'absolute',
  // right: '0',
  // top: '0',
  // bottom: '0',
  background: '-webkit-gradient(linear, left top, right top, color-stop(0, rgb(29,29,29)), color-stop(0.6, rgb(50,50,50)) )',
  border: '1px solid rgb(29, 29, 29)',
  // zIndex: '1000',
  textAlign: 'center',
  cursor: 'pointer'
};
var scrollbar_style = {
  background: '-webkit-gradient(linear, left top, right top, color-stop(0.2, rgb(88,88,88)), color-stop(0.6, rgb(64,64,64)) )',
  border: '1px solid rgb(25,25,25)',
  // position: 'absolute',
  position: 'relative',
  borderRadius: '6px'
};

function ScrollBar(h, w, dispatcher) {
  var SCROLLBAR_WIDTH = w ? w : 12;
  var SCROLLBAR_MARGIN = 3;
  var SCROLL_WIDTH = SCROLLBAR_WIDTH + SCROLLBAR_MARGIN * 2;
  var MIN_BAR_LENGTH = 25;
  var scrolltrack = document.createElement('div');

  _utils.utils.style(scrolltrack, scrolltrack_style);

  var scrolltrackHeight = h - 2;
  scrolltrack.style.height = scrolltrackHeight + 'px';
  scrolltrack.style.width = SCROLL_WIDTH + 'px'; // var scrollTop = 0;

  var scrollbar = document.createElement('div'); // scrollbar.className = 'scrollbar';

  _utils.utils.style(scrollbar, scrollbar_style);

  scrollbar.style.width = SCROLLBAR_WIDTH + 'px';
  scrollbar.style.height = h / 2;
  scrollbar.style.top = 0;
  scrollbar.style.left = SCROLLBAR_MARGIN + 'px'; // 0; //S

  scrolltrack.appendChild(scrollbar);
  var me = this;
  var bar_length, bar_y; // Sets lengths of scrollbar by percentage

  this.setLength = function (l) {
    // limit 0..1
    l = Math.max(Math.min(1, l), 0);
    l *= scrolltrackHeight;
    bar_length = Math.max(l, MIN_BAR_LENGTH);
    scrollbar.style.height = bar_length + 'px';
  };

  this.setHeight = function (height) {
    h = height;
    scrolltrackHeight = h - 2;
    scrolltrack.style.height = scrolltrackHeight + 'px';
  }; // Moves scrollbar to position by Percentage


  this.setPosition = function (p) {
    p = Math.max(Math.min(1, p), 0);
    var emptyTrack = scrolltrackHeight - bar_length;
    bar_y = p * emptyTrack;
    scrollbar.style.top = bar_y + 'px';
  };

  this.setLength(1);
  this.setPosition(0);
  this.onScroll = new _do.Do();
  var mouse_down_grip;

  function onDown(event) {
    event.preventDefault();

    if (event.target == scrollbar) {
      mouse_down_grip = event.clientY;
      document.addEventListener('mousemove', onMove, false);
      document.addEventListener('mouseup', onUp, false);
    } else {
      if (event.clientY < bar_y) {
        me.onScroll.fire('pageup');
      } else if (event.clientY > bar_y + bar_length) {
        me.onScroll.fire('pagedown');
      } // if want to drag scroller to empty track instead
      // me.setPosition(event.clientY / (scrolltrackHeight - 1));

    }
  }

  function onMove(event) {
    event.preventDefault(); // event.target == scrollbar

    var emptyTrack = scrolltrackHeight - bar_length;
    var scrollto = (event.clientY - mouse_down_grip) / emptyTrack; // clamp limits to 0..1

    if (scrollto > 1) scrollto = 1;
    if (scrollto < 0) scrollto = 0;
    me.setPosition(scrollto);
    me.onScroll.fire('scrollto', scrollto);
  }

  function onUp(event) {
    onMove(event);
    document.removeEventListener('mousemove', onMove, false);
    document.removeEventListener('mouseup', onUp, false);
  }

  scrolltrack.addEventListener('mousedown', onDown, false);
  this.dom = scrolltrack;
}

},{"../utils/do.js":9,"../utils/utils.js":16}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UINumber = UINumber;

var _theme = require("../theme.js");

var _do = require("../utils/do.js");

var _util_handle_drag = require("../utils/util_handle_drag.js");

var _utils = require("../utils/utils.js");

var firstDefined = _utils.utils.firstDefined,
    style = _utils.utils.style;
/**************************/
// UINumber

/**************************/

function UINumber(config) {
  config = config || {};
  var min = config.min === undefined ? -Infinity : config.min; // config.xstep and config.ystep allow configuring adjustment
  // speed across each axis.
  // config.wheelStep and config.wheelStepFine allow configuring
  // adjustment speed for mousewheel, and mousewheel while holding <alt>
  // If only config.step is specified, all other adjustment speeds
  // are set to the same value.

  var xstep = firstDefined(config.xstep, config.step, 0.001);
  var ystep = firstDefined(config.ystep, config.step, 0.1);
  var wheelStep = firstDefined(config.wheelStep, ystep);
  var wheelStepFine = firstDefined(config.wheelStepFine, xstep);
  var precision = config.precision || 3; // Range
  // Max

  var span = document.createElement('input'); // span.type = 'number'; // spinner

  style(span, {
    textAlign: 'center',
    fontSize: '10px',
    padding: '1px',
    cursor: 'ns-resize',
    width: '40px',
    margin: 0,
    marginRight: '10px',
    appearance: 'none',
    outline: 'none',
    border: 0,
    background: 'none',
    borderBottom: '1px dotted ' + _theme.Theme.c,
    color: _theme.Theme.c
  });
  var me = this;
  var state,
      value = 0,
      unchanged_value;
  this.onChange = new _do.Do();
  span.addEventListener('change', function (e) {
    console.log('input changed', span.value);
    value = parseFloat(span.value, 10);
    fireChange();
  }); // Allow keydown presses in inputs, don't allow parent to block them

  span.addEventListener('keydown', function (e) {
    e.stopPropagation();
  });
  span.addEventListener('focus', function (e) {
    span.setSelectionRange(0, span.value.length);
  });
  span.addEventListener('wheel', function (e) {
    // Disregard pixel/line/page scrolling and just
    // use event direction.
    var inc = e.deltaY > 0 ? 1 : -1;

    if (e.altKey) {
      inc *= wheelStepFine;
    } else {
      inc *= wheelStep;
    }

    value = clamp(value + inc);
    fireChange();
  });
  (0, _util_handle_drag.handleDrag)(span, onDown, onMove, onUp);

  function clamp(value) {
    return Math.max(min, value);
  }

  function onUp(e) {
    if (e.moved) fireChange();else {
      // single click
      span.focus();
    }
  }

  function onMove(e) {
    var dx = e.dx;
    var dy = e.dy;
    value = unchanged_value + dx * xstep + dy * -ystep;
    value = clamp(value); // value = +value.toFixed(precision); // or toFixed toPrecision

    me.onChange.fire(value, true);
  }

  function onDown(e) {
    unchanged_value = value;
  }

  function fireChange() {
    me.onChange.fire(value);
  }

  this.dom = span; // public

  this.setValue = function (v) {
    value = v;
    span.value = value.toFixed(precision);
  };

  this.paint = function () {
    if (value && document.activeElement !== span) {
      span.value = value.toFixed(precision);
    }
  };
}

},{"../theme.js":2,"../utils/do.js":9,"../utils/util_handle_drag.js":13,"../utils/utils.js":16}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Do = void 0;

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }

/* Over simplistic Event Dispatcher */
var Do = /*#__PURE__*/function () {
  function Do() {
    _classCallCheck(this, Do);

    this.listeners = new Set();
  }

  _createClass(Do, [{
    key: "do",
    value: function _do(callback) {
      this.listeners.add(callback);
    }
  }, {
    key: "undo",
    value: function undo(callback) {
      this.listeners["delete"](callback);
    }
  }, {
    key: "fire",
    value: function fire() {
      var _iterator = _createForOfIteratorHelper(this.listeners),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var l = _step.value;
          l.apply(void 0, arguments);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }]);

  return Do;
}();

exports.Do = Do;

},{}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DockingWindow = DockingWindow;

var _do = require("./do.js");

var _layout_constants = require("../layout_constants.js");

var SNAP_FULL_SCREEN = 'full-screen';
var SNAP_TOP_EDGE = 'snap-top-edge'; // or actually top half

var SNAP_LEFT_EDGE = 'snap-left-edge';
var SNAP_RIGHT_EDGE = 'snap-right-edge';
var SNAP_BOTTOM_EDGE = 'snap-bottom-edge';
var SNAP_DOCK_BOTTOM = 'dock-bottom';

function setBounds(element, x, y, w, h) {
  element.style.left = x + 'px';
  element.style.top = y + 'px';
  element.style.width = w + 'px';
  element.style.height = h + 'px';
}
/*

The Docking Widget

1. when .allowMove(true) is set, the pane becomes draggable
2. when dragging, if the pointer to near to the edges,
   it resizes the ghost pannel as a suggestion to snap into the
   suggested position
3. user can either move pointer away or let go of the cursor,
   allow the pane to be resized and snapped into position


My origin implementation from https://codepen.io/zz85/pen/gbOoVP

args eg.
	var pane = document.getElementById('pane');
	var ghostpane = document.getElementById('ghostpane');
	widget = new DockingWindow(pane, ghostpane)


	title_dom.addEventListener('mouseover', function() {
		widget.allowMove(true);
	});

	title_dom.addEventListener('mouseout', function() {
		widget.allowMove(false);
	});

	resize_full.onClick(() => {
		widget.maximize() // fill to screen
	})

	// TODO callback when pane is resized
	widget.resizes.do(() => {
		something
	})
*/


function DockingWindow(pane, ghostpane) {
  "use strict"; // Minimum resizable area

  var minWidth = 100;
  var minHeight = 80; // Thresholds

  var FULLSCREEN_MARGINS = 2;
  var SNAP_MARGINS = 8;
  var MARGINS = 2; // End of what's configurable.

  var pointerStart = null;
  var onRightEdge, onBottomEdge, onLeftEdge, onTopEdge;
  var preSnapped;
  var bounds, x, y;
  var redraw = false;
  var allowDragging = true;
  var snapType;

  this.allowMove = function (allow) {
    allowDragging = allow;
  };

  function canMove() {
    return allowDragging;
  }

  this.maximize = function () {
    if (!preSnapped) {
      preSnapped = {
        width: bounds.width,
        height: bounds.height,
        top: bounds.top,
        left: bounds.left
      };
      snapType = SNAP_FULL_SCREEN;
      resizeEdges();
    } else {
      setBounds(pane, bounds.left, bounds.top, bounds.width, bounds.height);
      calculateBounds();
      snapType = null;
      preSnapped = null;
    }
  };

  this.resizes = new _do.Do();
  /* DOM Utils */

  function hideGhostPane() {
    // hide the hinter, animatating to the pane's bounds
    setBounds(ghostpane, bounds.left, bounds.top, bounds.width, bounds.height);
    ghostpane.style.opacity = 0;
  }

  function onTouchDown(e) {
    onDown(e.touches[0]);
    e.preventDefault();
  }

  function onTouchMove(e) {
    onMove(e.touches[0]);
  }

  function onTouchEnd(e) {
    if (e.touches.length == 0) onUp(e.changedTouches[0]);
  }

  function onMouseDown(e) {
    onDown(e);
  }

  function onMouseUp(e) {
    onUp(e);
  }

  function onDown(e) {
    calculateBounds(e);
    var isResizing = onRightEdge || onBottomEdge || onTopEdge || onLeftEdge;
    var isMoving = !isResizing && canMove();
    pointerStart = {
      x: x,
      y: y,
      cx: e.clientX,
      cy: e.clientY,
      w: bounds.width,
      h: bounds.height,
      isResizing: isResizing,
      isMoving: isMoving,
      onTopEdge: onTopEdge,
      onLeftEdge: onLeftEdge,
      onRightEdge: onRightEdge,
      onBottomEdge: onBottomEdge
    };

    if (isResizing || isMoving) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function calculateBounds(e) {
    bounds = pane.getBoundingClientRect();
    x = e.clientX - bounds.left;
    y = e.clientY - bounds.top;
    onTopEdge = y < MARGINS;
    onLeftEdge = x < MARGINS;
    onRightEdge = x >= bounds.width - MARGINS;
    onBottomEdge = y >= bounds.height - MARGINS;
  }

  var e; // current mousemove event

  function onMove(ee) {
    e = ee;
    calculateBounds(e);
    redraw = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!redraw) return;
    redraw = false; // style cursor

    if (onRightEdge && onBottomEdge || onLeftEdge && onTopEdge) {
      pane.style.cursor = 'nwse-resize';
    } else if (onRightEdge && onTopEdge || onBottomEdge && onLeftEdge) {
      pane.style.cursor = 'nesw-resize';
    } else if (onRightEdge || onLeftEdge) {
      pane.style.cursor = 'ew-resize';
    } else if (onBottomEdge || onTopEdge) {
      pane.style.cursor = 'ns-resize';
    } else if (canMove()) {
      pane.style.cursor = 'move';
    } else {
      pane.style.cursor = 'default';
    }

    if (!pointerStart) return;
    /* User is resizing */

    if (pointerStart.isResizing) {
      if (pointerStart.onRightEdge) pane.style.width = Math.max(x, minWidth) + 'px';
      if (pointerStart.onBottomEdge) pane.style.height = Math.max(y, minHeight) + 'px';

      if (pointerStart.onLeftEdge) {
        var currentWidth = Math.max(pointerStart.cx - e.clientX + pointerStart.w, minWidth);

        if (currentWidth > minWidth) {
          pane.style.width = currentWidth + 'px';
          pane.style.left = e.clientX + 'px';
        }
      }

      if (pointerStart.onTopEdge) {
        var currentHeight = Math.max(pointerStart.cy - e.clientY + pointerStart.h, minHeight);

        if (currentHeight > minHeight) {
          pane.style.height = currentHeight + 'px';
          pane.style.top = e.clientY + 'px';
        }
      }

      hideGhostPane();
      self.resizes.fire(bounds.width, bounds.height);
      return;
    }
    /* User is dragging */


    if (pointerStart.isMoving) {
      var snapType = checkSnapType();

      if (snapType) {
        calcSnapBounds(snapType); // console.log('snapping...', JSON.stringify(snapBounds))

        var left = snapBounds.left,
            top = snapBounds.top,
            width = snapBounds.width,
            height = snapBounds.height;
        setBounds(ghostpane, left, top, width, height);
        ghostpane.style.opacity = 0.2;
      } else {
        hideGhostPane();
      }

      if (preSnapped) {
        setBounds(pane, e.clientX - preSnapped.width / 2, e.clientY - Math.min(pointerStart.y, preSnapped.height), preSnapped.width, preSnapped.height);
        return;
      } // moving


      pane.style.top = e.clientY - pointerStart.y + 'px';
      pane.style.left = e.clientX - pointerStart.x + 'px';
      return;
    }
  }

  function checkSnapType() {
    // drag to full screen
    if (e.clientY < FULLSCREEN_MARGINS) return SNAP_FULL_SCREEN; // drag for top half screen

    if (e.clientY < SNAP_MARGINS) return SNAP_TOP_EDGE; // drag for left half screen

    if (e.clientX < SNAP_MARGINS) return SNAP_LEFT_EDGE; // drag for right half screen

    if (window.innerWidth - e.clientX < SNAP_MARGINS) return SNAP_RIGHT_EDGE; // drag for bottom half screen

    if (window.innerHeight - e.clientY < SNAP_MARGINS) return SNAP_BOTTOM_EDGE;
  }

  var self = this;
  var snapBounds = {};

  function calcSnapBounds(snapType) {
    if (!snapType) return;
    var width, height, left, top;

    switch (snapType) {
      case SNAP_FULL_SCREEN:
        width = window.innerWidth;
        height = window.innerHeight;
        left = 0;
        top = 0;
        break;

      case SNAP_TOP_EDGE:
        width = window.innerWidth;
        height = window.innerHeight / 2;
        left = 0;
        top = 0;
        break;

      case SNAP_LEFT_EDGE:
        width = window.innerWidth / 2;
        height = window.innerHeight;
        left = 0;
        top = 0;
        break;

      case SNAP_RIGHT_EDGE:
        width = window.innerWidth / 2;
        height = window.innerHeight;
        left = window.innerWidth - width;
        top = 0;
        break;

      case SNAP_BOTTOM_EDGE:
        width = window.innerWidth;
        height = window.innerHeight / 3;
        left = 0;
        top = window.innerHeight - height;
        break;

      case SNAP_DOCK_BOTTOM:
        width = bounds.width;
        height = bounds.height;
        left = (window.innerWidth - width) * 0.5;
        top = window.innerHeight - height;
    }

    Object.assign(snapBounds, {
      left: left,
      top: top,
      width: width,
      height: height
    });
  }
  /* When one of the edges is move, resize pane */


  function resizeEdges() {
    if (!snapType) return;
    calcSnapBounds(snapType);
    var left = snapBounds.left,
        top = snapBounds.top,
        width = snapBounds.width,
        height = snapBounds.height;
    setBounds(pane, left, top, width, height);
    self.resizes.fire(width, height);
  }

  function onUp(e) {
    calculateBounds(e);

    if (pointerStart && pointerStart.isMoving) {
      // Snap
      snapType = checkSnapType();

      if (snapType) {
        preSnapped = {
          width: bounds.width,
          height: bounds.height,
          top: bounds.top,
          left: bounds.left
        };
        resizeEdges();
      } else {
        preSnapped = null;
      }

      hideGhostPane();
    }

    pointerStart = null;
  }

  function init() {
    window.addEventListener('resize', function () {
      resizeEdges();
    });
    setBounds(pane, 0, 0, _layout_constants.LayoutConstants.width, _layout_constants.LayoutConstants.height);
    setBounds(ghostpane, 0, 0, _layout_constants.LayoutConstants.width, _layout_constants.LayoutConstants.height); // Mouse events

    pane.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onMouseUp); // Touch events

    pane.addEventListener('touchstart', onTouchDown);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
    bounds = pane.getBoundingClientRect();
    snapType = SNAP_DOCK_BOTTOM; // use setTimeout as a hack to get diemensions correctly! :(

    setTimeout(function () {
      return resizeEdges();
    });
    hideGhostPane();
    animate();
  }

  init();
}

},{"../layout_constants.js":1,"./do.js":9}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DataStore = DataStore;

var _layout_constants = require("../layout_constants.js");

var _do = require("./do.js");

var package_json = {
  version: "test-version"
};

// Data Store with a source of truth
function DataStore() {
  this.DELIMITER = ':';
  this.blank();
  this.onOpen = new _do.Do();
  this.onSave = new _do.Do();
  this.listeners = [];
}

DataStore.prototype.addListener = function (path, cb) {
  this.listeners.push({
    path: path,
    callback: cb
  });
};

DataStore.prototype.blank = function () {
  var data = {};
  data.version = package_json.version;
  data.modified = new Date().toString();
  data.title = 'Untitled';
  data.ui = {
    currentTime: 0,
    totalTime: _layout_constants.LayoutConstants.default_length,
    scrollTime: 0,
    timeScale: _layout_constants.LayoutConstants.time_scale
  };
  data.layers = [];
  this.data = data;
};

DataStore.prototype.update = function () {
  var data = this.data;
  data.version = package_json.version;
  data.modified = new Date().toString();
};

DataStore.prototype.setJSONString = function (data) {
  this.data = JSON.parse(data);
};

DataStore.prototype.setJSON = function (data) {
  this.data = data;
};

DataStore.prototype.getJSONString = function (format) {
  return JSON.stringify(this.data, null, format);
};

DataStore.prototype.getValue = function (paths) {
  var descend = paths.split(this.DELIMITER);
  var reference = this.data;

  for (var i = 0, il = descend.length; i < il; i++) {
    var path = descend[i];

    if (reference[path] === undefined) {
      console.warn('Cant find ' + paths);
      return;
    }

    reference = reference[path];
  }

  return reference;
};

DataStore.prototype.setValue = function (paths, value) {
  var descend = paths.split(this.DELIMITER);
  var reference = this.data;
  var path;

  for (var i = 0, il = descend.length - 1; path = descend[i], i < il; i++) {
    reference = reference[path];
  }

  reference[path] = value;
  this.listeners.forEach(function (l) {
    if (paths.indexOf(l.path) > -1) l.callback();
  });
};

DataStore.prototype.get = function (path, suffix) {
  if (suffix) path = suffix + this.DELIMITER + path;
  return new DataProx(this, path);
};

function DataProx(store, path) {
  this.path = path;
  this.store = store;
}

DataProx.prototype = {
  get value() {
    return this.store.getValue(this.path);
  },

  set value(val) {
    this.store.setValue(this.path, val);
  }

};

DataProx.prototype.get = function (path) {
  return this.store.get(path, this.path);
};

},{"../layout_constants.js":1,"./do.js":9}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dispatcher = Dispatcher;

/**************************/
// Dispatcher

/**************************/
function Dispatcher() {
  var event_listeners = {};

  function on(type, listener) {
    if (!(type in event_listeners)) {
      event_listeners[type] = [];
    }

    var listeners = event_listeners[type];
    listeners.push(listener);
  }

  function fire(type) {
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    var listeners = event_listeners[type];
    if (!listeners) return;

    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener.apply(listener, args);
    }
  }

  this.on = on;
  this.fire = fire;
}

},{}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.handleDrag = handleDrag;

function handleDrag(element, ondown, onmove, onup, down_criteria) {
  var pointer = null;
  var bounds = element.getBoundingClientRect();
  element.addEventListener('mousedown', onMouseDown);

  function onMouseDown(e) {
    handleStart(e);

    if (down_criteria && !down_criteria(pointer)) {
      pointer = null;
      return;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    ondown(pointer);
    e.preventDefault();
  }

  function onMouseMove(e) {
    handleMove(e);
    onmove(pointer);
  }

  function handleStart(e) {
    bounds = element.getBoundingClientRect();
    var currentx = e.clientX,
        currenty = e.clientY;
    pointer = {
      startx: currentx,
      starty: currenty,
      x: currentx,
      y: currenty,
      dx: 0,
      dy: 0,
      offsetx: currentx - bounds.left,
      offsety: currenty - bounds.top,
      moved: false
    };
  }

  function handleMove(e) {
    bounds = element.getBoundingClientRect();
    var currentx = e.clientX,
        currenty = e.clientY,
        offsetx = currentx - bounds.left,
        offsety = currenty - bounds.top;
    pointer.x = currentx;
    pointer.y = currenty;
    pointer.dx = e.clientX - pointer.startx;
    pointer.dy = e.clientY - pointer.starty;
    pointer.offsetx = offsetx;
    pointer.offsety = offsety; // If the pointer dx/dy is _ever_ non-zero, then it's moved

    pointer.moved = pointer.moved || pointer.dx !== 0 || pointer.dy !== 0;
  }

  function onMouseUp(e) {
    handleMove(e);
    onup(pointer);
    pointer = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  element.addEventListener('touchstart', onTouchStart);

  function onTouchStart(te) {
    if (te.touches.length == 1) {
      var e = te.touches[0];
      if (down_criteria && !down_criteria(e)) return;
      te.preventDefault();
      handleStart(e);
      ondown(pointer);
    }

    element.addEventListener('touchmove', onTouchMove);
    element.addEventListener('touchend', onTouchEnd);
  }

  function onTouchMove(te) {
    var e = te.touches[0];
    onMouseMove(e);
  }

  function onTouchEnd(e) {
    // var e = e.touches[0];
    onMouseUp(e);
    element.removeEventListener('touchmove', onTouchMove);
    element.removeEventListener('touchend', onTouchEnd);
  } // this.release = function() {
  // 	element.removeEventListener('mousedown', onMouseDown);
  // 	element.removeEventListener('touchstart', onTouchStart);
  // };

}

},{}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tweens = void 0;

/**************************/
// Tweens

/**************************/
var Tweens = {
  none: function none(k) {
    return 0;
  },
  linear: function linear(k) {
    return k;
  },
  quadEaseIn: function quadEaseIn(k) {
    return k * k;
  },
  quadEaseOut: function quadEaseOut(k) {
    return -k * (k - 2);
  },
  quadEaseInOut: function quadEaseInOut(k) {
    if ((k *= 2) < 1) return 0.5 * k * k;
    return -0.5 * (--k * (k - 2) - 1);
  }
};
exports.Tweens = Tweens;

},{}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UndoManager = UndoManager;
exports.UndoState = UndoState;

/**************************/
// Undo Manager

/**************************/
function UndoState(state, description) {
  // this.state = JSON.stringify(state);
  this.state = state.getJSONString();
  this.description = description;
}

function UndoManager(dispatcher, max) {
  this.dispatcher = dispatcher;
  this.MAX_ITEMS = max || 100;
  this.clear();
}

UndoManager.prototype.save = function (state, suppress) {
  var states = this.states;
  var next_index = this.index + 1;
  var to_remove = states.length - next_index;
  states.splice(next_index, to_remove, state);

  if (states.length > this.MAX_ITEMS) {
    states.shift();
  }

  this.index = states.length - 1; // console.log('Undo State Saved: ', state.description);

  if (!suppress) this.dispatcher.fire('state:save', state.description);
};

UndoManager.prototype.clear = function () {
  this.states = [];
  this.index = -1; // FIXME: leave default state or always leave one state?
};

UndoManager.prototype.canUndo = function () {
  return this.index > 0; // && this.states.length > 1
};

UndoManager.prototype.canRedo = function () {
  return this.index < this.states.length - 1;
};

UndoManager.prototype.undo = function () {
  if (this.canUndo()) {
    this.dispatcher.fire('status', 'Undo: ' + this.get().description);
    this.index--;
  } else {
    this.dispatcher.fire('status', 'Nothing to undo');
  }

  return this.get();
};

UndoManager.prototype.redo = function () {
  if (this.canRedo()) {
    this.index++;
    this.dispatcher.fire('status', 'Redo: ' + this.get().description);
  } else {
    this.dispatcher.fire('status', 'Nothing to redo');
  }

  return this.get();
};

UndoManager.prototype.get = function () {
  return this.states[this.index];
};

},{}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utils = void 0;

var _util_tween = require("./util_tween.js");

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

var STORAGE_PREFIX = 'timeliner-';
/**************************/
// Utils

/**************************/

function firstDefined() {
  for (var i = 0; i < arguments.length; i++) {
    if (typeof arguments[i] !== 'undefined') {
      return arguments[i];
    }
  }

  return undefined;
}

function style(element) {
  for (var i = 0; i < (arguments.length <= 1 ? 0 : arguments.length - 1); ++i) {
    var style = i + 1 < 1 || arguments.length <= i + 1 ? undefined : arguments[i + 1];

    for (var s in style) {
      element.style[s] = style[s];
    }
  }
}

function saveToFile(string, filename) {
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  var blob = new Blob([string], {
    type: 'octet/stream'
  }),
      // application/json
  url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  fakeClick(a);
  setTimeout(function () {
    // cleanup and revoke
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 500);
}

var input, openCallback;

function handleFileSelect(evt) {
  var files = evt.target.files; // FileList object

  console.log('handle file select', files.length);
  var f = files[0];
  if (!f) return; // Can try to do MINE match
  // if (!f.type.match('application/json')) {
  //   return;
  // }

  console.log('match', f.type);
  var reader = new FileReader(); // Closure to capture the file information.

  reader.onload = function (e) {
    var data = e.target.result;
    openCallback(data);
  };

  reader.readAsText(f);
  input.value = '';
}

function openAs(callback, target) {
  console.log('openfile...');
  openCallback = callback;

  if (!input) {
    input = document.createElement('input');
    input.style.display = 'none';
    input.type = 'file';
    input.addEventListener('change', handleFileSelect);
    target = target || document.body;
    target.appendChild(input);
  }

  fakeClick(input);
}

function fakeClick(target) {
  var e = document.createEvent("MouseEvents");
  e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
  target.dispatchEvent(e);
}

function format_friendly_seconds(s, type) {
  // TODO Refactor to 60fps???
  // 20 mins * 60 sec = 1080
  // 1080s * 60fps = 1080 * 60 < Number.MAX_SAFE_INTEGER
  var raw_secs = s | 0;
  var secs_micro = s % 60;
  var secs = raw_secs % 60;
  var raw_mins = raw_secs / 60 | 0;
  var mins = raw_mins % 60;
  var hours = raw_mins / 60 | 0;
  var secs_str = (secs / 100).toFixed(2).substring(2);
  var str = mins + ':' + secs_str;

  if (s % 1 > 0) {
    var t2 = s % 1 * 60;
    if (type === 'frames') str = secs + '+' + t2.toFixed(0) + 'f';else str += (s % 1).toFixed(2).substring(1); // else str = mins + ':' + secs_micro;
    // else str = secs_micro + 's'; /// .toFixed(2)
  }

  return str;
} // get object at time


function findTimeinLayer(layer, time) {
  var values = layer.values;
  var i, il; // TODO optimize by checking time / binary search

  for (i = 0, il = values.length; i < il; i++) {
    var value = values[i];

    if (value.time === time) {
      return {
        index: i,
        object: value
      };
    } else if (value.time > time) {
      return i;
    }
  }

  return i;
}

function timeAtLayer(layer, t) {
  // Find the value of layer at t seconds.
  // this expect layer to be sorted
  // not the most optimized for now, but would do.
  var values = layer.values;
  var i, il, entry, prev_entry;
  il = values.length; // can't do anything

  if (il === 0) return;
  if (layer._mute) return; // find boundary cases

  entry = values[0];

  if (t < entry.time) {
    return {
      value: entry.value,
      can_tween: false,
      // cannot tween
      keyframe: false // not on keyframe

    };
  }

  for (i = 0; i < il; i++) {
    prev_entry = entry;
    entry = values[i];

    if (t === entry.time) {
      // only exception is on the last KF, where we display tween from prev entry
      if (i === il - 1) {
        return {
          // index: i,
          entry: prev_entry,
          tween: prev_entry.tween,
          can_tween: il > 1,
          value: entry.value,
          keyframe: true
        };
      }

      return {
        // index: i,
        entry: entry,
        tween: entry.tween,
        can_tween: il > 1,
        value: entry.value,
        keyframe: true // il > 1

      };
    }

    if (t < entry.time) {
      // possibly a tween
      if (!prev_entry.tween) {
        // or if value is none
        return {
          value: prev_entry.value,
          tween: false,
          entry: prev_entry,
          can_tween: true,
          keyframe: false
        };
      } // calculate tween


      var time_diff = entry.time - prev_entry.time;
      var value_diff = entry.value - prev_entry.value;
      var tween = prev_entry.tween;
      var dt = t - prev_entry.time;
      var k = dt / time_diff;
      var new_value = prev_entry.value + _util_tween.Tweens[tween](k) * value_diff;
      return {
        entry: prev_entry,
        value: new_value,
        tween: prev_entry.tween,
        can_tween: true,
        keyframe: false
      };
    }
  } // time is after all entries


  return {
    value: entry.value,
    can_tween: false,
    keyframe: false
  };
}

function proxy_ctx(ctx) {
  // Creates a proxy 2d context wrapper which
  // allows the fluent / chaining API.
  var wrapper = {};

  function proxy_function(c) {
    return function () {
      // Warning: this doesn't return value of function call
      ctx[c].apply(ctx, arguments);
      return wrapper;
    };
  }

  function proxy_property(c) {
    return function (v) {
      ctx[c] = v;
      return wrapper;
    };
  }

  wrapper.run = function (args) {
    args(wrapper);
    return wrapper;
  };

  for (var c in ctx) {
    // if (!ctx.hasOwnProperty(c)) continue;
    // console.log(c, typeof(ctx[c]), ctx.hasOwnProperty(c));
    // string, number, boolean, function, object
    var type = _typeof(ctx[c]);

    switch (type) {
      case 'object':
        break;

      case 'function':
        wrapper[c] = proxy_function(c);
        break;

      default:
        wrapper[c] = proxy_property(c);
        break;
    }
  }

  return wrapper;
}

var utils = {
  STORAGE_PREFIX: STORAGE_PREFIX,
  firstDefined: firstDefined,
  style: style,
  saveToFile: saveToFile,
  openAs: openAs,
  format_friendly_seconds: format_friendly_seconds,
  findTimeinLayer: findTimeinLayer,
  timeAtLayer: timeAtLayer,
  proxy_ctx: proxy_ctx
};
exports.utils = utils;

},{"./util_tween.js":14}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LayerCabinet = LayerCabinet;

var _layout_constants = require("../layout_constants.js");

var _view_layer = require("./view_layer.js");

var _icon_button = require("../ui/icon_button.js");

var _utils = require("../utils/utils.js");

var _theme = require("../theme.js");

var _ui_number = require("../ui/ui_number.js");

var STORAGE_PREFIX = _utils.utils.STORAGE_PREFIX,
    style = _utils.utils.style;

function LayerCabinet(data, dispatcher) {
  var layer_store = data.get('layers');
  var div = document.createElement('div');
  var top = document.createElement('div');
  top.style.cssText = 'margin: 0px; top: 0; left: 0; height: ' + _layout_constants.LayoutConstants.MARKER_TRACK_HEIGHT + 'px'; // top.style.textAlign = 'right';

  var layer_scroll = document.createElement('div');
  style(layer_scroll, {
    position: 'absolute',
    top: _layout_constants.LayoutConstants.MARKER_TRACK_HEIGHT + 'px',
    // height: (LayoutConstants.height - LayoutConstants.MARKER_TRACK_HEIGHT) + 'px'
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden'
  });
  layer_scroll.id = 'layer_scroll';
  div.appendChild(layer_scroll);
  var playing = false;
  var button_styles = {
    width: '22px',
    height: '22px',
    padding: '2px'
  };
  var op_button_styles = {
    width: '32px',
    padding: '3px 4px 3px 4px'
  };
  var play_button = new _icon_button.IconButton(16, 'play', 'play', dispatcher);
  style(play_button.dom, button_styles, {
    marginTop: '2px'
  });
  play_button.onClick(function (e) {
    e.preventDefault();
    dispatcher.fire('controls.toggle_play');
  });
  var stop_button = new _icon_button.IconButton(16, 'stop', 'stop', dispatcher);
  style(stop_button.dom, button_styles, {
    marginTop: '2px'
  });
  stop_button.onClick(function (e) {
    dispatcher.fire('controls.stop');
  });
  var undo_button = new _icon_button.IconButton(16, 'undo', 'undo', dispatcher);
  style(undo_button.dom, op_button_styles);
  undo_button.onClick(function () {
    dispatcher.fire('controls.undo');
  });
  var redo_button = new _icon_button.IconButton(16, 'repeat', 'redo', dispatcher);
  style(redo_button.dom, op_button_styles);
  redo_button.onClick(function () {
    dispatcher.fire('controls.redo');
  });
  var range = document.createElement('input');
  range.type = "range";
  range.value = 0;
  range.min = -1;
  range.max = +1;
  range.step = 0.125;
  style(range, {
    width: '90px',
    margin: '0px',
    marginLeft: '2px',
    marginRight: '2px'
  });
  var draggingRange = 0;
  range.addEventListener('mousedown', function () {
    draggingRange = 1;
  });
  range.addEventListener('mouseup', function () {
    draggingRange = 0;
    changeRange();
  });
  range.addEventListener('mousemove', function () {
    if (!draggingRange) return;
    changeRange();
  });
  div.appendChild(top);
  var time_options = {
    min: 0,
    step: 0.125
  };
  var currentTime = new _ui_number.UINumber(time_options);
  var totalTime = new _ui_number.UINumber(time_options);
  var currentTimeStore = data.get('ui:currentTime');
  var totalTimeStore = data.get('ui:totalTime'); // UI2StoreBind(view, datastore) {
  // 	view.onChange.do(function(v) {
  // 		datastore.value = view;
  // 	})
  // 	datastore.onChange.do(function(v) {
  // 		view.setValue = v;
  // 	})
  // }

  currentTime.onChange["do"](function (value, done) {
    dispatcher.fire('time.update', value); // repaint();
  });
  totalTime.onChange["do"](function (value, done) {
    totalTimeStore.value = value;
    repaint();
  }); // Play Controls

  top.appendChild(currentTime.dom);
  top.appendChild(document.createTextNode('/')); // 0:00:00 / 0:10:00

  top.appendChild(totalTime.dom);
  top.appendChild(play_button.dom);
  top.appendChild(stop_button.dom);
  top.appendChild(range);
  var operations_div = document.createElement('div');
  style(operations_div, {
    marginTop: '4px' // borderBottom: '1px solid ' + Theme.b

  });
  top.appendChild(operations_div); // top.appendChild(document.createElement('br'));
  // open _alt

  var file_open = new _icon_button.IconButton(16, 'folder_open_alt', 'Open', dispatcher);
  style(file_open.dom, op_button_styles);
  operations_div.appendChild(file_open.dom);

  function populateOpen() {
    while (dropdown.length) {
      dropdown.remove(0);
    }

    var option;
    option = document.createElement('option');
    option.text = 'New';
    option.value = '*new*';
    dropdown.add(option);
    option = document.createElement('option');
    option.text = 'Import JSON';
    option.value = '*import*';
    dropdown.add(option); // Doesn't work
    // option = document.createElement('option');
    // option.text = 'Select File';
    // option.value = '*select*';
    // dropdown.add(option);

    option = document.createElement('option');
    option.text = '==Open==';
    option.disabled = true;
    option.selected = true;
    dropdown.add(option);
    var regex = new RegExp(STORAGE_PREFIX + '(.*)');

    for (var key in localStorage) {
      // console.log(key);
      var match = regex.exec(key);

      if (match) {
        option = document.createElement('option');
        option.text = match[1];
        dropdown.add(option);
      }
    }
  } // listen on other tabs


  window.addEventListener('storage', function (e) {
    var regex = new RegExp(STORAGE_PREFIX + '(.*)');

    if (regex.exec(e.key)) {
      populateOpen();
    }
  });
  dispatcher.on('save:done', populateOpen);
  var dropdown = document.createElement('select');
  style(dropdown, {
    position: 'absolute',
    // right: 0,
    // margin: 0,
    opacity: 0,
    width: '16px',
    height: '16px' // zIndex: 1,

  });
  dropdown.addEventListener('change', function (e) {
    // console.log('changed', dropdown.length, dropdown.value);
    switch (dropdown.value) {
      case '*new*':
        dispatcher.fire('new');
        break;

      case '*import*':
        dispatcher.fire('import');
        break;

      case '*select*':
        dispatcher.fire('openfile');
        break;

      default:
        dispatcher.fire('open', dropdown.value);
        break;
    }
  });
  file_open.dom.insertBefore(dropdown, file_open.dom.firstChild);
  populateOpen(); // // json import
  // var import_json = new IconButton(16, 'signin', 'Import JSON', dispatcher);
  // operations_div.appendChild(import_json.dom);
  // import_json.onClick(function() {
  // 	dispatcher.fire('import');
  // });
  // // new
  // var file_alt = new IconButton(16, 'file_alt', 'New', dispatcher);
  // operations_div.appendChild(file_alt.dom);
  // save

  var save = new _icon_button.IconButton(16, 'save', 'Save', dispatcher);
  style(save.dom, op_button_styles);
  operations_div.appendChild(save.dom);
  save.onClick(function () {
    dispatcher.fire('save');
  }); // save as

  var save_as = new _icon_button.IconButton(16, 'paste', 'Save as', dispatcher);
  style(save_as.dom, op_button_styles);
  operations_div.appendChild(save_as.dom);
  save_as.onClick(function () {
    dispatcher.fire('save_as');
  }); // download json (export)

  var download_alt = new _icon_button.IconButton(16, 'download_alt', 'Download / Export JSON to file', dispatcher);
  style(download_alt.dom, op_button_styles);
  operations_div.appendChild(download_alt.dom);
  download_alt.onClick(function () {
    dispatcher.fire('export');
  });
  var upload_alt = new _icon_button.IconButton(16, 'upload_alt', 'Load from file', dispatcher);
  style(upload_alt.dom, op_button_styles);
  operations_div.appendChild(upload_alt.dom);
  upload_alt.onClick(function () {
    dispatcher.fire('openfile');
  });
  var span = document.createElement('span');
  span.style.width = '20px';
  span.style.display = 'inline-block';
  operations_div.appendChild(span);
  operations_div.appendChild(undo_button.dom);
  operations_div.appendChild(redo_button.dom);
  operations_div.appendChild(document.createElement('br')); // Cloud Download / Upload edit pencil

  /*
  // // show layer
  // var eye_open = new IconButton(16, 'eye_open', 'eye_open', dispatcher);
  // operations_div.appendChild(eye_open.dom);
  	// // hide / disable layer
  // var eye_close = new IconButton(16, 'eye_close', 'eye_close', dispatcher);
  // operations_div.appendChild(eye_close.dom);
  
  // remove layer
  var minus = new IconButton(16, 'minus', 'minus', dispatcher);
  operations_div.appendChild(minus.dom);
  	// check
  var ok = new IconButton(16, 'ok', 'ok', dispatcher);
  operations_div.appendChild(ok.dom);
  	// cross
  var remove = new IconButton(16, 'remove', 'remove', dispatcher);
  operations_div.appendChild(remove.dom);
  	*/
  // range.addEventListener('change', changeRange);

  function convertPercentToTime(t) {
    var min_time = 10 * 60; // 10 minutes

    min_time = data.get('ui:totalTime').value;
    var max_time = 1;
    var v = _layout_constants.LayoutConstants.width * 0.8 / (t * (max_time - min_time) + min_time);
    return v;
  }

  function convertTimeToPercent(v) {
    var min_time = 10 * 60; // 10 minutes

    min_time = data.get('ui:totalTime').value;
    var max_time = 1;
    var t = (_layout_constants.LayoutConstants.width * 0.8 / v - min_time) / (max_time - min_time);
    return t;
  }

  function changeRange() {
    dispatcher.fire('update.scale', 6 * Math.pow(100, -range.value));
  }

  var layer_uis = [],
      visible_layers = 0;
  var unused_layers = [];
  this.layers = layer_uis;

  this.setControlStatus = function (v) {
    playing = v;

    if (playing) {
      play_button.setIcon('pause');
      play_button.setTip('Pause');
    } else {
      play_button.setIcon('play');
      play_button.setTip('Play');
    }
  };

  this.setState = function (state) {
    layer_store = state;
    var layers = layer_store.value; // layers = state;

    console.log(layer_uis.length, layers);
    var i, layer;

    for (i = 0; i < layers.length; i++) {
      layer = layers[i];

      if (!layer_uis[i]) {
        var layer_ui;

        if (unused_layers.length) {
          layer_ui = unused_layers.pop();
          layer_ui.dom.style.display = 'block';
        } else {
          // new
          layer_ui = new _view_layer.LayerView(layer, dispatcher);
          layer_scroll.appendChild(layer_ui.dom);
        }

        layer_uis.push(layer_ui);
      } // layer_uis[i].setState(layer);

    }

    console.log('Total layers (view, hidden, total)', layer_uis.length, unused_layers.length, layer_uis.length + unused_layers.length);
  };

  function repaint(s) {
    s = currentTimeStore.value;
    currentTime.setValue(s);
    totalTime.setValue(totalTimeStore.value);
    currentTime.paint();
    totalTime.paint();
    var i;
    s = s || 0;
    var layers = layer_store.value;

    for (i = layer_uis.length; i-- > 0;) {
      // quick hack
      if (i >= layers.length) {
        layer_uis[i].dom.style.display = 'none';
        unused_layers.push(layer_uis.pop());
        continue;
      }

      layer_uis[i].setState(layers[i], layer_store.get(i)); // layer_uis[i].setState('layers'+':'+i);

      layer_uis[i].repaint(s);
    }

    visible_layers = layer_uis.length;
  }

  this.repaint = repaint;
  this.setState(layer_store);

  this.scrollTo = function (x) {
    layer_scroll.scrollTop = x * (layer_scroll.scrollHeight - layer_scroll.clientHeight);
  };

  this.dom = div;
  repaint();
}

},{"../layout_constants.js":1,"../theme.js":2,"../ui/icon_button.js":6,"../ui/ui_number.js":8,"../utils/utils.js":16,"./view_layer.js":20}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TimelinePanel = TimelinePanel;

var _layout_constants = require("../layout_constants.js");

var _theme = require("../theme.js");

var _utils = require("../utils/utils.js");

var _util_tween = require("../utils/util_tween.js");

var _util_handle_drag = require("../utils/util_handle_drag.js");

var _time_scroller = require("./time_scroller.js");

var _canvas = require("../ui/canvas.js");

var proxy_ctx = _utils.utils.proxy_ctx;
var LINE_HEIGHT = _layout_constants.LayoutConstants.LINE_HEIGHT,
    DIAMOND_SIZE = _layout_constants.LayoutConstants.DIAMOND_SIZE,
    TIME_SCROLLER_HEIGHT = 35,
    MARKER_TRACK_HEIGHT = 25,
    LEFT_PANE_WIDTH = _layout_constants.LayoutConstants.LEFT_PANE_WIDTH,
    time_scale = _layout_constants.LayoutConstants.time_scale,
    TOP = 10;
var frame_start = 0; // this is the current scroll position.

/*
 * This class contains the view for the right main section of timeliner
 */
// TODO
// dirty rendering
// drag block
// DON'T use time.update for everything

var tickMark1;
var tickMark2;
var tickMark3;

function time_scaled() {
  /*
   * Subdivison LOD
   * time_scale refers to number of pixels per unit
   * Eg. 1 inch - 60s, 1 inch - 60fps, 1 inch - 6 mins
   */
  var div = 60;
  tickMark1 = time_scale / div;
  tickMark2 = 2 * tickMark1;
  tickMark3 = 10 * tickMark1;
}

time_scaled();
/**************************/
// Timeline Panel

/**************************/

function TimelinePanel(data, dispatcher) {
  var dpr = window.devicePixelRatio;
  var track_canvas = document.createElement('canvas');
  var scrollTop = 0,
      scrollLeft = 0,
      SCROLL_HEIGHT;
  var layers = data.get('layers').value;

  this.scrollTo = function (s, y) {
    scrollTop = s * Math.max(layers.length * LINE_HEIGHT - SCROLL_HEIGHT, 0);
    repaint();
  };

  this.resize = function () {
    var h = _layout_constants.LayoutConstants.height - TIME_SCROLLER_HEIGHT;
    dpr = window.devicePixelRatio;
    track_canvas.width = _layout_constants.LayoutConstants.width * dpr;
    track_canvas.height = h * dpr;
    track_canvas.style.width = _layout_constants.LayoutConstants.width + 'px';
    track_canvas.style.height = h + 'px';
    SCROLL_HEIGHT = _layout_constants.LayoutConstants.height - TIME_SCROLLER_HEIGHT;
    scroll_canvas.setSize(_layout_constants.LayoutConstants.width, TIME_SCROLLER_HEIGHT);
  };

  var div = document.createElement('div');
  var scroll_canvas = new _canvas.Canvas(_layout_constants.LayoutConstants.width, TIME_SCROLLER_HEIGHT); // data.addListener('ui', repaint );

  _utils.utils.style(track_canvas, {
    position: 'absolute',
    top: TIME_SCROLLER_HEIGHT + 'px',
    left: '0px'
  });

  _utils.utils.style(scroll_canvas.dom, {
    position: 'absolute',
    top: '0px',
    left: '10px'
  });

  scroll_canvas.uses(new _time_scroller.ScrollCanvas(dispatcher, data));
  div.appendChild(track_canvas);
  div.appendChild(scroll_canvas.dom);
  scroll_canvas.dom.id = 'scroll-canvas';
  track_canvas.id = 'track-canvas'; // this.dom = canvas;

  this.dom = div;
  this.dom.id = 'timeline-panel';
  this.resize();
  var ctx = track_canvas.getContext('2d');
  var ctx_wrap = proxy_ctx(ctx);
  var currentTime; // measured in seconds
  // technically it could be in frames or  have it in string format (0:00:00:1-60)

  var LEFT_GUTTER = 20;
  var i, x, y, il, j;
  var needsRepaint = false;
  var renderItems = [];

  function EasingRect(x1, y1, x2, y2, frame, frame2, values, layer, j) {
    var self = this;

    this.path = function () {
      ctx_wrap.beginPath().rect(x1, y1, x2 - x1, y2 - y1).closePath();
    };

    this.paint = function () {
      this.path();
      ctx.fillStyle = frame._color;
      ctx.fill();
    };

    this.mouseover = function () {
      track_canvas.style.cursor = 'pointer'; // pointer move ew-resize
    };

    this.mouseout = function () {
      track_canvas.style.cursor = 'default';
    };

    this.mousedrag = function (e) {
      var t1 = x_to_time(x1 + e.dx);
      t1 = Math.max(0, t1); // TODO limit moving to neighbours

      frame.time = t1;
      var t2 = x_to_time(x2 + e.dx);
      t2 = Math.max(0, t2);
      frame2.time = t2; // dispatcher.fire('time.update', t1);
    };
  }

  function Diamond(frame, y) {
    var x, y2;
    x = time_to_x(frame.time);
    y2 = y + LINE_HEIGHT * 0.5 - DIAMOND_SIZE / 2;
    var self = this;
    var isOver = false;

    this.path = function (ctx_wrap) {
      ctx_wrap.beginPath().moveTo(x, y2).lineTo(x + DIAMOND_SIZE / 2, y2 + DIAMOND_SIZE / 2).lineTo(x, y2 + DIAMOND_SIZE).lineTo(x - DIAMOND_SIZE / 2, y2 + DIAMOND_SIZE / 2).closePath();
    };

    this.paint = function (ctx_wrap) {
      self.path(ctx_wrap);
      if (!isOver) ctx_wrap.fillStyle(_theme.Theme.c);else ctx_wrap.fillStyle('yellow'); // Theme.d

      ctx_wrap.fill().stroke();
    };

    this.mouseover = function () {
      isOver = true;
      track_canvas.style.cursor = 'move'; // pointer move ew-resize

      self.paint(ctx_wrap);
    };

    this.mouseout = function () {
      isOver = false;
      track_canvas.style.cursor = 'default';
      self.paint(ctx_wrap);
    };

    this.mousedrag = function (e) {
      var t = x_to_time(x + e.dx);
      t = Math.max(0, t); // TODO limit moving to neighbours

      frame.time = t;
      dispatcher.fire('time.update', t); // console.log('frame', frame);
      // console.log(s, format_friendly_seconds(s), this);
    };
  }

  function repaint() {
    needsRepaint = true;
  }

  function drawLayerContents() {
    renderItems = []; // horizontal Layer lines

    for (i = 0, il = layers.length; i <= il; i++) {
      ctx.strokeStyle = _theme.Theme.b;
      ctx.beginPath();
      y = i * LINE_HEIGHT;
      y = ~~y - 0.5;
      ctx_wrap.moveTo(0, y).lineTo(_layout_constants.LayoutConstants.width, y).stroke();
    }

    var frame, frame2, j; // Draw Easing Rects

    for (i = 0; i < il; i++) {
      // check for keyframes
      var layer = layers[i];
      var values = layer.values;
      y = i * LINE_HEIGHT;

      for (j = 0; j < values.length - 1; j++) {
        frame = values[j];
        frame2 = values[j + 1]; // Draw Tween Rect

        var x = time_to_x(frame.time);
        var x2 = time_to_x(frame2.time);
        if (!frame.tween || frame.tween == 'none') continue;
        var y1 = y + 2;
        var y2 = y + LINE_HEIGHT - 2;
        renderItems.push(new EasingRect(x, y1, x2, y2, frame, frame2)); // // draw easing graph
        // var color = parseInt(frame._color.substring(1,7), 16);
        // color = 0xffffff ^ color;
        // color = color.toString(16);           // convert to hex
        // color = '#' + ('000000' + color).slice(-6);
        // ctx.strokeStyle = color;
        // var x3;
        // ctx.beginPath();
        // ctx.moveTo(x, y2);
        // var dy = y1 - y2;
        // var dx = x2 - x;
        // for (x3=x; x3 < x2; x3++) {
        // 	ctx.lineTo(x3, y2 + Tweens[frame.tween]((x3 - x)/dx) * dy);
        // }
        // ctx.stroke();
      }

      for (j = 0; j < values.length; j++) {
        // Dimonds
        frame = values[j];
        renderItems.push(new Diamond(frame, y));
      }
    } // render items


    var item;

    for (i = 0, il = renderItems.length; i < il; i++) {
      item = renderItems[i];
      item.paint(ctx_wrap);
    }
  }

  function setTimeScale() {
    var v = data.get('ui:timeScale').value;

    if (time_scale !== v) {
      time_scale = v;
      time_scaled();
    }
  }

  var over = null;
  var mousedownItem = null;

  function check() {
    var item;
    var last_over = over; // over = [];

    over = null;

    for (i = renderItems.length; i-- > 0;) {
      item = renderItems[i];
      item.path(ctx_wrap);

      if (ctx.isPointInPath(pointer.x * dpr, pointer.y * dpr)) {
        // over.push(item);
        over = item;
        break;
      }
    } // clear old mousein


    if (last_over && last_over != over) {
      item = last_over;
      if (item.mouseout) item.mouseout();
    }

    if (over) {
      item = over;
      if (item.mouseover) item.mouseover();

      if (mousedown2) {
        mousedownItem = item;
      }
    } // console.log(pointer)

  }

  function pointerEvents() {
    if (!pointer) return;
    ctx_wrap.save().scale(dpr, dpr).translate(0, MARKER_TRACK_HEIGHT).beginPath().rect(0, 0, _layout_constants.LayoutConstants.width, SCROLL_HEIGHT).translate(-scrollLeft, -scrollTop).clip().run(check).restore();
  }

  function _paint() {
    if (!needsRepaint) {
      pointerEvents();
      return;
    }

    scroll_canvas.repaint();
    setTimeScale();
    currentTime = data.get('ui:currentTime').value;
    frame_start = data.get('ui:scrollTime').value;
    /**************************/
    // background

    ctx.fillStyle = _theme.Theme.a;
    ctx.clearRect(0, 0, track_canvas.width, track_canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr); //

    ctx.lineWidth = 1; // .5, 1, 2

    var width = _layout_constants.LayoutConstants.width;
    var height = _layout_constants.LayoutConstants.height;
    var units = time_scale / tickMark1;
    var offsetUnits = frame_start * time_scale % units;
    var count = (width - LEFT_GUTTER + offsetUnits) / units; // console.log('time_scale', time_scale, 'tickMark1', tickMark1, 'units', units, 'offsetUnits', offsetUnits, frame_start);
    // time_scale = pixels to 1 second (40)
    // tickMark1 = marks per second (marks / s)
    // units = pixels to every mark (40)
    // labels only

    for (i = 0; i < count; i++) {
      x = i * units + LEFT_GUTTER - offsetUnits; // vertical lines

      ctx.strokeStyle = _theme.Theme.b;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillStyle = _theme.Theme.d;
      ctx.textAlign = 'center';
      var t = (i * units - offsetUnits) / time_scale + frame_start;
      t = _utils.utils.format_friendly_seconds(t);
      ctx.fillText(t, x, 38);
    }

    units = time_scale / tickMark2;
    count = (width - LEFT_GUTTER + offsetUnits) / units; // marker lines - main

    for (i = 0; i < count; i++) {
      ctx.strokeStyle = _theme.Theme.c;
      ctx.beginPath();
      x = i * units + LEFT_GUTTER - offsetUnits;
      ctx.moveTo(x, MARKER_TRACK_HEIGHT - 0);
      ctx.lineTo(x, MARKER_TRACK_HEIGHT - 16);
      ctx.stroke();
    }

    var mul = tickMark3 / tickMark2;
    units = time_scale / tickMark3;
    count = (width - LEFT_GUTTER + offsetUnits) / units; // small ticks

    for (i = 0; i < count; i++) {
      if (i % mul === 0) continue;
      ctx.strokeStyle = _theme.Theme.c;
      ctx.beginPath();
      x = i * units + LEFT_GUTTER - offsetUnits;
      ctx.moveTo(x, MARKER_TRACK_HEIGHT - 0);
      ctx.lineTo(x, MARKER_TRACK_HEIGHT - 10);
      ctx.stroke();
    } // Encapsulate a scroll rect for the layers


    ctx_wrap.save().translate(0, MARKER_TRACK_HEIGHT).beginPath().rect(0, 0, _layout_constants.LayoutConstants.width, SCROLL_HEIGHT).translate(-scrollLeft, -scrollTop).clip().run(drawLayerContents).restore(); // Current Marker / Cursor

    ctx.strokeStyle = 'red'; // Theme.c

    x = (currentTime - frame_start) * time_scale + LEFT_GUTTER;

    var txt = _utils.utils.format_friendly_seconds(currentTime);

    var textWidth = ctx.measureText(txt).width;
    var base_line = MARKER_TRACK_HEIGHT - 5,
        half_rect = textWidth / 2 + 4;
    ctx.beginPath();
    ctx.moveTo(x, base_line);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillStyle = 'red'; // black

    ctx.textAlign = 'center';
    ctx.beginPath();
    ctx.moveTo(x, base_line + 5);
    ctx.lineTo(x + 5, base_line);
    ctx.lineTo(x + half_rect, base_line);
    ctx.lineTo(x + half_rect, base_line - 14);
    ctx.lineTo(x - half_rect, base_line - 14);
    ctx.lineTo(x - half_rect, base_line);
    ctx.lineTo(x - 5, base_line);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(txt, x, base_line - 4);
    ctx.restore();
    needsRepaint = false; // pointerEvents();
  }

  function y_to_track(y) {
    if (y - MARKER_TRACK_HEIGHT < 0) return -1;
    return (y - MARKER_TRACK_HEIGHT + scrollTop) / LINE_HEIGHT | 0;
  }

  function x_to_time(x) {
    var units = time_scale / tickMark3; // return frame_start + (x - LEFT_GUTTER) / time_scale;

    return frame_start + ((x - LEFT_GUTTER) / units | 0) / tickMark3;
  }

  function time_to_x(s) {
    var ds = s - frame_start;
    ds *= time_scale;
    ds += LEFT_GUTTER;
    return ds;
  }

  var me = this;
  this.repaint = repaint;
  this._paint = _paint;
  repaint();
  var mousedown = false,
      selection = false;
  var dragObject;
  var canvasBounds;
  document.addEventListener('mousemove', onMouseMove);
  track_canvas.addEventListener('dblclick', function (e) {
    canvasBounds = track_canvas.getBoundingClientRect();
    var mx = e.clientX - canvasBounds.left,
        my = e.clientY - canvasBounds.top;
    var track = y_to_track(my);
    var s = x_to_time(mx);
    dispatcher.fire('keyframe', layers[track], currentTime);
  });

  function onMouseMove(e) {
    canvasBounds = track_canvas.getBoundingClientRect();
    var mx = e.clientX - canvasBounds.left,
        my = e.clientY - canvasBounds.top;
    onPointerMove(mx, my);
  }

  var pointerdidMoved = false;
  var pointer = null;

  function onPointerMove(x, y) {
    if (mousedownItem) return;
    pointerdidMoved = true;
    pointer = {
      x: x,
      y: y
    };
  }

  track_canvas.addEventListener('mouseout', function () {
    pointer = null;
  });
  var mousedown2 = false,
      mouseDownThenMove = false;
  (0, _util_handle_drag.handleDrag)(track_canvas, function down(e) {
    mousedown2 = true;
    pointer = {
      x: e.offsetx,
      y: e.offsety
    };
    pointerEvents();
    if (!mousedownItem) dispatcher.fire('time.update', x_to_time(e.offsetx)); // Hit criteria
  }, function move(e) {
    mousedown2 = false;

    if (mousedownItem) {
      mouseDownThenMove = true;

      if (mousedownItem.mousedrag) {
        mousedownItem.mousedrag(e);
      }
    } else {
      dispatcher.fire('time.update', x_to_time(e.offsetx));
    }
  }, function up(e) {
    if (mouseDownThenMove) {
      dispatcher.fire('keyframe.move');
    } else {
      dispatcher.fire('time.update', x_to_time(e.offsetx));
    }

    mousedown2 = false;
    mousedownItem = null;
    mouseDownThenMove = false;
  });

  this.setState = function (state) {
    layers = state.value;
    repaint();
  };
}

},{"../layout_constants.js":1,"../theme.js":2,"../ui/canvas.js":4,"../utils/util_handle_drag.js":13,"../utils/util_tween.js":14,"../utils/utils.js":16,"./time_scroller.js":19}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ScrollCanvas = ScrollCanvas;

var _theme = require("../theme.js");

var _utils = require("../utils/utils.js");

var _util_handle_drag = require("../utils/util_handle_drag.js");

var proxy_ctx = _utils.utils.proxy_ctx;

/* This is the top bar where it shows a horizontal scrolls as well as a custom view port */
function Rect() {}

Rect.prototype.set = function (x, y, w, h, color, outline) {
  this.x = x;
  this.y = y;
  this.w = w;
  this.h = h;
  this.color = color;
  this.outline = outline;
};

Rect.prototype.paint = function (ctx) {
  ctx.fillStyle = _theme.Theme.b; // // 'yellow';

  ctx.strokeStyle = _theme.Theme.c;
  this.shape(ctx);
  ctx.stroke();
  ctx.fill();
};

Rect.prototype.shape = function (ctx) {
  ctx.beginPath();
  ctx.rect(this.x, this.y, this.w, this.h);
};

Rect.prototype.contains = function (x, y) {
  return x >= this.x && y >= this.y && x <= this.x + this.w && y <= this.y + this.h;
};

function ScrollCanvas(dispatcher, data) {
  var width, height;

  this.setSize = function (w, h) {
    width = w;
    height = h;
  };

  var TOP_SCROLL_TRACK = 20;
  var MARGINS = 15;
  var scroller = {
    left: 0,
    grip_length: 0,
    k: 1
  };
  var scrollRect = new Rect();

  this.paint = function (ctx) {
    var totalTime = data.get('ui:totalTime').value;
    var scrollTime = data.get('ui:scrollTime').value;
    var currentTime = data.get('ui:currentTime').value;
    var pixels_per_second = data.get('ui:timeScale').value;
    ctx.save();
    var dpr = window.devicePixelRatio;
    ctx.scale(dpr, dpr);
    var w = width - 2 * MARGINS;
    var h = 16; // TOP_SCROLL_TRACK;

    ctx.clearRect(0, 0, width, height);
    ctx.translate(MARGINS, 5); // outline scroller

    ctx.beginPath();
    ctx.strokeStyle = _theme.Theme.b;
    ctx.rect(0, 0, w, h);
    ctx.stroke();
    var totalTimePixels = totalTime * pixels_per_second;
    var k = w / totalTimePixels;
    scroller.k = k;
    var grip_length = w * k;
    scroller.grip_length = grip_length;
    scroller.left = scrollTime / totalTime * w;
    scrollRect.set(scroller.left, 0, scroller.grip_length, h);
    scrollRect.paint(ctx);
    var r = currentTime / totalTime * w;
    ctx.fillStyle = _theme.Theme.c;
    ctx.lineWidth = 2;
    ctx.beginPath(); // circle
    // ctx.arc(r, h2 / 2, h2 / 1.5, 0, Math.PI * 2);
    // line

    ctx.rect(r, 0, 2, h + 5);
    ctx.fill();
    ctx.fillText(currentTime && currentTime.toFixed(2), r, h + 14); // ctx.fillText(currentTime && currentTime.toFixed(3), 10, 10);

    ctx.fillText(totalTime, 300, 14);
    ctx.restore();
  };
  /** Handles dragging for scroll bar **/


  var draggingx = null;

  this.onDown = function (e) {
    // console.log('ondown', e);
    if (scrollRect.contains(e.offsetx - MARGINS, e.offsety - 5)) {
      draggingx = scroller.left;
      return;
    }

    var totalTime = data.get('ui:totalTime').value;
    var pixels_per_second = data.get('ui:timeScale').value;
    var w = width - 2 * MARGINS;
    var t = (e.offsetx - MARGINS) / w * totalTime; // t = Math.max(0, t);
    // data.get('ui:currentTime').value = t;

    dispatcher.fire('time.update', t);
    if (e.preventDefault) e.preventDefault();
  };

  this.onMove = function move(e) {
    if (draggingx != null) {
      var totalTime = data.get('ui:totalTime').value;
      var w = width - 2 * MARGINS;
      var scrollTime = (draggingx + e.dx) / w * totalTime;
      console.log(scrollTime, draggingx, e.dx, scroller.grip_length, w);
      if (draggingx + e.dx + scroller.grip_length > w) return;
      dispatcher.fire('update.scrollTime', scrollTime);
    } else {
      this.onDown(e);
    }
  };

  this.onUp = function (e) {
    draggingx = null;
  };
  /*** End handling for scrollbar ***/

}

},{"../theme.js":2,"../utils/util_handle_drag.js":13,"../utils/utils.js":16}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LayerView = LayerView;

var _theme = require("../theme.js");

var _ui_number = require("../ui/ui_number.js");

var _util_tween = require("../utils/util_tween.js");

var _layout_constants = require("../layout_constants.js");

var _utils = require("../utils/utils.js");

// TODO - tagged by index instead, work off layers.
function LayerView(layer, dispatcher) {
  var dom = document.createElement('div');
  var label = document.createElement('span');
  label.style.cssText = 'font-size: 12px; padding: 4px;';
  label.addEventListener('click', function (e) {// context.dispatcher.fire('label', channelName);
  });
  label.addEventListener('mouseover', function (e) {// context.dispatcher.fire('label', channelName);
  });
  var dropdown = document.createElement('select');
  var option;
  dropdown.style.cssText = 'font-size: 10px; width: 60px; margin: 0; float: right; text-align: right;';

  for (var k in _util_tween.Tweens) {
    option = document.createElement('option');
    option.text = k;
    dropdown.appendChild(option);
  }

  dropdown.addEventListener('change', function (e) {
    dispatcher.fire('ease', layer, dropdown.value);
  });
  var height = _layout_constants.LayoutConstants.LINE_HEIGHT - 1;
  var keyframe_button = document.createElement('button');
  keyframe_button.innerHTML = '&#9672;'; // '&diams;' &#9671; 9679 9670 9672

  keyframe_button.style.cssText = 'background: none; font-size: 12px; padding: 0px; font-family: monospace; float: right; width: 20px; height: ' + height + 'px; border-style:none; outline: none;'; //  border-style:inset;

  keyframe_button.addEventListener('click', function (e) {
    console.log('clicked:keyframing...', state.get('_value').value);
    dispatcher.fire('keyframe', layer, state.get('_value').value);
  });
  /*
  // Prev Keyframe
  var button = document.createElement('button');
  button.textContent = '<';
  button.style.cssText = 'font-size: 12px; padding: 1px; ';
  dom.appendChild(button);
  	// Next Keyframe
  button = document.createElement('button');
  button.textContent = '>';
  button.style.cssText = 'font-size: 12px; padding: 1px; ';
  dom.appendChild(button);
  
  */

  function ToggleButton(text) {
    var _this = this;

    // for css based button see http://codepen.io/mallendeo/pen/eLIiG
    var button = document.createElement('button');
    button.textContent = text;

    _utils.utils.style(button, {
      fontSize: '12px',
      padding: '1px',
      borderSize: '2px',
      outline: 'none',
      background: _theme.Theme.a,
      color: _theme.Theme.c
    });

    this.pressed = false;

    button.onclick = function () {
      _this.pressed = !_this.pressed;

      _utils.utils.style(button, {
        borderStyle: _this.pressed ? 'inset' : 'outset' // inset outset groove ridge

      });

      if (_this.onClick) _this.onClick();
    };

    this.dom = button;
  } // Solo


  var solo_toggle = new ToggleButton('S');
  dom.appendChild(solo_toggle.dom);

  solo_toggle.onClick = function () {
    dispatcher.fire('action:solo', layer, solo_toggle.pressed);
  }; // Mute


  var mute_toggle = new ToggleButton('M');
  dom.appendChild(mute_toggle.dom);

  mute_toggle.onClick = function () {
    dispatcher.fire('action:mute', layer, mute_toggle.pressed);
  };

  var number = new _ui_number.UINumber(layer, dispatcher);
  number.onChange["do"](function (value, done) {
    state.get('_value').value = value;
    dispatcher.fire('value.change', layer, value, done);
  });

  _utils.utils.style(number.dom, {
    "float": 'right'
  });

  dom.appendChild(label);
  dom.appendChild(keyframe_button);
  dom.appendChild(number.dom);
  dom.appendChild(dropdown);

  _utils.utils.style(dom, {
    textAlign: 'left',
    margin: '0px 0px 0px 5px',
    borderBottom: '1px solid ' + _theme.Theme.b,
    top: 0,
    left: 0,
    height: _layout_constants.LayoutConstants.LINE_HEIGHT - 1 + 'px',
    color: _theme.Theme.c
  });

  this.dom = dom;
  this.repaint = repaint;
  var state;

  this.setState = function (l, s) {
    layer = l;
    state = s;
    var tmp_value = state.get('_value');

    if (tmp_value.value === undefined) {
      tmp_value.value = 0;
    }

    number.setValue(tmp_value.value);
    label.textContent = state.get('name').value;
    repaint();
  };

  function repaint(s) {
    dropdown.style.opacity = 0;
    dropdown.disabled = true;
    keyframe_button.style.color = _theme.Theme.b; // keyframe_button.disabled = false;
    // keyframe_button.style.borderStyle = 'solid';

    var tween = null;

    var o = _utils.utils.timeAtLayer(layer, s);

    if (!o) return;

    if (o.can_tween) {
      dropdown.style.opacity = 1;
      dropdown.disabled = false; // if (o.tween)

      dropdown.value = o.tween ? o.tween : 'none';
      if (dropdown.value === 'none') dropdown.style.opacity = 0.5;
    }

    if (o.keyframe) {
      keyframe_button.style.color = _theme.Theme.c; // keyframe_button.disabled = true;
      // keyframe_button.style.borderStyle = 'inset';
    }

    state.get('_value').value = o.value;
    number.setValue(o.value);
    number.paint();
    dispatcher.fire('target.notify', layer.name, o.value);
  }
}

},{"../layout_constants.js":1,"../theme.js":2,"../ui/ui_number.js":8,"../utils/util_tween.js":14,"../utils/utils.js":16}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGF5b3V0X2NvbnN0YW50cy5qcyIsInNyYy90aGVtZS5qcyIsInNyYy90aW1lbGluZXIuanMiLCJzcmMvdWkvY2FudmFzLmpzIiwic3JjL3VpL2ZvbnQuanMiLCJzcmMvdWkvaWNvbl9idXR0b24uanMiLCJzcmMvdWkvc2Nyb2xsYmFyLmpzIiwic3JjL3VpL3VpX251bWJlci5qcyIsInNyYy91dGlscy9kby5qcyIsInNyYy91dGlscy9kb2NraW5nX3dpbmRvdy5qcyIsInNyYy91dGlscy91dGlsX2RhdGFzdG9yZS5qcyIsInNyYy91dGlscy91dGlsX2Rpc3BhdGNoZXIuanMiLCJzcmMvdXRpbHMvdXRpbF9oYW5kbGVfZHJhZy5qcyIsInNyYy91dGlscy91dGlsX3R3ZWVuLmpzIiwic3JjL3V0aWxzL3V0aWxfdW5kby5qcyIsInNyYy91dGlscy91dGlscy5qcyIsInNyYy92aWV3cy9sYXllcl9jYWJpbmV0LmpzIiwic3JjL3ZpZXdzL3BhbmVsLmpzIiwic3JjL3ZpZXdzL3RpbWVfc2Nyb2xsZXIuanMiLCJzcmMvdmlld3Mvdmlld19sYXllci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7OztBQ0FBLElBQUksa0JBQWtCLEdBQUcsRUFBekIsQyxDQUVBOztBQUNBLElBQUksZUFBZSxHQUFHO0VBQ3JCLFdBQVcsRUFBRSxFQURRO0VBRXJCLFlBQVksRUFBRSxFQUZPO0VBR3JCLG1CQUFtQixFQUFFLEVBSEE7RUFJckIsS0FBSyxFQUFFLEdBSmM7RUFLckIsTUFBTSxFQUFFLEdBTGE7RUFNckIsc0JBQXNCLEVBQUUsQ0FOSDtFQU9yQixlQUFlLEVBQUUsR0FQSTtFQVFyQixVQUFVLEVBQUUsa0JBUlM7RUFRVztFQUNoQyxjQUFjLEVBQUUsRUFUSztFQVNEO0VBQ3BCLGtCQUFrQixFQUFsQjtBQVZxQixDQUF0Qjs7Ozs7Ozs7OztBQ0hBLElBQU0sS0FBSyxHQUFH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LENBQUMsS0FBaEIsQ0FBc0IsS0FBdEIsR0FBOEIsWUFBQSxDQUFNLENBQXBDLENBRGUsQ0FFZjtNQUNBO0lBQ0E7O0lBRUQsS0FBSyxDQUFDLEdBQU4sQ0FBVSxRQUFWLEVBQW9CLEtBQXBCLEdBQTRCLENBQUMsQ0FBQyxLQUE5QjtJQUNBLE1BQU0sQ0FBQyxRQUFQLENBQWdCLENBQUMsQ0FBQyxLQUFsQjtJQUNBLE1BQU0sQ0FBQyxLQUFQO0lBRUEsVUFBVSxDQUFDLElBQVgsQ0FBZ0IsZUFBaEIsRUFBaUMsS0FBSyxDQUFDLElBQXZDLEVBQTZDLENBQUMsQ0FBQyxLQUEvQztFQUNBO0FBRUQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgREVGQVVMVF9USU1FX1NDQUxFID0gNjA7XG5cbi8vIERpbWVuc2lvbnNcbnZhciBMYXlvdXRDb25zdGFudHMgPSB7XG5cdExJTkVfSEVJR0hUOiAyNixcblx0RElBTU9ORF9TSVpFOiAxMCxcblx0TUFSS0VSX1RSQUNLX0hFSUdIVDogNjAsXG5cdHdpZHRoOiA2MDAsXG5cdGhlaWdodDogMjAwLFxuXHRUSU1FTElORV9TQ1JPTExfSEVJR0hUOiAwLFxuXHRMRUZUX1BBTkVfV0lEVEg6IDI1MCxcblx0dGltZV9zY2FsZTogREVGQVVMVF9USU1FX1NDQUxFLCAvLyBudW1iZXIgb2YgcGl4ZWxzIHRvIDEgc2Vjb25kXG5cdGRlZmF1bHRfbGVuZ3RoOiAyMCwgLy8gc2Vjb25kc1xuXHRERUZBVUxUX1RJTUVfU0NBTEVcbn07XG5cbmV4cG9ydCB7IExheW91dENvbnN0YW50cyB9IiwiY29uc3QgVGhlbWUgPSB7XG5cdC8vIHBob3Rvc2hvcCBjb2xvcnNcblx0YTogJyMzNDM0MzQnLFxuXHRiOiAnIzUzNTM1MycsXG5cdGM6ICcjYjhiOGI4Jyxcblx0ZDogJyNkNmQ2ZDYnLFxufTtcblxuZXhwb3J0IHsgVGhlbWUgfSIsIi8qXG4gKiBAYXV0aG9yIEpvc2h1YSBLb28gaHR0cDovL2pvc2h1YWtvby5jb21cbiAqL1xuXG5jb25zdCBUSU1FTElORVJfVkVSU0lPTiA9IFwiMi4wLjAtZGV2XCI7XG5cbmltcG9ydCB7IFVuZG9NYW5hZ2VyLCBVbmRvU3RhdGUgfSBmcm9tICcuL3V0aWxzL3V0aWxfdW5kby5qcydcbmltcG9ydCB7IERpc3BhdGNoZXIgfSBmcm9tICcuL3V0aWxzL3V0aWxfZGlzcGF0Y2hlci5qcydcbmltcG9ydCB7IFRoZW1lIH0gZnJvbSAnLi90aGVtZS5qcydcbmltcG9ydCB7IExheW91dENvbnN0YW50cyBhcyBTZXR0aW5ncyB9IGZyb20gJy4vbGF5b3V0X2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyB1dGlscyB9IGZyb20gJy4vdXRpbHMvdXRpbHMuanMnXG5pbXBvcnQgeyBMYXllckNhYmluZXQgfSBmcm9tICcuL3ZpZXdzL2xheWVyX2NhYmluZXQuanMnXG5pbXBvcnQgeyBUaW1lbGluZVBhbmVsIH0gZnJvbSAnLi92aWV3cy9wYW5lbC5qcydcbmltcG9ydCB7IEljb25CdXR0b24gfSBmcm9tICcuL3VpL2ljb25fYnV0dG9uLmpzJ1xudmFyIHN0eWxlID0gdXRpbHMuc3R5bGVcbnZhciBzYXZlVG9GaWxlID0gdXRpbHMuc2F2ZVRvRmlsZVxudmFyIG9wZW5BcyA9IHV0aWxzLm9wZW5Bc1xudmFyIFNUT1JBR0VfUFJFRklYID0gdXRpbHMuU1RPUkFHRV9QUkVGSVhcbmltcG9ydCB7IFNjcm9sbEJhciB9IGZyb20gJy4vdWkvc2Nyb2xsYmFyLmpzJ1xuaW1wb3J0IHsgRGF0YVN0b3JlIH0gZnJvbSAnLi91dGlscy91dGlsX2RhdGFzdG9yZS5qcydcbmltcG9ydCB7IERvY2tpbmdXaW5kb3cgfSBmcm9tICcuL3V0aWxzL2RvY2tpbmdfd2luZG93LmpzJ1xuXG52YXIgWl9JTkRFWCA9IDk5OTtcblxuZnVuY3Rpb24gTGF5ZXJQcm9wKG5hbWUpIHtcblx0dGhpcy5uYW1lID0gbmFtZTtcblx0dGhpcy52YWx1ZXMgPSBbXTtcblxuXHR0aGlzLl92YWx1ZSA9IDA7XG5cblx0dGhpcy5fY29sb3IgPSAnIycgKyAoTWF0aC5yYW5kb20oKSAqIDB4ZmZmZmZmIHwgMCkudG9TdHJpbmcoMTYpO1xuXHQvKlxuXHR0aGlzLm1heFxuXHR0aGlzLm1pblxuXHR0aGlzLnN0ZXBcblx0Ki9cbn1cblxuZnVuY3Rpb24gVGltZWxpbmVyKHRhcmdldCkge1xuXHQvLyBEaXNwYXRjaGVyIGZvciBjb29yZGluYXRpb25cblx0dmFyIGRpc3BhdGNoZXIgPSBuZXcgRGlzcGF0Y2hlcigpO1xuXG5cdC8vIERhdGFcblx0dmFyIGRhdGEgPSBuZXcgRGF0YVN0b3JlKCk7XG5cdHZhciBsYXllcl9zdG9yZSA9IGRhdGEuZ2V0KCdsYXllcnMnKTtcblx0dmFyIGxheWVycyA9IGxheWVyX3N0b3JlLnZhbHVlO1xuXG5cdHdpbmRvdy5fZGF0YSA9IGRhdGE7IC8vIGV4cG9zZSBpdCBmb3IgZGVidWdnaW5nXG5cblx0Ly8gVW5kbyBtYW5hZ2VyXG5cdHZhciB1bmRvX21hbmFnZXIgPSBuZXcgVW5kb01hbmFnZXIoZGlzcGF0Y2hlcik7XG5cblx0Ly8gVmlld3Ncblx0dmFyIHRpbWVsaW5lID0gbmV3IFRpbWVsaW5lUGFuZWwoZGF0YSwgZGlzcGF0Y2hlcik7XG5cdHZhciBsYXllcl9wYW5lbCA9IG5ldyBMYXllckNhYmluZXQoZGF0YSwgZGlzcGF0Y2hlcik7XG5cblx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHQvLyBoYWNrIVxuXHRcdHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0xvYWRlZCcpLCB0cnVlKTtcblx0fSk7XG5cblx0ZGlzcGF0Y2hlci5vbigna2V5ZnJhbWUnLCBmdW5jdGlvbihsYXllciwgdmFsdWUpIHtcblx0XHR2YXIgaW5kZXggPSBsYXllcnMuaW5kZXhPZihsYXllcik7XG5cblx0XHR2YXIgdCA9IGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpLnZhbHVlO1xuXHRcdHZhciB2ID0gdXRpbHMuZmluZFRpbWVpbkxheWVyKGxheWVyLCB0KTtcblxuXHRcdC8vIGNvbnNvbGUubG9nKHYsICcuLi5rZXlmcmFtZSBpbmRleCcsIGluZGV4LCB1dGlscy5mb3JtYXRfZnJpZW5kbHlfc2Vjb25kcyh0KSwgdHlwZW9mKHYpKTtcblx0XHQvLyBjb25zb2xlLmxvZygnbGF5ZXInLCBsYXllciwgdmFsdWUpO1xuXG5cdFx0aWYgKHR5cGVvZih2KSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGxheWVyLnZhbHVlcy5zcGxpY2UodiwgMCwge1xuXHRcdFx0XHR0aW1lOiB0LFxuXHRcdFx0XHR2YWx1ZTogdmFsdWUsXG5cdFx0XHRcdF9jb2xvcjogJyMnICsgKE1hdGgucmFuZG9tKCkgKiAweGZmZmZmZiB8IDApLnRvU3RyaW5nKDE2KVxuXHRcdFx0fSk7XG5cblx0XHRcdHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0FkZCBLZXlmcmFtZScpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5sb2coJ3JlbW92ZSBmcm9tIGluZGV4Jywgdik7XG5cdFx0XHRsYXllci52YWx1ZXMuc3BsaWNlKHYuaW5kZXgsIDEpO1xuXG5cdFx0XHR1bmRvX21hbmFnZXIuc2F2ZShuZXcgVW5kb1N0YXRlKGRhdGEsICdSZW1vdmUgS2V5ZnJhbWUnKSk7XG5cdFx0fVxuXG5cdFx0cmVwYWludEFsbCgpO1xuXG5cdH0pO1xuXG5cdGRpc3BhdGNoZXIub24oJ2tleWZyYW1lLm1vdmUnLCBmdW5jdGlvbihsYXllciwgdmFsdWUpIHtcblx0XHR1bmRvX21hbmFnZXIuc2F2ZShuZXcgVW5kb1N0YXRlKGRhdGEsICdNb3ZlIEtleWZyYW1lJykpO1xuXHR9KTtcblxuXHQvLyBkaXNwYXRjaGVyLmZpcmUoJ3ZhbHVlLmNoYW5nZScsIGxheWVyLCBtZS52YWx1ZSk7XG5cdGRpc3BhdGNoZXIub24oJ3ZhbHVlLmNoYW5nZScsIGZ1bmN0aW9uKGxheWVyLCB2YWx1ZSwgZG9udF9zYXZlKSB7XG5cdFx0aWYgKGxheWVyLl9tdXRlKSByZXR1cm47XG5cblx0XHR2YXIgdCA9IGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpLnZhbHVlO1xuXHRcdHZhciB2ID0gdXRpbHMuZmluZFRpbWVpbkxheWVyKGxheWVyLCB0KTtcblxuXHRcdC8vIGNvbnNvbGUubG9nKHYsICd2YWx1ZS5jaGFuZ2UnLCBsYXllciwgdmFsdWUsIHV0aWxzLmZvcm1hdF9mcmllbmRseV9zZWNvbmRzKHQpLCB0eXBlb2YodikpO1xuXHRcdGlmICh0eXBlb2YodikgPT09ICdudW1iZXInKSB7XG5cdFx0XHRsYXllci52YWx1ZXMuc3BsaWNlKHYsIDAsIHtcblx0XHRcdFx0dGltZTogdCxcblx0XHRcdFx0dmFsdWU6IHZhbHVlLFxuXHRcdFx0XHRfY29sb3I6ICcjJyArIChNYXRoLnJhbmRvbSgpICogMHhmZmZmZmYgfCAwKS50b1N0cmluZygxNilcblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFkb250X3NhdmUpIHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0FkZCB2YWx1ZScpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0di5vYmplY3QudmFsdWUgPSB2YWx1ZTtcblx0XHRcdGlmICghZG9udF9zYXZlKSB1bmRvX21hbmFnZXIuc2F2ZShuZXcgVW5kb1N0YXRlKGRhdGEsICdVcGRhdGUgdmFsdWUnKSk7XG5cdFx0fVxuXG5cdFx0cmVwYWludEFsbCgpO1xuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCdhY3Rpb246c29sbycsIGZ1bmN0aW9uKGxheWVyLCBzb2xvKSB7XG5cdFx0bGF5ZXIuX3NvbG8gPSBzb2xvO1xuXG5cdFx0Y29uc29sZS5sb2cobGF5ZXIsIHNvbG8pO1xuXG5cdFx0Ly8gV2hlbiBhIHRyYWNrIGlzIHNvbG8tZWQsIHBsYXliYWNrIG9ubHkgY2hhbmdlcyB2YWx1ZXNcblx0XHQvLyBvZiB0aGF0IGxheWVyLlxuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCdhY3Rpb246bXV0ZScsIGZ1bmN0aW9uKGxheWVyLCBtdXRlKSB7XG5cdFx0bGF5ZXIuX211dGUgPSBtdXRlO1xuXG5cdFx0Ly8gV2hlbiBhIHRyYWNrIGlzIG11dGUsIHBsYXliYWNrIGRvZXMgbm90IHBsYXlcblx0XHQvLyBmcmFtZXMgb2YgdGhvc2UgbXV0ZWQgbGF5ZXJzLlxuXG5cdFx0Ly8gYWxzbyBmZWVscyBsaWtlIGhpZGRlbiBmZWF0dXJlIGluIHBob3Rvc2hvcFxuXG5cdFx0Ly8gd2hlbiB2YWx1ZXMgYXJlIHVwZGF0ZWQsIGVnLiBmcm9tIHNsaWRlcixcblx0XHQvLyBubyB0d2VlbnMgd2lsbCBiZSBjcmVhdGVkLlxuXHRcdC8vIHdlIGNhbiBkZWNpZGUgYWxzbyB0byBcImxvY2sgaW5cIiBsYXllcnNcblx0XHQvLyBubyBjaGFuZ2VzIHRvIHR3ZWVuIHdpbGwgYmUgbWFkZSBldGMuXG5cdH0pO1xuXG5cdGRpc3BhdGNoZXIub24oJ2Vhc2UnLCBmdW5jdGlvbihsYXllciwgZWFzZV90eXBlKSB7XG5cdFx0dmFyIHQgPSBkYXRhLmdldCgndWk6Y3VycmVudFRpbWUnKS52YWx1ZTtcblx0XHR2YXIgdiA9IHV0aWxzLnRpbWVBdExheWVyKGxheWVyLCB0KTtcblx0XHQvLyBjb25zb2xlLmxvZygnRWFzZSBDaGFuZ2UgPiAnLCBsYXllciwgdmFsdWUsIHYpO1xuXHRcdGlmICh2ICYmIHYuZW50cnkpIHtcblx0XHRcdHYuZW50cnkudHdlZW4gID0gZWFzZV90eXBlO1xuXHRcdH1cblxuXHRcdHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0FkZCBFYXNlJykpO1xuXG5cdFx0cmVwYWludEFsbCgpO1xuXHR9KTtcblxuXHR2YXIgc3RhcnRfcGxheSA9IG51bGwsXG5cdFx0cGxheWVkX2Zyb20gPSAwOyAvLyByZXF1aXJlcyBzb21lIG1vcmUgdHdlYWtpbmdcblxuXHRkaXNwYXRjaGVyLm9uKCdjb250cm9scy50b2dnbGVfcGxheScsIGZ1bmN0aW9uKCkge1xuXHRcdGlmIChzdGFydF9wbGF5KSB7XG5cdFx0XHRwYXVzZVBsYXlpbmcoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3RhcnRQbGF5aW5nKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCdjb250cm9scy5yZXN0YXJ0X3BsYXknLCBmdW5jdGlvbigpIHtcblx0XHRpZiAoIXN0YXJ0X3BsYXkpIHtcblx0XHRcdHN0YXJ0UGxheWluZygpO1xuXHRcdH1cblxuXHRcdHNldEN1cnJlbnRUaW1lKHBsYXllZF9mcm9tKTtcblx0fSk7XG5cblx0ZGlzcGF0Y2hlci5vbignY29udHJvbHMucGxheScsIHN0YXJ0UGxheWluZyk7XG5cdGRpc3BhdGNoZXIub24oJ2NvbnRyb2xzLnBhdXNlJywgcGF1c2VQbGF5aW5nKTtcblxuXHRmdW5jdGlvbiBzdGFydFBsYXlpbmcoKSB7XG5cdFx0Ly8gcGxheWVkX2Zyb20gPSB0aW1lbGluZS5jdXJyZW50X2ZyYW1lO1xuXHRcdHN0YXJ0X3BsYXkgPSBwZXJmb3JtYW5jZS5ub3coKSAtIGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpLnZhbHVlICogMTAwMDtcblx0XHRsYXllcl9wYW5lbC5zZXRDb250cm9sU3RhdHVzKHRydWUpO1xuXHRcdC8vIGRpc3BhdGNoZXIuZmlyZSgnY29udHJvbHMuc3RhdHVzJywgdHJ1ZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBwYXVzZVBsYXlpbmcoKSB7XG5cdFx0c3RhcnRfcGxheSA9IG51bGw7XG5cdFx0bGF5ZXJfcGFuZWwuc2V0Q29udHJvbFN0YXR1cyhmYWxzZSk7XG5cdFx0Ly8gZGlzcGF0Y2hlci5maXJlKCdjb250cm9scy5zdGF0dXMnLCBmYWxzZSk7XG5cdH1cblxuXHRkaXNwYXRjaGVyLm9uKCdjb250cm9scy5zdG9wJywgZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHN0YXJ0X3BsYXkgIT09IG51bGwpIHBhdXNlUGxheWluZygpO1xuXHRcdHNldEN1cnJlbnRUaW1lKDApO1xuXHR9KTtcblxuXHR2YXIgY3VycmVudFRpbWVTdG9yZSA9IGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpO1xuXHRkaXNwYXRjaGVyLm9uKCd0aW1lLnVwZGF0ZScsIHNldEN1cnJlbnRUaW1lKTtcblxuXHRkaXNwYXRjaGVyLm9uKCd0b3RhbFRpbWUudXBkYXRlJywgZnVuY3Rpb24odmFsdWUpIHtcblx0XHQvLyBjb250ZXh0LnRvdGFsVGltZSA9IHZhbHVlO1xuXHRcdC8vIGNvbnRyb2xsZXIuc2V0RHVyYXRpb24odmFsdWUpO1xuXHRcdC8vIHRpbWVsaW5lLnJlcGFpbnQoKTtcblx0fSk7XG5cblx0LyogdXBkYXRlIHNjcm9sbCB2aWV3cG9ydCAqL1xuXHRkaXNwYXRjaGVyLm9uKCd1cGRhdGUuc2Nyb2xsVGltZScsIGZ1bmN0aW9uKHYpIHtcblx0XHR2ID0gTWF0aC5tYXgoMCwgdik7XG5cdFx0ZGF0YS5nZXQoJ3VpOnNjcm9sbFRpbWUnKS52YWx1ZSA9IHY7XG5cdFx0cmVwYWludEFsbCgpO1xuXHR9KTtcblxuXG5cdGZ1bmN0aW9uIHNldEN1cnJlbnRUaW1lKHZhbHVlKSB7XG5cdFx0dmFsdWUgPSBNYXRoLm1heCgwLCB2YWx1ZSk7XG5cdFx0Y3VycmVudFRpbWVTdG9yZS52YWx1ZSA9IHZhbHVlO1xuXG5cdFx0aWYgKHN0YXJ0X3BsYXkpIHN0YXJ0X3BsYXkgPSBwZXJmb3JtYW5jZS5ub3coKSAtIHZhbHVlICogMTAwMDtcblx0XHRyZXBhaW50QWxsKCk7XG5cdFx0Ly8gbGF5ZXJfcGFuZWwucmVwYWludChzKTtcblx0fVxuXG5cdGRpc3BhdGNoZXIub24oJ3RhcmdldC5ub3RpZnknLCBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuXHRcdGlmICh0YXJnZXQpIHRhcmdldFtuYW1lXSA9IHZhbHVlO1xuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCd1cGRhdGUuc2NhbGUnLCBmdW5jdGlvbih2KSB7XG5cdFx0Y29uc29sZS5sb2coJ3JhbmdlJywgdik7XG5cdFx0ZGF0YS5nZXQoJ3VpOnRpbWVTY2FsZScpLnZhbHVlID0gdjtcblxuXHRcdHRpbWVsaW5lLnJlcGFpbnQoKTtcblx0fSk7XG5cblx0Ly8gaGFuZGxlIHVuZG8gLyByZWRvXG5cdGRpc3BhdGNoZXIub24oJ2NvbnRyb2xzLnVuZG8nLCBmdW5jdGlvbigpIHtcblx0XHR2YXIgaGlzdG9yeSA9IHVuZG9fbWFuYWdlci51bmRvKCk7XG5cdFx0ZGF0YS5zZXRKU09OU3RyaW5nKGhpc3Rvcnkuc3RhdGUpO1xuXG5cdFx0dXBkYXRlU3RhdGUoKTtcblx0fSk7XG5cblx0ZGlzcGF0Y2hlci5vbignY29udHJvbHMucmVkbycsIGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoaXN0b3J5ID0gdW5kb19tYW5hZ2VyLnJlZG8oKTtcblx0XHRkYXRhLnNldEpTT05TdHJpbmcoaGlzdG9yeS5zdGF0ZSk7XG5cblx0XHR1cGRhdGVTdGF0ZSgpO1xuXHR9KTtcblxuXHQvKlxuXHRcdFBhaW50IFJvdXRpbmVzXG5cdCovXG5cblx0ZnVuY3Rpb24gcGFpbnQoKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKHBhaW50KTtcblxuXHRcdGlmIChzdGFydF9wbGF5KSB7XG5cdFx0XHR2YXIgdCA9IChwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXJ0X3BsYXkpIC8gMTAwMDtcblx0XHRcdHNldEN1cnJlbnRUaW1lKHQpO1xuXG5cblx0XHRcdGlmICh0ID4gZGF0YS5nZXQoJ3VpOnRvdGFsVGltZScpLnZhbHVlKSB7XG5cdFx0XHRcdC8vIHNpbXBsZSBsb29wXG5cdFx0XHRcdHN0YXJ0X3BsYXkgPSBwZXJmb3JtYW5jZS5ub3coKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobmVlZHNSZXNpemUpIHtcblx0XHRcdGRpdi5zdHlsZS53aWR0aCA9IFNldHRpbmdzLndpZHRoICsgJ3B4Jztcblx0XHRcdGRpdi5zdHlsZS5oZWlnaHQgPSBTZXR0aW5ncy5oZWlnaHQgKyAncHgnO1xuXG5cdFx0XHRyZXN0eWxlKGxheWVyX3BhbmVsLmRvbSwgdGltZWxpbmUuZG9tKTtcblxuXHRcdFx0dGltZWxpbmUucmVzaXplKCk7XG5cdFx0XHRyZXBhaW50QWxsKCk7XG5cdFx0XHRuZWVkc1Jlc2l6ZSA9IGZhbHNlO1xuXG5cdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ3Jlc2l6ZScpO1xuXHRcdH1cblxuXHRcdHRpbWVsaW5lLl9wYWludCgpO1xuXHR9XG5cblx0cGFpbnQoKTtcblxuXHQvKlxuXHRcdEVuZCBQYWludCBSb3V0aW5lc1xuXHQqL1xuXG5cdGZ1bmN0aW9uIHNhdmUobmFtZSkge1xuXHRcdGlmICghbmFtZSkgbmFtZSA9ICdhdXRvc2F2ZSc7XG5cblx0XHR2YXIganNvbiA9IGRhdGEuZ2V0SlNPTlN0cmluZygpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGxvY2FsU3RvcmFnZVtTVE9SQUdFX1BSRUZJWCArIG5hbWVdID0ganNvbjtcblx0XHRcdGRpc3BhdGNoZXIuZmlyZSgnc2F2ZTpkb25lJyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0Nhbm5vdCBzYXZlJywgbmFtZSwganNvbik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gc2F2ZUFzKG5hbWUpIHtcblx0XHRpZiAoIW5hbWUpIG5hbWUgPSBkYXRhLmdldCgnbmFtZScpLnZhbHVlO1xuXHRcdG5hbWUgPSBwcm9tcHQoJ1BpY2sgYSBuYW1lIHRvIHNhdmUgdG8gKGxvY2FsU3RvcmFnZSknLCBuYW1lKTtcblx0XHRpZiAobmFtZSkge1xuXHRcdFx0ZGF0YS5kYXRhLm5hbWUgPSBuYW1lO1xuXHRcdFx0c2F2ZShuYW1lKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzYXZlU2ltcGx5KCkge1xuXHRcdHZhciBuYW1lID0gZGF0YS5nZXQoJ25hbWUnKS52YWx1ZTtcblx0XHRpZiAobmFtZSkge1xuXHRcdFx0c2F2ZShuYW1lKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2F2ZUFzKG5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGV4cG9ydEpTT04oKSB7XG5cdFx0dmFyIGpzb24gPSBkYXRhLmdldEpTT05TdHJpbmcoKTtcblx0XHR2YXIgcmV0ID0gcHJvbXB0KCdIaXQgT0sgdG8gZG93bmxvYWQgb3RoZXJ3aXNlIENvcHkgYW5kIFBhc3RlIEpTT04nLCBqc29uKTtcblxuXHRcdGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGRhdGEuZGF0YSwgbnVsbCwgJ1xcdCcpKTtcblx0XHRpZiAoIXJldCkgcmV0dXJuO1xuXG5cdFx0Ly8gbWFrZSBqc29uIGRvd25sb2FkYWJsZVxuXHRcdGpzb24gPSBkYXRhLmdldEpTT05TdHJpbmcoJ1xcdCcpO1xuXHRcdHZhciBmaWxlTmFtZSA9ICd0aW1lbGluZXItdGVzdCcgKyAnLmpzb24nO1xuXG5cdFx0c2F2ZVRvRmlsZShqc29uLCBmaWxlTmFtZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBsb2FkSlNPTlN0cmluZyhvKSB7XG5cdFx0Ly8gc2hvdWxkIGNhdGNoIGFuZCBjaGVjayBlcnJvcnMgaGVyZVxuXHRcdHZhciBqc29uID0gSlNPTi5wYXJzZShvKTtcblx0XHRsb2FkKGpzb24pO1xuXHR9XG5cblx0ZnVuY3Rpb24gbG9hZChvKSB7XG5cdFx0ZGF0YS5zZXRKU09OKG8pO1xuXHRcdC8vXG5cdFx0aWYgKGRhdGEuZ2V0VmFsdWUoJ3VpJykgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0ZGF0YS5zZXRWYWx1ZSgndWknLCB7XG5cdFx0XHRcdGN1cnJlbnRUaW1lOiAwLFxuXHRcdFx0XHR0b3RhbFRpbWU6IFNldHRpbmdzLmRlZmF1bHRfbGVuZ3RoLFxuXHRcdFx0XHRzY3JvbGxUaW1lOiAwLFxuXHRcdFx0XHR0aW1lU2NhbGU6IFNldHRpbmdzLnRpbWVfc2NhbGVcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHVuZG9fbWFuYWdlci5jbGVhcigpO1xuXHRcdHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0xvYWRlZCcpLCB0cnVlKTtcblxuXHRcdHVwZGF0ZVN0YXRlKCk7XG5cdH1cblxuXHRmdW5jdGlvbiB1cGRhdGVTdGF0ZSgpIHtcblx0XHRsYXllcnMgPSBsYXllcl9zdG9yZS52YWx1ZTsgLy8gRklYTUU6IHN1cHBvcnQgQXJyYXlzXG5cdFx0bGF5ZXJfcGFuZWwuc2V0U3RhdGUobGF5ZXJfc3RvcmUpO1xuXHRcdHRpbWVsaW5lLnNldFN0YXRlKGxheWVyX3N0b3JlKTtcblxuXHRcdHJlcGFpbnRBbGwoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlcGFpbnRBbGwoKSB7XG5cdFx0dmFyIGNvbnRlbnRfaGVpZ2h0ID0gbGF5ZXJzLmxlbmd0aCAqIFNldHRpbmdzLkxJTkVfSEVJR0hUO1xuXHRcdHNjcm9sbGJhci5zZXRMZW5ndGgoU2V0dGluZ3MuVElNRUxJTkVfU0NST0xMX0hFSUdIVCAvIGNvbnRlbnRfaGVpZ2h0KTtcblxuXHRcdGxheWVyX3BhbmVsLnJlcGFpbnQoKTtcblx0XHR0aW1lbGluZS5yZXBhaW50KCk7XG5cdH1cblxuXHRmdW5jdGlvbiBwcm9tcHRJbXBvcnQoKSB7XG5cdFx0dmFyIGpzb24gPSBwcm9tcHQoJ1Bhc3RlIEpTT04gaW4gaGVyZSB0byBMb2FkJyk7XG5cdFx0aWYgKCFqc29uKSByZXR1cm47XG5cdFx0Y29uc29sZS5sb2coJ0xvYWRpbmcuLiAnLCBqc29uKTtcblx0XHRsb2FkSlNPTlN0cmluZyhqc29uKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9wZW4odGl0bGUpIHtcblx0XHRpZiAodGl0bGUpIHtcblx0XHRcdGxvYWRKU09OU3RyaW5nKGxvY2FsU3RvcmFnZVtTVE9SQUdFX1BSRUZJWCArIHRpdGxlXSk7XG5cdFx0fVxuXHR9XG5cblx0dGhpcy5vcGVuTG9jYWxTYXZlID0gb3BlbjtcblxuXHRkaXNwYXRjaGVyLm9uKCdpbXBvcnQnLCBmdW5jdGlvbigpIHtcblx0XHRwcm9tcHRJbXBvcnQoKTtcblx0fS5iaW5kKHRoaXMpKTtcblxuXHRkaXNwYXRjaGVyLm9uKCduZXcnLCBmdW5jdGlvbigpIHtcblx0XHRkYXRhLmJsYW5rKCk7XG5cdFx0dXBkYXRlU3RhdGUoKTtcblx0fSk7XG5cblx0ZGlzcGF0Y2hlci5vbignb3BlbmZpbGUnLCBmdW5jdGlvbigpIHtcblx0XHRvcGVuQXMoZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0Ly8gY29uc29sZS5sb2coJ2xvYWRlZCAnICsgZGF0YSk7XG5cdFx0XHRsb2FkSlNPTlN0cmluZyhkYXRhKTtcblx0XHR9LCBkaXYpO1xuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCdvcGVuJywgb3Blbik7XG5cdGRpc3BhdGNoZXIub24oJ2V4cG9ydCcsIGV4cG9ydEpTT04pO1xuXG5cdGRpc3BhdGNoZXIub24oJ3NhdmUnLCBzYXZlU2ltcGx5KTtcblx0ZGlzcGF0Y2hlci5vbignc2F2ZV9hcycsIHNhdmVBcyk7XG5cblx0Ly8gRXhwb3NlIEFQSVxuXHR0aGlzLnNhdmUgPSBzYXZlO1xuXHR0aGlzLmxvYWQgPSBsb2FkO1xuXG5cdC8qXG5cdFx0U3RhcnQgRE9NIFN0dWZmIChzaG91bGQgc2VwYXJhdGUgZmlsZSlcblx0Ki9cblxuXHR2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdHN0eWxlKGRpdiwge1xuXHRcdHRleHRBbGlnbjogJ2xlZnQnLFxuXHRcdGxpbmVIZWlnaHQ6ICcxZW0nLFxuXHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdHRvcDogJzIycHgnXG5cdH0pO1xuXG5cdHZhciBwYW5lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0c3R5bGUocGFuZSwge1xuXHRcdHBvc2l0aW9uOiAnZml4ZWQnLFxuXHRcdHRvcDogJzIwcHgnLFxuXHRcdGxlZnQ6ICcyMHB4Jyxcblx0XHRtYXJnaW46IDAsXG5cdFx0Ym9yZGVyOiAnMXB4IHNvbGlkICcgKyBUaGVtZS5hLFxuXHRcdHBhZGRpbmc6IDAsXG5cdFx0b3ZlcmZsb3c6ICdoaWRkZW4nLFxuXHRcdGJhY2tncm91bmRDb2xvcjogVGhlbWUuYSxcblx0XHRjb2xvcjogVGhlbWUuZCxcblx0XHR6SW5kZXg6IFpfSU5ERVgsXG5cdFx0Zm9udEZhbWlseTogJ21vbm9zcGFjZScsXG5cdFx0Zm9udFNpemU6ICcxMnB4J1xuXHR9KTtcblxuXG5cdHZhciBoZWFkZXJfc3R5bGVzID0ge1xuXHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdHRvcDogJzBweCcsXG5cdFx0d2lkdGg6ICcxMDAlJyxcblx0XHRoZWlnaHQ6ICcyMnB4Jyxcblx0XHRsaW5lSGVpZ2h0OiAnMjJweCcsXG5cdFx0b3ZlcmZsb3c6ICdoaWRkZW4nXG5cdH07XG5cblx0dmFyIGJ1dHRvbl9zdHlsZXMgPSB7XG5cdFx0d2lkdGg6ICcyMHB4Jyxcblx0XHRoZWlnaHQ6ICcyMHB4Jyxcblx0XHRwYWRkaW5nOiAnMnB4Jyxcblx0XHRtYXJnaW5SaWdodDogJzJweCdcblx0fTtcblxuXHR2YXIgcGFuZV90aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRzdHlsZShwYW5lX3RpdGxlLCBoZWFkZXJfc3R5bGVzLCB7XG5cdFx0Ym9yZGVyQm90dG9tOiAnMXB4IHNvbGlkICcgKyBUaGVtZS5iLFxuXHRcdHRleHRBbGlnbjogJ2NlbnRlcidcblx0fSk7XG5cblx0dmFyIHRpdGxlX2JhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0cGFuZV90aXRsZS5hcHBlbmRDaGlsZCh0aXRsZV9iYXIpO1xuXG5cdHRpdGxlX2Jhci5pbm5lckhUTUwgPSAnVGltZWxpbmVyICcgKyBUSU1FTElORVJfVkVSU0lPTjtcblx0cGFuZV90aXRsZS5hcHBlbmRDaGlsZCh0aXRsZV9iYXIpO1xuXG5cdHZhciB0b3BfcmlnaHRfYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdHN0eWxlKHRvcF9yaWdodF9iYXIsIGhlYWRlcl9zdHlsZXMsIHtcblx0XHR0ZXh0QWxpZ246ICdyaWdodCdcblx0fSk7XG5cblx0cGFuZV90aXRsZS5hcHBlbmRDaGlsZCh0b3BfcmlnaHRfYmFyKTtcblxuXHQvLyByZXNpemUgbWluaW1pemVcblx0Ly8gdmFyIHJlc2l6ZV9zbWFsbCA9IG5ldyBJY29uQnV0dG9uKDEwLCAncmVzaXplX3NtYWxsJywgJ21pbmltaXplJywgZGlzcGF0Y2hlcik7XG5cdC8vIHRvcF9yaWdodF9iYXIuYXBwZW5kQ2hpbGQocmVzaXplX3NtYWxsLmRvbSk7XG5cblx0Ly8gcmVzaXplIGZ1bGxcblx0dmFyIHJlc2l6ZV9mdWxsID0gbmV3IEljb25CdXR0b24oMTAsICdyZXNpemVfZnVsbCcsICdtYXhpbWl6ZScsIGRpc3BhdGNoZXIpO1xuXHRzdHlsZShyZXNpemVfZnVsbC5kb20sIGJ1dHRvbl9zdHlsZXMsIHsgbWFyZ2luUmlnaHQ6ICcycHgnIH0pO1xuXHR0b3BfcmlnaHRfYmFyLmFwcGVuZENoaWxkKHJlc2l6ZV9mdWxsLmRvbSk7XG5cblx0dmFyIHBhbmVfc3RhdHVzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0dmFyIGZvb3Rlcl9zdHlsZXMgPSB7XG5cdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0d2lkdGg6ICcxMDAlJyxcblx0XHRoZWlnaHQ6ICcyMnB4Jyxcblx0XHRsaW5lSGVpZ2h0OiAnMjJweCcsXG5cdFx0Ym90dG9tOiAnMCcsXG5cdFx0Ly8gcGFkZGluZzogJzJweCcsXG5cdFx0YmFja2dyb3VuZDogVGhlbWUuYSxcblx0XHRmb250U2l6ZTogJzExcHgnXG5cdH07XG5cblx0c3R5bGUocGFuZV9zdGF0dXMsIGZvb3Rlcl9zdHlsZXMsIHtcblx0XHRib3JkZXJUb3A6ICcxcHggc29saWQgJyArIFRoZW1lLmIsXG5cdH0pO1xuXG5cdHBhbmUuYXBwZW5kQ2hpbGQoZGl2KTtcblx0cGFuZS5hcHBlbmRDaGlsZChwYW5lX3N0YXR1cyk7XG5cdHBhbmUuYXBwZW5kQ2hpbGQocGFuZV90aXRsZSk7XG5cblx0dmFyIGxhYmVsX3N0YXR1cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0bGFiZWxfc3RhdHVzLnRleHRDb250ZW50ID0gJ2hlbGxvISc7XG5cdGxhYmVsX3N0YXR1cy5zdHlsZS5tYXJnaW5MZWZ0ID0gJzEwcHgnO1xuXG5cdHRoaXMuc2V0U3RhdHVzID0gZnVuY3Rpb24odGV4dCkge1xuXHRcdGxhYmVsX3N0YXR1cy50ZXh0Q29udGVudCA9IHRleHQ7XG5cdH07XG5cblx0ZGlzcGF0Y2hlci5vbignc3RhdGU6c2F2ZScsIGZ1bmN0aW9uKGRlc2NyaXB0aW9uKSB7XG5cdFx0ZGlzcGF0Y2hlci5maXJlKCdzdGF0dXMnLCBkZXNjcmlwdGlvbik7XG5cdFx0c2F2ZSgnYXV0b3NhdmUnKTtcblx0fSk7XG5cblx0ZGlzcGF0Y2hlci5vbignc3RhdHVzJywgdGhpcy5zZXRTdGF0dXMpO1xuXG5cdHZhciBib3R0b21fcmlnaHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0c3R5bGUoYm90dG9tX3JpZ2h0LCBmb290ZXJfc3R5bGVzLCB7XG5cdFx0dGV4dEFsaWduOiAncmlnaHQnXG5cdH0pO1xuXG5cblx0Ly8gdmFyIGJ1dHRvbl9zYXZlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdC8vIHN0eWxlKGJ1dHRvbl9zYXZlLCBidXR0b25fc3R5bGVzKTtcblx0Ly8gYnV0dG9uX3NhdmUudGV4dENvbnRlbnQgPSAnU2F2ZSc7XG5cdC8vIGJ1dHRvbl9zYXZlLm9uY2xpY2sgPSBmdW5jdGlvbigpIHtcblx0Ly8gXHRzYXZlKCk7XG5cdC8vIH07XG5cblx0Ly8gdmFyIGJ1dHRvbl9sb2FkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdC8vIHN0eWxlKGJ1dHRvbl9sb2FkLCBidXR0b25fc3R5bGVzKTtcblx0Ly8gYnV0dG9uX2xvYWQudGV4dENvbnRlbnQgPSAnSW1wb3J0Jztcblx0Ly8gYnV0dG9uX2xvYWQub25jbGljayA9IHRoaXMucHJvbXB0TG9hZDtcblxuXHQvLyB2YXIgYnV0dG9uX29wZW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0Ly8gc3R5bGUoYnV0dG9uX29wZW4sIGJ1dHRvbl9zdHlsZXMpO1xuXHQvLyBidXR0b25fb3Blbi50ZXh0Q29udGVudCA9ICdPcGVuJztcblx0Ly8gYnV0dG9uX29wZW4ub25jbGljayA9IHRoaXMucHJvbXB0T3BlbjtcblxuXG5cdC8vIGJvdHRvbV9yaWdodC5hcHBlbmRDaGlsZChidXR0b25fbG9hZCk7XG5cdC8vIGJvdHRvbV9yaWdodC5hcHBlbmRDaGlsZChidXR0b25fc2F2ZSk7XG5cdC8vIGJvdHRvbV9yaWdodC5hcHBlbmRDaGlsZChidXR0b25fb3Blbik7XG5cblx0cGFuZV9zdGF0dXMuYXBwZW5kQ2hpbGQobGFiZWxfc3RhdHVzKTtcblx0cGFuZV9zdGF0dXMuYXBwZW5kQ2hpbGQoYm90dG9tX3JpZ2h0KTtcblxuXG5cdC8qKi9cblx0Ly8gem9vbSBpblxuXHR2YXIgem9vbV9pbiA9IG5ldyBJY29uQnV0dG9uKDEyLCAnem9vbV9pbicsICd6b29tIGluJywgZGlzcGF0Y2hlcik7XG5cdC8vIHpvb20gb3V0XG5cdHZhciB6b29tX291dCA9IG5ldyBJY29uQnV0dG9uKDEyLCAnem9vbV9vdXQnLCAnem9vbSBvdXQnLCBkaXNwYXRjaGVyKTtcblx0Ly8gc2V0dGluZ3Ncblx0dmFyIGNvZyA9IG5ldyBJY29uQnV0dG9uKDEyLCAnY29nJywgJ3NldHRpbmdzJywgZGlzcGF0Y2hlcik7XG5cblx0Ly8gYm90dG9tX3JpZ2h0LmFwcGVuZENoaWxkKHpvb21faW4uZG9tKTtcblx0Ly8gYm90dG9tX3JpZ2h0LmFwcGVuZENoaWxkKHpvb21fb3V0LmRvbSk7XG5cdC8vIGJvdHRvbV9yaWdodC5hcHBlbmRDaGlsZChjb2cuZG9tKTtcblxuXHQvLyBhZGQgbGF5ZXJcblx0dmFyIHBsdXMgPSBuZXcgSWNvbkJ1dHRvbigxMiwgJ3BsdXMnLCAnTmV3IExheWVyJywgZGlzcGF0Y2hlcik7XG5cdHBsdXMub25DbGljayhmdW5jdGlvbigpIHtcblx0XHR2YXIgbmFtZSA9IHByb21wdCgnTGF5ZXIgbmFtZT8nKTtcblx0XHRhZGRMYXllcihuYW1lKTtcblxuXHRcdHVuZG9fbWFuYWdlci5zYXZlKG5ldyBVbmRvU3RhdGUoZGF0YSwgJ0xheWVyIGFkZGVkJykpO1xuXG5cdFx0cmVwYWludEFsbCgpO1xuXHR9KTtcblx0c3R5bGUocGx1cy5kb20sIGJ1dHRvbl9zdHlsZXMpO1xuXHRib3R0b21fcmlnaHQuYXBwZW5kQ2hpbGQocGx1cy5kb20pO1xuXG5cblx0Ly8gdHJhc2hcblx0dmFyIHRyYXNoID0gbmV3IEljb25CdXR0b24oMTIsICd0cmFzaCcsICdEZWxldGUgc2F2ZScsIGRpc3BhdGNoZXIpO1xuXHR0cmFzaC5vbkNsaWNrKGZ1bmN0aW9uKCkge1xuXHRcdHZhciBuYW1lID0gZGF0YS5nZXQoJ25hbWUnKS52YWx1ZTtcblx0XHRpZiAobmFtZSAmJiBsb2NhbFN0b3JhZ2VbU1RPUkFHRV9QUkVGSVggKyBuYW1lXSkge1xuXHRcdFx0dmFyIG9rID0gY29uZmlybSgnQXJlIHlvdSBzdXJlIHlvdSB3aXNoIHRvIGRlbGV0ZSAnICsgbmFtZSArICc/Jyk7XG5cdFx0XHRpZiAob2spIHtcblx0XHRcdFx0ZGVsZXRlIGxvY2FsU3RvcmFnZVtTVE9SQUdFX1BSRUZJWCArIG5hbWVdO1xuXHRcdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ3N0YXR1cycsIG5hbWUgKyAnIGRlbGV0ZWQnKTtcblx0XHRcdFx0ZGlzcGF0Y2hlci5maXJlKCdzYXZlOmRvbmUnKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXHRzdHlsZSh0cmFzaC5kb20sIGJ1dHRvbl9zdHlsZXMsIHsgbWFyZ2luUmlnaHQ6ICcycHgnIH0pO1xuXHRib3R0b21fcmlnaHQuYXBwZW5kQ2hpbGQodHJhc2guZG9tKTtcblxuXG5cdC8vIHBhbmVfc3RhdHVzLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgfCBUT0RPIDxEb2NrIEZ1bGwgfCBEb2NrIEJvdHRvbiB8IFNuYXAgV2luZG93IEVkZ2VzIHwgem9vbSBpbiB8IHpvb20gb3V0IHwgU2V0dGluZ3MgfCBoZWxwPicpKTtcblxuXHQvKlxuXHRcdFx0RW5kIERPTSBTdHVmZlxuXHQqL1xuXG5cdHZhciBnaG9zdHBhbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0Z2hvc3RwYW5lLmlkID0gJ2dob3N0cGFuZSc7XG5cdHN0eWxlKGdob3N0cGFuZSwge1xuXHRcdGJhY2tncm91bmQ6ICcjOTk5Jyxcblx0XHRvcGFjaXR5OiAwLjIsXG5cdFx0cG9zaXRpb246ICdmaXhlZCcsXG5cdFx0bWFyZ2luOiAwLFxuXHRcdHBhZGRpbmc6IDAsXG5cdFx0ekluZGV4OiAoWl9JTkRFWCAtIDEpLFxuXHRcdC8vIHRyYW5zaXRpb246ICdhbGwgMC4yNXMgZWFzZS1pbi1vdXQnLFxuXHRcdHRyYW5zaXRpb25Qcm9wZXJ0eTogJ3RvcCwgbGVmdCwgd2lkdGgsIGhlaWdodCwgb3BhY2l0eScsXG5cdFx0dHJhbnNpdGlvbkR1cmF0aW9uOiAnMC4yNXMnLFxuXHRcdHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbjogJ2Vhc2UtaW4tb3V0J1xuXHR9KTtcblxuXG5cdC8vXG5cdC8vIEhhbmRsZSBET00gVmlld3Ncblx0Ly9cblxuXHQvLyBTaGFkb3cgUm9vdFxuXHR2YXIgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RpbWVsaW5lcicpO1xuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJvb3QpO1xuXHRpZiAocm9vdC5jcmVhdGVTaGFkb3dSb290KSByb290ID0gcm9vdC5jcmVhdGVTaGFkb3dSb290KCk7XG5cblx0d2luZG93LnIgPSByb290O1xuXG5cdC8vIHZhciBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcblx0Ly8gZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpZnJhbWUpO1xuXHQvLyByb290ID0gaWZyYW1lLmNvbnRlbnREb2N1bWVudC5ib2R5O1xuXG5cdHJvb3QuYXBwZW5kQ2hpbGQocGFuZSk7XG5cdHJvb3QuYXBwZW5kQ2hpbGQoZ2hvc3RwYW5lKTtcblxuXHRkaXYuYXBwZW5kQ2hpbGQobGF5ZXJfcGFuZWwuZG9tKTtcblx0ZGl2LmFwcGVuZENoaWxkKHRpbWVsaW5lLmRvbSk7XG5cblx0dmFyIHNjcm9sbGJhciA9IG5ldyBTY3JvbGxCYXIoMjAwLCAxMCk7XG5cdGRpdi5hcHBlbmRDaGlsZChzY3JvbGxiYXIuZG9tKTtcblxuXHQvLyBwZXJjZW50YWdlc1xuXHRzY3JvbGxiYXIub25TY3JvbGwuZG8oZnVuY3Rpb24odHlwZSwgc2Nyb2xsVG8pIHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRjYXNlICdzY3JvbGx0byc6XG5cdFx0XHRsYXllcl9wYW5lbC5zY3JvbGxUbyhzY3JvbGxUbyk7XG5cdFx0XHR0aW1lbGluZS5zY3JvbGxUbyhzY3JvbGxUbyk7XG5cdFx0XHRicmVhaztcblx0Ly9cdFx0Y2FzZSAncGFnZXVwJzpcblx0Ly8gXHRcdFx0c2Nyb2xsVG9wIC09IHBhZ2VPZmZzZXQ7XG5cdC8vIFx0XHRcdG1lLmRyYXcoKTtcblx0Ly8gXHRcdFx0bWUudXBkYXRlU2Nyb2xsYmFyKCk7XG5cdC8vIFx0XHRcdGJyZWFrO1xuXHQvLyBcdFx0Y2FzZSAncGFnZWRvd24nOlxuXHQvLyBcdFx0XHRzY3JvbGxUb3AgKz0gcGFnZU9mZnNldDtcblx0Ly8gXHRcdFx0bWUuZHJhdygpO1xuXHQvLyBcdFx0XHRtZS51cGRhdGVTY3JvbGxiYXIoKTtcblx0Ly8gXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9KTtcblxuXG5cblx0Ly8gZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBmdW5jdGlvbihlKSB7XG5cdC8vIFx0Y29uc29sZS5sb2coJ2twJywgZSk7XG5cdC8vIH0pO1xuXHQvLyBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGZ1bmN0aW9uKGUpIHtcblx0Ly8gXHRpZiAodW5kbykgY29uc29sZS5sb2coJ1VORE8nKTtcblxuXHQvLyBcdGNvbnNvbGUubG9nKCdrZCcsIGUpO1xuXHQvLyB9KTtcblxuXHQvLyBUT0RPOiBLZXlib2FyZCBTaG9ydGN1dHNcblx0Ly8gRXNjIC0gU3RvcCBhbmQgcmV2aWV3IHRvIGxhc3QgcGxheWVkIGZyb20gLyB0byB0aGUgc3RhcnQ/XG5cdC8vIFNwYWNlIC0gcGxheSAvIHBhdXNlIGZyb20gY3VycmVudCBwb3NpdGlvblxuXHQvLyBFbnRlciAtIHBsYXkgYWxsXG5cdC8vIGsgLSBrZXlmcmFtZVxuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XG5cdFx0dmFyIHBsYXkgPSBlLmtleUNvZGUgPT0gMzI7IC8vIHNwYWNlXG5cdFx0dmFyIGVudGVyID0gZS5rZXlDb2RlID09IDEzOyAvL1xuXHRcdHZhciB1bmRvID0gZS5tZXRhS2V5ICYmIGUua2V5Q29kZSA9PSA5MSAmJiAhZS5zaGlmdEtleTtcblxuXHRcdHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdC8vIGNvbnNvbGUubG9nKCBhY3RpdmUubm9kZU5hbWUgKTtcblxuXHRcdGlmIChhY3RpdmUubm9kZU5hbWUubWF0Y2goLyhJTlBVVHxCVVRUT058U0VMRUNUfFRJTUVMSU5FUikvKSkge1xuXHRcdFx0YWN0aXZlLmJsdXIoKTtcblx0XHR9XG5cblx0XHRpZiAocGxheSkge1xuXHRcdFx0ZGlzcGF0Y2hlci5maXJlKCdjb250cm9scy50b2dnbGVfcGxheScpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChlbnRlcikge1xuXHRcdFx0Ly8gRklYTUU6IFJldHVybiBzaG91bGQgcGxheSBmcm9tIHRoZSBzdGFydCBvciBsYXN0IHBsYXllZCBmcm9tP1xuXHRcdFx0ZGlzcGF0Y2hlci5maXJlKCdjb250cm9scy5yZXN0YXJ0X3BsYXknKTtcblx0XHRcdC8vIGRpc3BhdGNoZXIuZmlyZSgnY29udHJvbHMudW5kbycpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChlLmtleUNvZGUgPT0gMjcpIHtcblx0XHRcdC8vIEVzYyA9IHN0b3AuIEZJWE1FOiBzaG91bGQgcmV3aW5kIGhlYWQgdG8gbGFzdCBwbGF5ZWQgZnJvbSBvciBMYXN0IHBvaW50ZWQgZnJvbT9cblx0XHRcdGRpc3BhdGNoZXIuZmlyZSgnY29udHJvbHMucGF1c2UnKTtcblx0XHR9XG5cdFx0ZWxzZSBjb25zb2xlLmxvZygna2V5ZG93bicsIGUua2V5Q29kZSk7XG5cdH0pO1xuXG5cdHZhciBuZWVkc1Jlc2l6ZSA9IHRydWU7XG5cblx0ZnVuY3Rpb24gcmVzaXplKHdpZHRoLCBoZWlnaHQpIHtcblx0XHQvLyBkYXRhLmdldCgndWk6Ym91bmRzJykudmFsdWUgPSB7XG5cdFx0Ly8gXHR3aWR0aDogd2lkdGgsXG5cdFx0Ly8gXHRoZWlnaHQ6IGhlaWdodFxuXHRcdC8vIH07XG5cdFx0Ly8gVE9ETzogcmVtb3ZlIHVnbHkgaGFyZGNvZGVzXG5cdFx0d2lkdGggLT0gNDtcblx0XHRoZWlnaHQgLT0gNDQ7XG5cblx0XHRTZXR0aW5ncy53aWR0aCA9IHdpZHRoIC0gU2V0dGluZ3MuTEVGVF9QQU5FX1dJRFRIO1xuXHRcdFNldHRpbmdzLmhlaWdodCA9IGhlaWdodDtcblxuXHRcdFNldHRpbmdzLlRJTUVMSU5FX1NDUk9MTF9IRUlHSFQgPSBoZWlnaHQgLSBTZXR0aW5ncy5NQVJLRVJfVFJBQ0tfSEVJR0hUO1xuXHRcdHZhciBzY3JvbGxhYmxlX2hlaWdodCA9IFNldHRpbmdzLlRJTUVMSU5FX1NDUk9MTF9IRUlHSFQ7XG5cblx0XHRzY3JvbGxiYXIuc2V0SGVpZ2h0KHNjcm9sbGFibGVfaGVpZ2h0IC0gMik7XG5cblx0XHRzdHlsZShzY3JvbGxiYXIuZG9tLCB7XG5cdFx0XHR0b3A6IFNldHRpbmdzLk1BUktFUl9UUkFDS19IRUlHSFQgKyAncHgnLFxuXHRcdFx0bGVmdDogKHdpZHRoIC0gMTYpICsgJ3B4Jyxcblx0XHR9KTtcblxuXHRcdG5lZWRzUmVzaXplID0gdHJ1ZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHJlc3R5bGUobGVmdCwgcmlnaHQpIHtcblx0XHRsZWZ0LnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGFic29sdXRlOyBsZWZ0OiAwcHg7IHRvcDogMHB4OyBoZWlnaHQ6ICcgKyBTZXR0aW5ncy5oZWlnaHQgKyAncHg7Jztcblx0XHRzdHlsZShsZWZ0LCB7XG5cdFx0XHQvLyBiYWNrZ3JvdW5kOiBUaGVtZS5hLFxuXHRcdFx0b3ZlcmZsb3c6ICdoaWRkZW4nXG5cdFx0fSk7XG5cdFx0bGVmdC5zdHlsZS53aWR0aCA9IFNldHRpbmdzLkxFRlRfUEFORV9XSURUSCArICdweCc7XG5cblx0XHQvLyByaWdodC5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAwcHg7Jztcblx0XHRyaWdodC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0cmlnaHQuc3R5bGUudG9wID0gJzBweCc7XG5cdFx0cmlnaHQuc3R5bGUubGVmdCA9IFNldHRpbmdzLkxFRlRfUEFORV9XSURUSCArICdweCc7XG5cdH1cblxuXHRmdW5jdGlvbiBhZGRMYXllcihuYW1lKSB7XG5cdFx0dmFyIGxheWVyID0gbmV3IExheWVyUHJvcChuYW1lKTtcblxuXHRcdGxheWVycyA9IGxheWVyX3N0b3JlLnZhbHVlO1xuXHRcdGxheWVycy5wdXNoKGxheWVyKTtcblxuXHRcdGxheWVyX3BhbmVsLnNldFN0YXRlKGxheWVyX3N0b3JlKTtcblx0fVxuXG5cdHRoaXMuYWRkTGF5ZXIgPSBhZGRMYXllcjtcblxuXHR0aGlzLmRpc3Bvc2UgPSBmdW5jdGlvbiBkaXNwb3NlKCkge1xuXG5cdFx0dmFyIGRvbVBhcmVudCA9IHBhbmUucGFyZW50RWxlbWVudDtcblx0XHRkb21QYXJlbnQucmVtb3ZlQ2hpbGQocGFuZSk7XG5cdFx0ZG9tUGFyZW50LnJlbW92ZUNoaWxkKGdob3N0cGFuZSk7XG5cblx0fTtcblxuXHR0aGlzLnNldFRhcmdldCA9IGZ1bmN0aW9uKHQpIHtcblx0XHR0YXJnZXQgPSB0O1xuXHR9O1xuXG5cdGZ1bmN0aW9uIGdldFZhbHVlUmFuZ2VzKHJhbmdlcywgaW50ZXJ2YWwpIHtcblx0XHRpbnRlcnZhbCA9IGludGVydmFsID8gaW50ZXJ2YWwgOiAwLjE1O1xuXHRcdHJhbmdlcyA9IHJhbmdlcyA/IHJhbmdlcyA6IDI7XG5cblx0XHQvLyBub3Qgb3B0aW1pemVkIVxuXHRcdHZhciB0ID0gZGF0YS5nZXQoJ3VpOmN1cnJlbnRUaW1lJykudmFsdWU7XG5cblx0XHR2YXIgdmFsdWVzID0gW107XG5cblx0XHRmb3IgKHZhciB1ID0gLXJhbmdlczsgdSA8PSByYW5nZXM7IHUrKykge1xuXHRcdFx0Ly8gaWYgKHUgPT0gMCkgY29udGludWU7XG5cdFx0XHR2YXIgbyA9IHt9O1xuXG5cdFx0XHRmb3IgKHZhciBsID0gMDsgbCA8IGxheWVycy5sZW5ndGg7IGwrKykge1xuXHRcdFx0XHR2YXIgbGF5ZXIgPSBsYXllcnNbbF07XG5cdFx0XHRcdHZhciBtID0gdXRpbHMudGltZUF0TGF5ZXIobGF5ZXIsIHQgKyB1ICogaW50ZXJ2YWwpO1xuXHRcdFx0XHRvW2xheWVyLm5hbWVdID0gbS52YWx1ZTtcblx0XHRcdH1cblxuXHRcdFx0dmFsdWVzLnB1c2gobyk7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdmFsdWVzO1xuXHR9XG5cblx0dGhpcy5nZXRWYWx1ZXMgPSBnZXRWYWx1ZVJhbmdlcztcblxuXHQvKiBJbnRlZ3JhdGUgcGFuZSBpbnRvIGRvY2tpbmcgd2luZG93ICovXG5cdHZhciB3aWRnZXQgPSBuZXcgRG9ja2luZ1dpbmRvdyhwYW5lLCBnaG9zdHBhbmUpXG5cdHdpZGdldC5hbGxvd01vdmUoZmFsc2UpO1xuXHR3aWRnZXQucmVzaXplcy5kbyhyZXNpemUpXG5cblx0cGFuZV90aXRsZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpIHtcblx0XHR3aWRnZXQuYWxsb3dNb3ZlKHRydWUpO1xuXHR9KTtcblxuXHRwYW5lX3RpdGxlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3V0JywgZnVuY3Rpb24oKSB7XG5cdFx0d2lkZ2V0LmFsbG93TW92ZShmYWxzZSk7XG5cdH0pO1xufVxuXG5cbndpbmRvdy5UaW1lbGluZXIgPSBUaW1lbGluZXI7XG5cbmV4cG9ydCB7IFRpbWVsaW5lciB9IiwiaW1wb3J0IHsgaGFuZGxlRHJhZyB9IGZyb20gJy4uL3V0aWxzL3V0aWxfaGFuZGxlX2RyYWcuanMnO1xuXG5mdW5jdGlvbiBDYW52YXModywgaCkge1xuXG5cdHZhciBjYW52YXMsIGN0eCwgd2lkdGgsIGhlaWdodCwgZHByO1xuXG5cdHZhciBjYW52YXNJdGVtcyA9IFtdO1xuXHR2YXIgY2hpbGQ7XG5cblx0ZnVuY3Rpb24gY3JlYXRlKCkge1xuXHRcdGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0U2l6ZSh3LCBoKSB7XG5cdFx0d2lkdGggPSB3O1xuXHRcdGhlaWdodCA9IGg7XG5cdFx0ZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG5cdFx0Y2FudmFzLndpZHRoID0gd2lkdGggKiBkcHI7XG5cdFx0Y2FudmFzLmhlaWdodCA9IGhlaWdodCAqIGRwcjtcblx0XHRjYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG5cdFx0Y2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cblx0XHRpZiAoY2hpbGQpIGNoaWxkLnNldFNpemUodywgaCk7XG5cdH1cblxuXHRmdW5jdGlvbiBwYWludChjdHgpIHtcblx0XHRpZiAoY2hpbGQpIHtcblx0XHRcdGlmICghY2hpbGQucGFpbnQpIGNvbnNvbGUud2FybignaW1wbGVtZW50IHJlcGFpbnQoKScpXG5cdFx0XHRjaGlsZC5wYWludChjdHgpO1xuXHRcdH1cblxuXHRcdHZhciBpdGVtO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY2FudmFzSXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGl0ZW0gPSBjYW52YXNJdGVtc1tpXTtcblx0XHRcdGl0ZW0ucGFpbnQoKVxuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlcGFpbnQoKSB7XG5cdFx0cGFpbnQoY3R4KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFkZChpdGVtKSB7XG5cdFx0Y2FudmFzSXRlbXMucHVzaChpdGVtKVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVtb3ZlKGl0ZW0pIHtcblx0XHRjYW52YXNJdGVtcy5zcGxpY2UoY2FudmFzSXRlbXMuaW5kZXhPZihpdGVtKSwgMSk7XG5cdH1cblxuXHRmdW5jdGlvbiB1c2VzKGMpIHtcblx0XHRjaGlsZCA9IGM7XG5cdFx0Y2hpbGQuYWRkID0gdGhpcy5hZGQ7XG5cdFx0Y2hpbGQucmVtb3ZlID0gdGhpcy5yZW1vdmU7XG5cdH1cblxuXHRjcmVhdGUoKTtcblx0c2V0U2l6ZSh3LCBoKTtcblx0dGhpcy5zZXRTaXplID0gc2V0U2l6ZTtcblx0dGhpcy5yZXBhaW50ID0gcmVwYWludDtcblx0dGhpcy51c2VzID0gdXNlcztcblxuXHR0aGlzLmRvbSA9IGNhbnZhcztcblxuXHRoYW5kbGVEcmFnKGNhbnZhcyxcblx0XHRmdW5jdGlvbiBkb3duKGUpIHtcblx0XHRcdGlmIChjaGlsZC5vbkRvd24pIHsgY2hpbGQub25Eb3duKGUpIH1cblx0XHR9LFxuXHRcdGZ1bmN0aW9uIG1vdmUoZSkge1xuXHRcdFx0aWYgKGNoaWxkLm9uTW92ZSkgeyBjaGlsZC5vbk1vdmUoZSkgfVxuXHRcdH0sXG5cdFx0ZnVuY3Rpb24gdXAoZSkge1xuXHRcdFx0aWYgKGNoaWxkLm9uVXApIHsgY2hpbGQub25VcChlKSB9XG5cdFx0fVxuXHRcdC8vIGZ1bmN0aW9uIGhpdChlKSB7XG5cdFx0Ly8gXHRpZiAoY2hpbGQub25IaXQpIHsgY2hpbGQub25IaXQoZSkgfTtcblx0XHQvLyB9XG5cdCk7XG59XG5cblxuZXhwb3J0IHsgQ2FudmFzIH1cblxuLypcbiAqIFVzYWdlOiBjYW52YXMgPSBuZXcgQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICogY2FudmFzLnJlc2l6ZSgpO1xuICovXG5cbi8vIGNoaWxkcmVuXG4vLyAxOiBvdmVycmlkZSByZXBhaW50XG4vLyAyOiBhZGQgb2JqZWN0c1xuLy8gQ2FudmFzLnVzZXMoQ2FudmFzQ2hpbGQpO1xuLy8gQ2FudmFzSXRlbVxuLy8gd2lkdGgsIGhlaWdodCwgeCwgeVxuLy8gYWxsb3cgRHJhZ1xuLy8gYWxsb3cgQ2xpY2tcbi8vIG1vdXNlT3ZlclxuLy9cblxuIiwiY29uc3QgZm9udCA9IHtcblx0XCJ1bml0c1BlckVtXCI6IDE3OTIsXG5cdFwiYXNjZW5kZXJcIjogMTUzNixcblx0XCJkZXNjZW5kZXJcIjogLTI1Nixcblx0XCJmb250c1wiOiB7XG5cdFx0XCJwbHVzXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE0MDgsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxNDA4LDgwMCBDLDE0MDgsODUzLDEzNjUsODk2LDEzMTIsODk2IEwsODk2LDg5NiBMLDg5NiwxMzEyIEMsODk2LDEzNjUsODUzLDE0MDgsODAwLDE0MDggTCw2MDgsMTQwOCBDLDU1NSwxNDA4LDUxMiwxMzY1LDUxMiwxMzEyIEwsNTEyLDg5NiBMLDk2LDg5NiBDLDQzLDg5NiwwLDg1MywwLDgwMCBMLDAsNjA4IEMsMCw1NTUsNDMsNTEyLDk2LDUxMiBMLDUxMiw1MTIgTCw1MTIsOTYgQyw1MTIsNDMsNTU1LDAsNjA4LDAgTCw4MDAsMCBDLDg1MywwLDg5Niw0Myw4OTYsOTYgTCw4OTYsNTEyIEwsMTMxMiw1MTIgQywxMzY1LDUxMiwxNDA4LDU1NSwxNDA4LDYwOCBaXCJcblx0XHR9LFxuXHRcdFwibWludXNcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTQwOCxcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDE0MDgsODAwIEMsMTQwOCw4NTMsMTM2NSw4OTYsMTMxMiw4OTYgTCw5Niw4OTYgQyw0Myw4OTYsMCw4NTMsMCw4MDAgTCwwLDYwOCBDLDAsNTU1LDQzLDUxMiw5Niw1MTIgTCwxMzEyLDUxMiBDLDEzNjUsNTEyLDE0MDgsNTU1LDE0MDgsNjA4IFpcIlxuXHRcdH0sXG5cdFx0XCJva1wiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNzkyLFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTY3MSw5NzAgQywxNjcxLDk5NSwxNjYxLDEwMjAsMTY0MywxMDM4IEwsMTUwNywxMTc0IEMsMTQ4OSwxMTkyLDE0NjQsMTIwMiwxNDM5LDEyMDIgQywxNDE0LDEyMDIsMTM4OSwxMTkyLDEzNzEsMTE3NCBMLDcxNSw1MTcgTCw0MjEsODEyIEMsNDAzLDgzMCwzNzgsODQwLDM1Myw4NDAgQywzMjgsODQwLDMwMyw4MzAsMjg1LDgxMiBMLDE0OSw2NzYgQywxMzEsNjU4LDEyMSw2MzMsMTIxLDYwOCBDLDEyMSw1ODMsMTMxLDU1OCwxNDksNTQwIEwsNTExLDE3OCBMLDY0Nyw0MiBDLDY2NSwyNCw2OTAsMTQsNzE1LDE0IEMsNzQwLDE0LDc2NSwyNCw3ODMsNDIgTCw5MTksMTc4IEwsMTY0Myw5MDIgQywxNjYxLDkyMCwxNjcxLDk0NSwxNjcxLDk3MCBaXCJcblx0XHR9LFxuXHRcdFwicmVtb3ZlXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE0MDgsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxMjk4LDIxNCBDLDEyOTgsMjM5LDEyODgsMjY0LDEyNzAsMjgyIEwsOTc2LDU3NiBMLDEyNzAsODcwIEMsMTI4OCw4ODgsMTI5OCw5MTMsMTI5OCw5MzggQywxMjk4LDk2MywxMjg4LDk4OCwxMjcwLDEwMDYgTCwxMTM0LDExNDIgQywxMTE2LDExNjAsMTA5MSwxMTcwLDEwNjYsMTE3MCBDLDEwNDEsMTE3MCwxMDE2LDExNjAsOTk4LDExNDIgTCw3MDQsODQ4IEwsNDEwLDExNDIgQywzOTIsMTE2MCwzNjcsMTE3MCwzNDIsMTE3MCBDLDMxNywxMTcwLDI5MiwxMTYwLDI3NCwxMTQyIEwsMTM4LDEwMDYgQywxMjAsOTg4LDExMCw5NjMsMTEwLDkzOCBDLDExMCw5MTMsMTIwLDg4OCwxMzgsODcwIEwsNDMyLDU3NiBMLDEzOCwyODIgQywxMjAsMjY0LDExMCwyMzksMTEwLDIxNCBDLDExMCwxODksMTIwLDE2NCwxMzgsMTQ2IEwsMjc0LDEwIEMsMjkyLC04LDMxNywtMTgsMzQyLC0xOCBDLDM2NywtMTgsMzkyLC04LDQxMCwxMCBMLDcwNCwzMDQgTCw5OTgsMTAgQywxMDE2LC04LDEwNDEsLTE4LDEwNjYsLTE4IEMsMTA5MSwtMTgsMTExNiwtOCwxMTM0LDEwIEwsMTI3MCwxNDYgQywxMjg4LDE2NCwxMjk4LDE4OSwxMjk4LDIxNCBaXCJcblx0XHR9LFxuXHRcdFwiem9vbV9pblwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNjY0LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTAyNCw3MzYgQywxMDI0LDc1MywxMDA5LDc2OCw5OTIsNzY4IEwsNzY4LDc2OCBMLDc2OCw5OTIgQyw3NjgsMTAwOSw3NTMsMTAyNCw3MzYsMTAyNCBMLDY3MiwxMDI0IEMsNjU1LDEwMjQsNjQwLDEwMDksNjQwLDk5MiBMLDY0MCw3NjggTCw0MTYsNzY4IEMsMzk5LDc2OCwzODQsNzUzLDM4NCw3MzYgTCwzODQsNjcyIEMsMzg0LDY1NSwzOTksNjQwLDQxNiw2NDAgTCw2NDAsNjQwIEwsNjQwLDQxNiBDLDY0MCwzOTksNjU1LDM4NCw2NzIsMzg0IEwsNzM2LDM4NCBDLDc1MywzODQsNzY4LDM5OSw3NjgsNDE2IEwsNzY4LDY0MCBMLDk5Miw2NDAgQywxMDA5LDY0MCwxMDI0LDY1NSwxMDI0LDY3MiBNLDExNTIsNzA0IEMsMTE1Miw0NTcsOTUxLDI1Niw3MDQsMjU2IEMsNDU3LDI1NiwyNTYsNDU3LDI1Niw3MDQgQywyNTYsOTUxLDQ1NywxMTUyLDcwNCwxMTUyIEMsOTUxLDExNTIsMTE1Miw5NTEsMTE1Miw3MDQgTSwxNjY0LC0xMjggQywxNjY0LC05NCwxNjUwLC02MSwxNjI3LC0zOCBMLDEyODQsMzA1IEMsMTM2NSw0MjIsMTQwOCw1NjIsMTQwOCw3MDQgQywxNDA4LDEwOTMsMTA5MywxNDA4LDcwNCwxNDA4IEMsMzE1LDE0MDgsMCwxMDkzLDAsNzA0IEMsMCwzMTUsMzE1LDAsNzA0LDAgQyw4NDYsMCw5ODYsNDMsMTEwMywxMjQgTCwxNDQ2LC0yMTggQywxNDY5LC0yNDIsMTUwMiwtMjU2LDE1MzYsLTI1NiBDLDE2MDcsLTI1NiwxNjY0LC0xOTksMTY2NCwtMTI4IFpcIlxuXHRcdH0sXG5cdFx0XCJ6b29tX291dFwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNjY0LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTAyNCw3MzYgQywxMDI0LDc1MywxMDA5LDc2OCw5OTIsNzY4IEwsNDE2LDc2OCBDLDM5OSw3NjgsMzg0LDc1MywzODQsNzM2IEwsMzg0LDY3MiBDLDM4NCw2NTUsMzk5LDY0MCw0MTYsNjQwIEwsOTkyLDY0MCBDLDEwMDksNjQwLDEwMjQsNjU1LDEwMjQsNjcyIE0sMTE1Miw3MDQgQywxMTUyLDQ1Nyw5NTEsMjU2LDcwNCwyNTYgQyw0NTcsMjU2LDI1Niw0NTcsMjU2LDcwNCBDLDI1Niw5NTEsNDU3LDExNTIsNzA0LDExNTIgQyw5NTEsMTE1MiwxMTUyLDk1MSwxMTUyLDcwNCBNLDE2NjQsLTEyOCBDLDE2NjQsLTk0LDE2NTAsLTYxLDE2MjcsLTM4IEwsMTI4NCwzMDUgQywxMzY1LDQyMiwxNDA4LDU2MiwxNDA4LDcwNCBDLDE0MDgsMTA5MywxMDkzLDE0MDgsNzA0LDE0MDggQywzMTUsMTQwOCwwLDEwOTMsMCw3MDQgQywwLDMxNSwzMTUsMCw3MDQsMCBDLDg0NiwwLDk4Niw0MywxMTAzLDEyNCBMLDE0NDYsLTIxOCBDLDE0NjksLTI0MiwxNTAyLC0yNTYsMTUzNiwtMjU2IEMsMTYwNywtMjU2LDE2NjQsLTE5OSwxNjY0LC0xMjggWlwiXG5cdFx0fSxcblx0XHRcImNvZ1wiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNTM2LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTAyNCw2NDAgQywxMDI0LDQ5OSw5MDksMzg0LDc2OCwzODQgQyw2MjcsMzg0LDUxMiw0OTksNTEyLDY0MCBDLDUxMiw3ODEsNjI3LDg5Niw3NjgsODk2IEMsOTA5LDg5NiwxMDI0LDc4MSwxMDI0LDY0MCBNLDE1MzYsNzQ5IEMsMTUzNiw3NjYsMTUyNCw3ODIsMTUwNyw3ODUgTCwxMzI0LDgxMyBDLDEzMTQsODQ2LDEzMDAsODc5LDEyODMsOTExIEMsMTMxNyw5NTgsMTM1NCwxMDAyLDEzODgsMTA0OCBDLDEzOTMsMTA1NSwxMzk2LDEwNjIsMTM5NiwxMDcxIEMsMTM5NiwxMDc5LDEzOTQsMTA4NywxMzg5LDEwOTMgQywxMzQ3LDExNTIsMTI3NywxMjE0LDEyMjQsMTI2MyBDLDEyMTcsMTI2OSwxMjA4LDEyNzMsMTE5OSwxMjczIEMsMTE5MCwxMjczLDExODEsMTI3MCwxMTc1LDEyNjQgTCwxMDMzLDExNTcgQywxMDA0LDExNzIsOTc0LDExODQsOTQzLDExOTQgTCw5MTUsMTM3OCBDLDkxMywxMzk1LDg5NywxNDA4LDg3OSwxNDA4IEwsNjU3LDE0MDggQyw2MzksMTQwOCw2MjUsMTM5Niw2MjEsMTM4MCBDLDYwNSwxMzIwLDU5OSwxMjU1LDU5MiwxMTk0IEMsNTYxLDExODQsNTMwLDExNzEsNTAxLDExNTYgTCwzNjMsMTI2MyBDLDM1NSwxMjY5LDM0NiwxMjczLDMzNywxMjczIEMsMzAzLDEyNzMsMTY4LDExMjcsMTQ0LDEwOTQgQywxMzksMTA4NywxMzUsMTA4MCwxMzUsMTA3MSBDLDEzNSwxMDYyLDEzOSwxMDU0LDE0NSwxMDQ3IEMsMTgyLDEwMDIsMjE4LDk1NywyNTIsOTA5IEMsMjM2LDg3OSwyMjMsODQ5LDIxMyw4MTcgTCwyNyw3ODkgQywxMiw3ODYsMCw3NjgsMCw3NTMgTCwwLDUzMSBDLDAsNTE0LDEyLDQ5OCwyOSw0OTUgTCwyMTIsNDY4IEMsMjIyLDQzNCwyMzYsNDAxLDI1MywzNjkgQywyMTksMzIyLDE4MiwyNzgsMTQ4LDIzMiBDLDE0MywyMjUsMTQwLDIxOCwxNDAsMjA5IEMsMTQwLDIwMSwxNDIsMTkzLDE0NywxODYgQywxODksMTI4LDI1OSw2NiwzMTIsMTggQywzMTksMTEsMzI4LDcsMzM3LDcgQywzNDYsNywzNTUsMTAsMzYyLDE2IEwsNTAzLDEyMyBDLDUzMiwxMDgsNTYyLDk2LDU5Myw4NiBMLDYyMSwtOTggQyw2MjMsLTExNSw2MzksLTEyOCw2NTcsLTEyOCBMLDg3OSwtMTI4IEMsODk3LC0xMjgsOTExLC0xMTYsOTE1LC0xMDAgQyw5MzEsLTQwLDkzNywyNSw5NDQsODYgQyw5NzUsOTYsMTAwNiwxMDksMTAzNSwxMjQgTCwxMTczLDE2IEMsMTE4MSwxMSwxMTkwLDcsMTE5OSw3IEMsMTIzMyw3LDEzNjgsMTU0LDEzOTIsMTg2IEMsMTM5OCwxOTMsMTQwMSwyMDAsMTQwMSwyMDkgQywxNDAxLDIxOCwxMzk3LDIyNywxMzkxLDIzNCBDLDEzNTQsMjc5LDEzMTgsMzIzLDEyODQsMzcyIEMsMTMwMCw0MDEsMTMxMiw0MzEsMTMyMyw0NjMgTCwxNTA4LDQ5MSBDLDE1MjQsNDk0LDE1MzYsNTEyLDE1MzYsNTI3IFpcIlxuXHRcdH0sXG5cdFx0XCJ0cmFzaFwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNDA4LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sNTEyLDgwMCBDLDUxMiw4MTgsNDk4LDgzMiw0ODAsODMyIEwsNDE2LDgzMiBDLDM5OCw4MzIsMzg0LDgxOCwzODQsODAwIEwsMzg0LDIyNCBDLDM4NCwyMDYsMzk4LDE5Miw0MTYsMTkyIEwsNDgwLDE5MiBDLDQ5OCwxOTIsNTEyLDIwNiw1MTIsMjI0IE0sNzY4LDgwMCBDLDc2OCw4MTgsNzU0LDgzMiw3MzYsODMyIEwsNjcyLDgzMiBDLDY1NCw4MzIsNjQwLDgxOCw2NDAsODAwIEwsNjQwLDIyNCBDLDY0MCwyMDYsNjU0LDE5Miw2NzIsMTkyIEwsNzM2LDE5MiBDLDc1NCwxOTIsNzY4LDIwNiw3NjgsMjI0IE0sMTAyNCw4MDAgQywxMDI0LDgxOCwxMDEwLDgzMiw5OTIsODMyIEwsOTI4LDgzMiBDLDkxMCw4MzIsODk2LDgxOCw4OTYsODAwIEwsODk2LDIyNCBDLDg5NiwyMDYsOTEwLDE5Miw5MjgsMTkyIEwsOTkyLDE5MiBDLDEwMTAsMTkyLDEwMjQsMjA2LDEwMjQsMjI0IE0sMTE1Miw3NiBDLDExNTIsMjgsMTEyNSwwLDExMjAsMCBMLDI4OCwwIEMsMjgzLDAsMjU2LDI4LDI1Niw3NiBMLDI1NiwxMDI0IEwsMTE1MiwxMDI0IEwsMTE1Miw3NiBNLDQ4MCwxMTUyIEwsNTI5LDEyNjkgQyw1MzIsMTI3Myw1NDAsMTI3OSw1NDYsMTI4MCBMLDg2MywxMjgwIEMsODY4LDEyNzksODc3LDEyNzMsODgwLDEyNjkgTCw5MjgsMTE1MiBNLDE0MDgsMTEyMCBDLDE0MDgsMTEzOCwxMzk0LDExNTIsMTM3NiwxMTUyIEwsMTA2NywxMTUyIEwsOTk3LDEzMTkgQyw5NzcsMTM2OCw5MTcsMTQwOCw4NjQsMTQwOCBMLDU0NCwxNDA4IEMsNDkxLDE0MDgsNDMxLDEzNjgsNDExLDEzMTkgTCwzNDEsMTE1MiBMLDMyLDExNTIgQywxNCwxMTUyLDAsMTEzOCwwLDExMjAgTCwwLDEwNTYgQywwLDEwMzgsMTQsMTAyNCwzMiwxMDI0IEwsMTI4LDEwMjQgTCwxMjgsNzIgQywxMjgsLTM4LDIwMCwtMTI4LDI4OCwtMTI4IEwsMTEyMCwtMTI4IEMsMTIwOCwtMTI4LDEyODAsLTM0LDEyODAsNzYgTCwxMjgwLDEwMjQgTCwxMzc2LDEwMjQgQywxMzk0LDEwMjQsMTQwOCwxMDM4LDE0MDgsMTA1NiBaXCJcblx0XHR9LFxuXHRcdFwiZmlsZV9hbHRcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTUzNixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDE0NjgsMTE1NiBMLDExNTYsMTQ2OCBDLDExMTksMTUwNSwxMDQ1LDE1MzYsOTkyLDE1MzYgTCw5NiwxNTM2IEMsNDMsMTUzNiwwLDE0OTMsMCwxNDQwIEwsMCwtMTYwIEMsMCwtMjEzLDQzLC0yNTYsOTYsLTI1NiBMLDE0NDAsLTI1NiBDLDE0OTMsLTI1NiwxNTM2LC0yMTMsMTUzNiwtMTYwIEwsMTUzNiw5OTIgQywxNTM2LDEwNDUsMTUwNSwxMTE5LDE0NjgsMTE1NiBNLDEwMjQsMTQwMCBDLDEwNDEsMTM5NCwxMDU4LDEzODUsMTA2NSwxMzc4IEwsMTM3OCwxMDY1IEMsMTM4NSwxMDU4LDEzOTQsMTA0MSwxNDAwLDEwMjQgTCwxMDI0LDEwMjQgTSwxNDA4LC0xMjggTCwxMjgsLTEyOCBMLDEyOCwxNDA4IEwsODk2LDE0MDggTCw4OTYsOTkyIEMsODk2LDkzOSw5MzksODk2LDk5Miw4OTYgTCwxNDA4LDg5NiBaXCJcblx0XHR9LFxuXHRcdFwiZG93bmxvYWRfYWx0XCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE2NjQsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxMjgwLDE5MiBDLDEyODAsMTU3LDEyNTEsMTI4LDEyMTYsMTI4IEMsMTE4MSwxMjgsMTE1MiwxNTcsMTE1MiwxOTIgQywxMTUyLDIyNywxMTgxLDI1NiwxMjE2LDI1NiBDLDEyNTEsMjU2LDEyODAsMjI3LDEyODAsMTkyIE0sMTUzNiwxOTIgQywxNTM2LDE1NywxNTA3LDEyOCwxNDcyLDEyOCBDLDE0MzcsMTI4LDE0MDgsMTU3LDE0MDgsMTkyIEMsMTQwOCwyMjcsMTQzNywyNTYsMTQ3MiwyNTYgQywxNTA3LDI1NiwxNTM2LDIyNywxNTM2LDE5MiBNLDE2NjQsNDE2IEMsMTY2NCw0NjksMTYyMSw1MTIsMTU2OCw1MTIgTCwxMTA0LDUxMiBMLDk2OCwzNzYgQyw5MzEsMzQwLDg4MywzMjAsODMyLDMyMCBDLDc4MSwzMjAsNzMzLDM0MCw2OTYsMzc2IEwsNTYxLDUxMiBMLDk2LDUxMiBDLDQzLDUxMiwwLDQ2OSwwLDQxNiBMLDAsOTYgQywwLDQzLDQzLDAsOTYsMCBMLDE1NjgsMCBDLDE2MjEsMCwxNjY0LDQzLDE2NjQsOTYgTSwxMzM5LDk4NSBDLDEzMjksMTAwOCwxMzA2LDEwMjQsMTI4MCwxMDI0IEwsMTAyNCwxMDI0IEwsMTAyNCwxNDcyIEMsMTAyNCwxNTA3LDk5NSwxNTM2LDk2MCwxNTM2IEwsNzA0LDE1MzYgQyw2NjksMTUzNiw2NDAsMTUwNyw2NDAsMTQ3MiBMLDY0MCwxMDI0IEwsMzg0LDEwMjQgQywzNTgsMTAyNCwzMzUsMTAwOCwzMjUsOTg1IEMsMzE1LDk2MSwzMjAsOTMzLDMzOSw5MTUgTCw3ODcsNDY3IEMsNzk5LDQ1NCw4MTYsNDQ4LDgzMiw0NDggQyw4NDgsNDQ4LDg2NSw0NTQsODc3LDQ2NyBMLDEzMjUsOTE1IEMsMTM0NCw5MzMsMTM0OSw5NjEsMTMzOSw5ODUgWlwiXG5cdFx0fSxcblx0XHRcInJlcGVhdFwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNTM2LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTUzNiwxMjgwIEMsMTUzNiwxMzA2LDE1MjAsMTMyOSwxNDk3LDEzMzkgQywxNDczLDEzNDksMTQ0NSwxMzQ0LDE0MjcsMTMyNSBMLDEyOTcsMTE5NiBDLDExNTYsMTMyOSw5NjUsMTQwOCw3NjgsMTQwOCBDLDM0NSwxNDA4LDAsMTA2MywwLDY0MCBDLDAsMjE3LDM0NSwtMTI4LDc2OCwtMTI4IEMsOTk3LC0xMjgsMTIxMywtMjcsMTM1OSwxNDkgQywxMzY5LDE2MiwxMzY5LDE4MSwxMzU3LDE5MiBMLDEyMjAsMzMwIEMsMTIxMywzMzYsMTIwNCwzMzksMTE5NSwzMzkgQywxMTg2LDMzOCwxMTc3LDMzNCwxMTcyLDMyNyBDLDEwNzQsMjAwLDkyNywxMjgsNzY4LDEyOCBDLDQ4NiwxMjgsMjU2LDM1OCwyNTYsNjQwIEMsMjU2LDkyMiw0ODYsMTE1Miw3NjgsMTE1MiBDLDg5OSwxMTUyLDEwMjMsMTEwMiwxMTE3LDEwMTUgTCw5NzksODc3IEMsOTYwLDg1OSw5NTUsODMxLDk2NSw4MDggQyw5NzUsNzg0LDk5OCw3NjgsMTAyNCw3NjggTCwxNDcyLDc2OCBDLDE1MDcsNzY4LDE1MzYsNzk3LDE1MzYsODMyIFpcIlxuXHRcdH0sXG5cdFx0XCJwZW5jaWxcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTUzNixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDM2MywwIEwsMjU2LDAgTCwyNTYsMTI4IEwsMTI4LDEyOCBMLDEyOCwyMzUgTCwyMTksMzI2IEwsNDU0LDkxIE0sODg2LDkyOCBDLDg4Niw5MjIsODg0LDkxNiw4NzksOTExIEwsMzM3LDM2OSBDLDMzMiwzNjQsMzI2LDM2MiwzMjAsMzYyIEMsMzA3LDM2MiwyOTgsMzcxLDI5OCwzODQgQywyOTgsMzkwLDMwMCwzOTYsMzA1LDQwMSBMLDg0Nyw5NDMgQyw4NTIsOTQ4LDg1OCw5NTAsODY0LDk1MCBDLDg3Nyw5NTAsODg2LDk0MSw4ODYsOTI4IE0sODMyLDExMjAgTCwwLDI4OCBMLDAsLTEyOCBMLDQxNiwtMTI4IEwsMTI0OCw3MDQgTSwxNTE1LDEwMjQgQywxNTE1LDEwNTgsMTUwMSwxMDkxLDE0NzgsMTExNSBMLDEyNDMsMTM0OSBDLDEyMTksMTM3MywxMTg2LDEzODcsMTE1MiwxMzg3IEMsMTExOCwxMzg3LDEwODUsMTM3MywxMDYyLDEzNDkgTCw4OTYsMTE4NCBMLDEzMTIsNzY4IEwsMTQ3OCw5MzQgQywxNTAxLDk1NywxNTE1LDk5MCwxNTE1LDEwMjQgWlwiXG5cdFx0fSxcblx0XHRcImVkaXRcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTc5Mixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDg4OCwzNTIgTCw4MzIsMzUyIEwsODMyLDQ0OCBMLDczNiw0NDggTCw3MzYsNTA0IEwsODUyLDYyMCBMLDEwMDQsNDY4IE0sMTMyOCwxMDcyIEMsMTMzNywxMDYzLDEzMzYsMTA0OCwxMzI3LDEwMzkgTCw5NzcsNjg5IEMsOTY4LDY4MCw5NTMsNjc5LDk0NCw2ODggQyw5MzUsNjk3LDkzNiw3MTIsOTQ1LDcyMSBMLDEyOTUsMTA3MSBDLDEzMDQsMTA4MCwxMzE5LDEwODEsMTMyOCwxMDcyIE0sMTQwOCw0NzggQywxNDA4LDQ5MSwxNDAwLDUwMiwxMzg4LDUwNyBDLDEzNzYsNTEyLDEzNjMsNTEwLDEzNTMsNTAwIEwsMTI4OSw0MzYgQywxMjgzLDQzMCwxMjgwLDQyMiwxMjgwLDQxNCBMLDEyODAsMjg4IEMsMTI4MCwyMDAsMTIwOCwxMjgsMTEyMCwxMjggTCwyODgsMTI4IEMsMjAwLDEyOCwxMjgsMjAwLDEyOCwyODggTCwxMjgsMTEyMCBDLDEyOCwxMjA4LDIwMCwxMjgwLDI4OCwxMjgwIEwsMTEyMCwxMjgwIEMsMTEzNSwxMjgwLDExNTAsMTI3OCwxMTY1LDEyNzQgQywxMTc2LDEyNzAsMTE4OCwxMjczLDExOTcsMTI4MiBMLDEyNDYsMTMzMSBDLDEyNTQsMTMzOSwxMjU3LDEzNDksMTI1NSwxMzYwIEMsMTI1MywxMzcwLDEyNDYsMTM3OSwxMjM3LDEzODMgQywxMjAwLDE0MDAsMTE2MCwxNDA4LDExMjAsMTQwOCBMLDI4OCwxNDA4IEMsMTI5LDE0MDgsMCwxMjc5LDAsMTEyMCBMLDAsMjg4IEMsMCwxMjksMTI5LDAsMjg4LDAgTCwxMTIwLDAgQywxMjc5LDAsMTQwOCwxMjksMTQwOCwyODggTSwxMzEyLDEyMTYgTCw2NDAsNTQ0IEwsNjQwLDI1NiBMLDkyOCwyNTYgTCwxNjAwLDkyOCBNLDE3NTYsMTA4NCBDLDE3OTMsMTEyMSwxNzkzLDExODMsMTc1NiwxMjIwIEwsMTYwNCwxMzcyIEMsMTU2NywxNDA5LDE1MDUsMTQwOSwxNDY4LDEzNzIgTCwxMzc2LDEyODAgTCwxNjY0LDk5MiBMLDE3NTYsMTA4NCBaXCJcblx0XHR9LFxuXHRcdFwicGxheVwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNDA4LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTM4NCw2MDkgQywxNDE1LDYyNiwxNDE1LDY1NCwxMzg0LDY3MSBMLDU2LDE0MDkgQywyNSwxNDI2LDAsMTQxMSwwLDEzNzYgTCwwLC05NiBDLDAsLTEzMSwyNSwtMTQ2LDU2LC0xMjkgWlwiXG5cdFx0fSxcblx0XHRcInBhdXNlXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE1MzYsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxNTM2LDEzNDQgQywxNTM2LDEzNzksMTUwNywxNDA4LDE0NzIsMTQwOCBMLDk2MCwxNDA4IEMsOTI1LDE0MDgsODk2LDEzNzksODk2LDEzNDQgTCw4OTYsLTY0IEMsODk2LC05OSw5MjUsLTEyOCw5NjAsLTEyOCBMLDE0NzIsLTEyOCBDLDE1MDcsLTEyOCwxNTM2LC05OSwxNTM2LC02NCBNLDY0MCwxMzQ0IEMsNjQwLDEzNzksNjExLDE0MDgsNTc2LDE0MDggTCw2NCwxNDA4IEMsMjksMTQwOCwwLDEzNzksMCwxMzQ0IEwsMCwtNjQgQywwLC05OSwyOSwtMTI4LDY0LC0xMjggTCw1NzYsLTEyOCBDLDYxMSwtMTI4LDY0MCwtOTksNjQwLC02NCBaXCJcblx0XHR9LFxuXHRcdFwic3RvcFwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNTM2LFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTUzNiwxMzQ0IEMsMTUzNiwxMzc5LDE1MDcsMTQwOCwxNDcyLDE0MDggTCw2NCwxNDA4IEMsMjksMTQwOCwwLDEzNzksMCwxMzQ0IEwsMCwtNjQgQywwLC05OSwyOSwtMTI4LDY0LC0xMjggTCwxNDcyLC0xMjggQywxNTA3LC0xMjgsMTUzNiwtOTksMTUzNiwtNjQgWlwiXG5cdFx0fSxcblx0XHRcInJlc2l6ZV9mdWxsXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE1MzYsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSw3NTUsNDgwIEMsNzU1LDQ4OCw3NTEsNDk3LDc0NSw1MDMgTCw2MzEsNjE3IEMsNjI1LDYyMyw2MTYsNjI3LDYwOCw2MjcgQyw2MDAsNjI3LDU5MSw2MjMsNTg1LDYxNyBMLDI1MywyODUgTCwxMDksNDI5IEMsOTcsNDQxLDgxLDQ0OCw2NCw0NDggQywyOSw0NDgsMCw0MTksMCwzODQgTCwwLC02NCBDLDAsLTk5LDI5LC0xMjgsNjQsLTEyOCBMLDUxMiwtMTI4IEMsNTQ3LC0xMjgsNTc2LC05OSw1NzYsLTY0IEMsNTc2LC00Nyw1NjksLTMxLDU1NywtMTkgTCw0MTMsMTI1IEwsNzQ1LDQ1NyBDLDc1MSw0NjMsNzU1LDQ3Miw3NTUsNDgwIE0sMTUzNiwxMzQ0IEMsMTUzNiwxMzc5LDE1MDcsMTQwOCwxNDcyLDE0MDggTCwxMDI0LDE0MDggQyw5ODksMTQwOCw5NjAsMTM3OSw5NjAsMTM0NCBDLDk2MCwxMzI3LDk2NywxMzExLDk3OSwxMjk5IEwsMTEyMywxMTU1IEwsNzkxLDgyMyBDLDc4NSw4MTcsNzgxLDgwOCw3ODEsODAwIEMsNzgxLDc5Miw3ODUsNzgzLDc5MSw3NzcgTCw5MDUsNjYzIEMsOTExLDY1Nyw5MjAsNjUzLDkyOCw2NTMgQyw5MzYsNjUzLDk0NSw2NTcsOTUxLDY2MyBMLDEyODMsOTk1IEwsMTQyNyw4NTEgQywxNDM5LDgzOSwxNDU1LDgzMiwxNDcyLDgzMiBDLDE1MDcsODMyLDE1MzYsODYxLDE1MzYsODk2IFpcIlxuXHRcdH0sXG5cdFx0XCJyZXNpemVfc21hbGxcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTUzNixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDc2OCw1NzYgQyw3NjgsNjExLDczOSw2NDAsNzA0LDY0MCBMLDI1Niw2NDAgQywyMjEsNjQwLDE5Miw2MTEsMTkyLDU3NiBDLDE5Miw1NTksMTk5LDU0MywyMTEsNTMxIEwsMzU1LDM4NyBMLDIzLDU1IEMsMTcsNDksMTMsNDAsMTMsMzIgQywxMywyNCwxNywxNSwyMyw5IEwsMTM3LC0xMDUgQywxNDMsLTExMSwxNTIsLTExNSwxNjAsLTExNSBDLDE2OCwtMTE1LDE3NywtMTExLDE4MywtMTA1IEwsNTE1LDIyNyBMLDY1OSw4MyBDLDY3MSw3MSw2ODcsNjQsNzA0LDY0IEMsNzM5LDY0LDc2OCw5Myw3NjgsMTI4IE0sMTUyMywxMjQ4IEMsMTUyMywxMjU2LDE1MTksMTI2NSwxNTEzLDEyNzEgTCwxMzk5LDEzODUgQywxMzkzLDEzOTEsMTM4NCwxMzk1LDEzNzYsMTM5NSBDLDEzNjgsMTM5NSwxMzU5LDEzOTEsMTM1MywxMzg1IEwsMTAyMSwxMDUzIEwsODc3LDExOTcgQyw4NjUsMTIwOSw4NDksMTIxNiw4MzIsMTIxNiBDLDc5NywxMjE2LDc2OCwxMTg3LDc2OCwxMTUyIEwsNzY4LDcwNCBDLDc2OCw2NjksNzk3LDY0MCw4MzIsNjQwIEwsMTI4MCw2NDAgQywxMzE1LDY0MCwxMzQ0LDY2OSwxMzQ0LDcwNCBDLDEzNDQsNzIxLDEzMzcsNzM3LDEzMjUsNzQ5IEwsMTE4MSw4OTMgTCwxNTEzLDEyMjUgQywxNTE5LDEyMzEsMTUyMywxMjQwLDE1MjMsMTI0OCBaXCJcblx0XHR9LFxuXHRcdFwiZXllX29wZW5cIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTc5Mixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDE2NjQsNTc2IEMsMTQ5MywzMTIsMTIxNywxMjgsODk2LDEyOCBDLDU3NSwxMjgsMjk5LDMxMiwxMjgsNTc2IEMsMjIzLDcyMywzNTMsODQ5LDUwOSw5MjkgQyw0NjksODYxLDQ0OCw3ODMsNDQ4LDcwNCBDLDQ0OCw0NTcsNjQ5LDI1Niw4OTYsMjU2IEMsMTE0MywyNTYsMTM0NCw0NTcsMTM0NCw3MDQgQywxMzQ0LDc4MywxMzIzLDg2MSwxMjgzLDkyOSBDLDE0MzksODQ5LDE1NjksNzIzLDE2NjQsNTc2IE0sOTQ0LDk2MCBDLDk0NCw5MzQsOTIyLDkxMiw4OTYsOTEyIEMsNzgyLDkxMiw2ODgsODE4LDY4OCw3MDQgQyw2ODgsNjc4LDY2Niw2NTYsNjQwLDY1NiBDLDYxNCw2NTYsNTkyLDY3OCw1OTIsNzA0IEMsNTkyLDg3MSw3MjksMTAwOCw4OTYsMTAwOCBDLDkyMiwxMDA4LDk0NCw5ODYsOTQ0LDk2MCBNLDE3OTIsNTc2IEMsMTc5Miw2MDEsMTc4NCw2MjQsMTc3Miw2NDUgQywxNTg4LDk0NywxMjUxLDExNTIsODk2LDExNTIgQyw1NDEsMTE1MiwyMDQsOTQ3LDIwLDY0NSBDLDgsNjI0LDAsNjAxLDAsNTc2IEMsMCw1NTEsOCw1MjgsMjAsNTA3IEMsMjA0LDIwNSw1NDEsMCw4OTYsMCBDLDEyNTEsMCwxNTg4LDIwNCwxNzcyLDUwNyBDLDE3ODQsNTI4LDE3OTIsNTUxLDE3OTIsNTc2IFpcIlxuXHRcdH0sXG5cdFx0XCJleWVfY2xvc2VcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTc5Mixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDU1NSwyMDEgQywzNzksMjgwLDIzMiw0MTUsMTI4LDU3NiBDLDIyMyw3MjMsMzUzLDg0OSw1MDksOTI5IEMsNDY5LDg2MSw0NDgsNzgzLDQ0OCw3MDQgQyw0NDgsNTYxLDUxNyw0MjYsNjMzLDM0MiBNLDk0NCw5NjAgQyw5NDQsOTM0LDkyMiw5MTIsODk2LDkxMiBDLDc4Miw5MTIsNjg4LDgxOSw2ODgsNzA0IEMsNjg4LDY3OCw2NjYsNjU2LDY0MCw2NTYgQyw2MTQsNjU2LDU5Miw2NzgsNTkyLDcwNCBDLDU5Miw4NzEsNzI5LDEwMDgsODk2LDEwMDggQyw5MjIsMTAwOCw5NDQsOTg2LDk0NCw5NjAgTSwxMzA3LDExNTEgQywxMzA3LDExNjIsMTMwMSwxMTcyLDEyOTEsMTE3OCBDLDEyNzAsMTE5MCwxMTc2LDEyNDgsMTE1OCwxMjQ4IEMsMTE0NiwxMjQ4LDExMzYsMTI0MiwxMTMwLDEyMzIgTCwxMDc2LDExMzUgQywxMDE3LDExNDYsOTU2LDExNTIsODk2LDExNTIgQyw1MjcsMTE1MiwyMTgsOTQ5LDIwLDY0NSBDLDcsNjI1LDAsNjAwLDAsNTc2IEMsMCw1NTEsNyw1MjcsMjAsNTA3IEMsMTM1LDMyNywyOTgsMTc3LDQ5Miw4OSBDLDQ4Miw3Miw0NDgsMTgsNDQ4LDIgQyw0NDgsLTEwLDQ1NCwtMjAsNDY0LC0yNiBDLDQ4NSwtMzgsNTgwLC05Niw1OTgsLTk2IEMsNjA5LC05Niw2MjAsLTkwLDYyNiwtODAgTCw2NzUsOSBDLDg4NiwzODYsMTA5NSw3NjUsMTMwNiwxMTQyIEMsMTMwNywxMTQ0LDEzMDcsMTE0OSwxMzA3LDExNTEgTSwxMzQ0LDcwNCBDLDEzNDQsNzMyLDEzNDEsNzYwLDEzMzYsNzg4IEwsMTA1NiwyODYgQywxMjI5LDM1MiwxMzQ0LDUxOCwxMzQ0LDcwNCBNLDE3OTIsNTc2IEMsMTc5Miw2MDIsMTc4NSw2MjMsMTc3Miw2NDUgQywxNjk0LDc3NCwxNTY5LDg5OSwxNDQ1LDk4MiBMLDEzODIsODcwIEMsMTQ5NSw3OTIsMTU5MCw2OTEsMTY2NCw1NzYgQywxNTA4LDMzNCwxMjYxLDE1Nyw5NzAsMTMyIEwsODk2LDAgQywxMTk3LDAsMTQ2NywxMzcsMTY2MywzNjIgQywxNzAyLDQwNywxNzQxLDQ1NiwxNzcyLDUwNyBDLDE3ODUsNTI5LDE3OTIsNTUwLDE3OTIsNTc2IFpcIlxuXHRcdH0sXG5cdFx0XCJmb2xkZXJfb3BlblwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxOTIwLFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sMTg3OSw1ODQgQywxODc5LDYyOSwxODI4LDY0MCwxNzkyLDY0MCBMLDcwNCw2NDAgQyw2MTYsNjQwLDQ5OCw1ODYsNDQwLDUxOCBMLDEwNCwxMjIgQyw4OCwxMDQsNzMsODAsNzMsNTYgQyw3MywxMSwxMjQsMCwxNjAsMCBMLDEyNDgsMCBDLDEzMzYsMCwxNDU0LDU0LDE1MTIsMTIyIEwsMTg0OCw1MTggQywxODY0LDUzNiwxODc5LDU2MCwxODc5LDU4NCBNLDE1MzYsOTI4IEMsMTUzNiwxMDUxLDE0MzUsMTE1MiwxMzEyLDExNTIgTCw3NjgsMTE1MiBMLDc2OCwxMTg0IEMsNzY4LDEzMDcsNjY3LDE0MDgsNTQ0LDE0MDggTCwyMjQsMTQwOCBDLDEwMSwxNDA4LDAsMTMwNywwLDExODQgTCwwLDIyNCBDLDAsMjE2LDEsMjA3LDEsMTk5IEwsNiwyMDUgTCwzNDMsNjAxIEMsNDI0LDY5Nyw1NzksNzY4LDcwNCw3NjggTCwxNTM2LDc2OCBaXCJcblx0XHR9LFxuXHRcdFwic2lnbmluXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE1MzYsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxMTg0LDY0MCBDLDExODQsNjU3LDExNzcsNjczLDExNjUsNjg1IEwsNjIxLDEyMjkgQyw2MDksMTI0MSw1OTMsMTI0OCw1NzYsMTI0OCBDLDU0MSwxMjQ4LDUxMiwxMjE5LDUxMiwxMTg0IEwsNTEyLDg5NiBMLDY0LDg5NiBDLDI5LDg5NiwwLDg2NywwLDgzMiBMLDAsNDQ4IEMsMCw0MTMsMjksMzg0LDY0LDM4NCBMLDUxMiwzODQgTCw1MTIsOTYgQyw1MTIsNjEsNTQxLDMyLDU3NiwzMiBDLDU5MywzMiw2MDksMzksNjIxLDUxIEwsMTE2NSw1OTUgQywxMTc3LDYwNywxMTg0LDYyMywxMTg0LDY0MCBNLDE1MzYsOTkyIEMsMTUzNiwxMTUxLDE0MDcsMTI4MCwxMjQ4LDEyODAgTCw5MjgsMTI4MCBDLDg4MywxMjgwLDg5NiwxMjEyLDg5NiwxMTg0IEMsODk2LDExNDcsOTM1LDExNTIsOTYwLDExNTIgTCwxMjQ4LDExNTIgQywxMzM2LDExNTIsMTQwOCwxMDgwLDE0MDgsOTkyIEwsMTQwOCwyODggQywxNDA4LDIwMCwxMzM2LDEyOCwxMjQ4LDEyOCBMLDkyOCwxMjggQyw4ODMsMTI4LDg5Niw2MCw4OTYsMzIgQyw4OTYsMTUsOTExLDAsOTI4LDAgTCwxMjQ4LDAgQywxNDA3LDAsMTUzNiwxMjksMTUzNiwyODggWlwiXG5cdFx0fSxcblx0XHRcInVwbG9hZF9hbHRcIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTY2NCxcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDEyODAsNjQgQywxMjgwLDI5LDEyNTEsMCwxMjE2LDAgQywxMTgxLDAsMTE1MiwyOSwxMTUyLDY0IEMsMTE1Miw5OSwxMTgxLDEyOCwxMjE2LDEyOCBDLDEyNTEsMTI4LDEyODAsOTksMTI4MCw2NCBNLDE1MzYsNjQgQywxNTM2LDI5LDE1MDcsMCwxNDcyLDAgQywxNDM3LDAsMTQwOCwyOSwxNDA4LDY0IEMsMTQwOCw5OSwxNDM3LDEyOCwxNDcyLDEyOCBDLDE1MDcsMTI4LDE1MzYsOTksMTUzNiw2NCBNLDE2NjQsMjg4IEMsMTY2NCwzNDEsMTYyMSwzODQsMTU2OCwzODQgTCwxMTQxLDM4NCBDLDExMTQsMzEwLDEwNDMsMjU2LDk2MCwyNTYgTCw3MDQsMjU2IEMsNjIxLDI1Niw1NTAsMzEwLDUyMywzODQgTCw5NiwzODQgQyw0MywzODQsMCwzNDEsMCwyODggTCwwLC0zMiBDLDAsLTg1LDQzLC0xMjgsOTYsLTEyOCBMLDE1NjgsLTEyOCBDLDE2MjEsLTEyOCwxNjY0LC04NSwxNjY0LC0zMiBNLDEzMzksOTM2IEMsMTM0OSw5NTksMTM0NCw5ODcsMTMyNSwxMDA1IEwsODc3LDE0NTMgQyw4NjUsMTQ2Niw4NDgsMTQ3Miw4MzIsMTQ3MiBDLDgxNiwxNDcyLDc5OSwxNDY2LDc4NywxNDUzIEwsMzM5LDEwMDUgQywzMjAsOTg3LDMxNSw5NTksMzI1LDkzNiBDLDMzNSw5MTIsMzU4LDg5NiwzODQsODk2IEwsNjQwLDg5NiBMLDY0MCw0NDggQyw2NDAsNDEzLDY2OSwzODQsNzA0LDM4NCBMLDk2MCwzODQgQyw5OTUsMzg0LDEwMjQsNDEzLDEwMjQsNDQ4IEwsMTAyNCw4OTYgTCwxMjgwLDg5NiBDLDEzMDYsODk2LDEzMjksOTEyLDEzMzksOTM2IFpcIlxuXHRcdH0sXG5cdFx0XCJzYXZlXCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE1MzYsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwzODQsMCBMLDM4NCwzODQgTCwxMTUyLDM4NCBMLDExNTIsMCBNLDEyODAsMCBMLDEyODAsNDE2IEMsMTI4MCw0NjksMTIzNyw1MTIsMTE4NCw1MTIgTCwzNTIsNTEyIEMsMjk5LDUxMiwyNTYsNDY5LDI1Niw0MTYgTCwyNTYsMCBMLDEyOCwwIEwsMTI4LDEyODAgTCwyNTYsMTI4MCBMLDI1Niw4NjQgQywyNTYsODExLDI5OSw3NjgsMzUyLDc2OCBMLDkyOCw3NjggQyw5ODEsNzY4LDEwMjQsODExLDEwMjQsODY0IEwsMTAyNCwxMjgwIEMsMTA0NCwxMjgwLDEwODMsMTI2NCwxMDk3LDEyNTAgTCwxMzc4LDk2OSBDLDEzOTEsOTU2LDE0MDgsOTE1LDE0MDgsODk2IEwsMTQwOCwwIE0sODk2LDkyOCBDLDg5Niw5MTEsODgxLDg5Niw4NjQsODk2IEwsNjcyLDg5NiBDLDY1NSw4OTYsNjQwLDkxMSw2NDAsOTI4IEwsNjQwLDEyNDggQyw2NDAsMTI2NSw2NTUsMTI4MCw2NzIsMTI4MCBMLDg2NCwxMjgwIEMsODgxLDEyODAsODk2LDEyNjUsODk2LDEyNDggTCw4OTYsOTI4IE0sMTUzNiw4OTYgQywxNTM2LDk0OSwxNTA2LDEwMjIsMTQ2OCwxMDYwIEwsMTE4OCwxMzQwIEMsMTE1MCwxMzc4LDEwNzcsMTQwOCwxMDI0LDE0MDggTCw5NiwxNDA4IEMsNDMsMTQwOCwwLDEzNjUsMCwxMzEyIEwsMCwtMzIgQywwLC04NSw0MywtMTI4LDk2LC0xMjggTCwxNDQwLC0xMjggQywxNDkzLC0xMjgsMTUzNiwtODUsMTUzNiwtMzIgWlwiXG5cdFx0fSxcblx0XHRcInVuZG9cIjoge1xuXHRcdFx0XCJhZHZhbmNlV2lkdGhcIjogMTUzNixcblx0XHRcdFwiY29tbWFuZHNcIjogXCJNLDE1MzYsNjQwIEMsMTUzNiwxMDYzLDExOTEsMTQwOCw3NjgsMTQwOCBDLDU3MSwxNDA4LDM4MCwxMzI5LDIzOSwxMTk2IEwsMTA5LDEzMjUgQyw5MSwxMzQ0LDYzLDEzNDksNDAsMTMzOSBDLDE2LDEzMjksMCwxMzA2LDAsMTI4MCBMLDAsODMyIEMsMCw3OTcsMjksNzY4LDY0LDc2OCBMLDUxMiw3NjggQyw1MzgsNzY4LDU2MSw3ODQsNTcxLDgwOCBDLDU4MSw4MzEsNTc2LDg1OSw1NTcsODc3IEwsNDIwLDEwMTUgQyw1MTMsMTEwMiw2MzcsMTE1Miw3NjgsMTE1MiBDLDEwNTAsMTE1MiwxMjgwLDkyMiwxMjgwLDY0MCBDLDEyODAsMzU4LDEwNTAsMTI4LDc2OCwxMjggQyw2MDksMTI4LDQ2MiwyMDAsMzY0LDMyNyBDLDM1OSwzMzQsMzUwLDMzOCwzNDEsMzM5IEMsMzMyLDMzOSwzMjMsMzM2LDMxNiwzMzAgTCwxNzksMTkyIEMsMTY4LDE4MSwxNjcsMTYyLDE3NywxNDkgQywzMjMsLTI3LDUzOSwtMTI4LDc2OCwtMTI4IEMsMTE5MSwtMTI4LDE1MzYsMjE3LDE1MzYsNjQwIFpcIlxuXHRcdH0sXG5cdFx0XCJwYXN0ZVwiOiB7XG5cdFx0XHRcImFkdmFuY2VXaWR0aFwiOiAxNzkyLFxuXHRcdFx0XCJjb21tYW5kc1wiOiBcIk0sNzY4LC0xMjggTCw3NjgsMTAyNCBMLDExNTIsMTAyNCBMLDExNTIsNjA4IEMsMTE1Miw1NTUsMTE5NSw1MTIsMTI0OCw1MTIgTCwxNjY0LDUxMiBMLDE2NjQsLTEyOCBNLDEwMjQsMTMxMiBDLDEwMjQsMTI5NSwxMDA5LDEyODAsOTkyLDEyODAgTCwyODgsMTI4MCBDLDI3MSwxMjgwLDI1NiwxMjk1LDI1NiwxMzEyIEwsMjU2LDEzNzYgQywyNTYsMTM5MywyNzEsMTQwOCwyODgsMTQwOCBMLDk5MiwxNDA4IEMsMTAwOSwxNDA4LDEwMjQsMTM5MywxMDI0LDEzNzYgTCwxMDI0LDEzMTIgTSwxMjgwLDY0MCBMLDEyODAsOTM5IEwsMTU3OSw2NDAgTSwxNzkyLDUxMiBDLDE3OTIsNTY1LDE3NjIsNjM4LDE3MjQsNjc2IEwsMTMxNiwxMDg0IEMsMTMwNSwxMDk1LDEyOTMsMTEwNCwxMjgwLDExMTIgTCwxMjgwLDE0NDAgQywxMjgwLDE0OTMsMTIzNywxNTM2LDExODQsMTUzNiBMLDk2LDE1MzYgQyw0MywxNTM2LDAsMTQ5MywwLDE0NDAgTCwwLDk2IEMsMCw0Myw0MywwLDk2LDAgTCw2NDAsMCBMLDY0MCwtMTYwIEMsNjQwLC0yMTMsNjgzLC0yNTYsNzM2LC0yNTYgTCwxNjk2LC0yNTYgQywxNzQ5LC0yNTYsMTc5MiwtMjEzLDE3OTIsLTE2MCBaXCJcblx0XHR9LFxuXHRcdFwiZm9sZGVyX29wZW5fYWx0XCI6IHtcblx0XHRcdFwiYWR2YW5jZVdpZHRoXCI6IDE5MjAsXG5cdFx0XHRcImNvbW1hbmRzXCI6IFwiTSwxNzgxLDYwNSBDLDE3ODEsNTkwLDE3NzIsNTc3LDE3NjMsNTY2IEwsMTQ2OSwyMDMgQywxNDM1LDE2MSwxMzY1LDEyOCwxMzEyLDEyOCBMLDIyNCwxMjggQywyMDIsMTI4LDE3MSwxMzUsMTcxLDE2MyBDLDE3MSwxNzgsMTgwLDE5MSwxODksMjAzIEwsNDgzLDU2NiBDLDUxNyw2MDcsNTg3LDY0MCw2NDAsNjQwIEwsMTcyOCw2NDAgQywxNzUwLDY0MCwxNzgxLDYzMywxNzgxLDYwNSBNLDY0MCw3NjggQyw1NDksNzY4LDQ0Miw3MTcsMzg0LDY0NiBMLDEyOCwzMzEgTCwxMjgsMTE4NCBDLDEyOCwxMjM3LDE3MSwxMjgwLDIyNCwxMjgwIEwsNTQ0LDEyODAgQyw1OTcsMTI4MCw2NDAsMTIzNyw2NDAsMTE4NCBMLDY0MCwxMTIwIEMsNjQwLDEwNjcsNjgzLDEwMjQsNzM2LDEwMjQgTCwxMzEyLDEwMjQgQywxMzY1LDEwMjQsMTQwOCw5ODEsMTQwOCw5MjggTCwxNDA4LDc2OCBNLDE5MDksNjA1IEMsMTkwOSw2MjksMTkwNCw2NTIsMTg5NCw2NzMgQywxODY0LDczNywxNzk2LDc2OCwxNzI4LDc2OCBMLDE1MzYsNzY4IEwsMTUzNiw5MjggQywxNTM2LDEwNTEsMTQzNSwxMTUyLDEzMTIsMTE1MiBMLDc2OCwxMTUyIEwsNzY4LDExODQgQyw3NjgsMTMwNyw2NjcsMTQwOCw1NDQsMTQwOCBMLDIyNCwxNDA4IEMsMTAxLDE0MDgsMCwxMzA3LDAsMTE4NCBMLDAsMjI0IEMsMCwxMDEsMTAxLDAsMjI0LDAgTCwxMzEyLDAgQywxNDAyLDAsMTUxMSw1MiwxNTY4LDEyMiBMLDE4NjMsNDg1IEMsMTg5MCw1MTksMTkwOSw1NjEsMTkwOSw2MDUgWlwiXG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCB7IGZvbnQgfSIsImltcG9ydCB7IGZvbnQgfSBmcm9tICcuL2ZvbnQuanMnXG5pbXBvcnQgeyBUaGVtZSB9IGZyb20gJy4uL3RoZW1lLmpzJ1xuaW1wb3J0IHsgdXRpbHMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcydcbmNvbnN0IHsgc3R5bGUgfSA9IHV0aWxzXG5cbmZ1bmN0aW9uIEljb25CdXR0b24oc2l6ZSwgaWNvbiwgdG9vbHRpcCwgZGlzcGF0Y2hlcikge1xuXHR2YXIgaWNvblN0eWxlID0ge1xuXHRcdHBhZGRpbmc6ICcwLjJlbSAwLjRlbScsXG5cdFx0bWFyZ2luOiAnMGVtJyxcblx0XHRiYWNrZ3JvdW5kOiAnbm9uZScsXG5cdFx0b3V0bGluZTogJ25vbmUnLFxuXHRcdGZvbnRTaXplOiAnMTZweCcsXG5cdFx0Ym9yZGVyOiAnbm9uZScsXG5cdFx0Ym9yZGVyUmFkaXVzOiAnMC4yZW0nLFxuXHR9O1xuXG5cdHZhciBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0c3R5bGUoYnV0dG9uLCBpY29uU3R5bGUpO1xuXG5cdHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblx0dmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG5cdGJ1dHRvbi5hcHBlbmRDaGlsZChjYW52YXMpO1xuXG5cdHRoaXMuY3R4ID0gY3R4O1xuXHR0aGlzLmRvbSA9IGJ1dHRvbjtcblx0dGhpcy5jYW52YXMgPSBjYW52YXM7XG5cblx0dmFyIG1lID0gdGhpcztcblx0dGhpcy5zaXplID0gc2l6ZTtcblx0dmFyIGRwciA9IDE7XG5cblx0dGhpcy5yZXNpemUgPSBmdW5jdGlvbigpIHtcblx0XHRkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcblx0XHR2YXIgaGVpZ2h0ID0gc2l6ZTtcblxuXHRcdHZhciBnbHlwaCA9IGZvbnQuZm9udHNbaWNvbl07XG5cblx0XHRjYW52YXMuaGVpZ2h0ID0gaGVpZ2h0ICogZHByO1xuXHRcdGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuXG5cdFx0dmFyIHNjYWxlID0gaGVpZ2h0IC8gZm9udC51bml0c1BlckVtO1xuXHRcdHZhciB3aWR0aCA9IGdseXBoLmFkdmFuY2VXaWR0aCAqIHNjYWxlICsgMC41IHwgMDtcblxuXHRcdHdpZHRoICs9IDI7XG5cdFx0aGVpZ2h0ICs9IDI7XG5cblx0XHRjYW52YXMud2lkdGggPSB3aWR0aCAqIGRwcjtcblx0XHRjYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG5cblx0XHRjdHguZmlsbFN0eWxlID0gVGhlbWUuYztcblx0XHRtZS5kcmF3KCk7XG5cdH07XG5cblx0aWYgKGRpc3BhdGNoZXIpIGRpc3BhdGNoZXIub24oJ3Jlc2l6ZScsIHRoaXMucmVzaXplKTtcblxuXHR0aGlzLnNldFNpemUgPSBmdW5jdGlvbihzKSB7XG5cdFx0c2l6ZSA9IHM7XG5cdFx0dGhpcy5yZXNpemUoKTtcblx0fTtcblxuXHR0aGlzLnNldEljb24gPSBmdW5jdGlvbihpY29uKSB7XG5cdFx0bWUuaWNvbiA9IGljb247XG5cblx0XHRpZiAoIWZvbnQuZm9udHNbaWNvbl0pIGNvbnNvbGUud2FybignRm9udCBpY29uIG5vdCBmb3VuZCEnKTtcblx0XHR0aGlzLnJlc2l6ZSgpO1xuXHR9O1xuXG5cdHRoaXMub25DbGljayA9IGZ1bmN0aW9uKGUpIHtcblx0XHRidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlKTtcblx0fTtcblxuXHR2YXIgTE9OR19IT0xEX0RVUkFUSU9OID0gNTAwO1xuXHR2YXIgbG9uZ0hvbGRUaW1lcjtcblxuXHR0aGlzLm9uTG9uZ0hvbGQgPSBmdW5jdGlvbihmKSB7XG5cdFx0Ly8gbm90IG1vc3QgZWxhZ2VudCBidXQgb2ggd2VsbHMuXG5cdFx0ZnVuY3Rpb24gc3RhcnRIb2xkKGUpIHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRsb25nSG9sZFRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYgKGxvbmdIb2xkVGltZXIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnTE9ORyBIT0xELUVEIScpO1xuXHRcdFx0XHRcdGYoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgTE9OR19IT0xEX0RVUkFUSU9OKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbGVhckxvbmdIb2xkVGltZXIoKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQobG9uZ0hvbGRUaW1lcik7XG5cdFx0fVxuXG5cdFx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHN0YXJ0SG9sZCk7XG5cdFx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBzdGFydEhvbGQpO1xuXHRcdGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgY2xlYXJMb25nSG9sZFRpbWVyKTtcblx0XHRidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdXQnLCBjbGVhckxvbmdIb2xkVGltZXIpO1xuXHRcdGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIGNsZWFyTG9uZ0hvbGRUaW1lcik7XG5cdH07XG5cblx0dGhpcy5zZXRUaXAgPSBmdW5jdGlvbih0aXApIHtcblx0XHR0b29sdGlwID0gdGlwO1xuXHR9O1xuXG5cdHZhciBib3JkZXJzID0ge1xuXHRcdGJvcmRlcjogJzFweCBzb2xpZCAnICsgVGhlbWUuYixcblx0XHQvLyBib3hTaGFkb3c6IFRoZW1lLmIgKyAnIDFweCAxcHgnXG5cdH07XG5cblx0dmFyIG5vX2JvcmRlcnMgPSB7XG5cdFx0Ym9yZGVyOiAnMXB4IHNvbGlkIHRyYW5zcGFyZW50Jyxcblx0XHQvLyBib3hTaGFkb3c6ICdub25lJ1xuXHR9O1xuXG5cdHZhciBub3JtYWwgPSAnbm9uZSc7IC8vIFRoZW1lLmI7XG5cdHZhciB1cCA9IFRoZW1lLmM7XG5cdHZhciBkb3duID0gVGhlbWUuYjtcblxuXHRidXR0b24uc3R5bGUuYmFja2dyb3VuZCA9IG5vcm1hbDtcblx0c3R5bGUoYnV0dG9uLCBub19ib3JkZXJzKTtcblxuXHRidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gYnV0dG9uLnN0eWxlLmJhY2tncm91bmQgPSB1cDtcblx0XHRzdHlsZShidXR0b24sIGJvcmRlcnMpO1xuXG5cdFx0Y3R4LmZpbGxTdHlsZSA9IFRoZW1lLmQ7XG5cdFx0Ly8gbWUuZHJvcHNoYWRvdyA9IHRydWU7XG5cdFx0Y3R4LnNoYWRvd0NvbG9yID0gVGhlbWUuYjtcblx0XHRjdHguc2hhZG93Qmx1ciA9IDAuNSAqIGRwcjtcblx0XHRjdHguc2hhZG93T2Zmc2V0WCA9IDEgKiBkcHI7XG5cdFx0Y3R4LnNoYWRvd09mZnNldFkgPSAxICogZHByO1xuXHRcdG1lLmRyYXcoKTtcblxuXHRcdGlmICh0b29sdGlwICYmIGRpc3BhdGNoZXIpIGRpc3BhdGNoZXIuZmlyZSgnc3RhdHVzJywgJ2J1dHRvbjogJyArIHRvb2x0aXApO1xuXHR9KTtcblxuXHRidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZnVuY3Rpb24oKSB7XG5cdFx0YnV0dG9uLnN0eWxlLmJhY2tncm91bmQgPSBkb3duO1xuXHRcdC8vIGN0eC5maWxsU3R5bGUgPSBUaGVtZS5iO1xuXHRcdC8vIG1lLmRyYXcoKTtcblx0fSk7XG5cblx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbigpIHtcblx0XHQvLyBjdHguZmlsbFN0eWxlID0gVGhlbWUuZDtcblx0XHRidXR0b24uc3R5bGUuYmFja2dyb3VuZCA9IG5vcm1hbDtcblx0XHRzdHlsZShidXR0b24sIGJvcmRlcnMpO1xuXHRcdC8vIG1lLmRyYXcoKTtcblx0fSk7XG5cblx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3V0JywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gY3R4LmZpbGxTdHlsZSA9IFRoZW1lLmM7XG5cblxuXHRcdGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kID0gbm9ybWFsO1xuXHRcdHN0eWxlKGJ1dHRvbiwgbm9fYm9yZGVycyk7XG5cdFx0bWUuZHJvcHNoYWRvdyA9IGZhbHNlO1xuXHRcdGN0eC5maWxsU3R5bGUgPSBUaGVtZS5jO1xuXHRcdGN0eC5zaGFkb3dDb2xvciA9IG51bGw7XG5cdFx0Y3R4LnNoYWRvd0JsdXIgPSAwO1xuXHRcdGN0eC5zaGFkb3dPZmZzZXRYID0gMDtcblx0XHRjdHguc2hhZG93T2Zmc2V0WSA9IDA7XG5cdFx0bWUuZHJhdygpO1xuXHR9KTtcblxuXHRpZiAoaWNvbikgdGhpcy5zZXRJY29uKGljb24pO1xufVxuXG5JY29uQnV0dG9uLnByb3RvdHlwZS5DTURfTUFQID0ge1xuXHRNOiAnbW92ZVRvJyxcblx0TDogJ2xpbmVUbycsXG5cdFE6ICdxdWFkcmF0aWNDdXJ2ZVRvJyxcblx0QzogJ2JlemllckN1cnZlVG8nLFxuXHRaOiAnY2xvc2VQYXRoJ1xufTtcblxuSWNvbkJ1dHRvbi5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuXHRpZiAoIXRoaXMuaWNvbikgcmV0dXJuO1xuXG5cdHZhciBjdHggPSB0aGlzLmN0eDtcblxuXHR2YXIgZ2x5cGggPSBmb250LmZvbnRzW3RoaXMuaWNvbl07XG5cblx0dmFyIGhlaWdodCA9IHRoaXMuc2l6ZTtcblx0dmFyIGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuXHR2YXIgc2NhbGUgPSBoZWlnaHQgLyBmb250LnVuaXRzUGVyRW0gKiBkcHI7XG5cdHZhciBwYXRoX2NvbW1hbmRzID0gIGdseXBoLmNvbW1hbmRzLnNwbGl0KCcgJyk7XG5cblx0Y3R4LnNhdmUoKTtcblx0Y3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLmNhbnZhcy53aWR0aCAqIGRwciwgdGhpcy5jYW52YXMuaGVpZ2h0ICogZHByKTtcblxuXHRpZiAodGhpcy5kcm9wc2hhZG93KSB7XG5cdFx0Y3R4LnNhdmUoKTtcblx0XHRjdHguZmlsbFN0eWxlID0gVGhlbWUuYjtcblx0XHRjdHgudHJhbnNsYXRlKDEuNSAqIGRwciwgMS41ICogZHByKTtcblx0XHRjdHguc2NhbGUoc2NhbGUsIC1zY2FsZSk7XG5cdFx0Y3R4LnRyYW5zbGF0ZSgwICwgLWZvbnQuYXNjZW5kZXIpO1xuXHRcdGN0eC5iZWdpblBhdGgoKTtcblxuXHRcdGZvciAobGV0IGkgPSAwLCBpbCA9IHBhdGhfY29tbWFuZHMubGVuZ3RoOyBpIDwgaWw7IGkrKykge1xuXHRcdFx0Y29uc3QgY21kcyA9IHBhdGhfY29tbWFuZHNbaV0uc3BsaXQoJywnKTtcblx0XHRcdGNvbnN0IHBhcmFtcyA9IGNtZHMuc2xpY2UoMSk7XG5cblx0XHRcdGN0eFt0aGlzLkNNRF9NQVBbY21kc1swXV1dLmFwcGx5KGN0eCwgcGFyYW1zKTtcblx0XHR9XG5cdFx0Y3R4LmZpbGwoKTtcblx0XHRjdHgucmVzdG9yZSgpO1xuXHR9XG5cblx0Y3R4LnNjYWxlKHNjYWxlLCAtc2NhbGUpO1xuXHRjdHgudHJhbnNsYXRlKDAsIC1mb250LmFzY2VuZGVyKTtcblx0Y3R4LmJlZ2luUGF0aCgpO1xuXG5cdGZvciAobGV0IGkgPSAwLCBpbCA9IHBhdGhfY29tbWFuZHMubGVuZ3RoOyBpIDwgaWw7IGkrKykge1xuXHRcdGNvbnN0IGNtZHMgPSBwYXRoX2NvbW1hbmRzW2ldLnNwbGl0KCcsJyk7XG5cdFx0Y29uc3QgcGFyYW1zID0gY21kcy5zbGljZSgxKTtcblxuXHRcdGN0eFt0aGlzLkNNRF9NQVBbY21kc1swXV1dLmFwcGx5KGN0eCwgcGFyYW1zKTtcblx0fVxuXHRjdHguZmlsbCgpO1xuXHRjdHgucmVzdG9yZSgpO1xuXG5cdC8qXG5cdHZhciB0cmlhbmdsZSA9IGhlaWdodCAvIDMgKiBkcHI7XG5cdGN0eC5zYXZlKCk7XG5cdC8vIGN0eC50cmFuc2xhdGUoZHByICogMiwgMCk7XG5cdC8vIGN0eC5maWxsUmVjdCh0aGlzLmNhbnZhcy53aWR0aCAtIHRyaWFuZ2xlLCB0aGlzLmNhbnZhcy5oZWlnaHQgLSB0cmlhbmdsZSwgdHJpYW5nbGUsIHRyaWFuZ2xlKTtcblx0Y3R4LmJlZ2luUGF0aCgpO1xuXHRjdHgubW92ZVRvKHRoaXMuY2FudmFzLndpZHRoIC0gdHJpYW5nbGUsIHRoaXMuY2FudmFzLmhlaWdodCAtIHRyaWFuZ2xlIC8gMik7XG5cdGN0eC5saW5lVG8odGhpcy5jYW52YXMud2lkdGgsIHRoaXMuY2FudmFzLmhlaWdodCAtIHRyaWFuZ2xlIC8gMik7XG5cdGN0eC5saW5lVG8odGhpcy5jYW52YXMud2lkdGggLSB0cmlhbmdsZSAvIDIsIHRoaXMuY2FudmFzLmhlaWdodCk7XG5cdGN0eC5maWxsKCk7XG5cdGN0eC5yZXN0b3JlKCk7XG5cdCovXG59O1xuXG5leHBvcnQgeyBJY29uQnV0dG9uIH0iLCJpbXBvcnQgeyBEbyB9IGZyb20gJy4uL3V0aWxzL2RvLmpzJ1xuaW1wb3J0IHsgdXRpbHMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcydcblxuLy8gKioqKioqKioqKiBjbGFzczogU2Nyb2xsQmFyICoqKioqKioqKioqKioqKioqKiAvL1xuLypcblx0U2ltcGxlIFVJIHdpZGdldCB0aGF0IGRpc3BsYXlzIGEgc2Nyb2xsdHJhY2tcblx0YW5kIHNsaWRlciwgdGhhdCBmaXJlcyBzb21lIHNjcm9sbCBldmVudHNcbiovXG4vLyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXG52YXIgc2Nyb2xsdHJhY2tfc3R5bGUgPSB7XG5cdC8vIGZsb2F0OiAncmlnaHQnLFxuXHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0Ly8gcmlnaHQ6ICcwJyxcblx0Ly8gdG9wOiAnMCcsXG5cdC8vIGJvdHRvbTogJzAnLFxuXHRiYWNrZ3JvdW5kOiAnLXdlYmtpdC1ncmFkaWVudChsaW5lYXIsIGxlZnQgdG9wLCByaWdodCB0b3AsIGNvbG9yLXN0b3AoMCwgcmdiKDI5LDI5LDI5KSksIGNvbG9yLXN0b3AoMC42LCByZ2IoNTAsNTAsNTApKSApJyxcblx0Ym9yZGVyOiAnMXB4IHNvbGlkIHJnYigyOSwgMjksIDI5KScsXG5cdC8vIHpJbmRleDogJzEwMDAnLFxuXHR0ZXh0QWxpZ246ICdjZW50ZXInLFxuXHRjdXJzb3I6ICdwb2ludGVyJ1xufTtcblxudmFyIHNjcm9sbGJhcl9zdHlsZSA9IHtcblx0YmFja2dyb3VuZDogJy13ZWJraXQtZ3JhZGllbnQobGluZWFyLCBsZWZ0IHRvcCwgcmlnaHQgdG9wLCBjb2xvci1zdG9wKDAuMiwgcmdiKDg4LDg4LDg4KSksIGNvbG9yLXN0b3AoMC42LCByZ2IoNjQsNjQsNjQpKSApJyxcblx0Ym9yZGVyOiAnMXB4IHNvbGlkIHJnYigyNSwyNSwyNSknLFxuXHQvLyBwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0cG9zaXRpb246ICdyZWxhdGl2ZScsXG5cdGJvcmRlclJhZGl1czogJzZweCdcbn07XG5cbmZ1bmN0aW9uIFNjcm9sbEJhcihoLCB3LCBkaXNwYXRjaGVyKSB7XG5cblx0dmFyIFNDUk9MTEJBUl9XSURUSCA9IHcgPyB3IDogMTI7XG5cdHZhciBTQ1JPTExCQVJfTUFSR0lOID0gMztcblx0dmFyIFNDUk9MTF9XSURUSCA9IFNDUk9MTEJBUl9XSURUSCArIFNDUk9MTEJBUl9NQVJHSU4gKiAyO1xuXHR2YXIgTUlOX0JBUl9MRU5HVEggPSAyNTtcblxuXHR2YXIgc2Nyb2xsdHJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0dXRpbHMuc3R5bGUoc2Nyb2xsdHJhY2ssIHNjcm9sbHRyYWNrX3N0eWxlKTtcblxuXHR2YXIgc2Nyb2xsdHJhY2tIZWlnaHQgPSBoIC0gMjtcblx0c2Nyb2xsdHJhY2suc3R5bGUuaGVpZ2h0ID0gc2Nyb2xsdHJhY2tIZWlnaHQgKyAncHgnO1xuXHRzY3JvbGx0cmFjay5zdHlsZS53aWR0aCA9IFNDUk9MTF9XSURUSCArICdweCc7XG5cblx0Ly8gdmFyIHNjcm9sbFRvcCA9IDA7XG5cdHZhciBzY3JvbGxiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0Ly8gc2Nyb2xsYmFyLmNsYXNzTmFtZSA9ICdzY3JvbGxiYXInO1xuXHR1dGlscy5zdHlsZShzY3JvbGxiYXIsIHNjcm9sbGJhcl9zdHlsZSk7XG5cdHNjcm9sbGJhci5zdHlsZS53aWR0aCA9IFNDUk9MTEJBUl9XSURUSCArICdweCc7XG5cdHNjcm9sbGJhci5zdHlsZS5oZWlnaHQgPSBoIC8gMjtcblx0c2Nyb2xsYmFyLnN0eWxlLnRvcCA9IDA7XG5cdHNjcm9sbGJhci5zdHlsZS5sZWZ0ID0gU0NST0xMQkFSX01BUkdJTiArICdweCc7IC8vIDA7IC8vU1xuXG5cdHNjcm9sbHRyYWNrLmFwcGVuZENoaWxkKHNjcm9sbGJhcik7XG5cblx0dmFyIG1lID0gdGhpcztcblxuXHR2YXIgYmFyX2xlbmd0aCwgYmFyX3k7XG5cblx0Ly8gU2V0cyBsZW5ndGhzIG9mIHNjcm9sbGJhciBieSBwZXJjZW50YWdlXG5cdHRoaXMuc2V0TGVuZ3RoID0gZnVuY3Rpb24obCkge1xuXHRcdC8vIGxpbWl0IDAuLjFcblx0XHRsID0gTWF0aC5tYXgoTWF0aC5taW4oMSwgbCksIDApO1xuXHRcdGwgKj0gc2Nyb2xsdHJhY2tIZWlnaHQ7XG5cdFx0YmFyX2xlbmd0aCA9IE1hdGgubWF4KGwsIE1JTl9CQVJfTEVOR1RIKTtcblx0XHRzY3JvbGxiYXIuc3R5bGUuaGVpZ2h0ID0gYmFyX2xlbmd0aCArICdweCc7XG5cdH07XG5cblx0dGhpcy5zZXRIZWlnaHQgPSBmdW5jdGlvbihoZWlnaHQpIHtcblx0XHRoID0gaGVpZ2h0O1xuXG5cdFx0c2Nyb2xsdHJhY2tIZWlnaHQgPSBoIC0gMjtcblx0XHRzY3JvbGx0cmFjay5zdHlsZS5oZWlnaHQgPSBzY3JvbGx0cmFja0hlaWdodCArICdweCcgO1xuXHR9O1xuXG5cdC8vIE1vdmVzIHNjcm9sbGJhciB0byBwb3NpdGlvbiBieSBQZXJjZW50YWdlXG5cdHRoaXMuc2V0UG9zaXRpb24gPSBmdW5jdGlvbihwKSB7XG5cdFx0cCA9IE1hdGgubWF4KE1hdGgubWluKDEsIHApLCAwKTtcblx0XHR2YXIgZW1wdHlUcmFjayA9IHNjcm9sbHRyYWNrSGVpZ2h0IC0gYmFyX2xlbmd0aDtcblx0XHRiYXJfeSA9IHAgKiBlbXB0eVRyYWNrO1xuXHRcdHNjcm9sbGJhci5zdHlsZS50b3AgPSBiYXJfeSArICdweCc7XG5cdH07XG5cblx0dGhpcy5zZXRMZW5ndGgoMSk7XG5cdHRoaXMuc2V0UG9zaXRpb24oMCk7XG5cdHRoaXMub25TY3JvbGwgPSBuZXcgRG8oKTtcblxuXHR2YXIgbW91c2VfZG93bl9ncmlwO1xuXG5cdGZ1bmN0aW9uIG9uRG93bihldmVudCkge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRpZiAoZXZlbnQudGFyZ2V0ID09IHNjcm9sbGJhcikge1xuXHRcdFx0bW91c2VfZG93bl9ncmlwID0gZXZlbnQuY2xpZW50WTtcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSwgZmFsc2UpO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXAsIGZhbHNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGV2ZW50LmNsaWVudFkgPCBiYXJfeSkge1xuXHRcdFx0XHRtZS5vblNjcm9sbC5maXJlKCdwYWdldXAnKTtcblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQuY2xpZW50WSA+IChiYXJfeSArIGJhcl9sZW5ndGgpKSB7XG5cdFx0XHRcdG1lLm9uU2Nyb2xsLmZpcmUoJ3BhZ2Vkb3duJyk7XG5cdFx0XHR9XG5cdFx0XHQvLyBpZiB3YW50IHRvIGRyYWcgc2Nyb2xsZXIgdG8gZW1wdHkgdHJhY2sgaW5zdGVhZFxuXHRcdFx0Ly8gbWUuc2V0UG9zaXRpb24oZXZlbnQuY2xpZW50WSAvIChzY3JvbGx0cmFja0hlaWdodCAtIDEpKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvbk1vdmUoZXZlbnQpIHtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0Ly8gZXZlbnQudGFyZ2V0ID09IHNjcm9sbGJhclxuXHRcdHZhciBlbXB0eVRyYWNrID0gc2Nyb2xsdHJhY2tIZWlnaHQgLSBiYXJfbGVuZ3RoO1xuXHRcdHZhciBzY3JvbGx0byA9IChldmVudC5jbGllbnRZIC0gbW91c2VfZG93bl9ncmlwKSAvIGVtcHR5VHJhY2s7XG5cblx0XHQvLyBjbGFtcCBsaW1pdHMgdG8gMC4uMVxuXHRcdGlmIChzY3JvbGx0byA+IDEpIHNjcm9sbHRvID0gMTtcblx0XHRpZiAoc2Nyb2xsdG8gPCAwKSBzY3JvbGx0byA9IDA7XG5cdFx0bWUuc2V0UG9zaXRpb24oc2Nyb2xsdG8pO1xuXHRcdG1lLm9uU2Nyb2xsLmZpcmUoJ3Njcm9sbHRvJywgc2Nyb2xsdG8pO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25VcChldmVudCkge1xuXHRcdG9uTW92ZShldmVudCk7XG5cdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlLCBmYWxzZSk7XG5cdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXAsIGZhbHNlKTtcblx0fVxuXG5cdHNjcm9sbHRyYWNrLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG9uRG93biwgZmFsc2UpO1xuXHR0aGlzLmRvbSA9IHNjcm9sbHRyYWNrO1xuXG59XG5cbmV4cG9ydCB7IFNjcm9sbEJhciB9IiwiaW1wb3J0IHsgVGhlbWUgfSBmcm9tICcuLi90aGVtZS5qcydcbmltcG9ydCB7IERvIH0gZnJvbSAnLi4vdXRpbHMvZG8uanMnXG5pbXBvcnQgeyBoYW5kbGVEcmFnIH0gZnJvbSAnLi4vdXRpbHMvdXRpbF9oYW5kbGVfZHJhZy5qcydcbmltcG9ydCB7IHV0aWxzIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMuanMnXG5jb25zdCB7IGZpcnN0RGVmaW5lZCwgc3R5bGUgfSA9IHV0aWxzO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vLyBVSU51bWJlclxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBVSU51bWJlcihjb25maWcpIHtcblx0Y29uZmlnID0gY29uZmlnIHx8IHt9O1xuXHR2YXIgbWluID0gY29uZmlnLm1pbiA9PT0gdW5kZWZpbmVkID8gLUluZmluaXR5IDogY29uZmlnLm1pbjtcblxuXHQvLyBjb25maWcueHN0ZXAgYW5kIGNvbmZpZy55c3RlcCBhbGxvdyBjb25maWd1cmluZyBhZGp1c3RtZW50XG5cdC8vIHNwZWVkIGFjcm9zcyBlYWNoIGF4aXMuXG5cdC8vIGNvbmZpZy53aGVlbFN0ZXAgYW5kIGNvbmZpZy53aGVlbFN0ZXBGaW5lIGFsbG93IGNvbmZpZ3VyaW5nXG5cdC8vIGFkanVzdG1lbnQgc3BlZWQgZm9yIG1vdXNld2hlZWwsIGFuZCBtb3VzZXdoZWVsIHdoaWxlIGhvbGRpbmcgPGFsdD5cblxuXHQvLyBJZiBvbmx5IGNvbmZpZy5zdGVwIGlzIHNwZWNpZmllZCwgYWxsIG90aGVyIGFkanVzdG1lbnQgc3BlZWRzXG5cdC8vIGFyZSBzZXQgdG8gdGhlIHNhbWUgdmFsdWUuXG5cdHZhciB4c3RlcCA9IGZpcnN0RGVmaW5lZChjb25maWcueHN0ZXAsIGNvbmZpZy5zdGVwLCAwLjAwMSk7XG5cdHZhciB5c3RlcCA9IGZpcnN0RGVmaW5lZChjb25maWcueXN0ZXAsIGNvbmZpZy5zdGVwLCAwLjEpO1xuXHR2YXIgd2hlZWxTdGVwID0gZmlyc3REZWZpbmVkKGNvbmZpZy53aGVlbFN0ZXAsIHlzdGVwKTtcblx0dmFyIHdoZWVsU3RlcEZpbmUgPSBmaXJzdERlZmluZWQoY29uZmlnLndoZWVsU3RlcEZpbmUsIHhzdGVwKTtcblxuXHR2YXIgcHJlY2lzaW9uID0gY29uZmlnLnByZWNpc2lvbiB8fCAzO1xuXHQvLyBSYW5nZVxuXHQvLyBNYXhcblxuXHR2YXIgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG5cdC8vIHNwYW4udHlwZSA9ICdudW1iZXInOyAvLyBzcGlubmVyXG5cblx0c3R5bGUoc3Bhbiwge1xuXHRcdHRleHRBbGlnbjogJ2NlbnRlcicsXG5cdFx0Zm9udFNpemU6ICcxMHB4Jyxcblx0XHRwYWRkaW5nOiAnMXB4Jyxcblx0XHRjdXJzb3I6ICducy1yZXNpemUnLFxuXHRcdHdpZHRoOiAnNDBweCcsXG5cdFx0bWFyZ2luOiAwLFxuXHRcdG1hcmdpblJpZ2h0OiAnMTBweCcsXG5cdFx0YXBwZWFyYW5jZTogJ25vbmUnLFxuXHRcdG91dGxpbmU6ICdub25lJyxcblx0XHRib3JkZXI6IDAsXG5cdFx0YmFja2dyb3VuZDogJ25vbmUnLFxuXHRcdGJvcmRlckJvdHRvbTogJzFweCBkb3R0ZWQgJysgVGhlbWUuYyxcblx0XHRjb2xvcjogVGhlbWUuY1xuXHR9KTtcblxuXHR2YXIgbWUgPSB0aGlzO1xuXHR2YXIgc3RhdGUsIHZhbHVlID0gMCwgdW5jaGFuZ2VkX3ZhbHVlO1xuXG5cdHRoaXMub25DaGFuZ2UgPSBuZXcgRG8oKTtcblxuXHRzcGFuLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcblx0XHRjb25zb2xlLmxvZygnaW5wdXQgY2hhbmdlZCcsIHNwYW4udmFsdWUpO1xuXHRcdHZhbHVlID0gcGFyc2VGbG9hdChzcGFuLnZhbHVlLCAxMCk7XG5cblx0XHRmaXJlQ2hhbmdlKCk7XG5cdH0pO1xuXG5cdC8vIEFsbG93IGtleWRvd24gcHJlc3NlcyBpbiBpbnB1dHMsIGRvbid0IGFsbG93IHBhcmVudCB0byBibG9jayB0aGVtXG5cdHNwYW4uYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGZ1bmN0aW9uKGUpIHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHR9KVxuXG5cdHNwYW4uYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBmdW5jdGlvbihlKSB7XG5cdFx0c3Bhbi5zZXRTZWxlY3Rpb25SYW5nZSgwLCBzcGFuLnZhbHVlLmxlbmd0aCk7XG5cdH0pXG5cblx0c3Bhbi5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIGZ1bmN0aW9uKGUpIHtcblx0XHQvLyBEaXNyZWdhcmQgcGl4ZWwvbGluZS9wYWdlIHNjcm9sbGluZyBhbmQganVzdFxuXHRcdC8vIHVzZSBldmVudCBkaXJlY3Rpb24uXG5cdFx0dmFyIGluYyA9IGUuZGVsdGFZID4gMD8gMSA6IC0xO1xuXHRcdGlmIChlLmFsdEtleSkge1xuXHRcdFx0aW5jICo9IHdoZWVsU3RlcEZpbmU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluYyAqPSB3aGVlbFN0ZXA7XG5cdFx0fVxuXHRcdHZhbHVlID0gY2xhbXAodmFsdWUgKyBpbmMpO1xuXHRcdGZpcmVDaGFuZ2UoKTtcblx0fSlcblxuXHRoYW5kbGVEcmFnKHNwYW4sIG9uRG93biwgb25Nb3ZlLCBvblVwKTtcblxuXHRmdW5jdGlvbiBjbGFtcCh2YWx1ZSkge1xuXHRcdHJldHVybiBNYXRoLm1heChtaW4sIHZhbHVlKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9uVXAoZSkge1xuXHRcdGlmIChlLm1vdmVkKSBmaXJlQ2hhbmdlKCk7XG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyBzaW5nbGUgY2xpY2tcblx0XHRcdHNwYW4uZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvbk1vdmUoZSkge1xuXHRcdHZhciBkeCA9IGUuZHg7XG5cdFx0dmFyIGR5ID0gZS5keTtcblxuXHRcdHZhbHVlID0gdW5jaGFuZ2VkX3ZhbHVlICsgKGR4ICogeHN0ZXApICsgKGR5ICogLXlzdGVwKTtcblxuXHRcdHZhbHVlID0gY2xhbXAodmFsdWUpO1xuXG5cdFx0Ly8gdmFsdWUgPSArdmFsdWUudG9GaXhlZChwcmVjaXNpb24pOyAvLyBvciB0b0ZpeGVkIHRvUHJlY2lzaW9uXG5cdFx0bWUub25DaGFuZ2UuZmlyZSh2YWx1ZSwgdHJ1ZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBvbkRvd24oZSkge1xuXHRcdHVuY2hhbmdlZF92YWx1ZSA9IHZhbHVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gZmlyZUNoYW5nZSgpIHtcblx0XHRtZS5vbkNoYW5nZS5maXJlKHZhbHVlKTtcblx0fVxuXG5cdHRoaXMuZG9tID0gc3BhbjtcblxuXHQvLyBwdWJsaWNcblx0dGhpcy5zZXRWYWx1ZSA9IGZ1bmN0aW9uKHYpIHtcblx0XHR2YWx1ZSA9IHY7XG5cdFx0c3Bhbi52YWx1ZSA9IHZhbHVlLnRvRml4ZWQocHJlY2lzaW9uKTtcblx0fTtcblxuXHR0aGlzLnBhaW50ID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHZhbHVlICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgIT09IHNwYW4pIHtcblx0XHRcdHNwYW4udmFsdWUgPSB2YWx1ZS50b0ZpeGVkKHByZWNpc2lvbik7XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgeyBVSU51bWJlciB9XG4iLCIvKiBPdmVyIHNpbXBsaXN0aWMgRXZlbnQgRGlzcGF0Y2hlciAqL1xuXG5jbGFzcyBEbyB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMubGlzdGVuZXJzID0gbmV3IFNldCgpXG5cdH1cblxuXHRkbyhjYWxsYmFjaykge1xuXHRcdHRoaXMubGlzdGVuZXJzLmFkZChjYWxsYmFjayk7XG5cdH1cblxuXHR1bmRvKGNhbGxiYWNrKSB7XG5cdFx0dGhpcy5saXN0ZW5lcnMuZGVsZXRlKGNhbGxiYWNrKTtcblx0fVxuXG5cdGZpcmUoLi4uYXJncykge1xuXHRcdGZvciAobGV0IGwgb2YgdGhpcy5saXN0ZW5lcnMpIHtcblx0XHRcdGwoLi4uYXJncylcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IHsgRG8gfSIsImltcG9ydCB7IERvIH0gZnJvbSAnLi9kby5qcyc7XG5pbXBvcnQgeyBMYXlvdXRDb25zdGFudHMgfSBmcm9tICcuLi9sYXlvdXRfY29uc3RhbnRzLmpzJ1xuXG5jb25zdCBTTkFQX0ZVTExfU0NSRUVOID0gJ2Z1bGwtc2NyZWVuJ1xuY29uc3QgU05BUF9UT1BfRURHRSA9ICdzbmFwLXRvcC1lZGdlJyAvLyBvciBhY3R1YWxseSB0b3AgaGFsZlxuY29uc3QgU05BUF9MRUZUX0VER0UgPSAnc25hcC1sZWZ0LWVkZ2UnXG5jb25zdCBTTkFQX1JJR0hUX0VER0UgPSAnc25hcC1yaWdodC1lZGdlJ1xuY29uc3QgU05BUF9CT1RUT01fRURHRSA9ICdzbmFwLWJvdHRvbS1lZGdlJ1xuY29uc3QgU05BUF9ET0NLX0JPVFRPTSA9ICdkb2NrLWJvdHRvbSdcblxuZnVuY3Rpb24gc2V0Qm91bmRzKGVsZW1lbnQsIHgsIHksIHcsIGgpIHtcblx0ZWxlbWVudC5zdHlsZS5sZWZ0ID0geCArICdweCc7XG5cdGVsZW1lbnQuc3R5bGUudG9wID0geSArICdweCc7XG5cdGVsZW1lbnQuc3R5bGUud2lkdGggPSB3ICsgJ3B4Jztcblx0ZWxlbWVudC5zdHlsZS5oZWlnaHQgPSBoICsgJ3B4Jztcbn1cblxuLypcblxuVGhlIERvY2tpbmcgV2lkZ2V0XG5cbjEuIHdoZW4gLmFsbG93TW92ZSh0cnVlKSBpcyBzZXQsIHRoZSBwYW5lIGJlY29tZXMgZHJhZ2dhYmxlXG4yLiB3aGVuIGRyYWdnaW5nLCBpZiB0aGUgcG9pbnRlciB0byBuZWFyIHRvIHRoZSBlZGdlcyxcbiAgIGl0IHJlc2l6ZXMgdGhlIGdob3N0IHBhbm5lbCBhcyBhIHN1Z2dlc3Rpb24gdG8gc25hcCBpbnRvIHRoZVxuICAgc3VnZ2VzdGVkIHBvc2l0aW9uXG4zLiB1c2VyIGNhbiBlaXRoZXIgbW92ZSBwb2ludGVyIGF3YXkgb3IgbGV0IGdvIG9mIHRoZSBjdXJzb3IsXG4gICBhbGxvdyB0aGUgcGFuZSB0byBiZSByZXNpemVkIGFuZCBzbmFwcGVkIGludG8gcG9zaXRpb25cblxuXG5NeSBvcmlnaW4gaW1wbGVtZW50YXRpb24gZnJvbSBodHRwczovL2NvZGVwZW4uaW8veno4NS9wZW4vZ2JPb1ZQXG5cbmFyZ3MgZWcuXG5cdHZhciBwYW5lID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmUnKTtcblx0dmFyIGdob3N0cGFuZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnaG9zdHBhbmUnKTtcblx0d2lkZ2V0ID0gbmV3IERvY2tpbmdXaW5kb3cocGFuZSwgZ2hvc3RwYW5lKVxuXG5cblx0dGl0bGVfZG9tLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKCkge1xuXHRcdHdpZGdldC5hbGxvd01vdmUodHJ1ZSk7XG5cdH0pO1xuXG5cdHRpdGxlX2RvbS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW91dCcsIGZ1bmN0aW9uKCkge1xuXHRcdHdpZGdldC5hbGxvd01vdmUoZmFsc2UpO1xuXHR9KTtcblxuXHRyZXNpemVfZnVsbC5vbkNsaWNrKCgpID0+IHtcblx0XHR3aWRnZXQubWF4aW1pemUoKSAvLyBmaWxsIHRvIHNjcmVlblxuXHR9KVxuXG5cdC8vIFRPRE8gY2FsbGJhY2sgd2hlbiBwYW5lIGlzIHJlc2l6ZWRcblx0d2lkZ2V0LnJlc2l6ZXMuZG8oKCkgPT4ge1xuXHRcdHNvbWV0aGluZ1xuXHR9KVxuKi9cblxuZnVuY3Rpb24gRG9ja2luZ1dpbmRvdyhwYW5lLCBnaG9zdHBhbmUpIHtcblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0Ly8gTWluaW11bSByZXNpemFibGUgYXJlYVxuXHR2YXIgbWluV2lkdGggPSAxMDA7XG5cdHZhciBtaW5IZWlnaHQgPSA4MDtcblxuXHQvLyBUaHJlc2hvbGRzXG5cdHZhciBGVUxMU0NSRUVOX01BUkdJTlMgPSAyO1xuXHR2YXIgU05BUF9NQVJHSU5TID0gODtcblx0dmFyIE1BUkdJTlMgPSAyO1xuXG5cdC8vIEVuZCBvZiB3aGF0J3MgY29uZmlndXJhYmxlLlxuXHR2YXIgcG9pbnRlclN0YXJ0ID0gbnVsbDtcblx0dmFyIG9uUmlnaHRFZGdlLCBvbkJvdHRvbUVkZ2UsIG9uTGVmdEVkZ2UsIG9uVG9wRWRnZTtcblxuXHR2YXIgcHJlU25hcHBlZDtcblxuXHR2YXIgYm91bmRzLCB4LCB5O1xuXG5cdHZhciByZWRyYXcgPSBmYWxzZTtcblxuXHR2YXIgYWxsb3dEcmFnZ2luZyA9IHRydWU7XG5cdHZhciBzbmFwVHlwZTtcblxuXHR0aGlzLmFsbG93TW92ZSA9IGZ1bmN0aW9uKGFsbG93KSB7XG5cdFx0YWxsb3dEcmFnZ2luZyA9IGFsbG93O1xuXHR9XG5cblx0ZnVuY3Rpb24gY2FuTW92ZSgpIHtcblx0XHRyZXR1cm4gYWxsb3dEcmFnZ2luZztcblx0fVxuXG5cdHRoaXMubWF4aW1pemUgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIXByZVNuYXBwZWQpIHtcblx0XHRcdHByZVNuYXBwZWQgPSB7XG5cdFx0XHRcdHdpZHRoOiBib3VuZHMud2lkdGgsXG5cdFx0XHRcdGhlaWdodDogYm91bmRzLmhlaWdodCxcblx0XHRcdFx0dG9wOiBib3VuZHMudG9wLFxuXHRcdFx0XHRsZWZ0OiBib3VuZHMubGVmdCxcblx0XHRcdH1cblxuXHRcdFx0c25hcFR5cGUgPSBTTkFQX0ZVTExfU0NSRUVOO1xuXHRcdFx0cmVzaXplRWRnZXMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2V0Qm91bmRzKHBhbmUsIGJvdW5kcy5sZWZ0LCBib3VuZHMudG9wLCBib3VuZHMud2lkdGgsIGJvdW5kcy5oZWlnaHQpO1xuXHRcdFx0Y2FsY3VsYXRlQm91bmRzKClcblx0XHRcdHNuYXBUeXBlID0gbnVsbDtcblx0XHRcdHByZVNuYXBwZWQgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHRoaXMucmVzaXplcyA9IG5ldyBEbygpO1xuXG5cdC8qIERPTSBVdGlscyAqL1xuXHRmdW5jdGlvbiBoaWRlR2hvc3RQYW5lKCkge1xuXHRcdC8vIGhpZGUgdGhlIGhpbnRlciwgYW5pbWF0YXRpbmcgdG8gdGhlIHBhbmUncyBib3VuZHNcblx0XHRzZXRCb3VuZHMoZ2hvc3RwYW5lLCBib3VuZHMubGVmdCwgYm91bmRzLnRvcCwgYm91bmRzLndpZHRoLCBib3VuZHMuaGVpZ2h0KTtcblx0XHRnaG9zdHBhbmUuc3R5bGUub3BhY2l0eSA9IDA7XG5cdH1cblxuXHRmdW5jdGlvbiBvblRvdWNoRG93bihlKSB7XG5cdFx0b25Eb3duKGUudG91Y2hlc1swXSk7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25Ub3VjaE1vdmUoZSkge1xuXHRcdG9uTW92ZShlLnRvdWNoZXNbMF0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25Ub3VjaEVuZChlKSB7XG5cdFx0aWYgKGUudG91Y2hlcy5sZW5ndGggPT0gMCkgb25VcChlLmNoYW5nZWRUb3VjaGVzWzBdKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9uTW91c2VEb3duKGUpIHtcblx0XHRvbkRvd24oZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBvbk1vdXNlVXAoZSkge1xuXHRcdG9uVXAoZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBvbkRvd24oZSkge1xuXHRcdGNhbGN1bGF0ZUJvdW5kcyhlKTtcblxuXHRcdHZhciBpc1Jlc2l6aW5nID0gb25SaWdodEVkZ2UgfHwgb25Cb3R0b21FZGdlIHx8IG9uVG9wRWRnZSB8fCBvbkxlZnRFZGdlO1xuXHRcdHZhciBpc01vdmluZyA9ICFpc1Jlc2l6aW5nICYmIGNhbk1vdmUoKTtcblxuXHRcdHBvaW50ZXJTdGFydCA9IHtcblx0XHRcdHg6IHgsXG5cdFx0XHR5OiB5LFxuXHRcdFx0Y3g6IGUuY2xpZW50WCxcblx0XHRcdGN5OiBlLmNsaWVudFksXG5cdFx0XHR3OiBib3VuZHMud2lkdGgsXG5cdFx0XHRoOiBib3VuZHMuaGVpZ2h0LFxuXHRcdFx0aXNSZXNpemluZzogaXNSZXNpemluZyxcblx0XHRcdGlzTW92aW5nOiBpc01vdmluZyxcblx0XHRcdG9uVG9wRWRnZTogb25Ub3BFZGdlLFxuXHRcdFx0b25MZWZ0RWRnZTogb25MZWZ0RWRnZSxcblx0XHRcdG9uUmlnaHRFZGdlOiBvblJpZ2h0RWRnZSxcblx0XHRcdG9uQm90dG9tRWRnZTogb25Cb3R0b21FZGdlXG5cdFx0fTtcblxuXHRcdGlmIChpc1Jlc2l6aW5nIHx8IGlzTW92aW5nKSB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cblx0ZnVuY3Rpb24gY2FsY3VsYXRlQm91bmRzKGUpIHtcblx0XHRib3VuZHMgPSBwYW5lLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHggPSBlLmNsaWVudFggLSBib3VuZHMubGVmdDtcblx0XHR5ID0gZS5jbGllbnRZIC0gYm91bmRzLnRvcDtcblxuXHRcdG9uVG9wRWRnZSA9IHkgPCBNQVJHSU5TO1xuXHRcdG9uTGVmdEVkZ2UgPSB4IDwgTUFSR0lOUztcblx0XHRvblJpZ2h0RWRnZSA9IHggPj0gYm91bmRzLndpZHRoIC0gTUFSR0lOUztcblx0XHRvbkJvdHRvbUVkZ2UgPSB5ID49IGJvdW5kcy5oZWlnaHQgLSBNQVJHSU5TO1xuXHR9XG5cblx0dmFyIGU7IC8vIGN1cnJlbnQgbW91c2Vtb3ZlIGV2ZW50XG5cblx0ZnVuY3Rpb24gb25Nb3ZlKGVlKSB7XG5cdFx0ZSA9IGVlO1xuXHRcdGNhbGN1bGF0ZUJvdW5kcyhlKTtcblxuXHRcdHJlZHJhdyA9IHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBhbmltYXRlKCkge1xuXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xuXG5cdFx0aWYgKCFyZWRyYXcpIHJldHVybjtcblxuXHRcdHJlZHJhdyA9IGZhbHNlO1xuXG5cdFx0Ly8gc3R5bGUgY3Vyc29yXG5cdFx0aWYgKG9uUmlnaHRFZGdlICYmIG9uQm90dG9tRWRnZSB8fCBvbkxlZnRFZGdlICYmIG9uVG9wRWRnZSkge1xuXHRcdFx0cGFuZS5zdHlsZS5jdXJzb3IgPSAnbndzZS1yZXNpemUnO1xuXHRcdH0gZWxzZSBpZiAob25SaWdodEVkZ2UgJiYgb25Ub3BFZGdlIHx8IG9uQm90dG9tRWRnZSAmJiBvbkxlZnRFZGdlKSB7XG5cdFx0XHRwYW5lLnN0eWxlLmN1cnNvciA9ICduZXN3LXJlc2l6ZSc7XG5cdFx0fSBlbHNlIGlmIChvblJpZ2h0RWRnZSB8fCBvbkxlZnRFZGdlKSB7XG5cdFx0XHRwYW5lLnN0eWxlLmN1cnNvciA9ICdldy1yZXNpemUnO1xuXHRcdH0gZWxzZSBpZiAob25Cb3R0b21FZGdlIHx8IG9uVG9wRWRnZSkge1xuXHRcdFx0cGFuZS5zdHlsZS5jdXJzb3IgPSAnbnMtcmVzaXplJztcblx0XHR9IGVsc2UgaWYgKGNhbk1vdmUoKSkge1xuXHRcdFx0cGFuZS5zdHlsZS5jdXJzb3IgPSAnbW92ZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBhbmUuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuXHRcdH1cblxuXHRcdGlmICghcG9pbnRlclN0YXJ0KSByZXR1cm47XG5cblx0XHQvKiBVc2VyIGlzIHJlc2l6aW5nICovXG5cdFx0aWYgKHBvaW50ZXJTdGFydC5pc1Jlc2l6aW5nKSB7XG5cblx0XHRcdGlmIChwb2ludGVyU3RhcnQub25SaWdodEVkZ2UpIHBhbmUuc3R5bGUud2lkdGggPSBNYXRoLm1heCh4LCBtaW5XaWR0aCkgKyAncHgnO1xuXHRcdFx0aWYgKHBvaW50ZXJTdGFydC5vbkJvdHRvbUVkZ2UpIHBhbmUuc3R5bGUuaGVpZ2h0ID0gTWF0aC5tYXgoeSwgbWluSGVpZ2h0KSArICdweCc7XG5cblx0XHRcdGlmIChwb2ludGVyU3RhcnQub25MZWZ0RWRnZSkge1xuXHRcdFx0XHR2YXIgY3VycmVudFdpZHRoID0gTWF0aC5tYXgocG9pbnRlclN0YXJ0LmN4IC0gZS5jbGllbnRYICArIHBvaW50ZXJTdGFydC53LCBtaW5XaWR0aCk7XG5cdFx0XHRcdGlmIChjdXJyZW50V2lkdGggPiBtaW5XaWR0aCkge1xuXHRcdFx0XHRcdHBhbmUuc3R5bGUud2lkdGggPSBjdXJyZW50V2lkdGggKyAncHgnO1xuXHRcdFx0XHRcdHBhbmUuc3R5bGUubGVmdCA9IGUuY2xpZW50WCArICdweCc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHBvaW50ZXJTdGFydC5vblRvcEVkZ2UpIHtcblx0XHRcdFx0dmFyIGN1cnJlbnRIZWlnaHQgPSBNYXRoLm1heChwb2ludGVyU3RhcnQuY3kgLSBlLmNsaWVudFkgICsgcG9pbnRlclN0YXJ0LmgsIG1pbkhlaWdodCk7XG5cdFx0XHRcdGlmIChjdXJyZW50SGVpZ2h0ID4gbWluSGVpZ2h0KSB7XG5cdFx0XHRcdFx0cGFuZS5zdHlsZS5oZWlnaHQgPSBjdXJyZW50SGVpZ2h0ICsgJ3B4Jztcblx0XHRcdFx0XHRwYW5lLnN0eWxlLnRvcCA9IGUuY2xpZW50WSArICdweCc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aGlkZUdob3N0UGFuZSgpO1xuXG5cdFx0XHRzZWxmLnJlc2l6ZXMuZmlyZShib3VuZHMud2lkdGgsIGJvdW5kcy5oZWlnaHQpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0LyogVXNlciBpcyBkcmFnZ2luZyAqL1xuXHRcdGlmIChwb2ludGVyU3RhcnQuaXNNb3ZpbmcpIHtcblx0XHRcdHZhciBzbmFwVHlwZSA9IGNoZWNrU25hcFR5cGUoKVxuXHRcdFx0aWYgKHNuYXBUeXBlKSB7XG5cdFx0XHRcdGNhbGNTbmFwQm91bmRzKHNuYXBUeXBlKTtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ3NuYXBwaW5nLi4uJywgSlNPTi5zdHJpbmdpZnkoc25hcEJvdW5kcykpXG5cdFx0XHRcdHZhciB7IGxlZnQsIHRvcCwgd2lkdGgsIGhlaWdodCB9ID0gc25hcEJvdW5kcztcblx0XHRcdFx0c2V0Qm91bmRzKGdob3N0cGFuZSwgbGVmdCwgdG9wLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRcdFx0Z2hvc3RwYW5lLnN0eWxlLm9wYWNpdHkgPSAwLjI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoaWRlR2hvc3RQYW5lKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcmVTbmFwcGVkKSB7XG5cdFx0XHRcdHNldEJvdW5kcyhwYW5lLFxuXHRcdFx0XHRcdGUuY2xpZW50WCAtIHByZVNuYXBwZWQud2lkdGggLyAyLFxuXHRcdFx0XHRcdGUuY2xpZW50WSAtIE1hdGgubWluKHBvaW50ZXJTdGFydC55LCBwcmVTbmFwcGVkLmhlaWdodCksXG5cdFx0XHRcdFx0cHJlU25hcHBlZC53aWR0aCxcblx0XHRcdFx0XHRwcmVTbmFwcGVkLmhlaWdodFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIG1vdmluZ1xuXHRcdFx0cGFuZS5zdHlsZS50b3AgPSAoZS5jbGllbnRZIC0gcG9pbnRlclN0YXJ0LnkpICsgJ3B4Jztcblx0XHRcdHBhbmUuc3R5bGUubGVmdCA9IChlLmNsaWVudFggLSBwb2ludGVyU3RhcnQueCkgKyAncHgnO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY2hlY2tTbmFwVHlwZSgpIHtcblx0XHQvLyBkcmFnIHRvIGZ1bGwgc2NyZWVuXG5cdFx0aWYgKGUuY2xpZW50WSA8IEZVTExTQ1JFRU5fTUFSR0lOUykgcmV0dXJuIFNOQVBfRlVMTF9TQ1JFRU47XG5cblx0XHQvLyBkcmFnIGZvciB0b3AgaGFsZiBzY3JlZW5cblx0XHRpZiAoZS5jbGllbnRZIDwgU05BUF9NQVJHSU5TKSByZXR1cm4gU05BUF9UT1BfRURHRTtcblxuXHRcdC8vIGRyYWcgZm9yIGxlZnQgaGFsZiBzY3JlZW5cblx0XHRpZiAoZS5jbGllbnRYIDwgU05BUF9NQVJHSU5TKSByZXR1cm4gU05BUF9MRUZUX0VER0U7XG5cblx0XHQvLyBkcmFnIGZvciByaWdodCBoYWxmIHNjcmVlblxuXHRcdGlmICh3aW5kb3cuaW5uZXJXaWR0aCAtIGUuY2xpZW50WCA8IFNOQVBfTUFSR0lOUykgcmV0dXJuIFNOQVBfUklHSFRfRURHRTtcblxuXHRcdC8vIGRyYWcgZm9yIGJvdHRvbSBoYWxmIHNjcmVlblxuXHRcdGlmICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgPCBTTkFQX01BUkdJTlMpIHJldHVybiBTTkFQX0JPVFRPTV9FREdFO1xuXG5cdH1cblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dmFyIHNuYXBCb3VuZHMgPSB7fVxuXG5cdGZ1bmN0aW9uIGNhbGNTbmFwQm91bmRzKHNuYXBUeXBlKSB7XG5cdFx0aWYgKCFzbmFwVHlwZSkgcmV0dXJuO1xuXG5cdFx0dmFyIHdpZHRoLCBoZWlnaHQsIGxlZnQsIHRvcDtcblxuXHRcdHN3aXRjaCAoc25hcFR5cGUpIHtcblx0XHRjYXNlIFNOQVBfRlVMTF9TQ1JFRU46XG5cdFx0XHR3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuXHRcdFx0aGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuXHRcdFx0bGVmdCA9IDBcblx0XHRcdHRvcCA9IDBcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgU05BUF9UT1BfRURHRTpcblx0XHRcdHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG5cdFx0XHRoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAyO1xuXHRcdFx0bGVmdCA9IDBcblx0XHRcdHRvcCA9IDBcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgU05BUF9MRUZUX0VER0U6XG5cdFx0XHR3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoIC8gMjtcblx0XHRcdGhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcblx0XHRcdGxlZnQgPSAwXG5cdFx0XHR0b3AgPSAwXG5cdFx0XHRicmVhaztcblx0XHRjYXNlIFNOQVBfUklHSFRfRURHRTpcblx0XHRcdHdpZHRoID0gd2luZG93LmlubmVyV2lkdGggLyAyO1xuXHRcdFx0aGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuXHRcdFx0bGVmdCA9IHdpbmRvdy5pbm5lcldpZHRoIC0gd2lkdGhcblx0XHRcdHRvcCA9IDBcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgU05BUF9CT1RUT01fRURHRTpcblx0XHRcdHdpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG5cdFx0XHRoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAzO1xuXHRcdFx0bGVmdCA9IDBcblx0XHRcdHRvcCA9IHdpbmRvdy5pbm5lckhlaWdodCAtIGhlaWdodFxuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSBTTkFQX0RPQ0tfQk9UVE9NOlxuXHRcdFx0d2lkdGggPSBib3VuZHMud2lkdGhcblx0XHRcdGhlaWdodCA9IGJvdW5kcy5oZWlnaHRcblx0XHRcdGxlZnQgPSAod2luZG93LmlubmVyV2lkdGggLSB3aWR0aCkgKiAwLjVcblx0XHRcdHRvcCA9IHdpbmRvdy5pbm5lckhlaWdodCAtIGhlaWdodFxuXHRcdH1cblxuXHRcdE9iamVjdC5hc3NpZ24oc25hcEJvdW5kcywgeyBsZWZ0LCB0b3AsIHdpZHRoLCBoZWlnaHQgfSk7XG5cdH1cblxuXHQvKiBXaGVuIG9uZSBvZiB0aGUgZWRnZXMgaXMgbW92ZSwgcmVzaXplIHBhbmUgKi9cblx0ZnVuY3Rpb24gcmVzaXplRWRnZXMoKSB7XG5cdFx0aWYgKCFzbmFwVHlwZSkgcmV0dXJuO1xuXG5cdFx0Y2FsY1NuYXBCb3VuZHMoc25hcFR5cGUpO1xuXHRcdHZhciB7IGxlZnQsIHRvcCwgd2lkdGgsIGhlaWdodCB9ID0gc25hcEJvdW5kcztcblx0XHRzZXRCb3VuZHMocGFuZSwgbGVmdCwgdG9wLCB3aWR0aCwgaGVpZ2h0KTtcblxuXHRcdHNlbGYucmVzaXplcy5maXJlKHdpZHRoLCBoZWlnaHQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25VcChlKSB7XG5cdFx0Y2FsY3VsYXRlQm91bmRzKGUpO1xuXG5cdFx0aWYgKHBvaW50ZXJTdGFydCAmJiBwb2ludGVyU3RhcnQuaXNNb3ZpbmcpIHtcblx0XHRcdC8vIFNuYXBcblx0XHRcdHNuYXBUeXBlID0gY2hlY2tTbmFwVHlwZSgpO1xuXHRcdFx0aWYgKHNuYXBUeXBlKSB7XG5cdFx0XHRcdHByZVNuYXBwZWQgPSB7XG5cdFx0XHRcdFx0d2lkdGg6IGJvdW5kcy53aWR0aCxcblx0XHRcdFx0XHRoZWlnaHQ6IGJvdW5kcy5oZWlnaHQsXG5cdFx0XHRcdFx0dG9wOiBib3VuZHMudG9wLFxuXHRcdFx0XHRcdGxlZnQ6IGJvdW5kcy5sZWZ0LFxuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc2l6ZUVkZ2VzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwcmVTbmFwcGVkID0gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0aGlkZUdob3N0UGFuZSgpO1xuXHRcdH1cblxuXHRcdHBvaW50ZXJTdGFydCA9IG51bGw7XG5cdH1cblxuXHRmdW5jdGlvbiBpbml0KCkge1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJlc2l6ZUVkZ2VzKCk7XG5cdFx0fSk7XG5cblx0XHRzZXRCb3VuZHMocGFuZSwgMCwgMCwgTGF5b3V0Q29uc3RhbnRzLndpZHRoLCBMYXlvdXRDb25zdGFudHMuaGVpZ2h0KTtcblx0XHRzZXRCb3VuZHMoZ2hvc3RwYW5lLCAwLCAwLCBMYXlvdXRDb25zdGFudHMud2lkdGgsIExheW91dENvbnN0YW50cy5oZWlnaHQpO1xuXG5cdFx0Ly8gTW91c2UgZXZlbnRzXG5cdFx0cGFuZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbk1vdXNlRG93bik7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwKTtcblxuXHRcdC8vIFRvdWNoIGV2ZW50c1xuXHRcdHBhbmUuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hEb3duKTtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCBvblRvdWNoTW92ZSk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcblxuXHRcdGJvdW5kcyA9IHBhbmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0c25hcFR5cGUgPSBTTkFQX0RPQ0tfQk9UVE9NO1xuXG5cdFx0Ly8gdXNlIHNldFRpbWVvdXQgYXMgYSBoYWNrIHRvIGdldCBkaWVtZW5zaW9ucyBjb3JyZWN0bHkhIDooXG5cdFx0c2V0VGltZW91dCgoKSA9PiByZXNpemVFZGdlcygpKTtcblx0XHRoaWRlR2hvc3RQYW5lKCk7XG5cblx0XHRhbmltYXRlKCk7XG5cdH1cblxuXHRpbml0KCk7XG59XG5cblxuZXhwb3J0IHsgRG9ja2luZ1dpbmRvdyB9IiwidmFyIHBhY2thZ2VfanNvbiA9IHsgdmVyc2lvbjogXCJ0ZXN0LXZlcnNpb25cIiB9O1xuXG5pbXBvcnQgeyBMYXlvdXRDb25zdGFudHMgfSBmcm9tICcuLi9sYXlvdXRfY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgRG8gfSBmcm9tICcuL2RvLmpzJ1xuXG4vLyBEYXRhIFN0b3JlIHdpdGggYSBzb3VyY2Ugb2YgdHJ1dGhcbmZ1bmN0aW9uIERhdGFTdG9yZSgpIHtcblx0dGhpcy5ERUxJTUlURVIgPSAnOic7XG5cdHRoaXMuYmxhbmsoKTtcblx0dGhpcy5vbk9wZW4gPSBuZXcgRG8oKTtcblx0dGhpcy5vblNhdmUgPSBuZXcgRG8oKTtcblxuXHR0aGlzLmxpc3RlbmVycyA9IFtdO1xufVxuXG5EYXRhU3RvcmUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24ocGF0aCwgY2IpIHtcblx0dGhpcy5saXN0ZW5lcnMucHVzaCh7XG5cdFx0cGF0aDogcGF0aCxcblx0XHRjYWxsYmFjazogY2Jcblx0fSk7XG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLmJsYW5rID0gZnVuY3Rpb24oKSB7XG5cdHZhciBkYXRhID0ge307XG5cblx0ZGF0YS52ZXJzaW9uID0gcGFja2FnZV9qc29uLnZlcnNpb247XG5cdGRhdGEubW9kaWZpZWQgPSBuZXcgRGF0ZSgpLnRvU3RyaW5nKCk7XG5cdGRhdGEudGl0bGUgPSAnVW50aXRsZWQnO1xuXG5cdGRhdGEudWkgPSB7XG5cdFx0Y3VycmVudFRpbWU6IDAsXG5cdFx0dG90YWxUaW1lOiBMYXlvdXRDb25zdGFudHMuZGVmYXVsdF9sZW5ndGgsXG5cdFx0c2Nyb2xsVGltZTogMCxcblx0XHR0aW1lU2NhbGU6IExheW91dENvbnN0YW50cy50aW1lX3NjYWxlXG5cdH07XG5cblx0ZGF0YS5sYXllcnMgPSBbXTtcblxuXHR0aGlzLmRhdGEgPSBkYXRhO1xufTtcblxuRGF0YVN0b3JlLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcblx0dmFyIGRhdGEgPSB0aGlzLmRhdGE7XG5cblx0ZGF0YS52ZXJzaW9uID0gcGFja2FnZV9qc29uLnZlcnNpb247XG5cdGRhdGEubW9kaWZpZWQgPSBuZXcgRGF0ZSgpLnRvU3RyaW5nKCk7XG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLnNldEpTT05TdHJpbmcgPSBmdW5jdGlvbihkYXRhKSB7XG5cdHRoaXMuZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLnNldEpTT04gPSBmdW5jdGlvbihkYXRhKSB7XG5cdHRoaXMuZGF0YSA9IGRhdGE7XG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLmdldEpTT05TdHJpbmcgPSBmdW5jdGlvbihmb3JtYXQpIHtcblx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSwgbnVsbCwgZm9ybWF0KTtcbn07XG5cbkRhdGFTdG9yZS5wcm90b3R5cGUuZ2V0VmFsdWUgPSBmdW5jdGlvbihwYXRocykge1xuXHR2YXIgZGVzY2VuZCA9IHBhdGhzLnNwbGl0KHRoaXMuREVMSU1JVEVSKTtcblx0dmFyIHJlZmVyZW5jZSA9IHRoaXMuZGF0YTtcblx0Zm9yICh2YXIgaSA9IDAsIGlsID0gZGVzY2VuZC5sZW5ndGg7IGkgPCBpbDsgaSsrKSB7XG5cdFx0dmFyIHBhdGggPSBkZXNjZW5kW2ldO1xuXHRcdGlmIChyZWZlcmVuY2VbcGF0aF0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdDYW50IGZpbmQgJyArIHBhdGhzKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVmZXJlbmNlID0gcmVmZXJlbmNlW3BhdGhdO1xuXHR9XG5cdHJldHVybiByZWZlcmVuY2U7XG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24ocGF0aHMsIHZhbHVlKSB7XG5cdHZhciBkZXNjZW5kID0gcGF0aHMuc3BsaXQodGhpcy5ERUxJTUlURVIpO1xuXHR2YXIgcmVmZXJlbmNlID0gdGhpcy5kYXRhO1xuXHR2YXIgcGF0aDtcblx0Zm9yICh2YXIgaSA9IDAsIGlsID0gZGVzY2VuZC5sZW5ndGggLSAxOyBwYXRoID0gZGVzY2VuZFtpXSwgaSA8IGlsIDsgaSsrKSB7XG5cdFx0cmVmZXJlbmNlID0gcmVmZXJlbmNlW3BhdGhdO1xuXHR9XG5cblx0cmVmZXJlbmNlW3BhdGhdID0gdmFsdWU7XG5cblx0dGhpcy5saXN0ZW5lcnMuZm9yRWFjaChmdW5jdGlvbihsKSB7XG5cdFx0aWYgKHBhdGhzLmluZGV4T2YobC5wYXRoKSA+IC0xKSBsLmNhbGxiYWNrKCk7XG5cdH0pXG59O1xuXG5EYXRhU3RvcmUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKHBhdGgsIHN1ZmZpeCkge1xuXHRpZiAoc3VmZml4KSBwYXRoID0gc3VmZml4ICsgdGhpcy5ERUxJTUlURVIgKyBwYXRoO1xuXHRyZXR1cm4gbmV3IERhdGFQcm94KHRoaXMsIHBhdGgpO1xufTtcblxuZnVuY3Rpb24gRGF0YVByb3goc3RvcmUsIHBhdGgpIHtcblx0dGhpcy5wYXRoID0gcGF0aDtcblx0dGhpcy5zdG9yZSA9IHN0b3JlO1xufVxuXG5EYXRhUHJveC5wcm90b3R5cGUgPSB7XG5cdGdldCB2YWx1ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yZS5nZXRWYWx1ZSh0aGlzLnBhdGgpO1xuXHR9LFxuXHRzZXQgdmFsdWUodmFsKSB7XG5cdFx0dGhpcy5zdG9yZS5zZXRWYWx1ZSh0aGlzLnBhdGgsIHZhbCk7XG5cdH1cbn07XG5cbkRhdGFQcm94LnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihwYXRoKSB7XG5cdHJldHVybiB0aGlzLnN0b3JlLmdldChwYXRoLCB0aGlzLnBhdGgpO1xufTtcblxuZXhwb3J0IHsgRGF0YVN0b3JlIH1cbiIsIi8qKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8vIERpc3BhdGNoZXJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gRGlzcGF0Y2hlcigpIHtcblxuXHR2YXIgZXZlbnRfbGlzdGVuZXJzID0ge1xuXG5cdH07XG5cblx0ZnVuY3Rpb24gb24odHlwZSwgbGlzdGVuZXIpIHtcblx0XHRpZiAoISh0eXBlIGluIGV2ZW50X2xpc3RlbmVycykpIHtcblx0XHRcdGV2ZW50X2xpc3RlbmVyc1t0eXBlXSA9IFtdO1xuXHRcdH1cblx0XHR2YXIgbGlzdGVuZXJzID0gZXZlbnRfbGlzdGVuZXJzW3R5cGVdO1xuXHRcdGxpc3RlbmVycy5wdXNoKGxpc3RlbmVyKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZpcmUodHlwZSkge1xuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblx0XHRhcmdzLnNoaWZ0KCk7XG5cdFx0dmFyIGxpc3RlbmVycyA9IGV2ZW50X2xpc3RlbmVyc1t0eXBlXTtcblx0XHRpZiAoIWxpc3RlbmVycykgcmV0dXJuO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgbGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XG5cdFx0XHRsaXN0ZW5lci5hcHBseShsaXN0ZW5lciwgYXJncyk7XG5cdFx0fVxuXHR9XG5cblx0dGhpcy5vbiA9IG9uO1xuXHR0aGlzLmZpcmUgPSBmaXJlO1xuXG59XG5cbmV4cG9ydCB7IERpc3BhdGNoZXIgfSIsImZ1bmN0aW9uIGhhbmRsZURyYWcoZWxlbWVudCwgb25kb3duLCBvbm1vdmUsIG9udXAsIGRvd25fY3JpdGVyaWEpIHtcblx0dmFyIHBvaW50ZXIgPSBudWxsO1xuXHR2YXIgYm91bmRzID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG9uTW91c2VEb3duKTtcblxuXHRmdW5jdGlvbiBvbk1vdXNlRG93bihlKSB7XG5cdFx0aGFuZGxlU3RhcnQoZSk7XG5cblx0XHRpZiAoZG93bl9jcml0ZXJpYSAmJiAhZG93bl9jcml0ZXJpYShwb2ludGVyKSkge1xuXHRcdFx0cG9pbnRlciA9IG51bGw7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdXNlTW92ZSk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VVcCk7XG5cblx0XHRvbmRvd24ocG9pbnRlcik7XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdH1cblxuXHRmdW5jdGlvbiBvbk1vdXNlTW92ZShlKSB7XG5cdFx0aGFuZGxlTW92ZShlKTtcblx0XHRvbm1vdmUocG9pbnRlcik7XG5cdH1cblxuXHRmdW5jdGlvbiBoYW5kbGVTdGFydChlKSB7XG5cdFx0Ym91bmRzID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR2YXIgY3VycmVudHggPSBlLmNsaWVudFgsIGN1cnJlbnR5ID0gZS5jbGllbnRZO1xuXHRcdHBvaW50ZXIgPSB7XG5cdFx0XHRzdGFydHg6IGN1cnJlbnR4LFxuXHRcdFx0c3RhcnR5OiBjdXJyZW50eSxcblx0XHRcdHg6IGN1cnJlbnR4LFxuXHRcdFx0eTogY3VycmVudHksXG5cdFx0XHRkeDogMCxcblx0XHRcdGR5OiAwLFxuXHRcdFx0b2Zmc2V0eDogY3VycmVudHggLSBib3VuZHMubGVmdCxcblx0XHRcdG9mZnNldHk6IGN1cnJlbnR5IC0gYm91bmRzLnRvcCxcblx0XHRcdG1vdmVkOiBmYWxzZVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBoYW5kbGVNb3ZlKGUpIHtcblx0XHRib3VuZHMgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHZhciBjdXJyZW50eCA9IGUuY2xpZW50WCxcblx0XHRcdGN1cnJlbnR5ID0gZS5jbGllbnRZLFxuXHRcdFx0b2Zmc2V0eCA9IGN1cnJlbnR4IC0gYm91bmRzLmxlZnQsXG5cdFx0XHRvZmZzZXR5ID0gY3VycmVudHkgLSBib3VuZHMudG9wO1xuXHRcdHBvaW50ZXIueCA9IGN1cnJlbnR4O1xuXHRcdHBvaW50ZXIueSA9IGN1cnJlbnR5O1xuXHRcdHBvaW50ZXIuZHggPSBlLmNsaWVudFggLSBwb2ludGVyLnN0YXJ0eDtcblx0XHRwb2ludGVyLmR5ID0gZS5jbGllbnRZIC0gcG9pbnRlci5zdGFydHk7XG5cdFx0cG9pbnRlci5vZmZzZXR4ID0gb2Zmc2V0eDtcblx0XHRwb2ludGVyLm9mZnNldHkgPSBvZmZzZXR5O1xuXG5cdFx0Ly8gSWYgdGhlIHBvaW50ZXIgZHgvZHkgaXMgX2V2ZXJfIG5vbi16ZXJvLCB0aGVuIGl0J3MgbW92ZWRcblx0XHRwb2ludGVyLm1vdmVkID0gcG9pbnRlci5tb3ZlZCB8fCBwb2ludGVyLmR4ICE9PSAwIHx8IHBvaW50ZXIuZHkgIT09IDA7XG5cdH1cblxuXHRmdW5jdGlvbiBvbk1vdXNlVXAoZSkge1xuXHRcdGhhbmRsZU1vdmUoZSk7XG5cdFx0b251cChwb2ludGVyKTtcblx0XHRwb2ludGVyID0gbnVsbDtcblxuXHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlKTtcblx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25Nb3VzZVVwKTtcblx0fVxuXG5cdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uVG91Y2hTdGFydCk7XG5cblx0ZnVuY3Rpb24gb25Ub3VjaFN0YXJ0KHRlKSB7XG5cblx0XHRpZiAodGUudG91Y2hlcy5sZW5ndGggPT0gMSkge1xuXG5cdFx0XHR2YXIgZSA9IHRlLnRvdWNoZXNbMF07XG5cdFx0XHRpZiAoZG93bl9jcml0ZXJpYSAmJiAhZG93bl9jcml0ZXJpYShlKSkgcmV0dXJuO1xuXHRcdFx0dGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGhhbmRsZVN0YXJ0KGUpO1xuXHRcdFx0b25kb3duKHBvaW50ZXIpO1xuXHRcdH1cblxuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUpO1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9uVG91Y2hNb3ZlKHRlKSB7XG5cdFx0dmFyIGUgPSB0ZS50b3VjaGVzWzBdO1xuXHRcdG9uTW91c2VNb3ZlKGUpO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25Ub3VjaEVuZChlKSB7XG5cdFx0Ly8gdmFyIGUgPSBlLnRvdWNoZXNbMF07XG5cdFx0b25Nb3VzZVVwKGUpO1xuXHRcdGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgb25Ub3VjaE1vdmUpO1xuXHRcdGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCBvblRvdWNoRW5kKTtcblx0fVxuXG5cblx0Ly8gdGhpcy5yZWxlYXNlID0gZnVuY3Rpb24oKSB7XG5cdC8vIFx0ZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbk1vdXNlRG93bik7XG5cdC8vIFx0ZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0Jywgb25Ub3VjaFN0YXJ0KTtcblx0Ly8gfTtcbn1cblxuZXhwb3J0IHsgaGFuZGxlRHJhZyB9XG4iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vLyBUd2VlbnNcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxudmFyIFR3ZWVucyA9IHtcblx0bm9uZTogZnVuY3Rpb24oaykge1xuXHRcdHJldHVybiAwO1xuXHR9LFxuXHRsaW5lYXI6IGZ1bmN0aW9uKGspIHtcblx0XHRyZXR1cm4gaztcblx0fSxcblx0cXVhZEVhc2VJbjogZnVuY3Rpb24oaykge1xuXHRcdHJldHVybiBrICogaztcblx0fSxcblx0cXVhZEVhc2VPdXQ6IGZ1bmN0aW9uKGspIHtcblx0XHRyZXR1cm4gLSBrICogKCBrIC0gMiApO1xuXHR9LFxuXHRxdWFkRWFzZUluT3V0OiBmdW5jdGlvbihrKSB7XG5cdFx0aWYgKCAoIGsgKj0gMiApIDwgMSApIHJldHVybiAwLjUgKiBrICogaztcblx0XHRyZXR1cm4gLSAwLjUgKiAoIC0tayAqICggayAtIDIgKSAtIDEgKTtcblx0fVxufTtcblxuZXhwb3J0IHsgVHdlZW5zIH0iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vLyBVbmRvIE1hbmFnZXJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gVW5kb1N0YXRlKHN0YXRlLCBkZXNjcmlwdGlvbikge1xuXHQvLyB0aGlzLnN0YXRlID0gSlNPTi5zdHJpbmdpZnkoc3RhdGUpO1xuXHR0aGlzLnN0YXRlID0gc3RhdGUuZ2V0SlNPTlN0cmluZygpO1xuXHR0aGlzLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG59XG5cbmZ1bmN0aW9uIFVuZG9NYW5hZ2VyKGRpc3BhdGNoZXIsIG1heCkge1xuXHR0aGlzLmRpc3BhdGNoZXIgPSBkaXNwYXRjaGVyO1xuXHR0aGlzLk1BWF9JVEVNUyA9IG1heCB8fCAxMDA7XG5cdHRoaXMuY2xlYXIoKTtcbn1cblxuVW5kb01hbmFnZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbihzdGF0ZSwgc3VwcHJlc3MpIHtcblx0dmFyIHN0YXRlcyA9IHRoaXMuc3RhdGVzO1xuXHR2YXIgbmV4dF9pbmRleCA9IHRoaXMuaW5kZXggKyAxO1xuXHR2YXIgdG9fcmVtb3ZlID0gc3RhdGVzLmxlbmd0aCAtIG5leHRfaW5kZXg7XG5cdHN0YXRlcy5zcGxpY2UobmV4dF9pbmRleCwgdG9fcmVtb3ZlLCBzdGF0ZSk7XG5cblx0aWYgKHN0YXRlcy5sZW5ndGggPiB0aGlzLk1BWF9JVEVNUykge1xuXHRcdHN0YXRlcy5zaGlmdCgpO1xuXHR9XG5cblx0dGhpcy5pbmRleCA9IHN0YXRlcy5sZW5ndGggLSAxO1xuXG5cdC8vIGNvbnNvbGUubG9nKCdVbmRvIFN0YXRlIFNhdmVkOiAnLCBzdGF0ZS5kZXNjcmlwdGlvbik7XG5cdGlmICghc3VwcHJlc3MpIHRoaXMuZGlzcGF0Y2hlci5maXJlKCdzdGF0ZTpzYXZlJywgc3RhdGUuZGVzY3JpcHRpb24pO1xufTtcblxuVW5kb01hbmFnZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMuc3RhdGVzID0gW107XG5cdHRoaXMuaW5kZXggPSAtMTtcblx0Ly8gRklYTUU6IGxlYXZlIGRlZmF1bHQgc3RhdGUgb3IgYWx3YXlzIGxlYXZlIG9uZSBzdGF0ZT9cbn07XG5cblVuZG9NYW5hZ2VyLnByb3RvdHlwZS5jYW5VbmRvID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmluZGV4ID4gMDtcblx0Ly8gJiYgdGhpcy5zdGF0ZXMubGVuZ3RoID4gMVxufTtcblxuVW5kb01hbmFnZXIucHJvdG90eXBlLmNhblJlZG8gPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuaW5kZXggPCB0aGlzLnN0YXRlcy5sZW5ndGggLSAxO1xufTtcblxuVW5kb01hbmFnZXIucHJvdG90eXBlLnVuZG8gPSBmdW5jdGlvbigpIHtcblx0aWYgKHRoaXMuY2FuVW5kbygpKSB7XG5cdFx0dGhpcy5kaXNwYXRjaGVyLmZpcmUoJ3N0YXR1cycsICdVbmRvOiAnICsgdGhpcy5nZXQoKS5kZXNjcmlwdGlvbik7XG5cdFx0dGhpcy5pbmRleC0tO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuZGlzcGF0Y2hlci5maXJlKCdzdGF0dXMnLCAnTm90aGluZyB0byB1bmRvJyk7XG5cdH1cblxuXHRyZXR1cm4gdGhpcy5nZXQoKTtcbn07XG5cblVuZG9NYW5hZ2VyLnByb3RvdHlwZS5yZWRvID0gZnVuY3Rpb24oKSB7XG5cdGlmICh0aGlzLmNhblJlZG8oKSkge1xuXHRcdHRoaXMuaW5kZXgrKztcblx0XHR0aGlzLmRpc3BhdGNoZXIuZmlyZSgnc3RhdHVzJywgJ1JlZG86ICcgKyB0aGlzLmdldCgpLmRlc2NyaXB0aW9uKTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLmRpc3BhdGNoZXIuZmlyZSgnc3RhdHVzJywgJ05vdGhpbmcgdG8gcmVkbycpO1xuXHR9XG5cblx0cmV0dXJuIHRoaXMuZ2V0KCk7XG59O1xuXG5VbmRvTWFuYWdlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnN0YXRlc1t0aGlzLmluZGV4XTtcbn07XG5cbmV4cG9ydCB7IFVuZG9TdGF0ZSwgVW5kb01hbmFnZXIgfTsiLCJpbXBvcnQgeyBUd2VlbnMgfSBmcm9tICcuL3V0aWxfdHdlZW4uanMnXG5cbnZhciBTVE9SQUdFX1BSRUZJWCA9ICd0aW1lbGluZXItJ1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vLyBVdGlsc1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBmaXJzdERlZmluZWQoKSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKHR5cGVvZiBhcmd1bWVudHNbaV0gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gYXJndW1lbnRzW2ldO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBzdHlsZShlbGVtZW50LCAuLi5zdHlsZXMpIHtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzdHlsZXMubGVuZ3RoOyArK2kpIHtcblx0XHR2YXIgc3R5bGUgPSBzdHlsZXNbaV07XG5cdFx0Zm9yICh2YXIgcyBpbiBzdHlsZSkge1xuXHRcdFx0ZWxlbWVudC5zdHlsZVtzXSA9IHN0eWxlW3NdO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBzYXZlVG9GaWxlKHN0cmluZywgZmlsZW5hbWUpIHtcblx0dmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcblx0YS5zdHlsZSA9IFwiZGlzcGxheTogbm9uZVwiO1xuXG5cdHZhciBibG9iID0gbmV3IEJsb2IoW3N0cmluZ10sIHsgdHlwZTogJ29jdGV0L3N0cmVhbScgfSksIC8vIGFwcGxpY2F0aW9uL2pzb25cblx0XHR1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblxuXHRhLmhyZWYgPSB1cmw7XG5cdGEuZG93bmxvYWQgPSBmaWxlbmFtZTtcblxuXHRmYWtlQ2xpY2soYSk7XG5cblx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHQvLyBjbGVhbnVwIGFuZCByZXZva2Vcblx0XHR3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuXHRcdGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYSk7XG5cdH0sIDUwMCk7XG59XG5cblxuXG52YXIgaW5wdXQsIG9wZW5DYWxsYmFjaztcblxuZnVuY3Rpb24gaGFuZGxlRmlsZVNlbGVjdChldnQpIHtcblx0dmFyIGZpbGVzID0gZXZ0LnRhcmdldC5maWxlczsgLy8gRmlsZUxpc3Qgb2JqZWN0XG5cblx0Y29uc29sZS5sb2coJ2hhbmRsZSBmaWxlIHNlbGVjdCcsIGZpbGVzLmxlbmd0aCk7XG5cblx0dmFyIGYgPSBmaWxlc1swXTtcblx0aWYgKCFmKSByZXR1cm47XG5cdC8vIENhbiB0cnkgdG8gZG8gTUlORSBtYXRjaFxuXHQvLyBpZiAoIWYudHlwZS5tYXRjaCgnYXBwbGljYXRpb24vanNvbicpKSB7XG5cdC8vICAgcmV0dXJuO1xuXHQvLyB9XG5cdGNvbnNvbGUubG9nKCdtYXRjaCcsIGYudHlwZSk7XG5cblx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0Ly8gQ2xvc3VyZSB0byBjYXB0dXJlIHRoZSBmaWxlIGluZm9ybWF0aW9uLlxuXHRyZWFkZXIub25sb2FkID0gZnVuY3Rpb24oZSkge1xuXHRcdHZhciBkYXRhID0gZS50YXJnZXQucmVzdWx0O1xuXHRcdG9wZW5DYWxsYmFjayhkYXRhKTtcblx0fTtcblxuXHRyZWFkZXIucmVhZEFzVGV4dChmKTtcblxuXHRpbnB1dC52YWx1ZSA9ICcnO1xufVxuXG5cbmZ1bmN0aW9uIG9wZW5BcyhjYWxsYmFjaywgdGFyZ2V0KSB7XG5cdGNvbnNvbGUubG9nKCdvcGVuZmlsZS4uLicpO1xuXHRvcGVuQ2FsbGJhY2sgPSBjYWxsYmFjaztcblxuXHRpZiAoIWlucHV0KSB7XG5cdFx0aW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuXHRcdGlucHV0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0aW5wdXQudHlwZSA9ICdmaWxlJztcblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBoYW5kbGVGaWxlU2VsZWN0KTtcblx0XHR0YXJnZXQgPSB0YXJnZXQgfHwgZG9jdW1lbnQuYm9keTtcblx0XHR0YXJnZXQuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuXHR9XG5cblx0ZmFrZUNsaWNrKGlucHV0KTtcbn1cblxuZnVuY3Rpb24gZmFrZUNsaWNrKHRhcmdldCkge1xuXHR2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KFwiTW91c2VFdmVudHNcIik7XG5cdGUuaW5pdE1vdXNlRXZlbnQoXG5cdFx0J2NsaWNrJywgdHJ1ZSwgZmFsc2UsIHdpbmRvdywgMCwgMCwgMCwgMCwgMCxcblx0XHRmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgMCwgbnVsbFxuXHQpO1xuXHR0YXJnZXQuZGlzcGF0Y2hFdmVudChlKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0X2ZyaWVuZGx5X3NlY29uZHMocywgdHlwZSkge1xuXHQvLyBUT0RPIFJlZmFjdG9yIHRvIDYwZnBzPz8/XG5cdC8vIDIwIG1pbnMgKiA2MCBzZWMgPSAxMDgwXG5cdC8vIDEwODBzICogNjBmcHMgPSAxMDgwICogNjAgPCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUlxuXG5cdHZhciByYXdfc2VjcyA9IHMgfCAwO1xuXHR2YXIgc2Vjc19taWNybyA9IHMgJSA2MDtcblx0dmFyIHNlY3MgPSByYXdfc2VjcyAlIDYwO1xuXHR2YXIgcmF3X21pbnMgPSByYXdfc2VjcyAvIDYwIHwgMDtcblx0dmFyIG1pbnMgPSByYXdfbWlucyAlIDYwO1xuXHR2YXIgaG91cnMgPSByYXdfbWlucyAvIDYwIHwgMDtcblxuXHR2YXIgc2Vjc19zdHIgPSAoc2VjcyAvIDEwMCkudG9GaXhlZCgyKS5zdWJzdHJpbmcoMik7XG5cblx0dmFyIHN0ciA9IG1pbnMgKyAnOicgKyBzZWNzX3N0cjtcblxuXHRpZiAocyAlIDEgPiAwKSB7XG5cdFx0dmFyIHQyID0gKHMgJSAxKSAqIDYwO1xuXHRcdGlmICh0eXBlID09PSAnZnJhbWVzJykgc3RyID0gc2VjcyArICcrJyArIHQyLnRvRml4ZWQoMCkgKyAnZic7XG5cdFx0ZWxzZSBzdHIgKz0gKChzICUgMSkudG9GaXhlZCgyKSkuc3Vic3RyaW5nKDEpO1xuXHRcdC8vIGVsc2Ugc3RyID0gbWlucyArICc6JyArIHNlY3NfbWljcm87XG5cdFx0Ly8gZWxzZSBzdHIgPSBzZWNzX21pY3JvICsgJ3MnOyAvLy8gLnRvRml4ZWQoMilcblx0fVxuXHRyZXR1cm4gc3RyO1xufVxuXG4vLyBnZXQgb2JqZWN0IGF0IHRpbWVcbmZ1bmN0aW9uIGZpbmRUaW1laW5MYXllcihsYXllciwgdGltZSkge1xuXHR2YXIgdmFsdWVzID0gbGF5ZXIudmFsdWVzO1xuXHR2YXIgaSwgaWw7XG5cblx0Ly8gVE9ETyBvcHRpbWl6ZSBieSBjaGVja2luZyB0aW1lIC8gYmluYXJ5IHNlYXJjaFxuXG5cdGZvciAoaT0wLCBpbD12YWx1ZXMubGVuZ3RoOyBpPGlsOyBpKyspIHtcblx0XHR2YXIgdmFsdWUgPSB2YWx1ZXNbaV07XG5cdFx0aWYgKHZhbHVlLnRpbWUgPT09IHRpbWUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluZGV4OiBpLFxuXHRcdFx0XHRvYmplY3Q6IHZhbHVlXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSBpZiAodmFsdWUudGltZSA+IHRpbWUpIHtcblx0XHRcdHJldHVybiBpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBpO1xufVxuXG5cbmZ1bmN0aW9uIHRpbWVBdExheWVyKGxheWVyLCB0KSB7XG5cdC8vIEZpbmQgdGhlIHZhbHVlIG9mIGxheWVyIGF0IHQgc2Vjb25kcy5cblx0Ly8gdGhpcyBleHBlY3QgbGF5ZXIgdG8gYmUgc29ydGVkXG5cdC8vIG5vdCB0aGUgbW9zdCBvcHRpbWl6ZWQgZm9yIG5vdywgYnV0IHdvdWxkIGRvLlxuXG5cdHZhciB2YWx1ZXMgPSBsYXllci52YWx1ZXM7XG5cdHZhciBpLCBpbCwgZW50cnksIHByZXZfZW50cnk7XG5cblx0aWwgPSB2YWx1ZXMubGVuZ3RoO1xuXG5cdC8vIGNhbid0IGRvIGFueXRoaW5nXG5cdGlmIChpbCA9PT0gMCkgcmV0dXJuO1xuXG5cdGlmIChsYXllci5fbXV0ZSkgcmV0dXJuXG5cblx0Ly8gZmluZCBib3VuZGFyeSBjYXNlc1xuXHRlbnRyeSA9IHZhbHVlc1swXTtcblx0aWYgKHQgPCBlbnRyeS50aW1lKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHZhbHVlOiBlbnRyeS52YWx1ZSxcblx0XHRcdGNhbl90d2VlbjogZmFsc2UsIC8vIGNhbm5vdCB0d2VlblxuXHRcdFx0a2V5ZnJhbWU6IGZhbHNlIC8vIG5vdCBvbiBrZXlmcmFtZVxuXHRcdH07XG5cdH1cblxuXHRmb3IgKGk9MDsgaTxpbDsgaSsrKSB7XG5cdFx0cHJldl9lbnRyeSA9IGVudHJ5O1xuXHRcdGVudHJ5ID0gdmFsdWVzW2ldO1xuXG5cdFx0aWYgKHQgPT09IGVudHJ5LnRpbWUpIHtcblx0XHRcdC8vIG9ubHkgZXhjZXB0aW9uIGlzIG9uIHRoZSBsYXN0IEtGLCB3aGVyZSB3ZSBkaXNwbGF5IHR3ZWVuIGZyb20gcHJldiBlbnRyeVxuXHRcdFx0aWYgKGkgPT09IGlsIC0gMSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdC8vIGluZGV4OiBpLFxuXHRcdFx0XHRcdGVudHJ5OiBwcmV2X2VudHJ5LFxuXHRcdFx0XHRcdHR3ZWVuOiBwcmV2X2VudHJ5LnR3ZWVuLFxuXHRcdFx0XHRcdGNhbl90d2VlbjogaWwgPiAxLFxuXHRcdFx0XHRcdHZhbHVlOiBlbnRyeS52YWx1ZSxcblx0XHRcdFx0XHRrZXlmcmFtZTogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Ly8gaW5kZXg6IGksXG5cdFx0XHRcdGVudHJ5OiBlbnRyeSxcblx0XHRcdFx0dHdlZW46IGVudHJ5LnR3ZWVuLFxuXHRcdFx0XHRjYW5fdHdlZW46IGlsID4gMSxcblx0XHRcdFx0dmFsdWU6IGVudHJ5LnZhbHVlLFxuXHRcdFx0XHRrZXlmcmFtZTogdHJ1ZSAvLyBpbCA+IDFcblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmICh0IDwgZW50cnkudGltZSkge1xuXHRcdFx0Ly8gcG9zc2libHkgYSB0d2VlblxuXHRcdFx0aWYgKCFwcmV2X2VudHJ5LnR3ZWVuKSB7IC8vIG9yIGlmIHZhbHVlIGlzIG5vbmVcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR2YWx1ZTogcHJldl9lbnRyeS52YWx1ZSxcblx0XHRcdFx0XHR0d2VlbjogZmFsc2UsXG5cdFx0XHRcdFx0ZW50cnk6IHByZXZfZW50cnksXG5cdFx0XHRcdFx0Y2FuX3R3ZWVuOiB0cnVlLFxuXHRcdFx0XHRcdGtleWZyYW1lOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBjYWxjdWxhdGUgdHdlZW5cblx0XHRcdHZhciB0aW1lX2RpZmYgPSBlbnRyeS50aW1lIC0gcHJldl9lbnRyeS50aW1lO1xuXHRcdFx0dmFyIHZhbHVlX2RpZmYgPSBlbnRyeS52YWx1ZSAtIHByZXZfZW50cnkudmFsdWU7XG5cdFx0XHR2YXIgdHdlZW4gPSBwcmV2X2VudHJ5LnR3ZWVuO1xuXG5cdFx0XHR2YXIgZHQgPSB0IC0gcHJldl9lbnRyeS50aW1lO1xuXHRcdFx0dmFyIGsgPSBkdCAvIHRpbWVfZGlmZjtcblx0XHRcdHZhciBuZXdfdmFsdWUgPSBwcmV2X2VudHJ5LnZhbHVlICsgVHdlZW5zW3R3ZWVuXShrKSAqIHZhbHVlX2RpZmY7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGVudHJ5OiBwcmV2X2VudHJ5LFxuXHRcdFx0XHR2YWx1ZTogbmV3X3ZhbHVlLFxuXHRcdFx0XHR0d2VlbjogcHJldl9lbnRyeS50d2Vlbixcblx0XHRcdFx0Y2FuX3R3ZWVuOiB0cnVlLFxuXHRcdFx0XHRrZXlmcmFtZTogZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cdC8vIHRpbWUgaXMgYWZ0ZXIgYWxsIGVudHJpZXNcblx0cmV0dXJuIHtcblx0XHR2YWx1ZTogZW50cnkudmFsdWUsXG5cdFx0Y2FuX3R3ZWVuOiBmYWxzZSxcblx0XHRrZXlmcmFtZTogZmFsc2Vcblx0fTtcblxufVxuXG5cbmZ1bmN0aW9uIHByb3h5X2N0eChjdHgpIHtcblx0Ly8gQ3JlYXRlcyBhIHByb3h5IDJkIGNvbnRleHQgd3JhcHBlciB3aGljaFxuXHQvLyBhbGxvd3MgdGhlIGZsdWVudCAvIGNoYWluaW5nIEFQSS5cblx0dmFyIHdyYXBwZXIgPSB7fTtcblxuXHRmdW5jdGlvbiBwcm94eV9mdW5jdGlvbihjKSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly8gV2FybmluZzogdGhpcyBkb2Vzbid0IHJldHVybiB2YWx1ZSBvZiBmdW5jdGlvbiBjYWxsXG5cdFx0XHRjdHhbY10uYXBwbHkoY3R4LCBhcmd1bWVudHMpO1xuXHRcdFx0cmV0dXJuIHdyYXBwZXI7XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHByb3h5X3Byb3BlcnR5KGMpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24odikge1xuXHRcdFx0Y3R4W2NdID0gdjtcblx0XHRcdHJldHVybiB3cmFwcGVyO1xuXHRcdH07XG5cdH1cblxuXHR3cmFwcGVyLnJ1biA9IGZ1bmN0aW9uKGFyZ3MpIHtcblx0XHRhcmdzKHdyYXBwZXIpO1xuXHRcdHJldHVybiB3cmFwcGVyO1xuXHR9O1xuXG5cdGZvciAodmFyIGMgaW4gY3R4KSB7XG5cdFx0Ly8gaWYgKCFjdHguaGFzT3duUHJvcGVydHkoYykpIGNvbnRpbnVlO1xuXHRcdC8vIGNvbnNvbGUubG9nKGMsIHR5cGVvZihjdHhbY10pLCBjdHguaGFzT3duUHJvcGVydHkoYykpO1xuXHRcdC8vIHN0cmluZywgbnVtYmVyLCBib29sZWFuLCBmdW5jdGlvbiwgb2JqZWN0XG5cblx0XHR2YXIgdHlwZSA9IHR5cGVvZihjdHhbY10pO1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdGNhc2UgJ29iamVjdCc6XG5cdFx0XHRicmVhaztcblx0XHRjYXNlICdmdW5jdGlvbic6XG5cdFx0XHR3cmFwcGVyW2NdID0gcHJveHlfZnVuY3Rpb24oYyk7XG5cdFx0XHRicmVhaztcblx0XHRkZWZhdWx0OlxuXHRcdFx0d3JhcHBlcltjXSA9IHByb3h5X3Byb3BlcnR5KGMpO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHdyYXBwZXI7XG59XG5cbnZhciB1dGlscyA9IHtcblx0U1RPUkFHRV9QUkVGSVgsXG5cdGZpcnN0RGVmaW5lZCxcblx0c3R5bGUsXG5cdHNhdmVUb0ZpbGUsXG5cdG9wZW5Bcyxcblx0Zm9ybWF0X2ZyaWVuZGx5X3NlY29uZHMsXG5cdGZpbmRUaW1laW5MYXllcixcblx0dGltZUF0TGF5ZXIsXG5cdHByb3h5X2N0eFxufTtcblxuZXhwb3J0IHsgdXRpbHMgfSIsImltcG9ydCB7IExheW91dENvbnN0YW50cyB9IGZyb20gJy4uL2xheW91dF9jb25zdGFudHMuanMnXG5pbXBvcnQgeyBMYXllclZpZXcgfSBmcm9tICcuL3ZpZXdfbGF5ZXIuanMnXG5pbXBvcnQgeyBJY29uQnV0dG9uIH0gZnJvbSAnLi4vdWkvaWNvbl9idXR0b24uanMnXG5pbXBvcnQgeyB1dGlscyB9IGZyb20gJy4uL3V0aWxzL3V0aWxzLmpzJ1xuaW1wb3J0IHsgVGhlbWUgfSBmcm9tICcuLi90aGVtZS5qcydcbmltcG9ydCB7IFVJTnVtYmVyIH0gZnJvbSAnLi4vdWkvdWlfbnVtYmVyLmpzJ1xuXG5cbmNvbnN0IHsgU1RPUkFHRV9QUkVGSVgsIHN0eWxlIH0gPSB1dGlsc1xuXG5mdW5jdGlvbiBMYXllckNhYmluZXQoZGF0YSwgZGlzcGF0Y2hlcikge1xuXHR2YXIgbGF5ZXJfc3RvcmUgPSBkYXRhLmdldCgnbGF5ZXJzJyk7XG5cblx0dmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdHZhciB0b3AgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0dG9wLnN0eWxlLmNzc1RleHQgPSAnbWFyZ2luOiAwcHg7IHRvcDogMDsgbGVmdDogMDsgaGVpZ2h0OiAnICsgTGF5b3V0Q29uc3RhbnRzLk1BUktFUl9UUkFDS19IRUlHSFQgKyAncHgnO1xuXHQvLyB0b3Auc3R5bGUudGV4dEFsaWduID0gJ3JpZ2h0JztcblxuXHR2YXIgbGF5ZXJfc2Nyb2xsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdHN0eWxlKGxheWVyX3Njcm9sbCwge1xuXHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdHRvcDogTGF5b3V0Q29uc3RhbnRzLk1BUktFUl9UUkFDS19IRUlHSFQgKyAncHgnLFxuXHRcdC8vIGhlaWdodDogKExheW91dENvbnN0YW50cy5oZWlnaHQgLSBMYXlvdXRDb25zdGFudHMuTUFSS0VSX1RSQUNLX0hFSUdIVCkgKyAncHgnXG5cdFx0bGVmdDogMCxcblx0XHRyaWdodDogMCxcblx0XHRib3R0b206IDAsXG5cdFx0b3ZlcmZsb3c6ICdoaWRkZW4nXG5cdH0pO1xuXG5cdGxheWVyX3Njcm9sbC5pZCA9ICdsYXllcl9zY3JvbGwnXG5cblx0ZGl2LmFwcGVuZENoaWxkKGxheWVyX3Njcm9sbCk7XG5cblx0dmFyIHBsYXlpbmcgPSBmYWxzZTtcblxuXG5cdHZhciBidXR0b25fc3R5bGVzID0ge1xuXHRcdHdpZHRoOiAnMjJweCcsXG5cdFx0aGVpZ2h0OiAnMjJweCcsXG5cdFx0cGFkZGluZzogJzJweCdcblx0fTtcblxuXHR2YXIgb3BfYnV0dG9uX3N0eWxlcyA9IHtcblx0XHR3aWR0aDogJzMycHgnLFxuXHRcdHBhZGRpbmc6ICczcHggNHB4IDNweCA0cHgnXG5cdH07XG5cblxuXHR2YXIgcGxheV9idXR0b24gPSBuZXcgSWNvbkJ1dHRvbigxNiwgJ3BsYXknLCAncGxheScsIGRpc3BhdGNoZXIpO1xuXHRzdHlsZShwbGF5X2J1dHRvbi5kb20sIGJ1dHRvbl9zdHlsZXMsIHsgbWFyZ2luVG9wOiAnMnB4JyB9ICk7XG5cdHBsYXlfYnV0dG9uLm9uQ2xpY2soZnVuY3Rpb24oZSkge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ2NvbnRyb2xzLnRvZ2dsZV9wbGF5Jyk7XG5cdH0pO1xuXG5cdHZhciBzdG9wX2J1dHRvbiA9IG5ldyBJY29uQnV0dG9uKDE2LCAnc3RvcCcsICdzdG9wJywgZGlzcGF0Y2hlcik7XG5cdHN0eWxlKHN0b3BfYnV0dG9uLmRvbSwgYnV0dG9uX3N0eWxlcywgeyBtYXJnaW5Ub3A6ICcycHgnIH0gKTtcblx0c3RvcF9idXR0b24ub25DbGljayhmdW5jdGlvbihlKSB7XG5cdFx0ZGlzcGF0Y2hlci5maXJlKCdjb250cm9scy5zdG9wJyk7XG5cdH0pO1xuXG5cblx0dmFyIHVuZG9fYnV0dG9uID0gbmV3IEljb25CdXR0b24oMTYsICd1bmRvJywgJ3VuZG8nLCBkaXNwYXRjaGVyKTtcblx0c3R5bGUodW5kb19idXR0b24uZG9tLCBvcF9idXR0b25fc3R5bGVzKTtcblx0dW5kb19idXR0b24ub25DbGljayhmdW5jdGlvbigpIHtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ2NvbnRyb2xzLnVuZG8nKTtcblx0fSk7XG5cblx0dmFyIHJlZG9fYnV0dG9uID0gbmV3IEljb25CdXR0b24oMTYsICdyZXBlYXQnLCAncmVkbycsIGRpc3BhdGNoZXIpO1xuXHRzdHlsZShyZWRvX2J1dHRvbi5kb20sIG9wX2J1dHRvbl9zdHlsZXMpO1xuXHRyZWRvX2J1dHRvbi5vbkNsaWNrKGZ1bmN0aW9uKCkge1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgnY29udHJvbHMucmVkbycpO1xuXHR9KTtcblxuXHR2YXIgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuXHRyYW5nZS50eXBlID0gXCJyYW5nZVwiO1xuXHRyYW5nZS52YWx1ZSA9IDA7XG5cdHJhbmdlLm1pbiA9IC0xO1xuXHRyYW5nZS5tYXggPSArMTtcblx0cmFuZ2Uuc3RlcCA9IDAuMTI1O1xuXG5cdHN0eWxlKHJhbmdlLCB7XG5cdFx0d2lkdGg6ICc5MHB4Jyxcblx0XHRtYXJnaW46ICcwcHgnLFxuXHRcdG1hcmdpbkxlZnQ6ICcycHgnLFxuXHRcdG1hcmdpblJpZ2h0OiAnMnB4J1xuXHR9KTtcblxuXHR2YXIgZHJhZ2dpbmdSYW5nZSA9IDA7XG5cblx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZnVuY3Rpb24oKSB7XG5cdFx0ZHJhZ2dpbmdSYW5nZSA9IDE7XG5cdH0pO1xuXG5cdHJhbmdlLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbigpIHtcblx0XHRkcmFnZ2luZ1JhbmdlID0gMDtcblx0XHRjaGFuZ2VSYW5nZSgpO1xuXHR9KTtcblxuXHRyYW5nZS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBmdW5jdGlvbigpIHtcblx0XHRpZiAoIWRyYWdnaW5nUmFuZ2UpIHJldHVybjtcblx0XHRjaGFuZ2VSYW5nZSgpO1xuXHR9KTtcblxuXHRkaXYuYXBwZW5kQ2hpbGQodG9wKTtcblxuXHR2YXIgdGltZV9vcHRpb25zID0ge1xuXHRcdG1pbjogMCxcblx0XHRzdGVwOiAwLjEyNVxuXHR9O1xuXG5cdHZhciBjdXJyZW50VGltZSA9IG5ldyBVSU51bWJlcih0aW1lX29wdGlvbnMpO1xuXHR2YXIgdG90YWxUaW1lID0gbmV3IFVJTnVtYmVyKHRpbWVfb3B0aW9ucyk7XG5cblx0dmFyIGN1cnJlbnRUaW1lU3RvcmUgPSBkYXRhLmdldCgndWk6Y3VycmVudFRpbWUnKTtcblx0dmFyIHRvdGFsVGltZVN0b3JlID0gZGF0YS5nZXQoJ3VpOnRvdGFsVGltZScpO1xuXG5cdC8vIFVJMlN0b3JlQmluZCh2aWV3LCBkYXRhc3RvcmUpIHtcblx0Ly8gXHR2aWV3Lm9uQ2hhbmdlLmRvKGZ1bmN0aW9uKHYpIHtcblx0Ly8gXHRcdGRhdGFzdG9yZS52YWx1ZSA9IHZpZXc7XG5cdC8vIFx0fSlcblxuXHQvLyBcdGRhdGFzdG9yZS5vbkNoYW5nZS5kbyhmdW5jdGlvbih2KSB7XG5cdC8vIFx0XHR2aWV3LnNldFZhbHVlID0gdjtcblx0Ly8gXHR9KVxuXHQvLyB9XG5cblx0Y3VycmVudFRpbWUub25DaGFuZ2UuZG8oZnVuY3Rpb24odmFsdWUsIGRvbmUpIHtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ3RpbWUudXBkYXRlJywgdmFsdWUpO1xuXHRcdC8vIHJlcGFpbnQoKTtcblx0fSk7XG5cblx0dG90YWxUaW1lLm9uQ2hhbmdlLmRvKGZ1bmN0aW9uKHZhbHVlLCBkb25lKSB7XG5cdFx0dG90YWxUaW1lU3RvcmUudmFsdWUgPSB2YWx1ZTtcblx0XHRyZXBhaW50KCk7XG5cdH0pO1xuXG5cdC8vIFBsYXkgQ29udHJvbHNcblx0dG9wLmFwcGVuZENoaWxkKGN1cnJlbnRUaW1lLmRvbSk7XG5cdHRvcC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnLycpKTsgLy8gMDowMDowMCAvIDA6MTA6MDBcblx0dG9wLmFwcGVuZENoaWxkKHRvdGFsVGltZS5kb20pXG5cdHRvcC5hcHBlbmRDaGlsZChwbGF5X2J1dHRvbi5kb20pO1xuXHR0b3AuYXBwZW5kQ2hpbGQoc3RvcF9idXR0b24uZG9tKTtcblx0dG9wLmFwcGVuZENoaWxkKHJhbmdlKTtcblxuXG5cdHZhciBvcGVyYXRpb25zX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRzdHlsZShvcGVyYXRpb25zX2Rpdiwge1xuXHRcdG1hcmdpblRvcDogJzRweCcsXG5cdFx0Ly8gYm9yZGVyQm90dG9tOiAnMXB4IHNvbGlkICcgKyBUaGVtZS5iXG5cdH0pO1xuXHR0b3AuYXBwZW5kQ2hpbGQob3BlcmF0aW9uc19kaXYpO1xuXHQvLyB0b3AuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnInKSk7XG5cblxuXHQvLyBvcGVuIF9hbHRcblx0dmFyIGZpbGVfb3BlbiA9IG5ldyBJY29uQnV0dG9uKDE2LCAnZm9sZGVyX29wZW5fYWx0JywgJ09wZW4nLCBkaXNwYXRjaGVyKTtcblx0c3R5bGUoZmlsZV9vcGVuLmRvbSwgb3BfYnV0dG9uX3N0eWxlcyk7XG5cdG9wZXJhdGlvbnNfZGl2LmFwcGVuZENoaWxkKGZpbGVfb3Blbi5kb20pO1xuXG5cdGZ1bmN0aW9uIHBvcHVsYXRlT3BlbigpIHtcblx0XHR3aGlsZSAoZHJvcGRvd24ubGVuZ3RoKSB7XG5cdFx0XHRkcm9wZG93bi5yZW1vdmUoMCk7XG5cdFx0fVxuXG5cdFx0dmFyIG9wdGlvbjtcblx0XHRvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcblx0XHRvcHRpb24udGV4dCA9ICdOZXcnO1xuXHRcdG9wdGlvbi52YWx1ZSA9ICcqbmV3Kic7XG5cdFx0ZHJvcGRvd24uYWRkKG9wdGlvbik7XG5cblx0XHRvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcblx0XHRvcHRpb24udGV4dCA9ICdJbXBvcnQgSlNPTic7XG5cdFx0b3B0aW9uLnZhbHVlID0gJyppbXBvcnQqJztcblx0XHRkcm9wZG93bi5hZGQob3B0aW9uKTtcblxuXHRcdC8vIERvZXNuJ3Qgd29ya1xuXHRcdC8vIG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuXHRcdC8vIG9wdGlvbi50ZXh0ID0gJ1NlbGVjdCBGaWxlJztcblx0XHQvLyBvcHRpb24udmFsdWUgPSAnKnNlbGVjdConO1xuXHRcdC8vIGRyb3Bkb3duLmFkZChvcHRpb24pO1xuXG5cdFx0b3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XG5cdFx0b3B0aW9uLnRleHQgPSAnPT1PcGVuPT0nO1xuXHRcdG9wdGlvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0b3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcblx0XHRkcm9wZG93bi5hZGQob3B0aW9uKTtcblxuXHRcdHZhciByZWdleCA9IG5ldyBSZWdFeHAoU1RPUkFHRV9QUkVGSVggKyAnKC4qKScpO1xuXHRcdGZvciAodmFyIGtleSBpbiBsb2NhbFN0b3JhZ2UpIHtcblx0XHRcdC8vIGNvbnNvbGUubG9nKGtleSk7XG5cblx0XHRcdHZhciBtYXRjaCA9IHJlZ2V4LmV4ZWMoa2V5KTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcblx0XHRcdFx0b3B0aW9uLnRleHQgPSBtYXRjaFsxXTtcblxuXHRcdFx0XHRkcm9wZG93bi5hZGQob3B0aW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fVxuXG5cdC8vIGxpc3RlbiBvbiBvdGhlciB0YWJzXG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdzdG9yYWdlJywgZnVuY3Rpb24oZSkge1xuXHRcdHZhciByZWdleCA9IG5ldyBSZWdFeHAoU1RPUkFHRV9QUkVGSVggKyAnKC4qKScpO1xuXHRcdGlmIChyZWdleC5leGVjKGUua2V5KSkge1xuXHRcdFx0cG9wdWxhdGVPcGVuKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRkaXNwYXRjaGVyLm9uKCdzYXZlOmRvbmUnLCBwb3B1bGF0ZU9wZW4pO1xuXG5cdHZhciBkcm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXG5cdHN0eWxlKGRyb3Bkb3duLCB7XG5cdFx0cG9zaXRpb246ICdhYnNvbHV0ZScsXG5cdFx0Ly8gcmlnaHQ6IDAsXG5cdFx0Ly8gbWFyZ2luOiAwLFxuXHRcdG9wYWNpdHk6IDAsXG5cdFx0d2lkdGg6ICcxNnB4Jyxcblx0XHRoZWlnaHQ6ICcxNnB4Jyxcblx0XHQvLyB6SW5kZXg6IDEsXG5cdH0pO1xuXG5cdGRyb3Bkb3duLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGZ1bmN0aW9uKGUpIHtcblx0XHQvLyBjb25zb2xlLmxvZygnY2hhbmdlZCcsIGRyb3Bkb3duLmxlbmd0aCwgZHJvcGRvd24udmFsdWUpO1xuXG5cdFx0c3dpdGNoIChkcm9wZG93bi52YWx1ZSkge1xuXHRcdGNhc2UgJypuZXcqJzpcblx0XHRcdGRpc3BhdGNoZXIuZmlyZSgnbmV3Jyk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlICcqaW1wb3J0Kic6XG5cdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ2ltcG9ydCcpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAnKnNlbGVjdConOlxuXHRcdFx0ZGlzcGF0Y2hlci5maXJlKCdvcGVuZmlsZScpO1xuXHRcdFx0YnJlYWs7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdGRpc3BhdGNoZXIuZmlyZSgnb3BlbicsIGRyb3Bkb3duLnZhbHVlKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fSk7XG5cblx0ZmlsZV9vcGVuLmRvbS5pbnNlcnRCZWZvcmUoZHJvcGRvd24sIGZpbGVfb3Blbi5kb20uZmlyc3RDaGlsZCk7XG5cblx0cG9wdWxhdGVPcGVuKCk7XG5cblx0Ly8gLy8ganNvbiBpbXBvcnRcblx0Ly8gdmFyIGltcG9ydF9qc29uID0gbmV3IEljb25CdXR0b24oMTYsICdzaWduaW4nLCAnSW1wb3J0IEpTT04nLCBkaXNwYXRjaGVyKTtcblx0Ly8gb3BlcmF0aW9uc19kaXYuYXBwZW5kQ2hpbGQoaW1wb3J0X2pzb24uZG9tKTtcblx0Ly8gaW1wb3J0X2pzb24ub25DbGljayhmdW5jdGlvbigpIHtcblx0Ly8gXHRkaXNwYXRjaGVyLmZpcmUoJ2ltcG9ydCcpO1xuXHQvLyB9KTtcblxuXHQvLyAvLyBuZXdcblx0Ly8gdmFyIGZpbGVfYWx0ID0gbmV3IEljb25CdXR0b24oMTYsICdmaWxlX2FsdCcsICdOZXcnLCBkaXNwYXRjaGVyKTtcblx0Ly8gb3BlcmF0aW9uc19kaXYuYXBwZW5kQ2hpbGQoZmlsZV9hbHQuZG9tKTtcblxuXHQvLyBzYXZlXG5cdHZhciBzYXZlID0gbmV3IEljb25CdXR0b24oMTYsICdzYXZlJywgJ1NhdmUnLCBkaXNwYXRjaGVyKTtcblx0c3R5bGUoc2F2ZS5kb20sIG9wX2J1dHRvbl9zdHlsZXMpO1xuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChzYXZlLmRvbSk7XG5cdHNhdmUub25DbGljayhmdW5jdGlvbigpIHtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ3NhdmUnKTtcblx0fSk7XG5cblx0Ly8gc2F2ZSBhc1xuXHR2YXIgc2F2ZV9hcyA9IG5ldyBJY29uQnV0dG9uKDE2LCAncGFzdGUnLCAnU2F2ZSBhcycsIGRpc3BhdGNoZXIpO1xuXHRzdHlsZShzYXZlX2FzLmRvbSwgb3BfYnV0dG9uX3N0eWxlcyk7XG5cdG9wZXJhdGlvbnNfZGl2LmFwcGVuZENoaWxkKHNhdmVfYXMuZG9tKTtcblx0c2F2ZV9hcy5vbkNsaWNrKGZ1bmN0aW9uKCkge1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgnc2F2ZV9hcycpO1xuXHR9KTtcblxuXHQvLyBkb3dubG9hZCBqc29uIChleHBvcnQpXG5cdHZhciBkb3dubG9hZF9hbHQgPSBuZXcgSWNvbkJ1dHRvbigxNiwgJ2Rvd25sb2FkX2FsdCcsICdEb3dubG9hZCAvIEV4cG9ydCBKU09OIHRvIGZpbGUnLCBkaXNwYXRjaGVyKTtcblx0c3R5bGUoZG93bmxvYWRfYWx0LmRvbSwgb3BfYnV0dG9uX3N0eWxlcyk7XG5cdG9wZXJhdGlvbnNfZGl2LmFwcGVuZENoaWxkKGRvd25sb2FkX2FsdC5kb20pO1xuXHRkb3dubG9hZF9hbHQub25DbGljayhmdW5jdGlvbigpIHtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ2V4cG9ydCcpO1xuXHR9KTtcblxuXHR2YXIgdXBsb2FkX2FsdCA9IG5ldyBJY29uQnV0dG9uKDE2LCAndXBsb2FkX2FsdCcsICdMb2FkIGZyb20gZmlsZScsIGRpc3BhdGNoZXIpO1xuXHRzdHlsZSh1cGxvYWRfYWx0LmRvbSwgb3BfYnV0dG9uX3N0eWxlcyk7XG5cdG9wZXJhdGlvbnNfZGl2LmFwcGVuZENoaWxkKHVwbG9hZF9hbHQuZG9tKTtcblx0dXBsb2FkX2FsdC5vbkNsaWNrKGZ1bmN0aW9uKCkge1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgnb3BlbmZpbGUnKTtcblx0fSk7XG5cblx0dmFyIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdHNwYW4uc3R5bGUud2lkdGggPSAnMjBweCc7XG5cdHNwYW4uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChzcGFuKTtcblxuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZCh1bmRvX2J1dHRvbi5kb20pO1xuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChyZWRvX2J1dHRvbi5kb20pO1xuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpKTtcblxuXHQvLyBDbG91ZCBEb3dubG9hZCAvIFVwbG9hZCBlZGl0IHBlbmNpbFxuXG5cdC8qXG5cdC8vIC8vIHNob3cgbGF5ZXJcblx0Ly8gdmFyIGV5ZV9vcGVuID0gbmV3IEljb25CdXR0b24oMTYsICdleWVfb3BlbicsICdleWVfb3BlbicsIGRpc3BhdGNoZXIpO1xuXHQvLyBvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChleWVfb3Blbi5kb20pO1xuXG5cdC8vIC8vIGhpZGUgLyBkaXNhYmxlIGxheWVyXG5cdC8vIHZhciBleWVfY2xvc2UgPSBuZXcgSWNvbkJ1dHRvbigxNiwgJ2V5ZV9jbG9zZScsICdleWVfY2xvc2UnLCBkaXNwYXRjaGVyKTtcblx0Ly8gb3BlcmF0aW9uc19kaXYuYXBwZW5kQ2hpbGQoZXllX2Nsb3NlLmRvbSk7XG5cblxuXHQvLyByZW1vdmUgbGF5ZXJcblx0dmFyIG1pbnVzID0gbmV3IEljb25CdXR0b24oMTYsICdtaW51cycsICdtaW51cycsIGRpc3BhdGNoZXIpO1xuXHRvcGVyYXRpb25zX2Rpdi5hcHBlbmRDaGlsZChtaW51cy5kb20pO1xuXG5cdC8vIGNoZWNrXG5cdHZhciBvayA9IG5ldyBJY29uQnV0dG9uKDE2LCAnb2snLCAnb2snLCBkaXNwYXRjaGVyKTtcblx0b3BlcmF0aW9uc19kaXYuYXBwZW5kQ2hpbGQob2suZG9tKTtcblxuXHQvLyBjcm9zc1xuXHR2YXIgcmVtb3ZlID0gbmV3IEljb25CdXR0b24oMTYsICdyZW1vdmUnLCAncmVtb3ZlJywgZGlzcGF0Y2hlcik7XG5cdG9wZXJhdGlvbnNfZGl2LmFwcGVuZENoaWxkKHJlbW92ZS5kb20pO1xuXG5cdCovXG5cblxuXHQvLyByYW5nZS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VSYW5nZSk7XG5cblxuXHRmdW5jdGlvbiBjb252ZXJ0UGVyY2VudFRvVGltZSh0KSB7XG5cdFx0dmFyIG1pbl90aW1lID0gMTAgKiA2MDsgLy8gMTAgbWludXRlc1xuXHRcdG1pbl90aW1lID0gZGF0YS5nZXQoJ3VpOnRvdGFsVGltZScpLnZhbHVlO1xuXHRcdHZhciBtYXhfdGltZSA9IDE7XG5cdFx0dmFyIHYgPSBMYXlvdXRDb25zdGFudHMud2lkdGggKiAwLjggLyAodCAqIChtYXhfdGltZSAtIG1pbl90aW1lKSArIG1pbl90aW1lKTtcblx0XHRyZXR1cm4gdjtcblx0fVxuXG5cdGZ1bmN0aW9uIGNvbnZlcnRUaW1lVG9QZXJjZW50KHYpIHtcblx0XHR2YXIgbWluX3RpbWUgPSAxMCAqIDYwOyAvLyAxMCBtaW51dGVzXG5cdFx0bWluX3RpbWUgPSBkYXRhLmdldCgndWk6dG90YWxUaW1lJykudmFsdWU7XG5cdFx0dmFyIG1heF90aW1lID0gMTtcblx0XHR2YXIgdCAgPSAoKExheW91dENvbnN0YW50cy53aWR0aCAqIDAuOCAvIHYpIC0gbWluX3RpbWUpICAvIChtYXhfdGltZSAtIG1pbl90aW1lKTtcblx0XHRyZXR1cm4gdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGNoYW5nZVJhbmdlKCkge1xuXG5cdFx0ZGlzcGF0Y2hlci5maXJlKCd1cGRhdGUuc2NhbGUnLCA2ICogTWF0aC5wb3coMTAwLCAtcmFuZ2UudmFsdWUpICk7XG5cdH1cblxuXHR2YXIgbGF5ZXJfdWlzID0gW10sIHZpc2libGVfbGF5ZXJzID0gMDtcblx0dmFyIHVudXNlZF9sYXllcnMgPSBbXTtcblxuXHR0aGlzLmxheWVycyA9IGxheWVyX3VpcztcblxuXHR0aGlzLnNldENvbnRyb2xTdGF0dXMgPSBmdW5jdGlvbih2KSB7XG5cdFx0cGxheWluZyA9IHY7XG5cdFx0aWYgKHBsYXlpbmcpIHtcblx0XHRcdHBsYXlfYnV0dG9uLnNldEljb24oJ3BhdXNlJyk7XG5cdFx0XHRwbGF5X2J1dHRvbi5zZXRUaXAoJ1BhdXNlJyk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cGxheV9idXR0b24uc2V0SWNvbigncGxheScpO1xuXHRcdFx0cGxheV9idXR0b24uc2V0VGlwKCdQbGF5Jyk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuc2V0U3RhdGUgPSBmdW5jdGlvbihzdGF0ZSkge1xuXG5cdFx0bGF5ZXJfc3RvcmUgPSBzdGF0ZTtcblx0XHR2YXIgbGF5ZXJzID0gbGF5ZXJfc3RvcmUudmFsdWU7XG5cdFx0Ly8gbGF5ZXJzID0gc3RhdGU7XG5cdFx0Y29uc29sZS5sb2cobGF5ZXJfdWlzLmxlbmd0aCwgbGF5ZXJzKTtcblx0XHR2YXIgaSwgbGF5ZXI7XG5cdFx0Zm9yIChpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bGF5ZXIgPSBsYXllcnNbaV07XG5cblx0XHRcdGlmICghbGF5ZXJfdWlzW2ldKSB7XG5cdFx0XHRcdHZhciBsYXllcl91aTtcblx0XHRcdFx0aWYgKHVudXNlZF9sYXllcnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0bGF5ZXJfdWkgPSB1bnVzZWRfbGF5ZXJzLnBvcCgpO1xuXHRcdFx0XHRcdGxheWVyX3VpLmRvbS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBuZXdcblx0XHRcdFx0XHRsYXllcl91aSA9IG5ldyBMYXllclZpZXcobGF5ZXIsIGRpc3BhdGNoZXIpO1xuXHRcdFx0XHRcdGxheWVyX3Njcm9sbC5hcHBlbmRDaGlsZChsYXllcl91aS5kb20pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxheWVyX3Vpcy5wdXNoKGxheWVyX3VpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gbGF5ZXJfdWlzW2ldLnNldFN0YXRlKGxheWVyKTtcblx0XHR9XG5cblx0XHRjb25zb2xlLmxvZygnVG90YWwgbGF5ZXJzICh2aWV3LCBoaWRkZW4sIHRvdGFsKScsIGxheWVyX3Vpcy5sZW5ndGgsIHVudXNlZF9sYXllcnMubGVuZ3RoLFxuXHRcdFx0bGF5ZXJfdWlzLmxlbmd0aCArIHVudXNlZF9sYXllcnMubGVuZ3RoKTtcblxuXHR9O1xuXG5cdGZ1bmN0aW9uIHJlcGFpbnQocykge1xuXG5cdFx0cyA9IGN1cnJlbnRUaW1lU3RvcmUudmFsdWU7XG5cdFx0Y3VycmVudFRpbWUuc2V0VmFsdWUocyk7XG5cdFx0dG90YWxUaW1lLnNldFZhbHVlKHRvdGFsVGltZVN0b3JlLnZhbHVlKTtcblx0XHRjdXJyZW50VGltZS5wYWludCgpO1xuXHRcdHRvdGFsVGltZS5wYWludCgpO1xuXG5cdFx0dmFyIGk7XG5cblx0XHRzID0gcyB8fCAwO1xuXG5cdFx0dmFyIGxheWVycyA9IGxheWVyX3N0b3JlLnZhbHVlO1xuXHRcdGZvciAoaSA9IGxheWVyX3Vpcy5sZW5ndGg7IGktLSA+IDA7KSB7XG5cdFx0XHQvLyBxdWljayBoYWNrXG5cdFx0XHRpZiAoaSA+PSBsYXllcnMubGVuZ3RoKSB7XG5cdFx0XHRcdGxheWVyX3Vpc1tpXS5kb20uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdFx0dW51c2VkX2xheWVycy5wdXNoKGxheWVyX3Vpcy5wb3AoKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRsYXllcl91aXNbaV0uc2V0U3RhdGUobGF5ZXJzW2ldLCBsYXllcl9zdG9yZS5nZXQoaSkpO1xuXHRcdFx0Ly8gbGF5ZXJfdWlzW2ldLnNldFN0YXRlKCdsYXllcnMnKyc6JytpKTtcblx0XHRcdGxheWVyX3Vpc1tpXS5yZXBhaW50KHMpO1xuXHRcdH1cblxuXHRcdHZpc2libGVfbGF5ZXJzID0gbGF5ZXJfdWlzLmxlbmd0aDtcblxuXHR9XG5cblx0dGhpcy5yZXBhaW50ID0gcmVwYWludDtcblx0dGhpcy5zZXRTdGF0ZShsYXllcl9zdG9yZSk7XG5cblx0dGhpcy5zY3JvbGxUbyA9IGZ1bmN0aW9uKHgpIHtcblx0XHRsYXllcl9zY3JvbGwuc2Nyb2xsVG9wID0geCAqIChsYXllcl9zY3JvbGwuc2Nyb2xsSGVpZ2h0IC0gbGF5ZXJfc2Nyb2xsLmNsaWVudEhlaWdodCk7XG5cdH07XG5cblx0dGhpcy5kb20gPSBkaXY7XG5cblx0cmVwYWludCgpO1xufVxuXG5leHBvcnQgeyBMYXllckNhYmluZXQgfVxuIiwiaW1wb3J0IHsgTGF5b3V0Q29uc3RhbnRzIH0gIGZyb20gJy4uL2xheW91dF9jb25zdGFudHMuanMnXG5pbXBvcnQgeyBUaGVtZSB9ICBmcm9tICcuLi90aGVtZS5qcydcbmltcG9ydCB7IHV0aWxzIH0gIGZyb20gJy4uL3V0aWxzL3V0aWxzLmpzJ1xuaW1wb3J0IHsgVHdlZW5zIH0gIGZyb20gJy4uL3V0aWxzL3V0aWxfdHdlZW4uanMnXG5pbXBvcnQgeyBoYW5kbGVEcmFnIH0gIGZyb20gJy4uL3V0aWxzL3V0aWxfaGFuZGxlX2RyYWcuanMnXG5pbXBvcnQgeyBTY3JvbGxDYW52YXMgfSAgZnJvbSAnLi90aW1lX3Njcm9sbGVyLmpzJ1xuaW1wb3J0IHsgQ2FudmFzIH0gIGZyb20gJy4uL3VpL2NhbnZhcy5qcydcblxuY29uc3QgcHJveHlfY3R4ICA9IHV0aWxzLnByb3h5X2N0eDtcblxudmFyXG5cdExJTkVfSEVJR0hUID0gTGF5b3V0Q29uc3RhbnRzLkxJTkVfSEVJR0hULFxuXHRESUFNT05EX1NJWkUgPSBMYXlvdXRDb25zdGFudHMuRElBTU9ORF9TSVpFLFxuXHRUSU1FX1NDUk9MTEVSX0hFSUdIVCA9IDM1LFxuXHRNQVJLRVJfVFJBQ0tfSEVJR0hUID0gMjUsXG5cdExFRlRfUEFORV9XSURUSCA9IExheW91dENvbnN0YW50cy5MRUZUX1BBTkVfV0lEVEgsXG5cdHRpbWVfc2NhbGUgPSBMYXlvdXRDb25zdGFudHMudGltZV9zY2FsZSxcblx0VE9QID0gMTA7XG5cblxudmFyIGZyYW1lX3N0YXJ0ID0gMDsgLy8gdGhpcyBpcyB0aGUgY3VycmVudCBzY3JvbGwgcG9zaXRpb24uXG5cblxuLypcbiAqIFRoaXMgY2xhc3MgY29udGFpbnMgdGhlIHZpZXcgZm9yIHRoZSByaWdodCBtYWluIHNlY3Rpb24gb2YgdGltZWxpbmVyXG4gKi9cblxuXG4vLyBUT0RPXG4vLyBkaXJ0eSByZW5kZXJpbmdcbi8vIGRyYWcgYmxvY2tcbi8vIERPTidUIHVzZSB0aW1lLnVwZGF0ZSBmb3IgZXZlcnl0aGluZ1xuXG52YXIgdGlja01hcmsxO1xudmFyIHRpY2tNYXJrMjtcbnZhciB0aWNrTWFyazM7XG5cbmZ1bmN0aW9uIHRpbWVfc2NhbGVkKCkge1xuXHQvKlxuXHQgKiBTdWJkaXZpc29uIExPRFxuXHQgKiB0aW1lX3NjYWxlIHJlZmVycyB0byBudW1iZXIgb2YgcGl4ZWxzIHBlciB1bml0XG5cdCAqIEVnLiAxIGluY2ggLSA2MHMsIDEgaW5jaCAtIDYwZnBzLCAxIGluY2ggLSA2IG1pbnNcblx0ICovXG5cdHZhciBkaXYgPSA2MDtcblxuXHR0aWNrTWFyazEgPSB0aW1lX3NjYWxlIC8gZGl2O1xuXHR0aWNrTWFyazIgPSAyICogdGlja01hcmsxO1xuXHR0aWNrTWFyazMgPSAxMCAqIHRpY2tNYXJrMTtcblxufVxuXG50aW1lX3NjYWxlZCgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8vIFRpbWVsaW5lIFBhbmVsXG4vKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIFRpbWVsaW5lUGFuZWwoZGF0YSwgZGlzcGF0Y2hlcikge1xuXG5cdHZhciBkcHIgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcblx0dmFyIHRyYWNrX2NhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG5cdHZhciBzY3JvbGxUb3AgPSAwLCBzY3JvbGxMZWZ0ID0gMCwgU0NST0xMX0hFSUdIVDtcblx0dmFyIGxheWVycyA9IGRhdGEuZ2V0KCdsYXllcnMnKS52YWx1ZTtcblxuXHR0aGlzLnNjcm9sbFRvID0gZnVuY3Rpb24ocywgeSkge1xuXHRcdHNjcm9sbFRvcCA9IHMgKiBNYXRoLm1heChsYXllcnMubGVuZ3RoICogTElORV9IRUlHSFQgLSBTQ1JPTExfSEVJR0hULCAwKTtcblx0XHRyZXBhaW50KCk7XG5cdH07XG5cblx0dGhpcy5yZXNpemUgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgaCA9IChMYXlvdXRDb25zdGFudHMuaGVpZ2h0IC0gVElNRV9TQ1JPTExFUl9IRUlHSFQpO1xuXHRcdGRwciA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuXHRcdHRyYWNrX2NhbnZhcy53aWR0aCA9IExheW91dENvbnN0YW50cy53aWR0aCAqIGRwcjtcblx0XHR0cmFja19jYW52YXMuaGVpZ2h0ID0gaCAqIGRwcjtcblx0XHR0cmFja19jYW52YXMuc3R5bGUud2lkdGggPSBMYXlvdXRDb25zdGFudHMud2lkdGggKyAncHgnO1xuXHRcdHRyYWNrX2NhbnZhcy5zdHlsZS5oZWlnaHQgPSBoICsgJ3B4Jztcblx0XHRTQ1JPTExfSEVJR0hUID0gTGF5b3V0Q29uc3RhbnRzLmhlaWdodCAtIFRJTUVfU0NST0xMRVJfSEVJR0hUO1xuXHRcdHNjcm9sbF9jYW52YXMuc2V0U2l6ZShMYXlvdXRDb25zdGFudHMud2lkdGgsIFRJTUVfU0NST0xMRVJfSEVJR0hUKTtcblx0fTtcblxuXHR2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cblx0dmFyIHNjcm9sbF9jYW52YXMgPSBuZXcgQ2FudmFzKExheW91dENvbnN0YW50cy53aWR0aCwgVElNRV9TQ1JPTExFUl9IRUlHSFQpO1xuXHQvLyBkYXRhLmFkZExpc3RlbmVyKCd1aScsIHJlcGFpbnQgKTtcblxuXHR1dGlscy5zdHlsZSh0cmFja19jYW52YXMsIHtcblx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHR0b3A6IFRJTUVfU0NST0xMRVJfSEVJR0hUICsgJ3B4Jyxcblx0XHRsZWZ0OiAnMHB4J1xuXHR9KTtcblxuXHR1dGlscy5zdHlsZShzY3JvbGxfY2FudmFzLmRvbSwge1xuXHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdHRvcDogJzBweCcsXG5cdFx0bGVmdDogJzEwcHgnXG5cdH0pO1xuXG5cdHNjcm9sbF9jYW52YXMudXNlcyhuZXcgU2Nyb2xsQ2FudmFzKGRpc3BhdGNoZXIsIGRhdGEpKTtcblxuXHRkaXYuYXBwZW5kQ2hpbGQodHJhY2tfY2FudmFzKTtcblx0ZGl2LmFwcGVuZENoaWxkKHNjcm9sbF9jYW52YXMuZG9tKTtcblx0c2Nyb2xsX2NhbnZhcy5kb20uaWQgPSAnc2Nyb2xsLWNhbnZhcydcblx0dHJhY2tfY2FudmFzLmlkID0gJ3RyYWNrLWNhbnZhcydcblxuXHQvLyB0aGlzLmRvbSA9IGNhbnZhcztcblx0dGhpcy5kb20gPSBkaXY7XG5cdHRoaXMuZG9tLmlkID0gJ3RpbWVsaW5lLXBhbmVsJ1xuXHR0aGlzLnJlc2l6ZSgpO1xuXG5cdHZhciBjdHggPSB0cmFja19jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblx0dmFyIGN0eF93cmFwID0gcHJveHlfY3R4KGN0eCk7XG5cblx0dmFyIGN1cnJlbnRUaW1lOyAvLyBtZWFzdXJlZCBpbiBzZWNvbmRzXG5cdC8vIHRlY2huaWNhbGx5IGl0IGNvdWxkIGJlIGluIGZyYW1lcyBvciAgaGF2ZSBpdCBpbiBzdHJpbmcgZm9ybWF0ICgwOjAwOjAwOjEtNjApXG5cblx0dmFyIExFRlRfR1VUVEVSID0gMjA7XG5cdHZhciBpLCB4LCB5LCBpbCwgajtcblxuXHR2YXIgbmVlZHNSZXBhaW50ID0gZmFsc2U7XG5cdHZhciByZW5kZXJJdGVtcyA9IFtdO1xuXG5cdGZ1bmN0aW9uIEVhc2luZ1JlY3QoeDEsIHkxLCB4MiwgeTIsIGZyYW1lLCBmcmFtZTIsIHZhbHVlcywgbGF5ZXIsIGopIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHR0aGlzLnBhdGggPSBmdW5jdGlvbigpIHtcblx0XHRcdGN0eF93cmFwLmJlZ2luUGF0aCgpXG5cdFx0XHRcdC5yZWN0KHgxLCB5MSwgeDIteDEsIHkyLXkxKVxuXHRcdFx0XHQuY2xvc2VQYXRoKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMucGFpbnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMucGF0aCgpO1xuXHRcdFx0Y3R4LmZpbGxTdHlsZSA9IGZyYW1lLl9jb2xvcjtcblx0XHRcdGN0eC5maWxsKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMubW91c2VvdmVyID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR0cmFja19jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInOyAvLyBwb2ludGVyIG1vdmUgZXctcmVzaXplXG5cdFx0fTtcblxuXHRcdHRoaXMubW91c2VvdXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRyYWNrX2NhbnZhcy5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG5cdFx0fTtcblxuXHRcdHRoaXMubW91c2VkcmFnID0gZnVuY3Rpb24oZSkge1xuXHRcdFx0dmFyIHQxID0geF90b190aW1lKHgxICsgZS5keCk7XG5cdFx0XHR0MSA9IE1hdGgubWF4KDAsIHQxKTtcblx0XHRcdC8vIFRPRE8gbGltaXQgbW92aW5nIHRvIG5laWdoYm91cnNcblx0XHRcdGZyYW1lLnRpbWUgPSB0MTtcblxuXHRcdFx0dmFyIHQyID0geF90b190aW1lKHgyICsgZS5keCk7XG5cdFx0XHR0MiA9IE1hdGgubWF4KDAsIHQyKTtcblx0XHRcdGZyYW1lMi50aW1lID0gdDI7XG5cblx0XHRcdC8vIGRpc3BhdGNoZXIuZmlyZSgndGltZS51cGRhdGUnLCB0MSk7XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIERpYW1vbmQoZnJhbWUsIHkpIHtcblx0XHR2YXIgeCwgeTI7XG5cblx0XHR4ID0gdGltZV90b194KGZyYW1lLnRpbWUpO1xuXHRcdHkyID0geSArIExJTkVfSEVJR0hUICogMC41ICAtIERJQU1PTkRfU0laRSAvIDI7XG5cblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHR2YXIgaXNPdmVyID0gZmFsc2U7XG5cblx0XHR0aGlzLnBhdGggPSBmdW5jdGlvbihjdHhfd3JhcCkge1xuXHRcdFx0Y3R4X3dyYXBcblx0XHRcdFx0LmJlZ2luUGF0aCgpXG5cdFx0XHRcdC5tb3ZlVG8oeCwgeTIpXG5cdFx0XHRcdC5saW5lVG8oeCArIERJQU1PTkRfU0laRSAvIDIsIHkyICsgRElBTU9ORF9TSVpFIC8gMilcblx0XHRcdFx0LmxpbmVUbyh4LCB5MiArIERJQU1PTkRfU0laRSlcblx0XHRcdFx0LmxpbmVUbyh4IC0gRElBTU9ORF9TSVpFIC8gMiwgeTIgKyBESUFNT05EX1NJWkUgLyAyKVxuXHRcdFx0XHQuY2xvc2VQYXRoKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMucGFpbnQgPSBmdW5jdGlvbihjdHhfd3JhcCkge1xuXHRcdFx0c2VsZi5wYXRoKGN0eF93cmFwKTtcblx0XHRcdGlmICghaXNPdmVyKVxuXHRcdFx0XHRjdHhfd3JhcC5maWxsU3R5bGUoVGhlbWUuYyk7XG5cdFx0XHRlbHNlXG5cdFx0XHRcdGN0eF93cmFwLmZpbGxTdHlsZSgneWVsbG93Jyk7IC8vIFRoZW1lLmRcblxuXHRcdFx0Y3R4X3dyYXAuZmlsbCgpXG5cdFx0XHRcdC5zdHJva2UoKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5tb3VzZW92ZXIgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlzT3ZlciA9IHRydWU7XG5cdFx0XHR0cmFja19jYW52YXMuc3R5bGUuY3Vyc29yID0gJ21vdmUnOyAvLyBwb2ludGVyIG1vdmUgZXctcmVzaXplXG5cdFx0XHRzZWxmLnBhaW50KGN0eF93cmFwKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5tb3VzZW91dCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aXNPdmVyID0gZmFsc2U7XG5cdFx0XHR0cmFja19jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2RlZmF1bHQnO1xuXHRcdFx0c2VsZi5wYWludChjdHhfd3JhcCk7XG5cdFx0fTtcblxuXHRcdHRoaXMubW91c2VkcmFnID0gZnVuY3Rpb24oZSkge1xuXHRcdFx0dmFyIHQgPSB4X3RvX3RpbWUoeCArIGUuZHgpO1xuXHRcdFx0dCA9IE1hdGgubWF4KDAsIHQpO1xuXHRcdFx0Ly8gVE9ETyBsaW1pdCBtb3ZpbmcgdG8gbmVpZ2hib3Vyc1xuXHRcdFx0ZnJhbWUudGltZSA9IHQ7XG5cdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ3RpbWUudXBkYXRlJywgdCk7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygnZnJhbWUnLCBmcmFtZSk7XG5cdFx0XHQvLyBjb25zb2xlLmxvZyhzLCBmb3JtYXRfZnJpZW5kbHlfc2Vjb25kcyhzKSwgdGhpcyk7XG5cdFx0fTtcblxuXHR9XG5cblx0ZnVuY3Rpb24gcmVwYWludCgpIHtcblx0XHRuZWVkc1JlcGFpbnQgPSB0cnVlO1xuXHR9XG5cblxuXHRmdW5jdGlvbiBkcmF3TGF5ZXJDb250ZW50cygpIHtcblx0XHRyZW5kZXJJdGVtcyA9IFtdO1xuXHRcdC8vIGhvcml6b250YWwgTGF5ZXIgbGluZXNcblx0XHRmb3IgKGkgPSAwLCBpbCA9IGxheWVycy5sZW5ndGg7IGkgPD0gaWw7IGkrKykge1xuXHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gVGhlbWUuYjtcblx0XHRcdGN0eC5iZWdpblBhdGgoKTtcblx0XHRcdHkgPSBpICogTElORV9IRUlHSFQ7XG5cdFx0XHR5ID0gfn55IC0gMC41O1xuXG5cdFx0XHRjdHhfd3JhcFxuXHRcdFx0XHQubW92ZVRvKDAsIHkpXG5cdFx0XHRcdC5saW5lVG8oTGF5b3V0Q29uc3RhbnRzLndpZHRoLCB5KVxuXHRcdFx0XHQuc3Ryb2tlKCk7XG5cdFx0fVxuXG5cblx0XHR2YXIgZnJhbWUsIGZyYW1lMiwgajtcblxuXHRcdC8vIERyYXcgRWFzaW5nIFJlY3RzXG5cdFx0Zm9yIChpID0gMDsgaSA8IGlsOyBpKyspIHtcblx0XHRcdC8vIGNoZWNrIGZvciBrZXlmcmFtZXNcblx0XHRcdHZhciBsYXllciA9IGxheWVyc1tpXTtcblx0XHRcdHZhciB2YWx1ZXMgPSBsYXllci52YWx1ZXM7XG5cblx0XHRcdHkgPSBpICogTElORV9IRUlHSFQ7XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCB2YWx1ZXMubGVuZ3RoIC0gMTsgaisrKSB7XG5cdFx0XHRcdGZyYW1lID0gdmFsdWVzW2pdO1xuXHRcdFx0XHRmcmFtZTIgPSB2YWx1ZXNbaiArIDFdO1xuXG5cdFx0XHRcdC8vIERyYXcgVHdlZW4gUmVjdFxuXHRcdFx0XHR2YXIgeCA9IHRpbWVfdG9feChmcmFtZS50aW1lKTtcblx0XHRcdFx0dmFyIHgyID0gdGltZV90b194KGZyYW1lMi50aW1lKTtcblxuXHRcdFx0XHRpZiAoIWZyYW1lLnR3ZWVuIHx8IGZyYW1lLnR3ZWVuID09ICdub25lJykgY29udGludWU7XG5cblx0XHRcdFx0dmFyIHkxID0geSArIDI7XG5cdFx0XHRcdHZhciB5MiA9IHkgKyBMSU5FX0hFSUdIVCAtIDI7XG5cblx0XHRcdFx0cmVuZGVySXRlbXMucHVzaChuZXcgRWFzaW5nUmVjdCh4LCB5MSwgeDIsIHkyLCBmcmFtZSwgZnJhbWUyKSk7XG5cblx0XHRcdFx0Ly8gLy8gZHJhdyBlYXNpbmcgZ3JhcGhcblx0XHRcdFx0Ly8gdmFyIGNvbG9yID0gcGFyc2VJbnQoZnJhbWUuX2NvbG9yLnN1YnN0cmluZygxLDcpLCAxNik7XG5cdFx0XHRcdC8vIGNvbG9yID0gMHhmZmZmZmYgXiBjb2xvcjtcblx0XHRcdFx0Ly8gY29sb3IgPSBjb2xvci50b1N0cmluZygxNik7ICAgICAgICAgICAvLyBjb252ZXJ0IHRvIGhleFxuXHRcdFx0XHQvLyBjb2xvciA9ICcjJyArICgnMDAwMDAwJyArIGNvbG9yKS5zbGljZSgtNik7XG5cblx0XHRcdFx0Ly8gY3R4LnN0cm9rZVN0eWxlID0gY29sb3I7XG5cdFx0XHRcdC8vIHZhciB4Mztcblx0XHRcdFx0Ly8gY3R4LmJlZ2luUGF0aCgpO1xuXHRcdFx0XHQvLyBjdHgubW92ZVRvKHgsIHkyKTtcblx0XHRcdFx0Ly8gdmFyIGR5ID0geTEgLSB5Mjtcblx0XHRcdFx0Ly8gdmFyIGR4ID0geDIgLSB4O1xuXG5cdFx0XHRcdC8vIGZvciAoeDM9eDsgeDMgPCB4MjsgeDMrKykge1xuXHRcdFx0XHQvLyBcdGN0eC5saW5lVG8oeDMsIHkyICsgVHdlZW5zW2ZyYW1lLnR3ZWVuXSgoeDMgLSB4KS9keCkgKiBkeSk7XG5cdFx0XHRcdC8vIH1cblx0XHRcdFx0Ly8gY3R4LnN0cm9rZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgdmFsdWVzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdC8vIERpbW9uZHNcblx0XHRcdFx0ZnJhbWUgPSB2YWx1ZXNbal07XG5cdFx0XHRcdHJlbmRlckl0ZW1zLnB1c2gobmV3IERpYW1vbmQoZnJhbWUsIHkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyByZW5kZXIgaXRlbXNcblx0XHR2YXIgaXRlbTtcblx0XHRmb3IgKGkgPSAwLCBpbCA9IHJlbmRlckl0ZW1zLmxlbmd0aDsgaSA8IGlsOyBpKyspIHtcblx0XHRcdGl0ZW0gPSByZW5kZXJJdGVtc1tpXTtcblx0XHRcdGl0ZW0ucGFpbnQoY3R4X3dyYXApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNldFRpbWVTY2FsZSgpIHtcblxuXHRcdHZhciB2ID0gZGF0YS5nZXQoJ3VpOnRpbWVTY2FsZScpLnZhbHVlO1xuXHRcdGlmICh0aW1lX3NjYWxlICE9PSB2KSB7XG5cdFx0XHR0aW1lX3NjYWxlID0gdjtcblx0XHRcdHRpbWVfc2NhbGVkKCk7XG5cdFx0fVxuXHR9XG5cblx0dmFyIG92ZXIgPSBudWxsO1xuXHR2YXIgbW91c2Vkb3duSXRlbSA9IG51bGw7XG5cblx0ZnVuY3Rpb24gY2hlY2soKSB7XG5cdFx0dmFyIGl0ZW07XG5cdFx0dmFyIGxhc3Rfb3ZlciA9IG92ZXI7XG5cdFx0Ly8gb3ZlciA9IFtdO1xuXHRcdG92ZXIgPSBudWxsO1xuXHRcdGZvciAoaSA9IHJlbmRlckl0ZW1zLmxlbmd0aDsgaS0tID4gMDspIHtcblx0XHRcdGl0ZW0gPSByZW5kZXJJdGVtc1tpXTtcblx0XHRcdGl0ZW0ucGF0aChjdHhfd3JhcCk7XG5cblx0XHRcdGlmIChjdHguaXNQb2ludEluUGF0aChwb2ludGVyLnggKiBkcHIsIHBvaW50ZXIueSAqIGRwcikpIHtcblx0XHRcdFx0Ly8gb3Zlci5wdXNoKGl0ZW0pO1xuXHRcdFx0XHRvdmVyID0gaXRlbTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gY2xlYXIgb2xkIG1vdXNlaW5cblx0XHRpZiAobGFzdF9vdmVyICYmIGxhc3Rfb3ZlciAhPSBvdmVyKSB7XG5cdFx0XHRpdGVtID0gbGFzdF9vdmVyO1xuXHRcdFx0aWYgKGl0ZW0ubW91c2VvdXQpIGl0ZW0ubW91c2VvdXQoKTtcblx0XHR9XG5cblx0XHRpZiAob3Zlcikge1xuXHRcdFx0aXRlbSA9IG92ZXI7XG5cdFx0XHRpZiAoaXRlbS5tb3VzZW92ZXIpIGl0ZW0ubW91c2VvdmVyKCk7XG5cblx0XHRcdGlmIChtb3VzZWRvd24yKSB7XG5cdFx0XHRcdG1vdXNlZG93bkl0ZW0gPSBpdGVtO1xuXHRcdFx0fVxuXHRcdH1cblxuXG5cblx0XHQvLyBjb25zb2xlLmxvZyhwb2ludGVyKVxuXHR9XG5cblx0ZnVuY3Rpb24gcG9pbnRlckV2ZW50cygpIHtcblx0XHRpZiAoIXBvaW50ZXIpIHJldHVybjtcblxuXHRcdGN0eF93cmFwXG5cdFx0XHQuc2F2ZSgpXG5cdFx0XHQuc2NhbGUoZHByLCBkcHIpXG5cdFx0XHQudHJhbnNsYXRlKDAsIE1BUktFUl9UUkFDS19IRUlHSFQpXG5cdFx0XHQuYmVnaW5QYXRoKClcblx0XHRcdC5yZWN0KDAsIDAsIExheW91dENvbnN0YW50cy53aWR0aCwgU0NST0xMX0hFSUdIVClcblx0XHRcdC50cmFuc2xhdGUoLXNjcm9sbExlZnQsIC1zY3JvbGxUb3ApXG5cdFx0XHQuY2xpcCgpXG5cdFx0XHQucnVuKGNoZWNrKVxuXHRcdFx0LnJlc3RvcmUoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIF9wYWludCgpIHtcblx0XHRpZiAoIW5lZWRzUmVwYWludCkge1xuXHRcdFx0cG9pbnRlckV2ZW50cygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNjcm9sbF9jYW52YXMucmVwYWludCgpO1xuXG5cdFx0c2V0VGltZVNjYWxlKCk7XG5cblx0XHRjdXJyZW50VGltZSA9IGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpLnZhbHVlO1xuXHRcdGZyYW1lX3N0YXJ0ID0gIGRhdGEuZ2V0KCd1aTpzY3JvbGxUaW1lJykudmFsdWU7XG5cblx0XHQvKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cdFx0Ly8gYmFja2dyb3VuZFxuXG5cdFx0Y3R4LmZpbGxTdHlsZSA9IFRoZW1lLmE7XG5cdFx0Y3R4LmNsZWFyUmVjdCgwLCAwLCB0cmFja19jYW52YXMud2lkdGgsIHRyYWNrX2NhbnZhcy5oZWlnaHQpO1xuXHRcdGN0eC5zYXZlKCk7XG5cdFx0Y3R4LnNjYWxlKGRwciwgZHByKTtcblxuXHRcdC8vXG5cblx0XHRjdHgubGluZVdpZHRoID0gMTsgLy8gLjUsIDEsIDJcblxuXHRcdHZhciB3aWR0aCA9IExheW91dENvbnN0YW50cy53aWR0aDtcblx0XHR2YXIgaGVpZ2h0ID0gTGF5b3V0Q29uc3RhbnRzLmhlaWdodDtcblxuXHRcdHZhciB1bml0cyA9IHRpbWVfc2NhbGUgLyB0aWNrTWFyazE7XG5cdFx0dmFyIG9mZnNldFVuaXRzID0gKGZyYW1lX3N0YXJ0ICogdGltZV9zY2FsZSkgJSB1bml0cztcblxuXHRcdHZhciBjb3VudCA9ICh3aWR0aCAtIExFRlRfR1VUVEVSICsgb2Zmc2V0VW5pdHMpIC8gdW5pdHM7XG5cblx0XHQvLyBjb25zb2xlLmxvZygndGltZV9zY2FsZScsIHRpbWVfc2NhbGUsICd0aWNrTWFyazEnLCB0aWNrTWFyazEsICd1bml0cycsIHVuaXRzLCAnb2Zmc2V0VW5pdHMnLCBvZmZzZXRVbml0cywgZnJhbWVfc3RhcnQpO1xuXG5cdFx0Ly8gdGltZV9zY2FsZSA9IHBpeGVscyB0byAxIHNlY29uZCAoNDApXG5cdFx0Ly8gdGlja01hcmsxID0gbWFya3MgcGVyIHNlY29uZCAobWFya3MgLyBzKVxuXHRcdC8vIHVuaXRzID0gcGl4ZWxzIHRvIGV2ZXJ5IG1hcmsgKDQwKVxuXG5cdFx0Ly8gbGFiZWxzIG9ubHlcblx0XHRmb3IgKGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0eCA9IGkgKiB1bml0cyArIExFRlRfR1VUVEVSIC0gb2Zmc2V0VW5pdHM7XG5cblx0XHRcdC8vIHZlcnRpY2FsIGxpbmVzXG5cdFx0XHRjdHguc3Ryb2tlU3R5bGUgPSBUaGVtZS5iO1xuXHRcdFx0Y3R4LmJlZ2luUGF0aCgpO1xuXHRcdFx0Y3R4Lm1vdmVUbyh4LCAwKTtcblx0XHRcdGN0eC5saW5lVG8oeCwgaGVpZ2h0KTtcblx0XHRcdGN0eC5zdHJva2UoKTtcblxuXHRcdFx0Y3R4LmZpbGxTdHlsZSA9IFRoZW1lLmQ7XG5cdFx0XHRjdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cblx0XHRcdHZhciB0ID0gKGkgKiB1bml0cyAtIG9mZnNldFVuaXRzKSAvIHRpbWVfc2NhbGUgKyBmcmFtZV9zdGFydDtcblx0XHRcdHQgPSB1dGlscy5mb3JtYXRfZnJpZW5kbHlfc2Vjb25kcyh0KTtcblx0XHRcdGN0eC5maWxsVGV4dCh0LCB4LCAzOCk7XG5cdFx0fVxuXG5cdFx0dW5pdHMgPSB0aW1lX3NjYWxlIC8gdGlja01hcmsyO1xuXHRcdGNvdW50ID0gKHdpZHRoIC0gTEVGVF9HVVRURVIgKyBvZmZzZXRVbml0cykgLyB1bml0cztcblxuXHRcdC8vIG1hcmtlciBsaW5lcyAtIG1haW5cblx0XHRmb3IgKGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gVGhlbWUuYztcblx0XHRcdGN0eC5iZWdpblBhdGgoKTtcblx0XHRcdHggPSBpICogdW5pdHMgKyBMRUZUX0dVVFRFUiAtIG9mZnNldFVuaXRzO1xuXHRcdFx0Y3R4Lm1vdmVUbyh4LCBNQVJLRVJfVFJBQ0tfSEVJR0hUIC0gMCk7XG5cdFx0XHRjdHgubGluZVRvKHgsIE1BUktFUl9UUkFDS19IRUlHSFQgLSAxNik7XG5cdFx0XHRjdHguc3Ryb2tlKCk7XG5cdFx0fVxuXG5cdFx0dmFyIG11bCA9IHRpY2tNYXJrMyAvIHRpY2tNYXJrMjtcblx0XHR1bml0cyA9IHRpbWVfc2NhbGUgLyB0aWNrTWFyazM7XG5cdFx0Y291bnQgPSAod2lkdGggLSBMRUZUX0dVVFRFUiArIG9mZnNldFVuaXRzKSAvIHVuaXRzO1xuXG5cdFx0Ly8gc21hbGwgdGlja3Ncblx0XHRmb3IgKGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdFx0aWYgKGkgJSBtdWwgPT09IDApIGNvbnRpbnVlO1xuXHRcdFx0Y3R4LnN0cm9rZVN0eWxlID0gVGhlbWUuYztcblx0XHRcdGN0eC5iZWdpblBhdGgoKTtcblx0XHRcdHggPSBpICogdW5pdHMgKyBMRUZUX0dVVFRFUiAtIG9mZnNldFVuaXRzO1xuXHRcdFx0Y3R4Lm1vdmVUbyh4LCBNQVJLRVJfVFJBQ0tfSEVJR0hUIC0gMCk7XG5cdFx0XHRjdHgubGluZVRvKHgsIE1BUktFUl9UUkFDS19IRUlHSFQgLSAxMCk7XG5cdFx0XHRjdHguc3Ryb2tlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gRW5jYXBzdWxhdGUgYSBzY3JvbGwgcmVjdCBmb3IgdGhlIGxheWVyc1xuXHRcdGN0eF93cmFwXG5cdFx0XHQuc2F2ZSgpXG5cdFx0XHQudHJhbnNsYXRlKDAsIE1BUktFUl9UUkFDS19IRUlHSFQpXG5cdFx0XHQuYmVnaW5QYXRoKClcblx0XHRcdC5yZWN0KDAsIDAsIExheW91dENvbnN0YW50cy53aWR0aCwgU0NST0xMX0hFSUdIVClcblx0XHRcdC50cmFuc2xhdGUoLXNjcm9sbExlZnQsIC1zY3JvbGxUb3ApXG5cdFx0XHQuY2xpcCgpXG5cdFx0XHQucnVuKGRyYXdMYXllckNvbnRlbnRzKVxuXHRcdFx0LnJlc3RvcmUoKTtcblxuXHRcdC8vIEN1cnJlbnQgTWFya2VyIC8gQ3Vyc29yXG5cdFx0Y3R4LnN0cm9rZVN0eWxlID0gJ3JlZCc7IC8vIFRoZW1lLmNcblx0XHR4ID0gKGN1cnJlbnRUaW1lIC0gZnJhbWVfc3RhcnQpICogdGltZV9zY2FsZSArIExFRlRfR1VUVEVSO1xuXG5cdFx0dmFyIHR4dCA9IHV0aWxzLmZvcm1hdF9mcmllbmRseV9zZWNvbmRzKGN1cnJlbnRUaW1lKTtcblx0XHR2YXIgdGV4dFdpZHRoID0gY3R4Lm1lYXN1cmVUZXh0KHR4dCkud2lkdGg7XG5cblx0XHR2YXIgYmFzZV9saW5lID0gTUFSS0VSX1RSQUNLX0hFSUdIVCAtIDUsIGhhbGZfcmVjdCA9IHRleHRXaWR0aCAvIDIgKyA0O1xuXG5cdFx0Y3R4LmJlZ2luUGF0aCgpO1xuXHRcdGN0eC5tb3ZlVG8oeCwgYmFzZV9saW5lKTtcblx0XHRjdHgubGluZVRvKHgsIGhlaWdodCk7XG5cdFx0Y3R4LnN0cm9rZSgpO1xuXG5cdFx0Y3R4LmZpbGxTdHlsZSA9ICdyZWQnOyAvLyBibGFja1xuXHRcdGN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcblx0XHRjdHguYmVnaW5QYXRoKCk7XG5cdFx0Y3R4Lm1vdmVUbyh4LCBiYXNlX2xpbmUgKyA1KTtcblx0XHRjdHgubGluZVRvKHggKyA1LCBiYXNlX2xpbmUpO1xuXHRcdGN0eC5saW5lVG8oeCArIGhhbGZfcmVjdCwgYmFzZV9saW5lKTtcblx0XHRjdHgubGluZVRvKHggKyBoYWxmX3JlY3QsIGJhc2VfbGluZSAtIDE0KTtcblx0XHRjdHgubGluZVRvKHggLSBoYWxmX3JlY3QsIGJhc2VfbGluZSAtIDE0KTtcblx0XHRjdHgubGluZVRvKHggLSBoYWxmX3JlY3QsIGJhc2VfbGluZSk7XG5cdFx0Y3R4LmxpbmVUbyh4IC0gNSwgYmFzZV9saW5lKTtcblx0XHRjdHguY2xvc2VQYXRoKCk7XG5cdFx0Y3R4LmZpbGwoKTtcblxuXHRcdGN0eC5maWxsU3R5bGUgPSAnd2hpdGUnO1xuXHRcdGN0eC5maWxsVGV4dCh0eHQsIHgsIGJhc2VfbGluZSAtIDQpO1xuXG5cdFx0Y3R4LnJlc3RvcmUoKTtcblxuXHRcdG5lZWRzUmVwYWludCA9IGZhbHNlO1xuXHRcdC8vIHBvaW50ZXJFdmVudHMoKTtcblxuXHR9XG5cblx0ZnVuY3Rpb24geV90b190cmFjayh5KSB7XG5cdFx0aWYgKHkgLSBNQVJLRVJfVFJBQ0tfSEVJR0hUIDwgMCkgcmV0dXJuIC0xO1xuXHRcdHJldHVybiAoeSAtIE1BUktFUl9UUkFDS19IRUlHSFQgKyBzY3JvbGxUb3ApIC8gTElORV9IRUlHSFQgfCAwO1xuXHR9XG5cblxuXHRmdW5jdGlvbiB4X3RvX3RpbWUoeCkge1xuXHRcdHZhciB1bml0cyA9IHRpbWVfc2NhbGUgLyB0aWNrTWFyazM7XG5cblx0XHQvLyByZXR1cm4gZnJhbWVfc3RhcnQgKyAoeCAtIExFRlRfR1VUVEVSKSAvIHRpbWVfc2NhbGU7XG5cblx0XHRyZXR1cm4gZnJhbWVfc3RhcnQgKyAoKHggLSBMRUZUX0dVVFRFUikgLyB1bml0cyB8IDApIC8gdGlja01hcmszO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGltZV90b194KHMpIHtcblx0XHR2YXIgZHMgPSBzIC0gZnJhbWVfc3RhcnQ7XG5cdFx0ZHMgKj0gdGltZV9zY2FsZTtcblx0XHRkcyArPSBMRUZUX0dVVFRFUjtcblxuXHRcdHJldHVybiBkcztcblx0fVxuXG5cdHZhciBtZSA9IHRoaXM7XG5cdHRoaXMucmVwYWludCA9IHJlcGFpbnQ7XG5cdHRoaXMuX3BhaW50ID0gX3BhaW50O1xuXG5cdHJlcGFpbnQoKTtcblxuXHR2YXIgbW91c2Vkb3duID0gZmFsc2UsIHNlbGVjdGlvbiA9IGZhbHNlO1xuXG5cdHZhciBkcmFnT2JqZWN0O1xuXHR2YXIgY2FudmFzQm91bmRzO1xuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW91c2VNb3ZlKTtcblxuXHR0cmFja19jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignZGJsY2xpY2snLCBmdW5jdGlvbihlKSB7XG5cdFx0Y2FudmFzQm91bmRzID0gdHJhY2tfY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHZhciBteCA9IGUuY2xpZW50WCAtIGNhbnZhc0JvdW5kcy5sZWZ0ICwgbXkgPSBlLmNsaWVudFkgLSBjYW52YXNCb3VuZHMudG9wO1xuXG5cblx0XHR2YXIgdHJhY2sgPSB5X3RvX3RyYWNrKG15KTtcblx0XHR2YXIgcyA9IHhfdG9fdGltZShteCk7XG5cblxuXHRcdGRpc3BhdGNoZXIuZmlyZSgna2V5ZnJhbWUnLCBsYXllcnNbdHJhY2tdLCBjdXJyZW50VGltZSk7XG5cblx0fSk7XG5cblx0ZnVuY3Rpb24gb25Nb3VzZU1vdmUoZSkge1xuXHRcdGNhbnZhc0JvdW5kcyA9IHRyYWNrX2NhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR2YXIgbXggPSBlLmNsaWVudFggLSBjYW52YXNCb3VuZHMubGVmdCAsIG15ID0gZS5jbGllbnRZIC0gY2FudmFzQm91bmRzLnRvcDtcblx0XHRvblBvaW50ZXJNb3ZlKG14LCBteSk7XG5cdH1cblxuXHR2YXIgcG9pbnRlcmRpZE1vdmVkID0gZmFsc2U7XG5cdHZhciBwb2ludGVyID0gbnVsbDtcblxuXHRmdW5jdGlvbiBvblBvaW50ZXJNb3ZlKHgsIHkpIHtcblx0XHRpZiAobW91c2Vkb3duSXRlbSkgcmV0dXJuO1xuXHRcdHBvaW50ZXJkaWRNb3ZlZCA9IHRydWU7XG5cdFx0cG9pbnRlciA9IHsgeDogeCwgeTogeSB9O1xuXHR9XG5cblx0dHJhY2tfY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3V0JywgZnVuY3Rpb24oKSB7XG5cdFx0cG9pbnRlciA9IG51bGw7XG5cdH0pO1xuXG5cdHZhciBtb3VzZWRvd24yID0gZmFsc2UsIG1vdXNlRG93blRoZW5Nb3ZlID0gZmFsc2U7XG5cdGhhbmRsZURyYWcodHJhY2tfY2FudmFzLCBmdW5jdGlvbiBkb3duKGUpIHtcblx0XHRtb3VzZWRvd24yID0gdHJ1ZTtcblx0XHRwb2ludGVyID0ge1xuXHRcdFx0eDogZS5vZmZzZXR4LFxuXHRcdFx0eTogZS5vZmZzZXR5XG5cdFx0fTtcblx0XHRwb2ludGVyRXZlbnRzKCk7XG5cblx0XHRpZiAoIW1vdXNlZG93bkl0ZW0pIGRpc3BhdGNoZXIuZmlyZSgndGltZS51cGRhdGUnLCB4X3RvX3RpbWUoZS5vZmZzZXR4KSk7XG5cdFx0Ly8gSGl0IGNyaXRlcmlhXG5cdH0sIGZ1bmN0aW9uIG1vdmUoZSkge1xuXHRcdG1vdXNlZG93bjIgPSBmYWxzZTtcblx0XHRpZiAobW91c2Vkb3duSXRlbSkge1xuXHRcdFx0bW91c2VEb3duVGhlbk1vdmUgPSB0cnVlO1xuXHRcdFx0aWYgKG1vdXNlZG93bkl0ZW0ubW91c2VkcmFnKSB7XG5cdFx0XHRcdG1vdXNlZG93bkl0ZW0ubW91c2VkcmFnKGUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ3RpbWUudXBkYXRlJywgeF90b190aW1lKGUub2Zmc2V0eCkpO1xuXHRcdH1cblx0fSwgZnVuY3Rpb24gdXAoZSkge1xuXHRcdGlmIChtb3VzZURvd25UaGVuTW92ZSkge1xuXHRcdFx0ZGlzcGF0Y2hlci5maXJlKCdrZXlmcmFtZS5tb3ZlJyk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZGlzcGF0Y2hlci5maXJlKCd0aW1lLnVwZGF0ZScsIHhfdG9fdGltZShlLm9mZnNldHgpKTtcblx0XHR9XG5cdFx0bW91c2Vkb3duMiA9IGZhbHNlO1xuXHRcdG1vdXNlZG93bkl0ZW0gPSBudWxsO1xuXHRcdG1vdXNlRG93blRoZW5Nb3ZlID0gZmFsc2U7XG5cdH1cblx0KTtcblxuXHR0aGlzLnNldFN0YXRlID0gZnVuY3Rpb24oc3RhdGUpIHtcblx0XHRsYXllcnMgPSBzdGF0ZS52YWx1ZTtcblx0XHRyZXBhaW50KCk7XG5cdH07XG5cbn1cblxuZXhwb3J0IHsgVGltZWxpbmVQYW5lbCB9XG4iLCJpbXBvcnQgeyBUaGVtZSB9IGZyb20gJy4uL3RoZW1lLmpzJ1xuaW1wb3J0IHsgdXRpbHMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcydcbmNvbnN0IHByb3h5X2N0eCA9IHV0aWxzLnByb3h5X2N0eDtcbmltcG9ydCB7IGhhbmRsZURyYWcgfSBmcm9tICcuLi91dGlscy91dGlsX2hhbmRsZV9kcmFnLmpzJ1xuXG4vKiBUaGlzIGlzIHRoZSB0b3AgYmFyIHdoZXJlIGl0IHNob3dzIGEgaG9yaXpvbnRhbCBzY3JvbGxzIGFzIHdlbGwgYXMgYSBjdXN0b20gdmlldyBwb3J0ICovXG5cbmZ1bmN0aW9uIFJlY3QoKSB7XG5cbn1cblxuUmVjdC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24oeCwgeSwgdywgaCwgY29sb3IsIG91dGxpbmUpIHtcblx0dGhpcy54ID0geDtcblx0dGhpcy55ID0geTtcblx0dGhpcy53ID0gdztcblx0dGhpcy5oID0gaDtcblx0dGhpcy5jb2xvciA9IGNvbG9yO1xuXHR0aGlzLm91dGxpbmUgPSBvdXRsaW5lO1xufTtcblxuUmVjdC5wcm90b3R5cGUucGFpbnQgPSBmdW5jdGlvbihjdHgpIHtcblx0Y3R4LmZpbGxTdHlsZSA9IFRoZW1lLmI7ICAvLyAvLyAneWVsbG93Jztcblx0Y3R4LnN0cm9rZVN0eWxlID0gVGhlbWUuYztcblxuXHR0aGlzLnNoYXBlKGN0eCk7XG5cblx0Y3R4LnN0cm9rZSgpO1xuXHRjdHguZmlsbCgpO1xufTtcblxuUmVjdC5wcm90b3R5cGUuc2hhcGUgPSBmdW5jdGlvbihjdHgpIHtcblx0Y3R4LmJlZ2luUGF0aCgpO1xuXHRjdHgucmVjdCh0aGlzLngsIHRoaXMueSwgdGhpcy53LCB0aGlzLmgpO1xufTtcblxuUmVjdC5wcm90b3R5cGUuY29udGFpbnMgPSBmdW5jdGlvbih4LCB5KSB7XG5cdHJldHVybiB4ID49IHRoaXMueCAmJiB5ID49IHRoaXMueSAmJiB4IDw9IHRoaXMueCArIHRoaXMudyAmJiB5IDw9IHRoaXMueSArIHRoaXMuaDtcbn07XG5cblxuXG5mdW5jdGlvbiBTY3JvbGxDYW52YXMoZGlzcGF0Y2hlciwgZGF0YSkge1xuXHR2YXIgd2lkdGgsIGhlaWdodDtcblxuXHR0aGlzLnNldFNpemUgPSBmdW5jdGlvbih3LCBoKSB7XG5cdFx0d2lkdGggPSB3O1xuXHRcdGhlaWdodCA9IGg7XG5cdH1cblxuXHR2YXIgVE9QX1NDUk9MTF9UUkFDSyA9IDIwO1xuXHR2YXIgTUFSR0lOUyA9IDE1O1xuXG5cdHZhciBzY3JvbGxlciA9IHtcblx0XHRsZWZ0OiAwLFxuXHRcdGdyaXBfbGVuZ3RoOiAwLFxuXHRcdGs6IDFcblx0fTtcblxuXHR2YXIgc2Nyb2xsUmVjdCA9IG5ldyBSZWN0KCk7XG5cblx0dGhpcy5wYWludCA9IGZ1bmN0aW9uKGN0eCkge1xuXHRcdHZhciB0b3RhbFRpbWUgPSBkYXRhLmdldCgndWk6dG90YWxUaW1lJykudmFsdWU7XG5cdFx0dmFyIHNjcm9sbFRpbWUgPSBkYXRhLmdldCgndWk6c2Nyb2xsVGltZScpLnZhbHVlO1xuXHRcdHZhciBjdXJyZW50VGltZSA9IGRhdGEuZ2V0KCd1aTpjdXJyZW50VGltZScpLnZhbHVlO1xuXG5cdFx0dmFyIHBpeGVsc19wZXJfc2Vjb25kID0gZGF0YS5nZXQoJ3VpOnRpbWVTY2FsZScpLnZhbHVlO1xuXG5cdFx0Y3R4LnNhdmUoKTtcblx0XHR2YXIgZHByID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG5cdFx0Y3R4LnNjYWxlKGRwciwgZHByKTtcblxuXHRcdHZhciB3ID0gd2lkdGggLSAyICogTUFSR0lOUztcblx0XHR2YXIgaCA9IDE2OyAvLyBUT1BfU0NST0xMX1RSQUNLO1xuXG5cdFx0Y3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRjdHgudHJhbnNsYXRlKE1BUkdJTlMsIDUpO1xuXG5cdFx0Ly8gb3V0bGluZSBzY3JvbGxlclxuXHRcdGN0eC5iZWdpblBhdGgoKTtcblx0XHRjdHguc3Ryb2tlU3R5bGUgPSBUaGVtZS5iO1xuXHRcdGN0eC5yZWN0KDAsIDAsIHcsIGgpO1xuXHRcdGN0eC5zdHJva2UoKTtcblxuXHRcdHZhciB0b3RhbFRpbWVQaXhlbHMgPSB0b3RhbFRpbWUgKiBwaXhlbHNfcGVyX3NlY29uZDtcblx0XHR2YXIgayA9IHcgLyB0b3RhbFRpbWVQaXhlbHM7XG5cdFx0c2Nyb2xsZXIuayA9IGs7XG5cblx0XHR2YXIgZ3JpcF9sZW5ndGggPSB3ICogaztcblxuXHRcdHNjcm9sbGVyLmdyaXBfbGVuZ3RoID0gZ3JpcF9sZW5ndGg7XG5cblx0XHRzY3JvbGxlci5sZWZ0ID0gc2Nyb2xsVGltZSAvIHRvdGFsVGltZSAqIHc7XG5cblx0XHRzY3JvbGxSZWN0LnNldChzY3JvbGxlci5sZWZ0LCAwLCBzY3JvbGxlci5ncmlwX2xlbmd0aCwgaCk7XG5cdFx0c2Nyb2xsUmVjdC5wYWludChjdHgpO1xuXG5cdFx0dmFyIHIgPSBjdXJyZW50VGltZSAvIHRvdGFsVGltZSAqIHc7XG5cblx0XHRjdHguZmlsbFN0eWxlID0gIFRoZW1lLmM7XG5cdFx0Y3R4LmxpbmVXaWR0aCA9IDI7XG5cblx0XHRjdHguYmVnaW5QYXRoKCk7XG5cblx0XHQvLyBjaXJjbGVcblx0XHQvLyBjdHguYXJjKHIsIGgyIC8gMiwgaDIgLyAxLjUsIDAsIE1hdGguUEkgKiAyKTtcblxuXHRcdC8vIGxpbmVcblx0XHRjdHgucmVjdChyLCAwLCAyLCBoICsgNSk7XG5cdFx0Y3R4LmZpbGwoKVxuXG5cdFx0Y3R4LmZpbGxUZXh0KGN1cnJlbnRUaW1lICYmIGN1cnJlbnRUaW1lLnRvRml4ZWQoMiksIHIsIGggKyAxNCk7XG5cdFx0Ly8gY3R4LmZpbGxUZXh0KGN1cnJlbnRUaW1lICYmIGN1cnJlbnRUaW1lLnRvRml4ZWQoMyksIDEwLCAxMCk7XG5cdFx0Y3R4LmZpbGxUZXh0KHRvdGFsVGltZSwgMzAwLCAxNCk7XG5cblx0XHRjdHgucmVzdG9yZSgpO1xuXHR9XG5cblx0LyoqIEhhbmRsZXMgZHJhZ2dpbmcgZm9yIHNjcm9sbCBiYXIgKiovXG5cblx0dmFyIGRyYWdnaW5neCA9IG51bGw7XG5cblx0dGhpcy5vbkRvd24gPSBmdW5jdGlvbihlKSB7XG5cdFx0Ly8gY29uc29sZS5sb2coJ29uZG93bicsIGUpO1xuXG5cdFx0aWYgKHNjcm9sbFJlY3QuY29udGFpbnMoZS5vZmZzZXR4IC0gTUFSR0lOUywgZS5vZmZzZXR5IC01KSkge1xuXHRcdFx0ZHJhZ2dpbmd4ID0gc2Nyb2xsZXIubGVmdDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR2YXIgdG90YWxUaW1lID0gZGF0YS5nZXQoJ3VpOnRvdGFsVGltZScpLnZhbHVlO1xuXHRcdHZhciBwaXhlbHNfcGVyX3NlY29uZCA9IGRhdGEuZ2V0KCd1aTp0aW1lU2NhbGUnKS52YWx1ZTtcblx0XHR2YXIgdyA9IHdpZHRoIC0gMiAqIE1BUkdJTlM7XG5cblx0XHR2YXIgdCA9IChlLm9mZnNldHggLSBNQVJHSU5TKSAvIHcgKiB0b3RhbFRpbWU7XG5cdFx0Ly8gdCA9IE1hdGgubWF4KDAsIHQpO1xuXG5cdFx0Ly8gZGF0YS5nZXQoJ3VpOmN1cnJlbnRUaW1lJykudmFsdWUgPSB0O1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgndGltZS51cGRhdGUnLCB0KTtcblxuXHRcdGlmIChlLnByZXZlbnREZWZhdWx0KSBlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0fTtcblxuXHR0aGlzLm9uTW92ZSA9IGZ1bmN0aW9uIG1vdmUoZSkge1xuXHRcdGlmIChkcmFnZ2luZ3ggIT0gbnVsbCkge1xuXHRcdFx0dmFyIHRvdGFsVGltZSA9IGRhdGEuZ2V0KCd1aTp0b3RhbFRpbWUnKS52YWx1ZTtcblx0XHRcdHZhciB3ID0gd2lkdGggLSAyICogTUFSR0lOUztcblx0XHRcdHZhciBzY3JvbGxUaW1lID0gKGRyYWdnaW5neCArIGUuZHgpIC8gdyAqIHRvdGFsVGltZTtcblxuXHRcdFx0Y29uc29sZS5sb2coc2Nyb2xsVGltZSwgZHJhZ2dpbmd4LCBlLmR4LCBzY3JvbGxlci5ncmlwX2xlbmd0aCwgdyk7XG5cblx0XHRcdGlmIChkcmFnZ2luZ3ggICsgZS5keCArIHNjcm9sbGVyLmdyaXBfbGVuZ3RoID4gdykgcmV0dXJuO1xuXG5cdFx0XHRkaXNwYXRjaGVyLmZpcmUoJ3VwZGF0ZS5zY3JvbGxUaW1lJywgc2Nyb2xsVGltZSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5vbkRvd24oZSk7XG5cdFx0fVxuXG5cdH07XG5cblx0dGhpcy5vblVwID0gZnVuY3Rpb24oZSkge1xuXHRcdGRyYWdnaW5neCA9IG51bGw7XG5cdH1cblxuXHQvKioqIEVuZCBoYW5kbGluZyBmb3Igc2Nyb2xsYmFyICoqKi9cbn1cblxuZXhwb3J0IHsgU2Nyb2xsQ2FudmFzIH0iLCJpbXBvcnQgeyBUaGVtZSB9IGZyb20gJy4uL3RoZW1lLmpzJ1xuaW1wb3J0IHsgVUlOdW1iZXIgfSBmcm9tICcuLi91aS91aV9udW1iZXIuanMnXG5pbXBvcnQgeyBUd2VlbnMgfSBmcm9tICcuLi91dGlscy91dGlsX3R3ZWVuLmpzJ1xuaW1wb3J0IHsgTGF5b3V0Q29uc3RhbnRzIH0gZnJvbSAnLi4vbGF5b3V0X2NvbnN0YW50cy5qcydcbmltcG9ydCB7IHV0aWxzIH0gZnJvbSAnLi4vdXRpbHMvdXRpbHMuanMnXG47XG5cbi8vIFRPRE8gLSB0YWdnZWQgYnkgaW5kZXggaW5zdGVhZCwgd29yayBvZmYgbGF5ZXJzLlxuXG5mdW5jdGlvbiBMYXllclZpZXcobGF5ZXIsIGRpc3BhdGNoZXIpIHtcblx0dmFyIGRvbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdHZhciBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblxuXHRsYWJlbC5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZTogMTJweDsgcGFkZGluZzogNHB4Oyc7XG5cblx0bGFiZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKSB7XG5cdFx0Ly8gY29udGV4dC5kaXNwYXRjaGVyLmZpcmUoJ2xhYmVsJywgY2hhbm5lbE5hbWUpO1xuXHR9KTtcblxuXHRsYWJlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCBmdW5jdGlvbihlKSB7XG5cdFx0Ly8gY29udGV4dC5kaXNwYXRjaGVyLmZpcmUoJ2xhYmVsJywgY2hhbm5lbE5hbWUpO1xuXHR9KTtcblxuXHR2YXIgZHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0dmFyIG9wdGlvbjtcblx0ZHJvcGRvd24uc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6IDEwcHg7IHdpZHRoOiA2MHB4OyBtYXJnaW46IDA7IGZsb2F0OiByaWdodDsgdGV4dC1hbGlnbjogcmlnaHQ7JztcblxuXHRmb3IgKHZhciBrIGluIFR3ZWVucykge1xuXHRcdG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuXHRcdG9wdGlvbi50ZXh0ID0gaztcblx0XHRkcm9wZG93bi5hcHBlbmRDaGlsZChvcHRpb24pO1xuXHR9XG5cblx0ZHJvcGRvd24uYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oZSkge1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgnZWFzZScsIGxheWVyLCBkcm9wZG93bi52YWx1ZSk7XG5cdH0pO1xuXHR2YXIgaGVpZ2h0ID0gKExheW91dENvbnN0YW50cy5MSU5FX0hFSUdIVCAtIDEpO1xuXG5cdHZhciBrZXlmcmFtZV9idXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0a2V5ZnJhbWVfYnV0dG9uLmlubmVySFRNTCA9ICcmIzk2NzI7JzsgLy8gJyZkaWFtczsnICYjOTY3MTsgOTY3OSA5NjcwIDk2NzJcblx0a2V5ZnJhbWVfYnV0dG9uLnN0eWxlLmNzc1RleHQgPSAnYmFja2dyb3VuZDogbm9uZTsgZm9udC1zaXplOiAxMnB4OyBwYWRkaW5nOiAwcHg7IGZvbnQtZmFtaWx5OiBtb25vc3BhY2U7IGZsb2F0OiByaWdodDsgd2lkdGg6IDIwcHg7IGhlaWdodDogJyArIGhlaWdodCArICdweDsgYm9yZGVyLXN0eWxlOm5vbmU7IG91dGxpbmU6IG5vbmU7JzsgLy8gIGJvcmRlci1zdHlsZTppbnNldDtcblxuXHRrZXlmcmFtZV9idXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKSB7XG5cdFx0Y29uc29sZS5sb2coJ2NsaWNrZWQ6a2V5ZnJhbWluZy4uLicsIHN0YXRlLmdldCgnX3ZhbHVlJykudmFsdWUpO1xuXHRcdGRpc3BhdGNoZXIuZmlyZSgna2V5ZnJhbWUnLCBsYXllciwgc3RhdGUuZ2V0KCdfdmFsdWUnKS52YWx1ZSk7XG5cdH0pO1xuXG5cdC8qXG5cdC8vIFByZXYgS2V5ZnJhbWVcblx0dmFyIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRidXR0b24udGV4dENvbnRlbnQgPSAnPCc7XG5cdGJ1dHRvbi5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZTogMTJweDsgcGFkZGluZzogMXB4OyAnO1xuXHRkb20uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcblxuXHQvLyBOZXh0IEtleWZyYW1lXG5cdGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRidXR0b24udGV4dENvbnRlbnQgPSAnPic7XG5cdGJ1dHRvbi5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZTogMTJweDsgcGFkZGluZzogMXB4OyAnO1xuXHRkb20uYXBwZW5kQ2hpbGQoYnV0dG9uKTtcblxuXG5cdCovXG5cblx0ZnVuY3Rpb24gVG9nZ2xlQnV0dG9uKHRleHQpIHtcblx0XHQvLyBmb3IgY3NzIGJhc2VkIGJ1dHRvbiBzZWUgaHR0cDovL2NvZGVwZW4uaW8vbWFsbGVuZGVvL3Blbi9lTElpR1xuXG5cdFx0dmFyIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGJ1dHRvbi50ZXh0Q29udGVudCA9IHRleHQ7XG5cblx0XHR1dGlscy5zdHlsZShidXR0b24sIHtcblx0XHRcdGZvbnRTaXplOiAnMTJweCcsXG5cdFx0XHRwYWRkaW5nOiAnMXB4Jyxcblx0XHRcdGJvcmRlclNpemU6ICcycHgnLFxuXHRcdFx0b3V0bGluZTogJ25vbmUnLFxuXHRcdFx0YmFja2dyb3VuZDogVGhlbWUuYSxcblx0XHRcdGNvbG9yOiBUaGVtZS5jLFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5wcmVzc2VkID0gZmFsc2U7XG5cblx0XHRidXR0b24ub25jbGljayA9ICgpID0+IHtcblx0XHRcdHRoaXMucHJlc3NlZCA9ICF0aGlzLnByZXNzZWQ7XG5cblx0XHRcdHV0aWxzLnN0eWxlKGJ1dHRvbiwge1xuXHRcdFx0XHRib3JkZXJTdHlsZTogdGhpcy5wcmVzc2VkID8gJ2luc2V0JyA6ICdvdXRzZXQnLCAvLyBpbnNldCBvdXRzZXQgZ3Jvb3ZlIHJpZGdlXG5cdFx0XHR9KVxuXG5cdFx0XHRpZiAodGhpcy5vbkNsaWNrKSB0aGlzLm9uQ2xpY2soKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5kb20gPSBidXR0b247XG5cblx0fVxuXG5cdC8vIFNvbG9cblx0dmFyIHNvbG9fdG9nZ2xlID0gbmV3IFRvZ2dsZUJ1dHRvbignUycpO1xuXHRkb20uYXBwZW5kQ2hpbGQoc29sb190b2dnbGUuZG9tKTtcblxuXHRzb2xvX3RvZ2dsZS5vbkNsaWNrID0gZnVuY3Rpb24oKSB7XG5cdFx0ZGlzcGF0Y2hlci5maXJlKCdhY3Rpb246c29sbycsIGxheWVyLCBzb2xvX3RvZ2dsZS5wcmVzc2VkKTtcblx0fVxuXG5cdC8vIE11dGVcblx0dmFyIG11dGVfdG9nZ2xlID0gbmV3IFRvZ2dsZUJ1dHRvbignTScpO1xuXHRkb20uYXBwZW5kQ2hpbGQobXV0ZV90b2dnbGUuZG9tKTtcblxuXHRtdXRlX3RvZ2dsZS5vbkNsaWNrID0gZnVuY3Rpb24oKSB7XG5cdFx0ZGlzcGF0Y2hlci5maXJlKCdhY3Rpb246bXV0ZScsIGxheWVyLCBtdXRlX3RvZ2dsZS5wcmVzc2VkKTtcblx0fVxuXG5cdHZhciBudW1iZXIgPSBuZXcgVUlOdW1iZXIobGF5ZXIsIGRpc3BhdGNoZXIpO1xuXG5cdG51bWJlci5vbkNoYW5nZS5kbyhmdW5jdGlvbih2YWx1ZSwgZG9uZSkge1xuXHRcdHN0YXRlLmdldCgnX3ZhbHVlJykudmFsdWUgPSB2YWx1ZTtcblx0XHRkaXNwYXRjaGVyLmZpcmUoJ3ZhbHVlLmNoYW5nZScsIGxheWVyLCB2YWx1ZSwgZG9uZSk7XG5cdH0pO1xuXG5cdHV0aWxzLnN0eWxlKG51bWJlci5kb20sIHtcblx0XHRmbG9hdDogJ3JpZ2h0J1xuXHR9KTtcblxuXHRkb20uYXBwZW5kQ2hpbGQobGFiZWwpO1xuXHRkb20uYXBwZW5kQ2hpbGQoa2V5ZnJhbWVfYnV0dG9uKTtcblx0ZG9tLmFwcGVuZENoaWxkKG51bWJlci5kb20pO1xuXHRkb20uYXBwZW5kQ2hpbGQoZHJvcGRvd24pO1xuXG5cdHV0aWxzLnN0eWxlKGRvbSwge1xuXHRcdHRleHRBbGlnbjogJ2xlZnQnLFxuXHRcdG1hcmdpbjogJzBweCAwcHggMHB4IDVweCcsXG5cdFx0Ym9yZGVyQm90dG9tOiAnMXB4IHNvbGlkICcgKyBUaGVtZS5iLFxuXHRcdHRvcDogMCxcblx0XHRsZWZ0OiAwLFxuXHRcdGhlaWdodDogKExheW91dENvbnN0YW50cy5MSU5FX0hFSUdIVCAtIDEgKSArICdweCcsXG5cdFx0Y29sb3I6IFRoZW1lLmNcblx0fSk7XG5cblx0dGhpcy5kb20gPSBkb207XG5cblx0dGhpcy5yZXBhaW50ID0gcmVwYWludDtcblx0dmFyIHN0YXRlO1xuXG5cdHRoaXMuc2V0U3RhdGUgPSBmdW5jdGlvbihsLCBzKSB7XG5cdFx0bGF5ZXIgPSBsO1xuXHRcdHN0YXRlID0gcztcblxuXHRcdHZhciB0bXBfdmFsdWUgPSBzdGF0ZS5nZXQoJ192YWx1ZScpO1xuXHRcdGlmICh0bXBfdmFsdWUudmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dG1wX3ZhbHVlLnZhbHVlID0gMDtcblx0XHR9XG5cblx0XHRudW1iZXIuc2V0VmFsdWUodG1wX3ZhbHVlLnZhbHVlKTtcblx0XHRsYWJlbC50ZXh0Q29udGVudCA9IHN0YXRlLmdldCgnbmFtZScpLnZhbHVlO1xuXG5cdFx0cmVwYWludCgpO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHJlcGFpbnQocykge1xuXG5cdFx0ZHJvcGRvd24uc3R5bGUub3BhY2l0eSA9IDA7XG5cdFx0ZHJvcGRvd24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdGtleWZyYW1lX2J1dHRvbi5zdHlsZS5jb2xvciA9IFRoZW1lLmI7XG5cdFx0Ly8ga2V5ZnJhbWVfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0Ly8ga2V5ZnJhbWVfYnV0dG9uLnN0eWxlLmJvcmRlclN0eWxlID0gJ3NvbGlkJztcblxuXHRcdHZhciB0d2VlbiA9IG51bGw7XG5cdFx0dmFyIG8gPSB1dGlscy50aW1lQXRMYXllcihsYXllciwgcyk7XG5cblx0XHRpZiAoIW8pIHJldHVybjtcblxuXHRcdGlmIChvLmNhbl90d2Vlbikge1xuXHRcdFx0ZHJvcGRvd24uc3R5bGUub3BhY2l0eSA9IDE7XG5cdFx0XHRkcm9wZG93bi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0Ly8gaWYgKG8udHdlZW4pXG5cdFx0XHRkcm9wZG93bi52YWx1ZSA9IG8udHdlZW4gPyBvLnR3ZWVuIDogJ25vbmUnO1xuXHRcdFx0aWYgKGRyb3Bkb3duLnZhbHVlID09PSAnbm9uZScpIGRyb3Bkb3duLnN0eWxlLm9wYWNpdHkgPSAwLjU7XG5cdFx0fVxuXG5cdFx0aWYgKG8ua2V5ZnJhbWUpIHtcblx0XHRcdGtleWZyYW1lX2J1dHRvbi5zdHlsZS5jb2xvciA9IFRoZW1lLmM7XG5cdFx0XHQvLyBrZXlmcmFtZV9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0Ly8ga2V5ZnJhbWVfYnV0dG9uLnN0eWxlLmJvcmRlclN0eWxlID0gJ2luc2V0Jztcblx0XHR9XG5cblx0XHRzdGF0ZS5nZXQoJ192YWx1ZScpLnZhbHVlID0gby52YWx1ZTtcblx0XHRudW1iZXIuc2V0VmFsdWUoby52YWx1ZSk7XG5cdFx0bnVtYmVyLnBhaW50KCk7XG5cblx0XHRkaXNwYXRjaGVyLmZpcmUoJ3RhcmdldC5ub3RpZnknLCBsYXllci5uYW1lLCBvLnZhbHVlKTtcblx0fVxuXG59XG5cbmV4cG9ydCB7IExheWVyVmlldyB9XG4iXX0=

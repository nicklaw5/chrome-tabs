// jshint esversion: 6

(function (root, factory) { // Universal module definition.
  // See: <https://github.com/umdjs/umd/tree/master/templates>

  if (typeof define === 'function' && define.amd) {

    // AMD / RequireJS (anonymous module).
    define(['jquery', 'draggabilly/draggabilly'],
      (jQuery, Draggabilly) => factory(root, jQuery, Draggabilly));

  } else if (typeof module === 'object' && module.exports) {

    // NodeJS, Browserify, CommonJS-like, etc.
    let jQuery = root.jQuery || require('jquery');
    let Draggabilly = root.Draggabilly || require('draggabilly');
    module.exports = factory(root, jQuery, Draggabilly);

  } else { // Anything else.
    factory(root, jQuery, Draggabilly);
  }
  // -------------------------------------------------------------------------------------------------------------------
})( /* root = */ window, /* factory = */ (window, jQuery, Draggabilly) => {
  'use strict';

  // jQuery.

  let $ = jQuery;

  // Begin statics.

  let totalInstances = -1;

  let defaultTabTitle = 'New Tab';
  let defaultUnknownUrlTabTitle = 'Web Page';
  let defaultTabUrl = 'https://duckduckgo.com/?kae=b&kak=-1&kao=-1&k1=-1&kt=p&kj=f5f5f5&ka=p&kf=1&kam=google-maps&km=l&ko=1';
  let defaultLoadingTabFavicon = 'loading';
  let defaultTabFavicon = 'default';

  let tabTemplate = `
    <div class="-tab">
      <div class="-background">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <symbol id="topleft" viewBox="0 0 214 29">
              <path d="M14.3 0.1L214 0.1 214 29 0 29C0 29 12.2 2.6 13.2 1.1 14.3-0.4 14.3 0.1 14.3 0.1Z" />
            </symbol>
            <symbol id="topright" viewBox="0 0 214 29">
              <use xlink:href="#topleft" />
            </symbol>
            <clipPath id="crop">
              <rect class="mask" width="100%" height="100%" x="0" />
            </clipPath>
          </defs>
          <svg width="50%" height="100%" transfrom="scale(-1, 1)">
            <use xlink:href="#topleft" width="214" height="29" class="-background" />
            <use xlink:href="#topleft" width="214" height="29" class="-shadow" />
          </svg>
          <g transform="scale(-1, 1)">
            <svg width="50%" height="100%" x="-100%" y="0">
              <use xlink:href="#topright" width="214" height="29" class="-background" />
              <use xlink:href="#topright" width="214" height="29" class="-shadow" />
            </svg>
          </g>
        </svg>
      </div>
      <div class="-favicon"></div>
      <div class="-title"></div>
      <div class="-close"></div>
    </div>
  `;
  let webViewTemplate = `
    <webview class="-view"></webview>
  `;
  let iframeViewTemplate = `
    <iframe class="-view" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock"></iframe>
  `; // Note the absence of `allow-top-navigation` in this list; i.e., do not allow frames to break the tabbed interface.
  // This attribute can be altered at runtime using `defaultProps.viewAttrs.sandbox`.

  // Begin `ChromeTabz{}` class.

  class ChromeTabz {
    get $tabz() {
      return this.$content.find('> .-tab');
    }

    get $currentTab() {
      return this.$tabz.filter('.-current');
    }

    get tabWidth() {
      let width = this.$content.innerWidth() - this.settings.overlapDistance;
      width = (width / this.$tabz.length) + this.settings.overlapDistance;
      return Math.max(this.settings.minWidth, Math.min(this.settings.maxWidth, width));
    }

    get effectiveTabWidth() {
      return this.tabWidth - this.settings.overlapDistance;
    }

    get tabPositions() {
      let positions = [],
        x = 0; // X axis positions.
      let effectiveWidth = this.effectiveTabWidth;

      this.$tabz.each((i, tab) => {
        positions.push(x);
        x += effectiveWidth;
      });
      return positions;
    }

    constructor(settings) {
      this.defaultSettings = {
        obj: '.chrome-tabz',

        minWidth: 45,
        maxWidth: 243,
        leftMargin: 0,
        rightMargin: 300,
        overlapDistance: 14,

        viewz: 'iframes',
        // `iframes` or `webviews`.
        // `webviews` = Electron compatibility.
        // Or leave empty to disable viewz entirely.

        allowDragNDrop: true,
        allowDoubleClick: true,
        initial: [], // Array of prop objs.

        defaultProps: {
          url: defaultTabUrl,
          title: defaultTabTitle,
          favicon: defaultTabFavicon,

          loadingFavicon: defaultLoadingTabFavicon,
          unknownUrlTitle: defaultUnknownUrlTabTitle,

          viewAttrs: {} // Optional `<iframe>` or `<webview>` attrs.
          // These are simply `key: value` pairs representing HTML attrs.
        },
        debug: false, // Set as `false` in production please.
        // This setting enables console logging, for debugging.
      };
      if (settings && typeof settings !== 'object') {
        throw '`settings` is not an object.';
      }
      this.settings = $.extend(true, {}, this.defaultSettings, settings || {});

      if ($.inArray(typeof this.settings.obj, ['string', 'object']) === -1) {
        throw '`obj` must be a string selector, jQuery, or an element in the DOM.';
      } else if ((this.$obj = $(this.settings.obj).first()).length !== 1) {
        throw 'Unable to locate a single `obj` in the DOM.';
        //
      } else if (typeof this.settings.minWidth !== 'number' || isNaN(this.settings.minWidth)) {
        throw '`minWidth` is not a number.';
      } else if (typeof this.settings.maxWidth !== 'number' || isNaN(this.settings.maxWidth)) {
        throw '`maxWidth` is not a number.';
      } else if (typeof this.settings.leftMargin !== 'number' || isNaN(this.settings.leftMargin)) {
        throw '`leftMargin` is not a number.';
      } else if (typeof this.settings.rightMargin !== 'number' || isNaN(this.settings.rightMargin)) {
        throw '`rightMargin` is not a number.';
      } else if (typeof this.settings.overlapDistance !== 'number' || isNaN(this.settings.overlapDistance)) {
        throw '`overlapDistance` is not a number.';
        //
      } else if ($.inArray(this.settings.viewz, ['', 'iframes', 'webviews']) === -1) {
        throw '`viewz` must be: iframes, webviews, or an empty string.';
        //
      } else if (typeof this.settings.allowDragNDrop !== 'boolean') {
        throw '`allowDragNDrop` is not a boolean.';
      } else if (typeof this.settings.allowDoubleClick !== 'boolean') {
        throw '`allowDoubleClick` is not a boolean.';
      } else if (!(this.settings.initial instanceof Array)) {
        throw '`initial` is not an array.';
        //
      } else if (typeof this.settings.defaultProps !== 'object') {
        throw '`defaultProps` is not an object.';
        //
      } else if ($.inArray(typeof this.settings.debug, ['number', 'boolean']) === -1) {
        throw '`debug` is not a number or boolean.';
      }
      this.settings.minWidth = Math.max(1, this.settings.minWidth);
      this.settings.maxWidth = Math.max(1, this.settings.maxWidth);
      this.settings.rightMargin = Math.max(0, this.settings.rightMargin);
      this.settings.overlapDistance = Math.max(0, this.settings.overlapDistance);

      this.$obj.data('chromeTabz', this); // Instance reference.

      this.$bar = $('<div class="-bar"></div>');
      this.$content = $('<div class="-content"></div>');
      this.$bottomLine = $('<div class="-bottom-line"></div>');

      this.$viewz = $('<div class="-viewz"></div>');
      this.$styles = $('<style></style>');

      this.id = ++totalInstances; // Increment and assign an ID.
      this.draggabillyInstances = []; // Initialize instances.

      this.alwaysOnStyles = `.chrome-tabz.-id-${this.id} > .-bar > .-content {
        margin-left: ${this.settings.leftMargin}px;
        width: calc(100% - ${this.settings.rightMargin}px);
      }`;
      this.$obj.trigger('constructed', [this]);

      this.initialize(); // Initialize.
    }

    initialize() {
      this.addClasses();

      this.addBar();
      this.addContent();
      this.addBottomLine();
      this.addStyles();

      this.addViewz();
      this.addEvents();

      this.configureLayout();
      this.fixStackingOrder();
      this.addDraggabilly();

      if (this.settings.initial.length) {
        this.addTabz(this.settings.initial);
      }
      this.$obj.trigger('initialized', [this]);
    }

    destroy() {
      this.removeDraggabilly();
      this.$tabz.remove();

      this.removeEvents();
      this.removeViewz();

      this.removeStyles();
      this.removeBottomLine();
      this.removeContent();
      this.removeBar();

      this.removeClasses();

      this.$obj.removeData('chromeTabz');
      this.$obj.trigger('destroyed', [this]);
      this.$obj.off('.chrome-tabz');
    }

    addClasses() {
      this.$obj.addClass('chrome-tabz');
      this.$obj.addClass('-id-' + this.id);
    }

    removeClasses() {
      this.$obj.removeClass('chrome-tabz');
      this.$obj.removeClass('-id-' + this.id);
    }

    addBar() {
      this.$obj.append(this.$bar);
    }

    removeBar() {
      this.$bar.remove();
    }

    addContent() {
      this.$bar.append(this.$content);
    }

    removeContent() {
      this.$content.remove();
    }

    addBottomLine() {
      this.$bar.append(this.$bottomLine);
    }

    removeBottomLine() {
      this.$bottomLine.remove();
    }

    addStyles() {
      this.$bar.append(this.$styles);
      this.$styles.html(this.alwaysOnStyles);
    }

    removeStyles() {
      this.$styles.remove();
    }

    addViewz() {
      if (!this.settings.viewz) {
        return; // Not applicable.
      }
      this.$obj.append(this.$viewz);

      new ChromeTabViewz($.extend({}, {
        parentObj: this.$obj,
        type: this.settings.viewz,
        defaultProps: this.settings.defaultProps
      }));
    }

    removeViewz() {
      if (this.settings.viewz) {
        this.$viewz.data('chromeTabViewz').destroy();
        this.$viewz.remove();
      }
    }

    addEvents() {
      $(window).on('resize.chrome-tabz.id-' + this.id, (e) => this.configureLayout());

      if (this.settings.allowDoubleClick) {
        this.$obj.on('dblclick.chrome-tabz', (e) => this.addTab());
      }
      this.$obj.on('click.chrome-tabz', (e) => {
        let $target = $(e.target);

        if ($target.hasClass('-tab')) {
          this.setCurrentTab($target);
        } else if ($target.hasClass('-favicon')) {
          this.setCurrentTab($target.parent('.-tab'));
        } else if ($target.hasClass('-title')) {
          this.setCurrentTab($target.parent('.-tab'));
        } else if ($target.hasClass('-close')) {
          this.removeTab($target.parent('.-tab'));
        }
      });
    }

    removeEvents() {
      $(window).off('.chrome-tabz.id-' + this.id);
      this.$obj.off('.chrome-tabz');
    }

    configureLayout() {
      this.$tabz.width(this.tabWidth);

      if (this.settings.allowDragNDrop) {
        this.$tabz.removeClass('-just-dragged');
        this.$tabz.removeClass('-currently-dragged');
      }
      requestAnimationFrame(() => {
        let styles = ''; // Initialize.

        $.each(this.tabPositions, (i, x) => {
          styles += `.chrome-tabz.-id-${this.id} > .-bar > .-content > .-tab:nth-child(${i + 1}) {
            transform: translate3d(${x}px, 0, 0);
          }`;
        }); // This adds an X offset layout for all tabz.
        this.$styles.html(this.alwaysOnStyles + styles); // Set styles.
      });
    }

    fixStackingOrder() {
      let totalTabz = this.$tabz.length;

      this.$tabz.each((i, tab) => {
        let $tab = $(tab);
        let zindex = totalTabz - i;

        if ($tab.hasClass('-current')) {
          zindex = totalTabz + 2;
          this.$bottomLine.css({ zindex: totalTabz + 1 });
        }
        $tab.css({ zindex: zindex });
      });
    }

    addDraggabilly() {
      if (!this.settings.allowDragNDrop) {
        return; // Not applicable.
      }
      this.removeDraggabilly();

      this.$tabz.each((i, tab) => {

        let $tab = $(tab); // Current tab.
        let originalX = this.tabPositions[i];

        let draggabilly = new Draggabilly($tab[0], { axis: 'x', containment: this.$content });
        this.draggabillyInstances.push(draggabilly); // Maintain instances.

        draggabilly.on('dragStart', () => {
          this.$tabz.removeClass('-just-dragged');
          this.$tabz.removeClass('-currently-dragged');

          this.fixStackingOrder();

          this.$bar.addClass('-dragging');
          $tab.addClass('-currently-dragged');
          this.$obj.trigger('tabDragStarted', [$tab, this]);
        });
        draggabilly.on('dragMove', (event, pointer, moveVector) => {
          let $tabz = this.$tabz;
          let prevIndex = $tab.index();
          let ew = this.effectiveTabWidth;
          let prevX = originalX + moveVector.x;

          let newIndex = Math.floor((prevX + (ew / 2)) / ew);
          newIndex = Math.max(0, Math.min(Math.max(0, $tabz.length - 1), newIndex));

          if (prevIndex !== newIndex) {
            $tab[newIndex < prevIndex ? 'insertBefore' : 'insertAfter']($tabz.eq(newIndex));
            this.$obj.trigger('tabDragMoved', [$tab, { prevIndex, newIndex }, this]);
          }
        });
        draggabilly.on('dragEnd', () => {
          let finalX = parseFloat($tab.css('left'), 10);
          $tab.css({ transform: 'translate3d(0, 0, 0)' });

          requestAnimationFrame(() => {
            $tab.css({ left: 0, transform: 'translate3d(' + finalX + 'px, 0, 0)' });

            requestAnimationFrame(() => {
              $tab.addClass('-just-dragged');
              $tab.removeClass('-currently-dragged');
              setTimeout(() => $tab.removeClass('-just-dragged'), 500);

              this.setCurrentTab($tab);

              requestAnimationFrame(() => {
                this.addDraggabilly();
                $tab.css({ transform: '' });

                this.$bar.removeClass('-dragging');
                this.$obj.trigger('tabDragStopped', [$tab, $tab.index(), this]);
              });
            });
          });
        });
      });
    }

    removeDraggabilly() {
      if (!this.settings.allowDragNDrop) {
        return; // Not applicable.
      }
      $.each(this.draggabillyInstances, (i, instance) => instance.destroy());
      this.draggabillyInstances = []; // Reset instance array.
    }

    addTab(props, setAsCurrent = true) {
      return this.addTabz([props], setAsCurrent);
    }

    addTabz(propSets, setAsCurrent = true) {
      let $tabz = $(); // Initialize.

      if (!(propSets instanceof Array) || !propSets.length) {
        throw 'Missing or invalid property sets.';
      }
      $.each(propSets, (i, props) => {
        if (props && typeof props !== 'object') {
          throw 'Invalid properties.';
        }
        let $tab = $(tabTemplate);
        this.$content.append($tab);

        $tab.addClass('-just-added');
        setTimeout(() => $tab.removeClass('-just-added'), 500);

        this.$obj.trigger('tabAdded', [$tab, this]);

        this.updateTab($tab, props);

        $tabz = $tabz.add($tab);
      });
      if (setAsCurrent) {
        this.setCurrentTab($tabz.first());
      }
      this.configureLayout();
      this.fixStackingOrder();
      this.addDraggabilly();

      return $tabz;
    }

    removeTab($tab) {
      if (!($tab instanceof jQuery) || !$tab.length) {
        throw 'Missing or invalid $tab.';
      }
      $tab = $tab.first(); // One tab only.

      return this.removeTabz($tab);
    }

    removeTabz($tabz) {
      if (!($tabz instanceof jQuery) || !$tabz.length) {
        throw 'Missing or invalid $tabz.';
      }
      $tabz.each((i, tab) => {
        let $tab = $(tab);

        if ($tab.hasClass('-current')) {
          if ($tab.prev('.-tab').length) {
            this.setCurrentTab($tab.prev('.-tab'));
          } else if ($tab.next('.-tab').length) {
            this.setCurrentTab($tab.next('.-tab'));
          } else {
            this.setCurrentTab(undefined);
          }
        }
        this.$obj.trigger('tabBeingRemoved', [$tab, this]);
        $tab.remove(); // Remove tab from the DOM.
        this.$obj.trigger('tabRemoved', [$tab, this]);
      });
      this.configureLayout();
      this.fixStackingOrder();
      this.addDraggabilly();
    }

    updateTab($tab, props, via) {
      if (!($tab instanceof jQuery) || !$tab.length) {
        throw 'Missing or invalid $tab.';
      } else if (props && typeof props !== 'object') {
        throw 'Invalid properties.';
      }
      $tab = $tab.first(); // One tab only.

      let prevProps = $tab.data('props') || {};
      let newProps = props || {};

      props = $.extend({}, this.settings.defaultProps, prevProps, newProps);
      $tab.data('props', props); // Update to new props.

      $tab.find('.-title').text(props.title);

      if (props.favicon) {
        if (props.favicon === defaultLoadingTabFavicon) {
          $tab.find('.-favicon').css({ 'background-image': '' }).attr('data-favicon', defaultLoadingTabFavicon);
        } else if (props.favicon === defaultTabFavicon) {
          $tab.find('.-favicon').css({ 'background-image': '' }).attr('data-favicon', defaultTabFavicon);
        } else {
          $tab.find('.-favicon').css({ 'background-image': 'url(\'' + props.favicon + '\')' }).attr('data-favicon', '');
        }
      } else { $tab.find('.-favicon').css({ 'background-image': 'none' }).attr('data-favicon', ''); }

      this.$obj.trigger('tabUpdated', [$tab, props, via, prevProps, newProps, this]);
    }

    setCurrentTab($tab) {
      if ($tab && (!($tab instanceof jQuery) || !$tab.length)) {
        throw 'Missing or invalid $tab.';
      }
      $tab = $tab ? $tab.first() : $(); // One tab only.

      this.$tabz.removeClass('-current');
      $tab.addClass('-current');
      this.fixStackingOrder();

      this.$obj.trigger('currentTabChanged', [$tab, this]);
    }
  } // End `ChromeTabz{}` class.

  // Begin `ChromeTabViewz{}` class.

  class ChromeTabViewz {
    get $viewz() {
      return this.$content.find('> .-view');
    }

    get $currentView() {
      return this.$viewz.filter('.-current');
    }

    constructor(settings) {
      this.defaultSettings = {
        parentObj: '.chrome-tabz',

        type: 'iframes', // or `webviews`.
        // `webviews` = Electron compatibility.

        defaultProps: {
          url: defaultTabUrl,
          title: defaultTabTitle,
          favicon: defaultTabFavicon,

          loadingFavicon: defaultLoadingTabFavicon,
          unknownUrlTitle: defaultUnknownUrlTabTitle,

          viewAttrs: {} // Optional `<iframe>` or `<webview>` attrs.
          // These are simply `key: value` pairs representing HTML attrs.
        },
        debug: false, // Set as `false` in production please.
        // This setting enables console logging, for debugging.
      };
      if (settings && typeof settings !== 'object') {
        throw '`settings` is not an object.';
      }
      this.settings = $.extend(true, {}, this.defaultSettings, settings || {});

      if ($.inArray(typeof this.settings.parentObj, ['string', 'object']) === -1) {
        throw '`parentObj` must be a string selector, jQuery, or an element in the DOM.';
      } else if ((this.$parentObj = $(this.settings.parentObj).first()).length !== 1) {
        throw 'Unable to locate a single `parentObj` in the DOM.';
      } else if (!((this.$parentObj._ = this.$parentObj.data('chromeTabz')) instanceof ChromeTabz)) {
        throw 'Unable to locate a `chromeTabz` instance in the `parentObj`.';
        //
      } else if ((this.$obj = this.$parentObj.find('> .-viewz')).length !== 1) {
        throw 'Unable to locate a single `> .-viewz` object in the DOM.';
        //
      } else if ($.inArray(this.settings.type, ['iframes', 'webviews']) === -1) {
        throw '`type` must be one of: `iframes` or `webviews`.';
        //
      } else if (typeof this.settings.defaultProps !== 'object') {
        throw '`defaultProps` is not an object.';
        //
      } else if ($.inArray(typeof this.settings.debug, ['number', 'boolean']) === -1) {
        throw '`debug` is not a number or boolean.';
      }
      this.$obj.data('chromeTabViewz', this); // Instance reference.

      this.viewIndex = []; // Initialize index array.
      this.$content = $('<div class="-content"></div>');

      this.$obj.trigger('constructed', [this]);

      this.initialize(); // Initialize.
    }

    initialize() {
      this.addContent();
      this.addEvents();

      this.$obj.trigger('initialized', [this]);
    }

    destroy() {
      this.$viewz.remove();

      this.removeEvents();
      this.removeContent();

      this.$obj.removeData('chromeTabViewz');
      this.$obj.trigger('destroyed', [this]);
      this.$obj.off('.chrome-tabz');
    }

    addContent() {
      this.$obj.append(this.$content);
    }

    removeContent() {
      this.$content.remove();
    }

    addEvents() {
      this.$parentObj.on('tabAdded.chrome-tabz', (e, $tab) => this.addView($tab));
      this.$parentObj.on('tabBeingRemoved.chrome-tabz', (e, $tab) => this.removeView(undefined, $tab));

      this.$parentObj.on('tabDragMoved.chrome-tabz', (e, $tab, locations) => this.setViewIndex(undefined, locations.prevIndex, locations.newIndex));
      this.$parentObj.on('tabUpdated.chrome-tabz', (e, $tab, props, via) => this.updateView(undefined, $tab, props, via));
      this.$parentObj.on('currentTabChanged.chrome-tabz', (e, $tab) => this.setCurrentView(undefined, $tab));
    }

    removeEvents() {
      this.$parentObj.off('.chrome-tabz');
    }

    addView($tab) {
      if (!($tab instanceof jQuery) || !$tab.length) {
        throw 'Missing or invalid $tab.';
      }
      $tab = $tab.first(); // One tab only.

      let $view = $( // Template based on view type.
        this.settings.type === 'webviews' ? webViewTemplate : iframeViewTemplate
      );
      $view.data('urlCounter', 0); // Initialize.
      this.$content.append($view); // Add to DOM.

      this.setViewIndex($view, undefined, $tab.index());
      this.$obj.trigger('viewAdded', [$view, this]);

      return $view;
    }

    removeView($view, $tab) {
      if ((!($view instanceof jQuery) || !$view.length) && $tab instanceof jQuery && $tab.length) {
        $view = this.viewAtIndex($tab.index(), true);
      }
      if (!($view instanceof jQuery) || !$view.length) {
        throw 'Missing or invalid $view.';
      }
      $view = $view.first(); // One view only.

      this.$obj.trigger('viewBeingRemoved', [$view, this]);
      this.removeViewFromIndex($view), $view.remove();
      this.$obj.trigger('viewRemoved', [$view, this]);
    }

    removeViewFromIndex($view) {
      if (!($view instanceof jQuery) || !$view.length) {
        throw 'Missing or invalid $view.';
      }
      $view = $view.first(); // One view only.

      this.viewIndex.splice(this.mapViewIndex($view, true), 1);
    }

    viewAtIndex(index, require) {
      if (typeof index !== 'number' || isNaN(index) || index < 0) {
        throw 'Missing or invalid index.';
      }
      let $view = this.viewIndex[index] || undefined;

      if (require && (!($view instanceof jQuery) || !$view.length)) {
        throw 'No $view with that index.';
      }
      return $view instanceof jQuery && $view.length ? $view.first() : undefined;
    }

    mapViewIndex($view, require) {
      if (!($view instanceof jQuery) || !$view.length) {
        throw 'Missing or invalid $view.';
      }
      $view = $view.first(); // One view only.

      for (let index = 0; index < this.viewIndex.length; index++) {
        if (this.viewIndex[index].is($view)) return index;
      } // This uses jQuery `.is()` to compare.

      if (require) { // Require?
        throw '$view not in the index.';
      }
      return -1; // Default return value.
    }

    setViewIndex($view, prevIndex, newIndex) {
      if ((!($view instanceof jQuery) || !$view.length) && prevIndex !== undefined) {
        $view = this.viewAtIndex(prevIndex, true);
      }
      if (!($view instanceof jQuery) || !$view.length) {
        throw 'Missing or invalid $view.';
      } else if (typeof newIndex !== 'number' || isNaN(newIndex) || newIndex < 0) {
        throw 'Missing or invalid newIndex.';
      }
      $view = $view.first(); // One view only.

      if ((prevIndex = this.mapViewIndex($view)) !== -1) {
        this.viewIndex.splice(prevIndex, 1);
      } // Remove from current index (if applicable).

      this.viewIndex.splice(newIndex, 0, $view); // New index.
      this.$obj.trigger('viewIndexed', [$view, { prevIndex, newIndex }, this]);
    }

    updateView($view, $tab, props, via) {
      if (via === 'view::state-change') {
        return; // Ignore this quietly.
      } // See state-change events below.

      if ((!($view instanceof jQuery) || !$view.length) && $tab instanceof jQuery && $tab.length) {
        $view = this.viewAtIndex($tab.index(), true);
      }
      if (!($view instanceof jQuery) || !$view.length) {
        throw 'Missing or invalid $view.';
      } else if (props && typeof props !== 'object') {
        throw 'Invalid properties.';
      }
      $view = $view.first(); // One view only.

      let prevProps = $view.data('props') || {};
      let newProps = props || {};

      props = $.extend({}, this.settings.defaultProps, prevProps, newProps);
      $view.data('props', props); // Update to new props after merging.

      $.each(props.viewAttrs, (key, value) => {
        if (key.toLowerCase() !== 'src') $view.attr(key, value);
      }); // Anything but `src`, which is handled below.

      if (typeof prevProps.url === 'undefined' || prevProps.url !== props.url) {
        let isFirstUrl = () => { // The first URL?
          return Number($view.data('urlCounter')) === 1;
        }; // True if the first URL, based on counter.

        let $getTab = (require = true) => { // Tab matching view.
          let $tab = this.$parentObj._.$tabz.eq(this.mapViewIndex($view, require));
          if (require && (!($tab instanceof jQuery) || !$tab.length)) throw 'Missing $tab.';
          return $tab; // Otherwise, return the tab now.
        }; // Dynamically, in case it was moved by a user.

        if (this.settings.type === 'webviews') {
          let _favicon = ''; // Held until loading is complete.

          $view.off('did-start-loading.chrome-tabz')
            .on('did-start-loading.chrome-tabz', (e) => {
              let $tab = $getTab(),
                props = $view.data('props');

              // Increment the `<webview>` URL counter.
              $view.data('urlCounter', $view.data('urlCounter') + 1);

              // Use fallbacks on failure.
              let favicon = props.loadingFavicon;
              let title = typeof $view.getTitle === 'function' ? $view.getTitle() : '';
              title = !title && isFirstUrl() ? props.url || props.title : title;
              title = !title ? /* Loading dots. */ '...' : title;

              // Update the tab favicon and title.
              this.$parentObj._.updateTab($tab, { favicon, title }, 'view::state-change');

              // Trigger event after updating tab.
              this.$obj.trigger('viewStartedLoading', [$view, this]);
            });

          $view.off('did-stop-loading.chrome-tabz')
            .on('did-stop-loading.chrome-tabz', (e) => {
              let $tab = $getTab(),
                props = $view.data('props');

              // In the case of failure, use fallbacks.
              let favicon = !_favicon && isFirstUrl() ? props.favicon : _favicon;
              favicon = !favicon ? this.settings.defaultProps.favicon : favicon;

              // Updating tab favicon.
              this.$parentObj._.updateTab($tab, { favicon }, 'view::state-change');

              // Trigger event after updating tab.
              this.$obj.trigger('viewStoppedLoading', [$view, this]);
            });

          $view.off('page-favicon-updated.chrome-tabz')
            .on('page-favicon-updated.chrome-tabz', (e) => {
              let $tab = $getTab(),
                props = $view.data('props');

              // In the case of failure, use fallbacks.
              _favicon = e.originalEvent.favicons.length ? e.originalEvent.favicons[0] : '';
              let favicon = !_favicon && isFirstUrl() ? props.favicon : _favicon;
              favicon = !favicon ? this.settings.defaultProps.favicon : favicon;

              // If not loading, go ahead and update favicon.
              if (typeof $view.isLoading === 'function' && !$view.isLoading()) {
                this.$parentObj._.updateTab($tab, { favicon }, 'view::state-change');
              }
              // Trigger event after updating tab.
              this.$obj.trigger('viewFaviconUpdated', [$view, favicon, this]);
            });

          $view.off('page-title-updated.chrome-tabz')
            .on('page-title-updated.chrome-tabz', (e) => {
              let $tab = $getTab(),
                props = $view.data('props');

              // In the case of failure, use fallbacks.
              let title = e.originalEvent.title || ''; // If not empty.
              title = !title && typeof $view.getURL === 'function' ? $view.getURL() : title;
              title = !title ? this.settings.defaultProps.unknownUrlTitle : title;

              // Title can be updated immediately.
              this.$parentObj._.updateTab($tab, { title }, 'view::state-change');

              // Trigger event after updating tab.
              this.$obj.trigger('viewTitleUpdated', [$view, title, this]);
            });

          $view.attr('src', props.url); // Begin loading.

        } else { // Handle as `<iframe>` (more difficult to work with).
          let $contentWindow = $($view[0].contentWindow); // jQuery wrapper.
          let onUnloadHandler; // Referenced again below when reattaching.

          let tryGettingSameDomainUrl = () => {
            try { // Same-domain iframes only.
              return $view.contents().prop('URL');
            } catch (exception) {} // Fail gracefully.
          };
          let tryGettingSameDomainFavicon = () => {
            try { // Same-domain iframes only.
              return $.trim($view.contents().find('head > link[rel="shortcut icon"]').prop('href'));
            } catch (exception) {} // Fail gracefully.
          };
          let tryGettingSameDomainTitle = () => {
            try { // Same-domain iframes only.
              return $.trim($view.contents().find('head > title').text());
            } catch (exception) {} // Fail gracefully.
          };
          let tryReattachingSameDomainUnloadHandler = () => {
            try { // Same-domain iframes only.
              $contentWindow.off('unload.chrome-tabz').on('unload.chrome-tabz', onUnloadHandler);
            } catch (exception) {} // Fail gracefully.
          };

          $contentWindow.off('unload.chrome-tabz')
            .on('unload.chrome-tabz', (onUnloadHandler = (e) => {
              let $tab = $getTab(false),
                props = $view.data('props');

              if (!($tab instanceof jQuery) || !$tab.length || !$.contains(document, $tab[0])) {
                return; // e.g., The tab was removed entirely.
              } // i.e., Unloading occurs on tab removals also.

              if (!props || !$.contains(document, $view[0])) {
                return; // e.g., View was removed entirely.
              } // i.e., Unloading occurs on tab removals also.

              // Increment the `<iframe>` URL counter.
              $view.data('urlCounter', $view.data('urlCounter') + 1);

              // Use fallbacks on failure.
              let favicon = props.loadingFavicon;
              let title = isFirstUrl() ? props.url : '';
              title = !title && isFirstUrl() ? props.title : title;
              title = !title ? /* Loading dots. */ '...' : title;

              // Update the tab favicon and title. Unloaded = now loading.
              this.$parentObj._.updateTab($tab, { favicon, title }, 'view::state-change');

              // Trigger event after updating tab.
              this.$obj.trigger('viewStartedLoading', [$view, this]);
            }));

          $view.off('load.chrome-tabz').on('load.chrome-tabz', (e) => {
            let $tab = $getTab(),
              props = $view.data('props');

            // Reattach `unload` event handler.
            tryReattachingSameDomainUnloadHandler();

            // In the case of failure, use fallbacks.
            let url = tryGettingSameDomainUrl() || '';
            url = !url && isFirstUrl() ? props.url : url;

            // In the case of failure, use fallbacks.
            let favicon = tryGettingSameDomainFavicon() || '';
            favicon = !favicon && isFirstUrl() ? props.favicon : favicon;
            favicon = !favicon && url ? url.replace(/^(https?:\/\/[^\/]+).*$/i, '$1') + '/favicon.ico' : favicon;
            favicon = !favicon ? this.settings.defaultProps.favicon : favicon;

            // In the case of failure, use fallbacks.
            let title = tryGettingSameDomainTitle() || '';
            title = !title && isFirstUrl() ? props.title : title;
            title = !title ? url : title; // Prefer URL over unknown title.
            title = !title ? this.settings.defaultProps.unknownUrlTitle : title;

            // Update the favicon and title.
            this.$parentObj._.updateTab($tab, { favicon, title }, 'view::state-change');

            // Trigger these events for iframes too.
            this.$obj.trigger('viewFaviconUpdated', [$view, favicon, this]);
            this.$obj.trigger('viewTitleUpdated', [$view, title, this]);

            // Trigger event after updating tab.
            this.$obj.trigger('viewStoppedLoading', [$view, this]);
          });

          $view.attr('src', props.url); // Begin loading.
        }
      }
      this.$obj.trigger('viewUpdated', [$view, props, via, prevProps, newProps, this]);
    }

    setCurrentView($view, $tab) {
      if ((!($view instanceof jQuery) || !$view.length) && $tab instanceof jQuery && $tab.length) {
        $view = this.viewAtIndex($tab.index(), true);
      }
      if ($view && (!($view instanceof jQuery) || !$view.length)) {
        throw 'Missing or invalid $view.';
      }
      $view = $view ? $view.first() : $(); // One view only.

      this.$viewz.removeClass('-current');
      $view.addClass('-current');

      this.$obj.trigger('currentViewChanged', [$view, this]);
    }
  } // End `ChromeTabViewz{}` class.

  // Begin jQuery extension as a wrapper for both classes.

  $.fn.chromeTabz = function (settings) {
    return this.each((i, obj) => {
      if (!$(obj).data('chromeTabz')) {
        new ChromeTabz($.extend({}, settings || {}, { obj }));
      }
    });
  };
  // Handle factory return value.

  return $.fn.chromeTabz; // Extension reference.
});

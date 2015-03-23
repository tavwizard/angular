import {isBlank, isPresent, int, StringWrapper, assertionsEnabled} from 'angular2/src/facade/lang';
import {List, ListWrapper, MapWrapper, Map} from 'angular2/src/facade/collection';
import {PromiseWrapper} from 'angular2/src/facade/async';

import {DOM} from 'angular2/src/dom/dom_adapter';

import * as viewModule from '../view/view';

import {LightDom} from './emulation/light_dom';
import {ShadowCss} from './emulation/shadow_css';

import {StyleInliner} from './style_inliner';
import {StyleUrlResolver} from './style_url_resolver';

import * as NS from '../compiler/compile_step';
import {CompileElement} from '../compiler/compile_element';
import {CompileControl} from '../compiler/compile_control';

import {Template} from '../api';

var _EMPTY_STEP;

// Note: fill _EMPTY_STEP to prevent
// problems from cyclic dependencies
function _emptyStep() {
  if (isBlank(_EMPTY_STEP)) {
    _EMPTY_STEP = new _EmptyCompileStep();
  }
  return _EMPTY_STEP;
}

export class ShadowDomStrategy {
  attachTemplate(el, view:viewModule.View) {}
  constructLightDom(lightDomView:viewModule.View, shadowDomView:viewModule.View, el): LightDom { return null; }

  /**
   * An optional step that can modify the template style elements.
   *
   * @param {Template} template
   * @returns {CompileStep} a compile step to append to the compiler pipeline
   */
  getStyleCompileStep(template: Template, stylePromises: List<Promise>): NS.CompileStep {
    return _emptyStep();
  }

  /**
   * An optional step that can modify the template elements (style elements exlcuded).
   *
   * This step could be used to modify the template in order to scope the styles.
   *
   * @param {Template} template
   * @returns {CompileStep} a compile step to append to the compiler pipeline
   */
  getTemplateCompileStep(template: Template): NS.CompileStep { return _emptyStep(); }
}

/**
 * This strategy emulates the Shadow DOM for the templates, styles **excluded**:
 * - components templates are added as children of their component element,
 * - styles are moved from the templates to the styleHost (i.e. the document head).
 *
 * Notes:
 * - styles are **not** scoped to their component and will apply to the whole document,
 * - you can **not** use shadow DOM specific selectors in the styles
 */
export class EmulatedUnscopedShadowDomStrategy extends ShadowDomStrategy {
  _styleUrlResolver: StyleUrlResolver;
  _styleHost;

  constructor(styleUrlResolver: StyleUrlResolver, styleHost) {
    super();
    this._styleUrlResolver = styleUrlResolver;
    this._styleHost = styleHost;
  }

  attachTemplate(el, view:viewModule.View) {
    DOM.clearNodes(el);
    _moveViewNodesIntoParent(el, view);
  }

  constructLightDom(lightDomView:viewModule.View, shadowDomView:viewModule.View, el): LightDom {
    return new LightDom(lightDomView, shadowDomView, el);
  }

  getStyleCompileStep(template: Template, stylePromises: List<Promise>): NS.CompileStep {
    return new _EmulatedUnscopedCssStep(template, this._styleUrlResolver,
      this._styleHost, stylePromises);
  }

  getTemplateCompileStep(template: Template): NS.CompileStep {
    return new _BaseEmulatedShadowDomStep();
  }
}

/**
 * This strategy emulates the Shadow DOM for the templates, styles **included**:
 * - components templates are added as children of their component element,
 * - both the template and the styles are modified so that styles are scoped to the component
 *   they belong to,
 * - styles are moved from the templates to the styleHost (i.e. the document head).
 *
 * Notes:
 * - styles are scoped to their component and will apply only to it,
 * - a common subset of shadow DOM selectors are supported,
 * - see `ShadowCss` for more information and limitations.
 */
export class EmulatedScopedShadowDomStrategy extends EmulatedUnscopedShadowDomStrategy {
  _styleInliner: StyleInliner;

  constructor(styleInliner: StyleInliner, styleUrlResolver: StyleUrlResolver, styleHost) {
    super(styleUrlResolver, styleHost);
    this._styleInliner = styleInliner;
  }

  attachTemplate(el, view:viewModule.View) {
    super.attachTemplate(el, view);

    var hostAttribute = _getHostAttribute(_getComponentId(view.proto.componentId));
    DOM.setAttribute(element, hostAttribute, '');
  }

  getStyleCompileStep(template: Template, stylePromises: List<Promise>): NS.CompileStep {
    return new _EmulatedScopedCssStep(template, this._styleInliner,
      this._styleUrlResolver, this._styleHost, stylePromises);
  }

  getTemplateCompileStep(template: Template): NS.CompileStep {
    return new _ShimShadowDomStep(template);
  }
}

/**
 * This strategies uses the native Shadow DOM support.
 *
 * The templates for the component are inserted in a Shadow Root created on the component element.
 * Hence they are strictly isolated.
 */
export class NativeShadowDomStrategy extends ShadowDomStrategy {
  _styleUrlResolver: StyleUrlResolver;

  constructor(styleUrlResolver: StyleUrlResolver) {
    super();
    this._styleUrlResolver = styleUrlResolver;
  }

  attachTemplate(el, view:viewModule.View){
    _moveViewNodesIntoParent(DOM.createShadowRoot(el), view);
  }

  getStyleCompileStep(template: Template, stylePromises: List<Promise>): NS.CompileStep {
    return new _NativeCssStep(template.absUrl, this._styleUrlResolver);
  }
}

class _BaseEmulatedShadowDomStep extends NS.CompileStep {
  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    if (current.ignoreBindings) {
      return;
    }
    var nodeName = DOM.nodeName(current.element);
    if (StringWrapper.equals(nodeName.toUpperCase(), 'CONTENT')) {
      var attrs = current.attrs();
      var selector = MapWrapper.get(attrs, 'select');
      selector = isPresent(selector) ? selector : '';
      current.bindElement().setContentTagSelector(selector);

      var contentStart = DOM.createScriptTag('type', 'ng/contentStart');
      if (assertionsEnabled()) {
        DOM.setAttribute(contentStart, 'select', selector);
      }
      var contentEnd = DOM.createScriptTag('type', 'ng/contentEnd');
      DOM.insertBefore(current.element, contentStart);
      DOM.insertBefore(current.element, contentEnd);
      DOM.remove(current.element);

      current.element = contentStart;
    }
  }

}

class _EmptyCompileStep extends NS.CompileStep {
  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
  }
}


class _ShimShadowDomStep extends _BaseEmulatedShadowDomStep {
  _contentAttribute: string;

  constructor(template: Template) {
    super();
    this._contentAttribute = _getContentAttribute(_getComponentId(template.id));
  }


  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    super.process(parent, current, control);
    if (current.ignoreBindings) {
      return;
    }

    // Shim the element as a child of the compiled component
    DOM.setAttribute(current.element, this._contentAttribute, '');
  }
}

class _EmulatedUnscopedCssStep extends NS.CompileStep {
  _templateUrl: string;
  _styleUrlResolver: StyleUrlResolver;
  _styleHost;

  constructor(template: Template, styleUrlResolver: StyleUrlResolver, styleHost, stylePromises: List<Promise>) {
    super();
    this._templateUrl = template.absUrl;
    this._styleUrlResolver = styleUrlResolver;
    this._styleHost = styleHost;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var styleEl = current.element;
    var cssText = DOM.getText(styleEl);
    cssText = this._styleUrlResolver.resolveUrls(cssText, this._templateUrl);
    DOM.setText(styleEl, cssText);
    DOM.remove(styleEl);

    if (!MapWrapper.contains(_sharedStyleTexts, cssText)) {
      // Styles are unscoped and shared across components, only append them to the head
      // when there are not present yet
      MapWrapper.set(_sharedStyleTexts, cssText, true);
      _insertStyleElement(this._styleHost, styleEl);
    }
  }
}

class _EmulatedScopedCssStep extends NS.CompileStep {
  _templateUrl: string;
  _template: Template;
  _styleInliner: StyleInliner;
  _styleUrlResolver: StyleUrlResolver;
  _styleHost;
  _stylePromises;

  constructor(template: Template, styleInliner: StyleInliner,
    styleUrlResolver: StyleUrlResolver, styleHost, stylePromises: List<Promise>) {
    super();
    this._template = template;
    this._styleInliner = styleInliner;
    this._styleUrlResolver = styleUrlResolver;
    this._styleHost = styleHost;
    this._stylePromises = stylePromises;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var styleEl = current.element;

    var cssText = DOM.getText(styleEl);

    cssText = this._styleUrlResolver.resolveUrls(cssText, this._template.absUrl);
    var css = this._styleInliner.inlineImports(cssText, this._template.absUrl);

    if (PromiseWrapper.isPromise(css)) {
      DOM.setText(styleEl, '');
      ListWrapper.push(this._stylePromises, css);
      return css.then((css) => {
        css = _shimCssForComponent(css, this._template.id);
        DOM.setText(styleEl, css);
      });
    } else {
      css = _shimCssForComponent(css, this._template.id);
      DOM.setText(styleEl, css);
    }

    DOM.remove(styleEl);
    _insertStyleElement(this._styleHost, styleEl);
  }
}

class _NativeCssStep extends NS.CompileStep {
  _styleUrlResolver: StyleUrlResolver;
  _templateUrl: string;

  constructor(templateUrl: string, styleUrlResover: StyleUrlResolver) {
    super();
    this._styleUrlResolver = styleUrlResover;
    this._templateUrl = templateUrl;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var styleEl = current.element;
    var cssText = DOM.getText(styleEl);
    cssText = this._styleUrlResolver.resolveUrls(cssText, this._templateUrl);
    DOM.setText(styleEl, cssText);
  }
}

function _moveViewNodesIntoParent(parent, view) {
  for (var i = 0; i < view.rootNodes.length; ++i) {
    DOM.appendChild(parent, view.rootNodes[i]);
  }
}

var _componentUIDs: Map<string, int> = MapWrapper.create();
var _nextComponentUID: int = 0;
var _sharedStyleTexts: Map<string, boolean> = MapWrapper.create();
var _lastInsertedStyleEl;

function _getComponentId(componentStringId: string) {
  var id = MapWrapper.get(_componentUIDs, template.id);
  if (isBlank(id)) {
    id = _nextComponentUID++;
    MapWrapper.set(_componentUIDs, template.id, id);
  }
  return id;
}

function _insertStyleElement(host, styleEl) {
  if (isBlank(_lastInsertedStyleEl)) {
    var firstChild = DOM.firstChild(host);
    if (isPresent(firstChild)) {
      DOM.insertBefore(firstChild, styleEl);
    } else {
      DOM.appendChild(host, styleEl);
    }
  } else {
    DOM.insertAfter(_lastInsertedStyleEl, styleEl);
  }
  _lastInsertedStyleEl = styleEl;
}

// Return the attribute to be added to the component
function _getHostAttribute(id: int) {
  return `_nghost-${id}`;
}

// Returns the attribute to be added on every single element nodes in the component
function _getContentAttribute(id: int) {
  return `_ngcontent-${id}`;
}

function _shimCssForComponent(cssText: string, componentId: string): string {
  var id = _getComponentId(componentId);
  var shadowCss = new ShadowCss();
  return shadowCss.shimCssText(cssText, _getContentAttribute(id), _getHostAttribute(id));
}

// Reset the caches - used for tests only
export function resetShadowDomCache() {
  MapWrapper.clear(_componentUIDs);
  _nextComponentUID = 0;
  MapWrapper.clear(_sharedStyleTexts);
  _lastInsertedStyleEl = null;
}

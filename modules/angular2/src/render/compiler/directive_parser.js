import {isPresent, isBlank, BaseException, assertionsEnabled, RegExpWrapper} from 'angular2/src/facade/lang';
import {List, MapWrapper, StringMapWrapper} from 'angular2/src/facade/collection';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {SelectorMatcher, CssSelector} from './selector';

import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';

/**
 * Parses the directives on a single element. Assumes ViewSplitter has already created
 * <template> elements for template directives.
 */
export class DirectiveParser extends CompileStep {
  _selectorMatcher:SelectorMatcher;
  constructor(directiveSelectors:List<string>) {
    super();
    this._selectorMatcher = new SelectorMatcher();
    for (var i=0; i<directiveSelectors.length; i++) {
      var selector = CssSelector.parse(directiveSelectors[i]);
      this._selectorMatcher.addSelectable(selector, i);
    }
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var attrs = current.attrs();
    var classList = current.classList();

    var cssSelector = new CssSelector();
    var nodeName = DOM.nodeName(current.element);
    cssSelector.setElement(nodeName);
    for (var i=0; i < classList.length; i++) {
      cssSelector.addClassName(classList[i]);
    }

    MapWrapper.forEach(attrs, (attrValue, attrName) => {
      cssSelector.addAttribute(attrName, attrValue);
    });

    // Note: We assume that the ViewSplitter already did its work, i.e. template directive should
    // only be present on <template> elements any more!
    var isTemplateElement = DOM.isTemplateElement(current.element);

    this._selectorMatcher.match(cssSelector, (selector, directiveIndex) => {
      current.bindElement().addDirective(directiveIndex);
    });
  }
}

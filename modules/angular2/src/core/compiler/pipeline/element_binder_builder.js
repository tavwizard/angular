import {int, isPresent, isBlank, Type, BaseException, StringWrapper, RegExpWrapper, isString, stringify} from 'angular2/src/facade/lang';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {ListWrapper, List, MapWrapper, StringMapWrapper} from 'angular2/src/facade/collection';

import {reflector} from 'angular2/src/reflection/reflection';

import {Parser, ProtoChangeDetector} from 'angular2/change_detection';

import {DirectiveMetadata} from '../directive_metadata';

import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';
import {dashCaseToCamelCase, camelCaseToDashCase} from './util';

import {ElementBinderBuilder, DirectiveBinderBuilder} from '../proto_view_builder';

var DOT_REGEXP = RegExpWrapper.create('\\.');

const ARIA_PREFIX = 'aria';
var ariaSettersCache = StringMapWrapper.create();

function ariaSetterFactory(attrName:string) {
  var setterFn = StringMapWrapper.get(ariaSettersCache, attrName);
  var ariaAttrName;

  if (isBlank(setterFn)) {
    ariaAttrName = camelCaseToDashCase(attrName);
    setterFn = function(element, value) {
      if (isPresent(value)) {
        DOM.setAttribute(element, ariaAttrName, stringify(value));
      } else {
        DOM.removeAttribute(element, ariaAttrName);
      }
    };
    StringMapWrapper.set(ariaSettersCache, attrName, setterFn);
  }

  return setterFn;
}

const CLASS_PREFIX = 'class.';
var classSettersCache = StringMapWrapper.create();

function classSetterFactory(className:string) {
  var setterFn = StringMapWrapper.get(classSettersCache, className);

  if (isBlank(setterFn)) {
    setterFn = function(element, value) {
      if (value) {
        DOM.addClass(element, className);
      } else {
        DOM.removeClass(element, className);
      }
    };
    StringMapWrapper.set(classSettersCache, className, setterFn);
  }

  return setterFn;
}

const STYLE_PREFIX = 'style.';
var styleSettersCache = StringMapWrapper.create();

function styleSetterFactory(styleName:string, stylesuffix:string) {
  var cacheKey = styleName + stylesuffix;
  var setterFn = StringMapWrapper.get(styleSettersCache, cacheKey);
  var dashCasedStyleName;

  if (isBlank(setterFn)) {
    dashCasedStyleName = camelCaseToDashCase(styleName);
    setterFn = function(element, value) {
      var valAsStr;
      if (isPresent(value)) {
        valAsStr = stringify(value);
        DOM.setStyle(element, dashCasedStyleName, valAsStr + stylesuffix);
      } else {
        DOM.removeStyle(element, dashCasedStyleName);
      }
    };
    StringMapWrapper.set(classSettersCache, cacheKey, setterFn);
  }

  return setterFn;
}

const ROLE_ATTR = 'role';
function roleSetter(element, value) {
  if (isString(value)) {
    DOM.setAttribute(element, ROLE_ATTR, value);
  } else {
    DOM.removeAttribute(element, ROLE_ATTR);
    if (isPresent(value)) {
      throw new BaseException("Invalid role attribute, only string values are allowed, got '" + stringify(value) + "'");
    }
  }
}

// tells if an attribute is handled by the ElementBinderBuilder step
export function isSpecialProperty(propName:string) {
  return StringWrapper.startsWith(propName, ARIA_PREFIX)
        || StringWrapper.startsWith(propName, CLASS_PREFIX)
        || StringWrapper.startsWith(propName, STYLE_PREFIX)
        || StringMapWrapper.contains(DOM.attrToPropMap, propName);
}

/**
 * Creates the ElementBinders and adds watches to the
 * ProtoChangeDetector.
 *
 * Fills:
 * - CompileElement#inheritedElementBinder
 *
 * Reads:
 * - (in parent) CompileElement#inheritedElementBinder
 * - CompileElement#hasBindings
 * - CompileElement#inheritedProtoView
 * - CompileElement#inheritedProtoElementInjector
 * - CompileElement#textNodeBindings
 * - CompileElement#propertyBindings
 * - CompileElement#eventBindings
 * - CompileElement#decoratorDirectives
 * - CompileElement#componentDirective
 * - CompileElement#viewportDirective
 *
 * Note: This actually only needs the CompileElements with the flags
 * `hasBindings` and `isViewRoot`,
 * and only needs the actual HTMLElement for the ones
 * with the flag `isViewRoot`.
 */
export class ElementBinderBuilderCS extends CompileStep {
  _parser:Parser;
  constructor(parser:Parser) {
    super();
    this._parser = parser;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var elementBinder = null;
    var parentElementBinder = null;
    var distanceToParentBinder = this._getDistanceToParentBinder(parent, current);
    if (isPresent(parent)) {
      parentElementBinder = parent.inheritedElementBinder;
    }
    if (current.hasBindings) {
      var protoView = current.inheritedProtoView;
      elementBinder = protoView.bindElement();
      if (isPresent(parentElementBinder)) {
        elementBinder.setParent(parentElementBinder, distanceToParentBinder);
      }
      current.distanceToParentBinder = 0;

      if (isPresent(current.textNodeBindings)) {
        this._bindTextNodes(elementBinder, current);
      }
      if (isPresent(current.propertyBindings)) {
        this._bindElementProperties(elementBinder, current);
      }
      if (isPresent(current.eventBindings)) {
        this._bindElementEvents(elementBinder, current);
      }
      if (isPresent(current.contentTagSelector)) {
        elementBinder.setContentTagSelector(current.contentTagSelector);
      }
      if (isPresent(current.componentDirective)) {
        this._bindDirective(
          current.componentDirective, elementBinder, current
        ).setComponent(true);
      }
      if (isPresent(current.viewportDirective)) {
        this._bindDirective(
          current.viewportDirective, elementBinder, current
        ).setViewport(true);
      }
      if (isPresent(current.decoratorDirectives)) {
        ListWrapper.forEach((directive) => {
          this._bindDirective(
            directive, elementBinder, current
          );
        });
      }
      // Viewport directives are treated differently than other element with var- definitions.
      // See proto_view_builder compile step
      if (isPresent(current.variableBindings) && !isPresent(current.viewportDirective)) {
        MapWrapper.forEach(current.variableBindings, (mappedName, varName) => {
          elementBinder.bindVariable(varName, mappedName);
        });
      }
    } else if (isPresent(parent)) {
      elementBinder = parentElementBinder;
      current.distanceToParentBinder = distanceToParentBinder;
    }
    current.inheritedElementBinder = elementBinder;
  }

  _getDistanceToParentBinder(parent, current) {
    return isPresent(parent) ? parent.distanceToParentBinder + 1 : 0;
  }

  _bindTextNodes(elementBuilder:ElementBinderBuilder, compileElement) {
    MapWrapper.forEach(compileElement.textNodeBindings, (expression, indexInParent) => {
      elementBuilder.bindText(indexInParent, expression);
    });
  }

  _bindElementProperties(elementBuilder:ElementBinderBuilder, compileElement) {
    MapWrapper.forEach(compileElement.propertyBindings, (expression, property) => {
      var setterFn, styleParts, styleSuffix;

      if (StringWrapper.startsWith(property, ARIA_PREFIX)) {
        setterFn = ariaSetterFactory(property);
      } else if (StringWrapper.equals(property, ROLE_ATTR)) {
        setterFn = roleSetter;
      } else if (StringWrapper.startsWith(property, CLASS_PREFIX)) {
        setterFn = classSetterFactory(StringWrapper.substring(property, CLASS_PREFIX.length));
      } else if (StringWrapper.startsWith(property, STYLE_PREFIX)) {
        styleParts = StringWrapper.split(property, DOT_REGEXP);
        styleSuffix = styleParts.length > 2 ? ListWrapper.get(styleParts, 2) : '';
        setterFn = styleSetterFactory(ListWrapper.get(styleParts, 1), styleSuffix);
      } else {
        property = this._resolvePropertyName(property);
        //TODO(pk): special casing innerHtml, see: https://github.com/angular/angular/issues/789
        if (StringWrapper.equals(property, 'innerHTML')) {
          setterFn = (element, value) => DOM.setInnerHTML(element, value);
        } else if (DOM.hasProperty(compileElement.element, property) || StringWrapper.equals(property, 'innerHtml')) {
          setterFn = reflector.setter(property);
        }
      }

      if (isPresent(setterFn)) {
        elementBuilder.bindProperty(expression.ast, property, setterFn);
      }
    });
  }

  _bindElementEvents(elementBuilder:ElementBinderBuilder, compileElement) {
    MapWrapper.forEach(compileElement.eventBindings, (expression, eventName) => {
      elementBuilder.bindEvent(eventName,  expression);
    });
  }

  _bindDirective(directive:DirectiveMetadata, elementBinderBuilder: ElementBinderBuilder, compileElement: CompileElement):DirectiveBinderBuilder {
    var directiveBuilder = elementBinderBuilder.bindDirective(directive);
    var annotation = directive.annotation;
    this._bindDirectiveEvents(annotation.events, directiveBuilder, compileElement);
    this._bindDirectiveProperties(annotation.bind, directiveBuilder, compileElement);
    return directiveBuilder;
  }

  _bindDirectiveEvents(events, directiveBuilder:DirectiveBinderBuilder, compileElement:CompileElement) {
    if (isBlank(annotation.events)) return;
    StringMapWrapper.forEach(annotation.events, (action, eventName) => {
      var expression = this._parser.parseAction(action, compileElement.elementDescription);
      directiveBuilder.bindEvent(eventName, expression);
    });
  }

  _bindDirectiveProperties(bind, directiveBuilder:DirectiveBinderBuilder, compileElement:CompileElement) {
    if (isBlank(bind)) continue;
    StringMapWrapper.forEach(bind, (bindConfig, dirProp) => {
      var pipes = this._splitBindConfig(bindConfig);
      var elProp = ListWrapper.removeAt(pipes, 0);

      var bindingAst = isPresent(compileElement.propertyBindings) ?
        MapWrapper.get(compileElement.propertyBindings, dashCaseToCamelCase(elProp)) :
          null;

      if (isBlank(bindingAst)) {
        var attributeValue = MapWrapper.get(compileElement.attrs(), elProp);
        if (isPresent(attributeValue)) {
          bindingAst = this._parser.wrapLiteralPrimitive(attributeValue, compileElement.elementDescription);
        }
      }

      // Bindings are optional, so this binding only needs to be set up if an expression is given.
      if (isPresent(bindingAst)) {
        var fullExpAstWithBindPipes = this._parser.addPipes(bindingAst, pipes);
        directiveBuilder.bindProperty(
          fullExpAstWithBindPipes,
          dirProp,
          reflector.setter(dashCaseToCamelCase(dirProp))
        );
      }
    });
  }

  _splitBindConfig(bindConfig:string) {
    return ListWrapper.map(bindConfig.split('|'), (s) => s.trim());
  }

  _resolvePropertyName(attrName:string) {
    var mappedPropName = StringMapWrapper.get(DOM.attrToPropMap, attrName);
    return isPresent(mappedPropName) ? mappedPropName : attrName;
  }
}

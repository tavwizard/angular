import {int, isPresent, isBlank, Type, BaseException, StringWrapper, RegExpWrapper, isString, stringify} from 'angular2/src/facade/lang';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {ListWrapper, List, MapWrapper, StringMapWrapper} from 'angular2/src/facade/collection';

import {reflector} from 'angular2/src/reflection/reflection';

import {dashCaseToCamelCase, camelCaseToDashCase} from '../util';

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

export class ElementPropertyAccessor {
  setProperty(element, property, value) {
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
      } else if (DOM.hasProperty(element, property) || StringWrapper.equals(property, 'innerHtml')) {
        setterFn = reflector.setter(property);
      }
    }
    if (isPresent(setterFn)) {
      setterFn(element, value);
    }
  }

  _resolvePropertyName(attrName:string) {
    var mappedPropName = StringMapWrapper.get(DOM.attrToPropMap, attrName);
    return isPresent(mappedPropName) ? mappedPropName : attrName;
  }
}
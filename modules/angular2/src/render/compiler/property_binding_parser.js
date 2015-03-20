import {isPresent, isBlank, RegExpWrapper, BaseException, StringWrapper} from 'angular2/src/facade/lang';
import {MapWrapper} from 'angular2/src/facade/collection';

import {Parser, AST, ExpressionWithSource} from 'angular2/change_detection';

import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';

import {isInterpolation, dashCaseToCamelCase} from '../util';

// TODO(tbosch): Cannot make this const/final right now because of the transpiler...
// Group 1 = "bind"
// Group 2 = "var"
// Group 3 = "on"
// Group 4 = the identifier after "bind", "var", or "on"
// Group 5 = idenitifer inside square braces
// Group 6 = identifier inside parenthesis
// Group 7 = "#"
// Group 8 = identifier after "#"
var BIND_NAME_REGEXP = RegExpWrapper.create(
    '^(?:(?:(bind)|(var)|(on))-(.+))|\\[([^\\]]+)\\]|\\(([^\\)]+)\\)|(#)(.+)');

/**
 * Parses the property bindings on a single element.
 */
export class PropertyBindingParser extends CompileStep {
  _parser:Parser;

  constructor(parser:Parser) {
    super();
    this._parser = parser;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    if (current.ignoreBindings) {
      return;
    }

    var attrs = current.attrs();
    var newAttrs = MapWrapper.create();

    MapWrapper.forEach(attrs, (attrValue, attrName) => {
      var bindParts = RegExpWrapper.firstMatch(BIND_NAME_REGEXP, attrName);
      if (isPresent(bindParts)) {
        if (isPresent(bindParts[1])) {
          // match: bind-prop
          this._bindProperty(bindParts[4], attrValue, current);
        } else if (isPresent(bindParts[2]) || isPresent(bindParts[7])) {
          // match: var-name / var-name="iden" / #name / #name="iden"
          var identifier = (isPresent(bindParts[4]) && bindParts[4] !== '') ?
              bindParts[4] : bindParts[8];
          var value = attrValue == '' ? '\$implicit' : attrValue;
          this._bindVariable(identifier, value, current, newAttrs);
        } else if (isPresent(bindParts[3])) {
          // match: on-event
          this._bindEvent(bindParts[4], attrValue, current, newAttrs);
        } else if (isPresent(bindParts[5])) {
          // match: [prop]
          this._bindProperty(bindParts[5], attrValue, current, newAttrs);
        } else if (isPresent(bindParts[6])) {
          // match: (event)
          this._bindEvent(bindParts[6], attrValue, current, newAttrs);
        }
      } else if (StringWrapper.equals(attrName, 'template')) {
        this._parseTemplateBindings(attrValue, current, newAttrs);
      } else if (isInterpolation(attrValue)) {
        current.bindElement().bindPropertyInterpolation(dashCaseToCamelCase(attrName), attrValue);
      } else {
        current.bindElement().bindInitAttr(dashCaseToCamelCase(attrName), attrValue);
      }
    });

    MapWrapper.forEach(newAttrs, (attrValue, attrName) => {
      MapWrapper.set(attrs, attrName, attrValue);
    });

  }

  _bindVariable(identifier, value, current:CompileElement, newAttrs) {
    current.bindElement().bindVariable(dashCaseToCamelCase(identifier), value);
    MapWrapper.set(newAttrs, identifier, value);
  }

  _bindProperty(name, expression, current:CompileElement, newAttrs) {
    current.bindElement().bindProperty(dashCaseToCamelCase(name), expression);
    MapWrapper.set(newAttrs, name, expression);
  }

  _bindEvent(name, expression, current:CompileElement, newAttrs) {
    current.bindElement().bindEvent(dashCaseToCamelCase(name), expression);
    // Don't detect directives for event names for now,
    // so don't add the event name to the CompileElement.attrs
  }

  _parseTemplateBindings(templateBindings:string, current:CompileElement, newAttrs) {
    // Note: We are using the parser only to be able to split property bindings and variable
    // bindings apart, so that we can find directives that match
    var bindings = this._parser.parseTemplateBindings(templateBindings, compileElement.elementDescription);
    for (var i=0; i<bindings.length; i++) {
      var binding = bindings[i];
      if (binding.keyIsVar) {
        this._bindVariable(binding.key, binding.name, current, newAttrs);
      } else if (isPresent(binding.expression)) {
        this._bindProperty(binding.key, binding.expression.source, current, newAttrs);
      } else {
        DOM.setAttribute(compileElement.element, binding.key, '');
      }
    }
  }

}

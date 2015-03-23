import {isPresent, isBlank} from 'angular2/src/facade/lang';
import {List, ListWrapper, Map, MapWrapper} from 'angular2/src/facade/collection';
import {AST, ChangeDetection, BindingRecord, Parser} from 'angular2/change_detection';

import {ElementBinder} from './element_binder';
import {ProtoView, ElementBindingMemento, DirectiveBindingMemento} from './proto_view';
import {
  ProtoElementInjector, ComponentKeyMetaData, DirectiveBinding
} from './element_injector';
import {DirectiveMetadata} from './directive_metadata';
import {Component, DynamicComponent, Viewport} from '../annotations/annotations';
import {reflector} from 'angular2/src/reflection/reflection';

import * as renderApi from 'angular2/render_api';

export class ProtoViewBuilder {
  _changeDetection: ChangeDetection;
  _parser: Parser;
  _componentDirectives: List<DirectiveMetadata>;
  _renderProtoView: renderApi.ProtoView;
  _eventHandlers: List;
  _bindingRecords: List;
  _elementBinders: List;
  _variableBindings: List;
  _protoLocals: Map;
  _textNodesWithBindingCount: number;

  constructor(changeDetection:ChangeDetection, parser: Parser) {
    this._changeDetection = changeDetection;
    this._parser = parser;
  }

  setRenderProtoView(renderProtoView) {
    this._renderProtoView = renderProtoView;
    return this;
  }

  setComponentDirectives(directives:List<DirectiveMetadata>) {
    this._componentDirectives = directives;
    return this;
  }

  build():ProtoView {
    this._eventHandlers = [];
    this._bindingRecords = [];
    this._elementBinders = [];
    this._variableBindings = ListWrapper.create(); // TODO
    this._protoLocals = MapWrapper.create(); // TODO
    this._textNodesWithBindingCount = 0;

    ListWrapper.forEach(this._renderProtoView.elementBinders, (renderElementBinder) => {
      this._processElementBinder(renderElementBinder);
    });

    return new ProtoView(
      this._renderProtoView.render,
      this._changeDetection.createProtoChangeDetector('dummy'),
      this._elementBinders,
      this._eventHandlers,
      this._bindingRecords,
      this._variableBindings,
      this._protoLocals
    );
  }

  _processElementBinder(renderElementBinder: renderApi.ElementBinder) {
    var componentDirective = null;
    var viewportDirective = null;
    var allDirectives = [];
    ListWrapper.forEach(renderElementBinder.directives, (renderDirective) => {
      var directive = this._resolveDirective(renderDirective);
      if (directive.annotation instanceof Component || directive.annotation instanceof DynamicComponent) {
        componentDirective = directive;
        // componentDirective needs to be first, so don't
        // add it immediately to the allDirectives array
      } else if (directive.annotation instanceof Viewport) {
        viewportDirective = directive;
        ListWrapper.push(allDirectives, directive);
      } else {
        ListWrapper.push(allDirectives, directive);
      }
    });
    if (isPresent(componentDirective)) {
      // componentDirective needs to be first!
      ListWrapper.insert(allDirectives, 0, componentDirective);
    }

    var protoElementInjector = this._createProtoElementInjector(
      renderElementBinder,
      allDirectives,
      isPresent(componentDirective)
    );
    this._processTextBindings(renderElementBinder);
    var propertyBindingAsts = MapWrapper.create();
    this._processPropertyBindings(renderElementBinder, propertyBindingAsts);
    this._processPropertyInterpolations(renderElementBinder, propertyBindingAsts);
    this._processDirectivePropertyBindings(allDirectives, renderElementBinder, propertyBindingAsts);

    var events = null; // TODO

    var nestedProtoView = null;
    if (isPresent(renderElementBinder.nestedProtoView)) {
      nestedProtoView = new ProtoViewBuilder(
        this._changeDetection, this._parser
      ).setComponentDirectives(this._componentDirectives)
       .setRenderProtoView(renderElementBinder.nestedProtoView)
       .build();
    }
    ListWrapper.push(this._elementBinders, new ElementBinder(
      protoElementInjector,
      componentDirective,
      viewportDirective,
      nestedProtoView,
      events
    ));
  }

  _processTextBindings(renderElementBinder) {
    ListWrapper.forEach(renderElementBinder.textBindings, (expressionStr) => {
      var expression = this._parser.parseInterpolation(expressionStr, renderElementBinder.elementDescription);
      var memento = this._textNodesWithBindingCount++;
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _processPropertyBindings(renderElementBinder, propertyBindingAsts) {
    MapWrapper.forEach(renderElementBinder.propertyBindings, (expressionStr, propertyName) => {
      var expression = this._parser.parseBinding(expressionStr, renderElementBinder.elementDescription);
      MapWrapper.set(propertyBindingAsts, propertyName, expression);
      var memento = new ElementBindingMemento(renderElementBinder.index, propertyName);
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _processPropertyInterpolations(renderElementBinder, propertyBindingAsts) {
    MapWrapper.forEach(renderElementBinder.propertyInterpolations, (expressionStr, propertyName) => {
      var expression = this._parser.parseInterpolation(expressionStr, renderElementBinder.elementDescription);
      MapWrapper.set(propertyBindingAsts, propertyName, expression);
      var memento = new ElementBindingMemento(renderElementBinder.index, propertyName);
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _processDirectivePropertyBindings(allDirectives, renderElementBinder, propertyBindingAsts) {
    for (var i=0; i<allDirectives.length; i++) {
      var directive = allDirectives[i];
      var bind = directive.annotation.bind;
      if (isPresent(bind)) {
        MapWrapper.forEach(bind, (bindConfig, dirProp) => {
          var pipes = this._splitBindConfig(bindConfig);
          var elProp = ListWrapper.removeAt(pipes, 0);

          var bindingAst = MapWrapper.get(propertyBindingAsts, elProp);
          if (isBlank(bindingAst)) {
            var attributeValue = MapWrapper.get(renderElementBinder.initAttrs, elProp);
            if (isPresent(attributeValue)) {
              bindingAst = this._parser.wrapLiteralPrimitive(attributeValue, renderElementBinder.elementDescription);
            }
          }

          // Bindings are optional, so this binding only needs to be set up if an expression is given.
          if (isPresent(bindingAst)) {
            var fullExpAstWithBindPipes = this._parser.addPipes(bindingAst, pipes);
            var memento = new DirectiveBindingMemento(
              renderElementBinder.index, i, dirProp, reflector.setter(dirProp)
            );
            ListWrapper.push(this._bindingRecords, new BindingRecord(fullExpAstWithBindPipes, memento, null));
          }
        });
      }
    }
  }

  _createProtoElementInjector(renderElementBinder, allDirectives, hasComponentDirective) {
    var protoElementInjector = null;
    var parentProtoElementInjector;
    var distanceToParentElementInjector = renderElementBinder.distanceToParentWithDirectives;
    if (renderElementBinder.parentWithDirectivesIndex !== -1) {
      parentProtoElementInjector = this._elementBinders[renderElementBinder.parentWithDirectivesIndex].protoElementInjector;
    }

    // Create a protoElementInjector for any element that either has bindings *or* has one
    // or more var- defined. Elements with a var- defined need a their own element injector
    // so that, when hydrating, $implicit can be set to the element.
    if (allDirectives.length > 0 || MapWrapper.size(renderElementBinder.variableBindings) > 0) {
      // TODO: copy logic from previous proto_element_injector_builder
      protoElementInjector = new ProtoElementInjector(
        parentProtoElementInjector,
        renderElementBinder.index,
        ListWrapper.map(allDirectives, this._createDirectiveBinding),
        hasComponentDirective,
        distanceToParentElementInjector
      );
    }
    return protoElementInjector;
  }

  _splitBindConfig(bindConfig:string) {
    return ListWrapper.map(bindConfig.split('|'), (s) => s.trim());
  }

  _createDirectiveBinding(d:DirectiveMetadata): DirectiveBinding {
    return DirectiveBinding.createFromType(d.type, d.annotation);
  }

  _resolveDirective(directive:renderApi.DirectiveMetadata):DirectiveMetadata {
    return this._componentDirectives[directive.index];
  }

}

class InheritedProtoElementInjector {
  protoElementInjector:ProtoElementInjector;
  distanceToParent:number;
  constructor(
      protoElementInjector:ProtoElementInjector,
      distanceToParent:number) {
    this.protoElementInjector = protoElementInjector;
    this.distanceToParent = distanceToParent;
  }
}
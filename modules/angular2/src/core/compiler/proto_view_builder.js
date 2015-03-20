import {isPresent} from 'angular2/src/facade/lang';
import {List, ListWrapper, Map, MapWrapper} from 'angular2/src/facade/collection';
import {AST, ChangeDetection, BindingRecord, Parser} from 'angular2/change_detection';

import {ElementBinder} from './element_binder';
import {ProtoView, ElementBindingMemento} from './proto_view';
import {ProtoElementInjector, ComponentKeyMetaData, DirectiveBinding} from './element_injector';

import * as renderApi from 'angular2/render_api';

export class ProtoViewBuilder {
  _changeDetection: ChangeDetection;
  _parser: Parser;
  _renderProtoView: renderApi.ProtoView;
  _eventHandlers: List;
  _bindingRecords: List;
  _elementBinders: List;
  _inheritedProtoElementInjectors: List;
  _inheritedProtoElementInjectorDistances: List;
  _variableBindings: List;
  _protoLocals: Map;
  _textNodesWithBindingCount: number;

  constructor(changeDetection:ChangeDetection, parser: Parser) {
    this._changeDetection = changeDetection;
    this._parser = parser;
  }

  init(renderProtoView: renderApi.ProtoView):ProtoViewBuilder {
    this._renderProtoView = renderProtoView;
    this._eventHandlers = [];
    this._bindingRecords = [];
    this._elementBinders = [];
    this._inheritedProtoElementInjectors = [];
    this._inheritedProtoElementInjectorDistances = []
    this._variableBindings = ListWrapper.create(); // TODO
    this._protoLocals = MapWrapper.create(); // TODO
    this._textNodesWithBindingCount = 0;
    return this;
  }

  build():ProtoView {
    ListWrapper.forEach(this._renderProtoView.elementBinders, (renderElementBinder) => {
      this._processElementBinder(renderElementBinder);
    });

    return new ProtoView(
      this._renderProtoView,
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
      if (directive.annotation instanceof Component) {
        componentDirective = directive;
        // componentDirective needs to be first, so don't
        // add it immediately to the allDirectives array
      } else if (directive.annotation instanceof Template) {
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
      allDirectives
    );
    this._processTextBindings(renderElementBinder);
    this._processPropertyBindings(renderElementBinder);
    this._processPropertyInterpolations(renderElementBinder);

    var events = null; // TODO

    var nestedProtoView = null;
    if (isPresent(renderElementBinder.nestedProtoView)) {
      nestedProtoView = new ProtoViewBuilder(
        this._changeDetection, this._parser
      ).init(renderElementBinder.nestedProtoView).build();
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
    MapWrapper.forEach(renderElementBinder.textBindings, (expressionStr, nodeIndex) => {
      var expression = this._parser.parseInterpolation(expressionStr, renderElementBinder.elementDescription);
      var memento = this._textNodesWithBindingCount++;
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _processPropertyBindings(renderElementBinder) {
    MapWrapper.forEach(renderElementBinder.propertyBindings, (expressionStr, propertyName) => {
      var expression = this._parser.parseBinding(expressionStr, renderElementBinder.elementDescription);
      var memento = new ElementBindingMemento(renderElementBinder.index, propertyName);
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _processPropertyInterpolations(renderElementBinder) {
    MapWrapper.forEach(renderElementBinder.propertyInterpolations, (expressionStr, propertyName) => {
      var expression = this._parser.parseInterpolation(expressionStr, renderElementBinder.elementDescription);
      var memento = new ElementBindingMemento(renderElementBinder.index, propertyName);
      ListWrapper.push(this._bindingRecords, new BindingRecord(expression, memento, null));
    });
  }

  _createProtoElementInjector(renderElementBinder, allDirectives) {
    var protoElementInjector = null;
    var parentProtoElementInjector = null;
    var distanceToParentElementInjector;
    var inheritedProtoElementInjector;

    if (renderElementBinder.parentIndex !== -1) {
      parentProtoElementInjector = this._inheritedProtoElementInjectors[renderElementBinder.parentIndex];
      distanceToParentElementInjector =
        this._inheritedProtoElementInjectorDistances[renderElementBinder.parentIndex] + renderElementBinder.distanceToParent;
      inheritedProtoElementInjector = parentProtoElementInjector;
    } else {
      distanceToParentElementInjector = 0;
      inheritedProtoElementInjector = null;
    }
    // Create a protoElementInjector for any element that either has bindings *or* has one
    // or more var- defined. Elements with a var- defined need a their own element injector
    // so that, when hydrating, $implicit can be set to the element.
    if (allDirectives.length > 0 || MapWrapper.size(renderElementBinder.variableBindings) > 0) {
      // TODO: copy logic from previous proto_element_injector_builder
      protoElementInjector = new ProtoElementInjector(
        parentProtoElementInjector,
        renderElementBinder.index,
        directives.map(this._createDirectiveBinding),
        isPresent(componentDirective),
        distanceToParentElementInjector
      );
      inheritedProtoElementInjector = protoElementInjector;
      distanceToParentElementInjector = 0;
    }
    ListWrapper.push(this._inheritedProtoElementInjectors, inheritedProtoElementInjector);
    ListWrapper.push(this._inheritedProtoElementInjectorDistances, distanceToParentElementInjector);
    return protoElementInjector;
  }

  _createDirectiveBinding(d:DirectiveMetadata): DirectiveBinding {
    return DirectiveBinding.createFromType(d.type, d.annotation);
  }

  _resolveDirective(directive:renderApi.DirectiveMetadata):DirectiveMetadata {
    // TODOz: really resolve the DirectiveMetadata for the case that it is
    // not the real DirectiveMetadata
    return directive;
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
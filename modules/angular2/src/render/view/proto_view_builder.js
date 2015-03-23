import {isPresent} from 'angular2/src/facade/lang';
import {ListWrapper, MapWrapper} from 'angular2/src/facade/collection';
import {DOM} from 'angular2/src/dom/dom_adapter';

import {ProtoView} from './proto_view';
import {ElementBinder} from './element_binder';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';

import * as api from '../api';

import {NG_BINDING_CLASS} from '../util';

export class ProtoViewBuilder {
  rootElement;
  variableBindings: Map<string, string>;
  elements:List<ElementBinderBuilder>;
  instantiateInPlace:boolean;
  componentId:string;

  constructor(rootElement) {
    this.rootElement = rootElement;
    this.elements = [];
    this.instantiateInPlace = false;
    this.variableBindings = MapWrapper.create();
    this.componentId = null;
  }

  bindElement(element, description = null):ElementBinderBuilder {
    var builder = new ElementBinderBuilder(this.elements.length, element, description);
    ListWrapper.push(this.elements, builder);
    DOM.addClass(element, NG_BINDING_CLASS);

    return builder;
  }

  bindVariable(name, value) {
    MapWrapper.set(this.variableBindings, name, value);
  }

  setInstantiateInPlace(value) {
    this.instantiateInPlace = value;
  }

  setComponentId(componentId) {
    this.componentId = componentId;
    return this;
  }

  build():api.ProtoView {
    var renderElementBinders = [];

    var apiElementBinders = [];
    ListWrapper.forEach(this.elements, (ebb) => {
      var nestedProtoView =
          isPresent(ebb.nestedProtoView) ? ebb.nestedProtoView.build() : null;
      var parentIndex = isPresent(ebb.parent) ? ebb.parent.index : -1;
      var parentWithDirectivesIndex = isPresent(ebb.parentWithDirectives) ? ebb.parentWithDirectives.index : -1;
      ListWrapper.push(apiElementBinders, new api.ElementBinder({
        index: ebb.index, parentIndex:parentIndex, distanceToParent:ebb.distanceToParent,
        parentWithDirectivesIndex: parentWithDirectivesIndex, distanceToParentWithDirectives: ebb.distanceToParentWithDirectives,
        directiveIndices: ebb.directiveIndices,
        nestedProtoView: nestedProtoView,
        elementDescription: ebb.elementDescription, initAttrs: ebb.initAttrs,
        propertyBindings: ebb.propertyBindings, variableBindings: ebb.variableBindings,
        eventBindings: ebb.eventBindings, propertyInterpolations: ebb.propertyInterpolations,
        textBindings: ebb.textBindings
      }));
      ListWrapper.push(renderElementBinders, new ElementBinder({
        textNodeIndices: ebb.textBindingIndices,
        contentTagSelector: ebb.contentTagSelector,
        nestedProtoView: isPresent(nestedProtoView) ? nestedProtoView.render : null
      }));
    });
    return new api.ProtoView({
      render: new ProtoView({
        element: this.rootElement,
        elementBinders: renderElementBinders,
        instantiateInPlace: instantiateInPlace,
        componentId: this.componentId
      }),
      elementBinders: apiElementBinders,
      variableBindings: this.variableBindings
    });
  }
}

export class ElementBinderBuilder {
  element;
  index:number;
  parent:ElementBinderBuilder;
  distanceToParent:number;
  parentWithDirectives:ElementBinderBuilder;
  distanceToParentWithDirectives:number;
  directiveIndices:List<number>;
  nestedProtoView:ProtoViewBuilder;
  elementDescription:string;
  // attributes of the element that are not part of bindings.
  // E.g. they are used to initialize directive properties
  initAttrs:Map<string, string>;
  propertyBindings: Map<string, string>;
  // Mapping from property name to interpolation expression
  propertyInterpolations: Map<string, string>;
  variableBindings: Map<string, string>;
  eventBindings: Map<string, string>;
  // Mapping from text node index to and interpolation expression
  textBindingIndices: List<number>;
  textBindings: List<string>;
  contentTagSelector:string;

  constructor(index, element, description) {
    this.element = element;
    this.index = index;
    this.parent = null;
    this.distanceToParent = 0;
    this.parentWithDirectives = null;
    this.distanceToParentWithDirectives = 0;
    this.directiveIndices = [];
    this.nestedProtoView = null;
    this.elementDescription = description;
    this.initAttrs = MapWrapper.create();
    this.propertyBindings = MapWrapper.create();
    this.propertyInterpolations = MapWrapper.create();
    this.variableBindings = MapWrapper.create();
    this.eventBindings = MapWrapper.create();
    this.textBindings = [];
    this.textBindingIndices = [];
    this.contentTagSelector = null
  }

  setParent(parent:ElementBinderBuilder, distanceToParent):ElementBinderBuilder {
    this.parent = parent;
    if (isPresent(parent)) {
      this.distanceToParent = distanceToParent;
      if (parent.directives.length > 0) {
        this.parentWithDirectives = parent;
        this.distanceToParentWithDirectives = distanceToParent;
      } else {
        this.parentWithDirectives = parent.parentWithDirectives;
        if (isPresent(this.parentWithDirectives)) {
          this.distanceToParentWithDirectives = distanceToParent + parent.distanceToParentWithDirectives;
        }
      }
    }
    return this;
  }

  addDirective(directiveIndex:number) {
    ListWrapper.push(this.directiveIndices, directiveIndex);
  }

  bindNestedProtoView():ProtoViewBuilder {
    if (isPresent(nestedProtoView)) {
      throw new BaseException('Only one nested view per element is allowed');
    }
    this.nestedProtoView = new ProtoViewBuilder(this.element);
    return this.nestedProtoView;
  }

  bindInitAttr(name, value) {
    MapWrapper.set(this.initAttrs, name, value);
  }

  bindProperty(name, expression) {
    MapWrapper.set(this.propertyBindings, name, expression);
  }

  bindPropertyInterpolation(name, expression) {
    MapWrapper.set(this.propertyInterpolations, name, expression);
  }

  bindVariable(name, value) {
    // When current is a view root, the variable bindings are set to the *nested* proto view.
    // The root view conceptually signifies a new "block scope" (the nested view), to which
    // the variables are bound.
    if (isPresent(this.nestedProtoView)) {
      this.nestedProtoView.bindVariable(name, value);
    } else {
      MapWrapper.set(this.variableBindings, name, value);
    }
  }

  bindEvent(name, expression) {
    MapWrapper.set(this.eventBindings, name, expression);
  }

  bindText(index, expression) {
    ListWrapper.push(this.textBindingIndices, index);
    ListWrapper.push(this.textBindings, expression);
  }

  setContentTagSelector(value:string) {
    this.contentTagSelector = value;
  }
}

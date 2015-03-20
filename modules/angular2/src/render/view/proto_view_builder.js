import {isPresent} from 'angular2/src/facade/lang';
import {ListWrapper, MapWrapper} from 'angular2/src/facade/collection';
import {DOM} from 'angular2/src/dom/dom_adapter';

import {ProtoView} from './proto_view';
import {ElementBinder} from './element_binder';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';

import {NG_BINDING_CLASS} from './util';

export class ProtoViewBuilder {
  rootElement;
  variableBindings: Map<string, string>;
  elements:List<ElementBinderBuilder>;
  instantiateInPlace:boolean;

  constructor(rootElement) {
    this.rootElement = rootElement;
    this.elements = [];
    this.instantiateInPlace = false;
    this.variableBindings = MapWrapper.create();
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

  build():ProtoView {
    var elementBinders = [];
    ListWrapper.forEach(this.elements, (ebb) => {
      var nestedProtoView =
          isPresent(ebb.nestedProtoView) ? ebb.nestedProtoView.build() : null;
      var parentIndex = isPresent(ebb.parent) ? ebb.parent.index : -1;
      var elBinder = new ElementBinder({
        index: ebb.index, parentIndex:parentIndex, distanceToParent:ebb.distanceToParent,
        directives: ebb.directives,
        nestedProtoView: nestedProtoView,
        elementDescription: ebb.elementDescription, initAttrs: ebb.initAttrs,
        propertyBindings: ebb.propertyBindings, variableBindings: ebb.variableBindings,
        eventBindings: ebb.eventBindings, propertyInterpolations: ebb.propertyInterpolations,
        textBindings: ebb.textBindings, contentTagSelector: ebb.contentTagSelector
      });
      ListWrapper.push(elementBinders, elBinder);
    });
    return new ProtoView({
      element: this.rootElement, elementBinders: elementBinders,
      variableBindings: this.variableBindings,
      instantiateInPlace: this.instantiateInPlace
    });
  }
}

export class ElementBinderBuilder {
  element;
  index:number;
  parent:ElementBinderBuilder;
  distanceToParent:number;
  directives:List<DirectiveMetadata>;
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
  textBindings: Map<number, string>;
  contentTagSelector:string;

  constructor(index, element, description) {
    this.element = element;
    this.index = index;
    this.parent = null;
    this.distanceToParent = 0;
    this.directives = [];
    this.nestedProtoView = null;
    this.elementDescription = description;
    this.initAttrs = MapWrapper.create();
    this.propertyBindings = MapWrapper.create();
    this.propertyInterpolations = MapWrapper.create();
    this.variableBindings = MapWrapper.create();
    this.eventBindings = MapWrapper.create();
    this.textBindings = MapWrapper.create();
    this.contentTagSelector = null
  }

  setParent(parent:ElementBinderBuilder, distanceToParent):ElementBinderBuilder {
    this.parent = parent;
    this.distanceToParent = distanceToParent;
    return this;
  }

  addDirective(directive:DirectiveMetadata) {
    ListWrapper.push(this.directives, directive);
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
    MapWrapper.set(this.textBindings, index, expression);
  }

  setContentTagSelector(value:string) {
    this.contentTagSelector = value;
  }
}

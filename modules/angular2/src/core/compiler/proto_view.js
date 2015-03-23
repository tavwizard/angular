import {Promise} from 'angular2/src/facade/async';
import {SetterFn} from 'angular2/src/reflection/types';

import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';
import {Locals, ChangeDispatcher, ProtoChangeDetector, ChangeRecord} from 'angular2/change_detection';

import {ProtoElementInjector, DirectiveBinding, ElementInjector} from './element_injector';
import {ElementBinder} from './element_binder';
import {DirectiveMetadata} from './directive_metadata';
import {int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';

import * as renderApi from 'angular2/render_api';

/**
 * @publicModule angular2/angular2
 */
export class ProtoView {
  elementBinders:List<ElementBinder>;
  protoChangeDetector:ProtoChangeDetector;
  variableBindings: Map;
  protoLocals:Map;
  // List<Map<eventName, handler>>, indexed by binder index
  eventHandlers:List;
  bindingRecords:List;
  parentProtoView:ProtoView;
  _variableBindings:List;
  render:renderApi.ProtoViewRef;

  constructor(
      protoRenderView: renderApi.ProtoViewRef,
      protoChangeDetector:ProtoChangeDetector,
      elementBinders:List<ElementBinder>,
      eventHandlers:List,
      bindingRecords:List,
      variableBindings:List,
      protoLocals:Map) {
    this.render = protoRenderView;
    this.elementBinders = elementBinders;
    this.variableBindings = MapWrapper.create();
    this.protoLocals = protoLocals;
    this.protoChangeDetector = protoChangeDetector;
    this.eventHandlers = eventHandlers;
    this.bindingRecords = bindingRecords;
    this._variableBindings = variableBindings;
    // Updated later so we can resolve the cyclic dependency:
    // ProtoView.parent vs elementBinder.nestedProtoView
    this.parentProtoView = null;
  }

  // this work should be done the constructor of ProtoView once we separate
  // ProtoView and ProtoViewBuilder
  getVariableBindings() {
    if (isPresent(this._variableBindings)) {
      return this._variableBindings;
    }

    this._variableBindings = isPresent(this.parentProtoView) ?
      ListWrapper.clone(this.parentProtoView.getVariableBindings()) : [];

    MapWrapper.forEach(this.protoLocals, (v, local) => {
      ListWrapper.push(this._variableBindings, local);
    });

    return this._variableBindings;
  }

  /**
   * Creates an event handler.
   *
   * @param {Map} eventMap Map directiveIndexes to expressions
   * @param {int} injectorIdx
   * @returns {Function}
   */
  static buildEventHandler(eventMap: Map, injectorIdx: int) {
    var locals = MapWrapper.create();
    return (event, view) => {
      // Most of the time the event will be fired only when the view is in the live document.
      // However, in a rare circumstance the view might get dehydrated, in between the event
      // queuing up and firing.
      if (view.hydrated()) {
        MapWrapper.set(locals, '$event', event);
        MapWrapper.forEach(eventMap, (expr, directiveIndex) => {
          var context;
          if (directiveIndex === -1) {
            context = view.context;
          } else {
            context = view.elementInjectors[injectorIdx].getDirectiveAtIndex(directiveIndex);
          }
          expr.eval(context, new Locals(view.locals, locals));
        });
      }
    }
  }

  // Create a rootView as if the compiler encountered <rootcmp></rootcmp>,
  // and the component template is already compiled into protoView.
  // Used for bootstrapping.
  static createRootProtoView(
      protoView: ProtoView,
      component: DirectiveMetadata,
      protoChangeDetector:ProtoChangeDetector
  ): ProtoView {
    return new ProtoView(
      null,
      protoChangeDetector,
      [
        new ElementBinder(
          new ProtoElementInjector(null, 0, [DirectiveBinding.createFromType(component.type, component.annotation)], true),
          component, null, protoView, MapWrapper.create()
        )
      ],
      [],
      [],
      [],
      MapWrapper.create());
  }
}


/**
 * @publicModule angular2/angular2
 */
export class ElementBindingMemento {
  _elementIndex:int;
  _setterName:string;
  constructor(elementIndex:int, setterName:string) {
    this._elementIndex = elementIndex;
    this._setterName = setterName;
  }

  invoke(record:ChangeRecord, renderView:renderApi.ViewRef, renderer:renderApi.Renderer) {
    renderer.setElementProperty(
      renderView, this._elementIndex,
      this._setterName, record.currentValue
    );
  }
}

/**
 * @publicModule angular2/angular2
 */
export class DirectiveBindingMemento {
  _elementInjectorIndex:int;
  _directiveIndex:int;
  _setterName:string;
  _setter:SetterFn;
  constructor(
      elementInjectorIndex:number,
      directiveIndex:number,
      setterName:string,
      setter:SetterFn) {
    this._elementInjectorIndex = elementInjectorIndex;
    this._directiveIndex = directiveIndex;
    this._setterName = setterName;
    this._setter = setter;
  }

  invoke(record:ChangeRecord, elementInjectors:List<ElementInjector>) {
    var elementInjector:ElementInjector = elementInjectors[this._elementInjectorIndex];
    var directive = elementInjector.getDirectiveAtIndex(this._directiveIndex);
    this._setter(directive, record.currentValue);
  }
}

var _directiveMementos = MapWrapper.create();

class DirectiveMemento {
  _elementInjectorIndex:number;
  _directiveIndex:number;

  constructor(elementInjectorIndex:number, directiveIndex:number) {
    this._elementInjectorIndex = elementInjectorIndex;
    this._directiveIndex = directiveIndex;
  }

  static get(memento:DirectiveBindingMemento) {
    var elementInjectorIndex = memento._elementInjectorIndex;
    var directiveIndex = memento._directiveIndex;
    var id = elementInjectorIndex * 100 + directiveIndex;

    if (!MapWrapper.contains(_directiveMementos, id)) {
      MapWrapper.set(_directiveMementos, id, new DirectiveMemento(elementInjectorIndex, directiveIndex));
    }
    return MapWrapper.get(_directiveMementos, id);
  }

  directive(elementInjectors:List<ElementInjector>) {
    var elementInjector:ElementInjector = elementInjectors[this._elementInjectorIndex];
    return elementInjector.getDirectiveAtIndex(this._directiveIndex);
  }

  directiveBinding(elementInjectors:List<ElementInjector>) {
    var elementInjector:ElementInjector = elementInjectors[this._elementInjectorIndex];
    return elementInjector.getDirectiveBindingAtIndex(this._directiveIndex);
  }
}

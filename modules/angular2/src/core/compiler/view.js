import {Promise} from 'angular2/src/facade/async';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';
import {AST, Locals, ChangeDispatcher, ProtoChangeDetector, ChangeDetector,
  ChangeRecord, BindingRecord, uninitialized} from 'angular2/change_detection';

import {ProtoElementInjector, ElementInjector, PreBuiltObjects} from './element_injector';
import {BindingPropagationConfig} from './binding_propagation_config';
import {ElementBinder} from './element_binder';
import {DirectiveMetadata} from './directive_metadata';
import {SetterFn} from 'angular2/src/reflection/types';
import {IMPLEMENTS, int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';
import {Injector} from 'angular2/di';
import {NgElement} from 'angular2/src/render/ng_element';
import {ViewContainer} from './view_container';
import {EventManager} from 'angular2/src/render/events/event_manager';

import {ProtoRenderView, RenderView} from 'angular2/src/render/render_view';
import {RenderViewContainer} from 'angular2/src/render/render_view_container';
import {RenderElementBinder} from 'angular2/src/render/render_element_binder';

/**
 * Const of making objects: http://jsperf.com/instantiate-size-of-object
 * @publicModule angular2/angular2
 */
@IMPLEMENTS(ChangeDispatcher)
export class View {
  /// This list matches the _nodes list. It is sparse, since only Elements have ElementInjector
  rootElementInjectors:List<ElementInjector>;
  elementInjectors:List<ElementInjector>;
  changeDetector:ChangeDetector;
  componentChildViews: List<View>;
  viewContainers: List<ViewContainer>;
  preBuiltObjects: List<PreBuiltObjects>;
  proto: ProtoView;
  context: any;
  locals:Locals;
  render:RenderView;

  constructor(renderView:RenderView, proto:ProtoView, protoLocals:Map) {
    this.render = renderView;
    this.proto = proto;
    this.changeDetector = null;
    this.elementInjectors = null;
    this.rootElementInjectors = null;
    this.componentChildViews = null;
    this.viewContainers = null;
    this.preBuiltObjects = null;
    this.context = null;
    this.locals = new Locals(null, MapWrapper.clone(protoLocals)); //TODO optimize this
  }

  init(changeDetector:ChangeDetector, elementInjectors:List, rootElementInjectors:List,
    viewContainers:List, preBuiltObjects:List, componentChildViews:List) {
    this.changeDetector = changeDetector;
    this.elementInjectors = elementInjectors;
    this.rootElementInjectors = rootElementInjectors;
    this.viewContainers = viewContainers;
    this.preBuiltObjects = preBuiltObjects;
    this.componentChildViews = componentChildViews;
  }

  setLocal(contextName: string, value) {
    if (!this.hydrated()) throw new BaseException('Cannot set locals on dehydrated view.');
    if (!MapWrapper.contains(this.proto.variableBindings, contextName)) {
      return;
    }
    var templateName = MapWrapper.get(this.proto.variableBindings, contextName);
    this.locals.set(templateName, value);
  }

  hydrated() {
    return isPresent(this.context);
  }

  _hydrateContext(newContext, locals) {
    this.context = newContext;
    this.locals.parent = locals;
    this.changeDetector.hydrate(this.context, this.locals);
  }

  _dehydrateContext() {
    if (isPresent(this.locals)) {
      this.locals.clearValues();
    }
    this.context = null;
    this.changeDetector.dehydrate();
  }

  /**
   * A dehydrated view is a state of the view that allows it to be moved around
   * the view tree, without incurring the cost of recreating the underlying
   * injectors and watch records.
   *
   * A dehydrated view has the following properties:
   *
   * - all element injectors are empty.
   * - all appInjectors are released.
   * - all viewcontainers are empty.
   * - all context locals are set to null.
   * - the view context is null.
   *
   * A call to hydrate/dehydrate does not attach/detach the view from the view
   * tree.
   */
  hydrate(appInjector: Injector, hostElementInjector: ElementInjector,
      context: Object, locals:Locals) {
    if (this.hydrated()) throw new BaseException('The view is already hydrated.');
    this._hydrateContext(context, locals);

    // viewContainers
    for (var i = 0; i < this.viewContainers.length; i++) {
      var vc = this.viewContainers[i];
      if (isPresent(vc)) {
        vc.hydrate(appInjector, hostElementInjector);
      }
    }

    var binders = this.proto.elementBinders;
    var componentChildViewIndex = 0;
    for (var i = 0; i < binders.length; ++i) {
      var componentDirective = binders[i].componentDirective;
      var shadowDomAppInjector = null;

      // shadowDomAppInjector
      if (isPresent(componentDirective)) {
        var services = componentDirective.annotation.services;
        if (isPresent(services))
          shadowDomAppInjector = appInjector.createChild(services);
        else {
          shadowDomAppInjector = appInjector;
        }
      } else {
        shadowDomAppInjector = null;
      }

      // elementInjectors
      var elementInjector = this.elementInjectors[i];
      if (isPresent(elementInjector)) {
        elementInjector.instantiateDirectives(appInjector, shadowDomAppInjector, this.preBuiltObjects[i]);

        // The exporting of $implicit is a special case. Since multiple elements will all export
        // the different values as $implicit, directly assign $implicit bindings to the variable
        // name.
        var exportImplicitName = elementInjector.getExportImplicitName();
        if (elementInjector.isExportingComponent()) {
          this.locals.set(exportImplicitName, elementInjector.getComponent());
        } else if (elementInjector.isExportingElement()) {
          this.locals.set(exportImplicitName, elementInjector.getNgElement().domElement);
        }
      }

      if (isPresent(binders[i].nestedProtoView) && isPresent(componentDirective)) {
        this.componentChildViews[componentChildViewIndex++].hydrate(shadowDomAppInjector,
          elementInjector, elementInjector.getComponent(), null);
      }
    }
  }

  dehydrate() {
    // Note: preserve the opposite order of the hydration process.

    // componentChildViews
    for (var i = 0; i < this.componentChildViews.length; i++) {
      this.componentChildViews[i].dehydrate();
    }

    // elementInjectors
    for (var i = 0; i < this.elementInjectors.length; i++) {
      if (isPresent(this.elementInjectors[i])) {
        this.elementInjectors[i].clearDirectives();
      }
    }

    // viewContainers
    if (isPresent(this.viewContainers)) {
      for (var i = 0; i < this.viewContainers.length; i++) {
        var vc = this.viewContainers[i];
        if (isPresent(vc)) {
          vc.dehydrate();
        }
      }
    }

    this._dehydrateContext();
  }

  /**
   * Triggers the event handlers for the element and the directives.
   *
   * This method is intended to be called from directive EventEmitters.
   *
   * @param {string} eventName
   * @param {*} eventObj
   * @param {int} binderIndex
   */
  triggerEventHandlers(eventName: string, eventObj, binderIndex: int) {
    var handlers = this.proto.eventHandlers[binderIndex];
    if (isBlank(handlers)) return;
    var handler = StringMapWrapper.get(handlers, eventName);
    if (isBlank(handler)) return;
    handler(eventObj, this);
  }

  onRecordChange(directiveMemento, records:List) {
    this._invokeMementos(records);
    if (directiveMemento instanceof DirectiveMemento) {
      this._notifyDirectiveAboutChanges(directiveMemento, records);
    }
  }

  _invokeMementos(records:List) {
    for(var i = 0; i < records.length; ++i) {
      this._invokeMementoFor(records[i]);
    }
  }

  _notifyDirectiveAboutChanges(directiveMemento, records:List) {
    var dir = directiveMemento.directive(this.elementInjectors);
    var binding = directiveMemento.directiveBinding(this.elementInjectors);

    if (binding.callOnChange) {
      dir.onChange(this._collectChanges(records));
    }
  }

    // dispatch to element injector or text nodes based on context
  _invokeMementoFor(record:ChangeRecord) {
    var memento = record.bindingMemento;
    if (memento instanceof DirectiveBindingMemento) {
      var directiveMemento:DirectiveBindingMemento = memento;
      directiveMemento.invoke(record, this.elementInjectors);

    } else if (memento instanceof ElementBindingMemento) {
      var elementMemento:ElementBindingMemento = memento;
      elementMemento.invoke(record, this.render);
    } else {
      // we know it refers to _textNodes.
      var textNodeIndex:number = memento;
      this.render.setText(textNodeIndex, record.currentValue);
    }
  }

  _collectChanges(records:List) {
    var changes = StringMapWrapper.create();
    for(var i = 0; i < records.length; ++i) {
      var record = records[i];
      var propertyUpdate = new PropertyUpdate(record.currentValue, record.previousValue);
      StringMapWrapper.set(changes, record.bindingMemento._setterName, propertyUpdate);
    }
    return changes;
  }
}

/**
 * @publicModule angular2/angular2
 */
export class ProtoView {
  elementBinders:List<ElementBinder>;
  protoChangeDetector:ProtoChangeDetector;
  variableBindings: Map;
  protoLocals:Map;
  textNodesWithBindingCount:int;
  // List<Map<eventName, handler>>, indexed by binder index
  eventHandlers:List;
  bindingRecords:List;
  parentProtoView:ProtoView;
  _variableBindings:List;
  render:ProtoRenderView;

  constructor(
      protoRenderView: ProtoRenderView,
      protoChangeDetector:ProtoChangeDetector,
      parentProtoView:ProtoView = null) {
    this.render = protoRenderView;
    this.elementBinders = [];
    this.variableBindings = MapWrapper.create();
    this.protoLocals = MapWrapper.create();
    this.protoChangeDetector = protoChangeDetector;
    this.parentProtoView = parentProtoView;
    this.textNodesWithBindingCount = 0;
    this.eventHandlers = [];
    this.bindingRecords = [];
    this._variableBindings = null;
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

  bindVariable(contextName:string, templateName:string) {
    MapWrapper.set(this.variableBindings, contextName, templateName);
    MapWrapper.set(this.protoLocals, templateName, null);
  }

  bindElement(renderElementBinder:RenderElementBinder, protoElementInjector:ProtoElementInjector,
      componentDirective:DirectiveMetadata = null, viewportDirective:DirectiveMetadata = null):ElementBinder {
    var elBinder = new ElementBinder(
      renderElementBinder, protoElementInjector, componentDirective, viewportDirective
    );
    ListWrapper.push(this.elementBinders, elBinder);
    return elBinder;
  }

  /**
   * Adds a text node binding for the last created ElementBinder via bindElement
   */
  bindTextNode(indexInParent:int, expression:AST) {
    this.render.bindTextNode(indexInParent);
    var elBinder = this.elementBinders[this.elementBinders.length-1];
    if (isBlank(elBinder.textNodeIndices)) {
      elBinder.textNodeIndices = ListWrapper.create();
    }
    ListWrapper.push(elBinder.textNodeIndices, indexInParent);
    var memento = this.textNodesWithBindingCount++;
    ListWrapper.push(this.bindingRecords, new BindingRecord(expression, memento, null));
  }

  /**
   * Adds an element property binding for the last created ElementBinder via bindElement
   */
  bindElementProperty(expression:AST, setterName:string, setter:SetterFn) {
    var elBinder = this.elementBinders[this.elementBinders.length-1];
    var memento = new ElementBindingMemento(this.elementBinders.length-1, setterName, setter);
    ListWrapper.push(this.bindingRecords, new BindingRecord(expression, memento, null));
  }

  /**
   * Adds an event binding for the last created ElementBinder via bindElement.
   *
   * If the directive index is a positive integer, the event is evaluated in the context of
   * the given directive.
   *
   * If the directive index is -1, the event is evaluated in the context of the enclosing view.
   *
   * @param {string} eventName
   * @param {AST} expression
   * @param {int} directiveIndex The directive index in the binder or -1 when the event is not bound
   *                             to a directive
   */
  bindEvent(eventName:string, expression:AST, directiveIndex: int = -1) {
    var elBinder = this.elementBinders[this.elementBinders.length - 1];
    var events = elBinder.events;
    if (isBlank(events)) {
      events = StringMapWrapper.create();
      elBinder.events = events;
    }
    var event = StringMapWrapper.get(events, eventName);
    if (isBlank(event)) {
      event = MapWrapper.create();
      StringMapWrapper.set(events, eventName, event);
    }
    MapWrapper.set(event, directiveIndex, expression);
  }

  /**
   * Adds a directive property binding for the last created ElementBinder via bindElement
   */
  bindDirectiveProperty(
    directiveIndex:number,
    expression:AST,
    setterName:string,
    setter:SetterFn) {

    var bindingMemento = new DirectiveBindingMemento(
      this.elementBinders.length-1,
      directiveIndex,
      setterName,
      setter
    );
    var directiveMemento = DirectiveMemento.get(bindingMemento);
    ListWrapper.push(this.bindingRecords, new BindingRecord(expression, bindingMemento, directiveMemento));
  }

  // Create a rootView as if the compiler encountered <rootcmp></rootcmp>,
  // and the component template is already compiled into protoView.
  // Used for bootstrapping.
  static createRootProtoView(
      rootProtoRenderView: ProtoRenderView,
      protoView: ProtoView,
      rootComponentAnnotatedType: DirectiveMetadata,
      protoChangeDetector:ProtoChangeDetector
  ): ProtoView {

    var cmpType = rootComponentAnnotatedType.type;
    var rootProtoView = new ProtoView(rootProtoRenderView, protoChangeDetector);
    var binder = rootProtoView.bindElement(
      new ProtoElementInjector(null, 0, [cmpType], true)
    );
    binder.componentDirective = rootComponentAnnotatedType;
    binder.nestedProtoView = protoView;
    return rootProtoView;
  }
}

/**
 * @publicModule angular2/angular2
 */
export class ElementBindingMemento {
  _elementIndex:int;
  _setterName:string;
  _setter:SetterFn;
  constructor(elementIndex:int, setterName:string, setter:SetterFn) {
    this._elementIndex = elementIndex;
    this._setterName = setterName;
    this._setter = setter;
  }

  invoke(record:ChangeRecord, renderView:RenderView) {
    renderView.setElementProperty(this._elementIndex, this._setterName, this._setter, record.currentValue);
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

/**
 * @publicModule angular2/angular2
 */
export class PropertyUpdate {
  currentValue;
  previousValue;

  constructor(currentValue, previousValue) {
    this.currentValue = currentValue;
    this.previousValue = previousValue;
  }

  static createWithoutPrevious(currentValue) {
    return new PropertyUpdate(currentValue, uninitialized);
  }
}

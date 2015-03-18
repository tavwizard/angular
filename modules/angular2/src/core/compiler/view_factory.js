import {OpaqueToken} from 'angular2/di';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';

import {ElementInjector, PreBuiltObjects} from './element_injector';
import {BindingPropagationConfig} from './binding_propagation_config';
import {int, isPresent, isBlank} from 'angular2/src/facade/lang';
import {NgElement} from 'angular2/src/render/ng_element';
import {ViewContainer} from './view_container';
import {EventManager} from 'angular2/src/render/events/event_manager';

import {RenderView} from 'angular2/src/render/render_view';
import {RenderViewFactory} from 'angular2/src/render/render_view_factory';
import {ProtoView, View} from './view';

export var VIEW_POOL_CAPACITY = new OpaqueToken('ViewFactory.viewPoolCapacity');

export class ViewFactory {
  _poolCapacity:number;
  _pooledViews:List<View>;
  render:RenderViewFactory;

  constructor(capacity) {
    this._poolCapacity = capacity;
    this._pooledViews = ListWrapper.create();
    this.render = new RenderViewFactory(capacity);
  }

  getView(renderView:RenderView, protoView:ProtoView, hostElementInjector: ElementInjector, eventManager: EventManager): View {
    // TODO(tbosch): benchmark this scanning of views and maybe
    // replace it with a fancy LRU Map/List combination...
    for (var i=0; i<this._pooledViews.length; i++) {
      var pooledView = this._pooledViews[i];
      if (pooledView.protoView === protoView) {
        return ListWrapper.removeAt(this._pooledViews, i);
      }
    }
    return this._createView(renderView, protoView, hostElementInjector, eventManager);
  }


  returnView(view:View) {
    ListWrapper.push(this._pooledViews, view);
    while (this._pooledViews.length > this._poolCapacity) {
      ListWrapper.removeAt(this._pooledViews, 0);
    }
  }

  _createView(renderView:RenderView, protoView:ProtoView, hostElementInjector: ElementInjector, eventManager: EventManager): View {
    var view = new View(renderView, protoView, protoView.protoLocals);
    var changeDetector = protoView.protoChangeDetector.instantiate(view, protoView.bindingRecords, protoView.getVariableBindings());
    var binders = protoView.elementBinders;
    var elementInjectors = ListWrapper.createFixedSize(binders.length);
    var eventHandlers = ListWrapper.createFixedSize(binders.length);
    var rootElementInjectors = [];
    var preBuiltObjects = ListWrapper.createFixedSize(binders.length);
    var viewContainers = ListWrapper.createFixedSize(binders.length);
    var componentChildViews = [];

    for (var binderIdx = 0; binderIdx < binders.length; binderIdx++) {
      var binder = binders[binderIdx];
      var element = renderView.boundElements[binderIdx];
      var elementInjector = null;

      // elementInjectors and rootElementInjectors
      var protoElementInjector = binder.protoElementInjector;
      if (isPresent(protoElementInjector)) {
        if (isPresent(protoElementInjector.parent)) {
          var parentElementInjector = elementInjectors[protoElementInjector.parent.index];
          elementInjector = protoElementInjector.instantiate(parentElementInjector, null);
        } else {
          elementInjector = protoElementInjector.instantiate(null, hostElementInjector);
          ListWrapper.push(rootElementInjectors, elementInjector);
        }
      }
      elementInjectors[binderIdx] = elementInjector;

      // componentChildViews
      var bindingPropagationConfig = null;
      if (isPresent(binder.nestedProtoView) && isPresent(binder.componentDirective)) {
        var childRenderView = this.render.getView(binder.nestedProtoView.render, eventManager);
        var childView = this.getView(
          childRenderView, binder.nestedProtoView,
          elementInjector, eventManager
        );
        renderView.setComponentView(binderIdx, childRenderView);
        changeDetector.addChild(childView.changeDetector);

        bindingPropagationConfig = new BindingPropagationConfig(changeDetector);

        ListWrapper.push(componentChildViews, childView);
      }

      // viewContainers
      var viewContainer = null;
      if (isPresent(binder.viewportDirective)) {
        viewContainer = new ViewContainer(
          this,
          renderView.viewContainers[binderIdx], view, binder.nestedProtoView,
          elementInjector, eventManager
        );
      }
      viewContainers[binderIdx] = viewContainer;

      // preBuiltObjects
      if (isPresent(elementInjector)) {
        preBuiltObjects[binderIdx] = new PreBuiltObjects(this, view, new NgElement(element), viewContainer,
          bindingPropagationConfig);
      }

      // events
      if (isPresent(binder.events)) {
        eventHandlers[binderIdx] = StringMapWrapper.create();
        StringMapWrapper.forEach(binder.events, (eventMap, eventName) => {
          var handler = ProtoView.buildEventHandler(eventMap, binderIdx);
          StringMapWrapper.set(eventHandlers[binderIdx], eventName, handler);
          if (isBlank(elementInjector) || !elementInjector.hasEventEmitter(eventName)) {
            renderView.listen(binderIdx, eventName,
              (event) => { handler(event, view); });
          }
        });
      }
    }

    // TODO(tbosch): event handlers of the ProtoView should be filled in a CompileStep,
    // and not during View instantiation!!
    protoView.eventHandlers = eventHandlers;

    view.init(changeDetector, elementInjectors, rootElementInjectors,
      viewContainers, preBuiltObjects, componentChildViews);

    return view;
  }

}
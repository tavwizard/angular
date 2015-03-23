import {OpaqueToken, Injector} from 'angular2/di';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';

import {ChangeDetection} from 'angular2/change_detection';

import {ElementInjector, PreBuiltObjects, DirectiveBinding} from './element_injector';
import {BindingPropagationConfig} from './binding_propagation_config';
import {int, isPresent, isBlank} from 'angular2/src/facade/lang';
import {NgElement} from './ng_element';
import {ViewContainer} from './view_container';
import {DirectiveMetadata} from './directive_metadata';
import {DirectiveMetadataReader} from './directive_metadata_reader';

import * as renderApi from 'angular2/render_api';
import {View} from './view';
import {ProtoView} from './proto_view';

export var VIEW_POOL_CAPACITY = new OpaqueToken('ViewFactory.viewPoolCapacity');

export class ViewFactory {
  _poolCapacity:number;
  _pooledViews:List<View>;
  _renderer:renderApi.Renderer;
  _changeDetection: ChangeDetection;
  _directiveMetadataReader: DirectiveMetadataReader;

  constructor(capacity, renderer:renderApi.Renderer,
      changeDetection: ChangeDetection, directiveMetadataReader: DirectiveMetadataReader) {
    this._poolCapacity = capacity;
    this._pooledViews = ListWrapper.create();
    this._renderer = renderer;
    this._changeDetection = changeDetection;
    this._directiveMetadataReader = directiveMetadataReader;
  }

  getView(protoView:ProtoView): View {
    // TODO(tbosch): benchmark this scanning of views and maybe
    // replace it with a fancy LRU Map/List combination...
    // Note: We are getting a new renderView even if
    // our view is from the pool so that the render side can have its own lifecycle,
    // e.g. for animations
    var renderView = this._renderer.createView(protoView.render);
    for (var i=0; i<this._pooledViews.length; i++) {
      var pooledView = this._pooledViews[i];
      if (pooledView.protoView === protoView) {
        var res = ListWrapper.removeAt(this._pooledViews, i);
        // TODOz: add an API to View for this!
        res.render = renderView;
        return res;
      }
    }
    return this._createView(renderView, protoView);
  }

  getRootView(rootElementSelectorOrElement, component:Type, injector: Injector, protoView:ProtoView): View {
    // Note: this render view is already hydrated and ready to use!
    var renderRootView = this._renderer.createRootView(rootElementSelectorOrElement);
    var rootProtoView = ProtoView.createRootProtoView(
      protoView,
      this._directiveMetadataReader.read(component),
      this._changeDetection.createProtoChangeDetector('root')
    );
    var view = this._createView(renderRootView, rootProtoView);
    view.hydrate(injector, null, new Object(), null);
    return view;
  }

  returnView(view:View) {
    if (view.hydrated()) {
      view.dehydrate();
    }
    this._renderer.destroyView(view.render);
    // TODOz: add an API to View for this!
    view.render = null;

    ListWrapper.push(this._pooledViews, view);
    while (this._pooledViews.length > this._poolCapacity) {
      ListWrapper.removeAt(this._pooledViews, 0);
    }
  }

  _createView(renderView:renderApi.ViewRef, protoView:ProtoView): View {
    var view = new View(this._renderer, renderView, protoView, protoView.protoLocals);
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
      var elementInjector = null;

      // elementInjectors and rootElementInjectors
      var protoElementInjector = binder.protoElementInjector;
      if (isPresent(protoElementInjector)) {
        if (isPresent(protoElementInjector.parent)) {
          var parentElementInjector = elementInjectors[protoElementInjector.parent.index];
          elementInjector = protoElementInjector.instantiate(parentElementInjector);
        } else {
          elementInjector = protoElementInjector.instantiate(null);
          ListWrapper.push(rootElementInjectors, elementInjector);
        }
      }
      elementInjectors[binderIdx] = elementInjector;

      // componentChildViews
      var bindingPropagationConfig = null;
      if (isPresent(binder.nestedProtoView) && isPresent(binder.componentDirective)) {
        var childView = this.getView(binder.nestedProtoView);
        this._renderer.setComponentView(renderView, binderIdx, childView.render);
        changeDetector.addChild(childView.changeDetector);

        bindingPropagationConfig = new BindingPropagationConfig(changeDetector);

        ListWrapper.push(componentChildViews, childView);
      }

      // viewContainers
      var viewContainer = null;
      if (isPresent(binder.viewportDirective)) {
        viewContainer = new ViewContainer(
          this,
          renderView.getViewContainer(binderIdx), view, binder.nestedProtoView,
          elementInjector
        );
      }
      viewContainers[binderIdx] = viewContainer;

      // preBuiltObjects
      if (isPresent(elementInjector)) {
        // TODO(tbosch): We need to find another way for NgElement to change the element
        // without actually referencing the element!
        var element = renderView.boundElements[binderIdx];
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
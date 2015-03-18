import {OpaqueToken} from 'angular2/di';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';

import {RenderViewContainer} from './render_view_container';
import {int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';
import {Content} from './shadow_dom/emulation/content_tag';
import {EventManager} from 'angular2/src/render/events/event_manager';

import {ProtoRenderView, RenderView} from './render_view';

export var VIEW_POOL_CAPACITY = new OpaqueToken('RenderViewFactory.viewPoolCapacity');

const NG_BINDING_CLASS_SELECTOR = '.ng-binding';
const NG_BINDING_CLASS = 'ng-binding';

export class RenderViewFactory {
  _poolCapacity:number;
  _pooledViews:List<RenderView>;

  constructor(capacity) {
    this._poolCapacity = capacity;
    this._pooledViews = ListWrapper.create();
  }

  getView(protoRenderView:ProtoRenderView, eventManager: EventManager): RenderView {
    // TODO(tbosch): benchmark this scanning of views and maybe
    // replace it with a fancy LRU Map/List combination...
    for (var i=0; i<this._pooledViews.length; i++) {
      var pooledView = this._pooledViews[i];
      if (pooledView.protoView === protoView) {
        return ListWrapper.removeAt(this._pooledViews, i);
      }
    }
    return this._createView(protoRenderView, eventManager);
  }


  returnView(view:RenderView) {
    ListWrapper.push(this._pooledViews, view);
    while (this._pooledViews.length > this._poolCapacity) {
      ListWrapper.removeAt(this._pooledViews, 0);
    }
  }

  _createView(protoRenderView:ProtoRenderView, eventManager: EventManager): RenderView {
    var rootElementClone = protoRenderView.instantiateInPlace ? protoRenderView.element : DOM.importIntoDoc(protoRenderView.element);
    var elementsWithBindingsDynamic;
    if (protoRenderView.isTemplateElement) {
      elementsWithBindingsDynamic = DOM.querySelectorAll(DOM.content(rootElementClone), NG_BINDING_CLASS_SELECTOR);
    } else {
      elementsWithBindingsDynamic= DOM.getElementsByClassName(rootElementClone, NG_BINDING_CLASS);
    }

    var elementsWithBindings = ListWrapper.createFixedSize(elementsWithBindingsDynamic.length);
    for (var binderIdx = 0; binderIdx < elementsWithBindingsDynamic.length; ++binderIdx) {
      elementsWithBindings[binderIdx] = elementsWithBindingsDynamic[binderIdx];
    }

    var viewRootNodes;
    if (protoRenderView.isTemplateElement) {
      var childNode = DOM.firstChild(DOM.content(rootElementClone));
      viewRootNodes = []; // TODO(perf): Should be fixed size, since we could pre-compute in in ProtoView
      // Note: An explicit loop is the fastest way to convert a DOM array into a JS array!
      while(childNode != null) {
        ListWrapper.push(viewRootNodes, childNode);
        childNode = DOM.nextSibling(childNode);
      }
    } else {
      viewRootNodes = [rootElementClone];
    }

    var binders = protoRenderView.elementBinders;
    var boundTextNodes = [];
    var boundElements = ListWrapper.createFixedSize(binders.length);
    var viewContainers = ListWrapper.createFixedSize(binders.length);
    var contentTags = ListWrapper.createFixedSize(binders.length);

    for (var binderIdx = 0; binderIdx < binders.length; binderIdx++) {
      var binder = binders[binderIdx];
      var element;
      if (binderIdx === 0 && protoRenderView.rootBindingOffset === 1) {
        element = rootElementClone;
      } else {
        element = elementsWithBindings[binderIdx - protoRenderView.rootBindingOffset];
      }
      boundElements[binderIdx] = element;

      // boundTextNodes
      var textNodeIndices = binder.textNodeIndices;
      if (isPresent(textNodeIndices)) {
        var childNode = DOM.firstChild(DOM.templateAwareRoot(element));
        for (var j = 0, k = 0; j < textNodeIndices.length; j++) {
          for(var index = textNodeIndices[j]; k < index; k++) {
            childNode = DOM.nextSibling(childNode);
          }
          ListWrapper.push(boundTextNodes, childNode);
        }
      }

      // viewContainers
      var viewContainer = null;
      if (binder.isViewContainer) {
        viewContainer = new RenderViewContainer(this, element, binder.nestedProtoView, eventManager);
      }
      viewContainers[binderIdx] = viewContainer;

      // contentTags
      var contentTag = null;
      if (isPresent(binder.contentTagSelector)) {
        contentTag = new Content(element, binder.contentTagSelector);
      }
      contentTags[binderIdx] = contentTag;
    }

    var view = new RenderView(
      protoRenderView, viewRootNodes, eventManager,
      boundTextNodes, boundElements, viewContainers, contentTags
    );

    return view;
  }

}
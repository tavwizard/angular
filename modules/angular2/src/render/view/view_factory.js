import {OpaqueToken} from 'angular2/di';
import {int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';

import {DOM} from 'angular2/src/dom/dom_adapter';

import {Content} from '../shadow_dom/emulation/content_tag';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';
import {EventManager} from '../events/event_manager';

import {ViewContainer} from './view_container';
import {ProtoView} from './proto_view';
import {View} from './view';
import {NG_BINDING_CLASS_SELECTOR, NG_BINDING_CLASS} from '../util';

import {ProtoViewBuilder} from './proto_view_builder';

export var VIEW_POOL_CAPACITY = new OpaqueToken('ViewFactory.viewPoolCapacity');


export class ViewFactory {
  _poolCapacity:number;
  _pooledViews:List<View>;

  constructor(capacity) {
    this._poolCapacity = capacity;
    this._pooledViews = ListWrapper.create();
  }

  getView(protoView:ProtoView): View {
    // TODO(tbosch): benchmark this scanning of views and maybe
    // replace it with a fancy LRU Map/List combination...
    for (var i=0; i<this._pooledViews.length; i++) {
      var pooledView = this._pooledViews[i];
      if (pooledView.protoView === protoView) {
        return ListWrapper.removeAt(this._pooledViews, i);
      }
    }
    return this._createView(protoView);
  }

  getRootView(elementOrSelector) {
    var element = elementOrSelector; // TODO: select the element if it is not a real element...
    var rootProtoViewBuilder = new ProtoViewBuilder(element);
    rootProtoViewBuilder.setInstantiateInPlace(true);
    rootProtoViewBuilder.bindElement(element, 'root element');
    return this.getView(rootProtoViewBuilder.build().render);
  }

  returnView(view:View) {
    if (view.hydrated()) {
      view.dehydrate();
    }
    ListWrapper.push(this._pooledViews, view);
    while (this._pooledViews.length > this._poolCapacity) {
      ListWrapper.removeAt(this._pooledViews, 0);
    }
  }

  _createView(protoView:ProtoView): View {
    var rootElementClone = protoView.instantiateInPlace ? protoView.element : DOM.importIntoDoc(protoView.element);
    var elementsWithBindingsDynamic;
    if (protoView.isTemplateElement) {
      elementsWithBindingsDynamic = DOM.querySelectorAll(DOM.content(rootElementClone), NG_BINDING_CLASS_SELECTOR);
    } else {
      elementsWithBindingsDynamic = DOM.getElementsByClassName(rootElementClone, NG_BINDING_CLASS);
    }

    var elementsWithBindings = ListWrapper.createFixedSize(elementsWithBindingsDynamic.length);
    for (var binderIdx = 0; binderIdx < elementsWithBindingsDynamic.length; ++binderIdx) {
      elementsWithBindings[binderIdx] = elementsWithBindingsDynamic[binderIdx];
    }

    var viewRootNodes;
    if (protoView.isTemplateElement) {
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

    var binders = protoView.elementBinders;
    var boundTextNodes = [];
    var boundElements = ListWrapper.createFixedSize(binders.length);
    var viewContainers = ListWrapper.createFixedSize(binders.length);
    var contentTags = ListWrapper.createFixedSize(binders.length);

    for (var binderIdx = 0; binderIdx < binders.length; binderIdx++) {
      var binder = binders[binderIdx];
      var element;
      if (binderIdx === 0 && protoView.rootBindingOffset === 1) {
        element = rootElementClone;
      } else {
        element = elementsWithBindings[binderIdx - protoView.rootBindingOffset];
      }
      boundElements[binderIdx] = element;

      // boundTextNodes
      var childNodes = DOM.childNodes(DOM.templateAwareRoot(element));
      var textNodeIndices = binder.textNodeIndices;
      for (var i = 0; i<textNodeIndices.length; i++) {
        ListWrapper.push(boundTextNodes, childNodes[textNodeIndices[i]]);
      }

      // viewContainers
      var viewContainer = null;
      if (isPresent(binder.nestedProtoView)) {
        viewContainer = new ViewContainer(this, element);
      }
      viewContainers[binderIdx] = viewContainer;

      // contentTags
      var contentTag = null;
      if (isPresent(binder.contentTagSelector)) {
        contentTag = new Content(element, binder.contentTagSelector);
      }
      contentTags[binderIdx] = contentTag;
    }

    var view = new View(
      protoView, viewRootNodes,
      boundTextNodes, boundElements, viewContainers, contentTags
    );

    return view;
  }

}
import * as api from '../api';

import {DOM} from 'angular2/src/dom/dom_adapter';
import {Promise} from 'angular2/src/facade/async';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';
import {int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';

import {ViewContainer} from './view_container';
import {ProtoView} from './proto_view';
import {LightDom} from '../shadow_dom/emulation/light_dom';
import {Content} from '../shadow_dom/emulation/content_tag';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';
import {EventManager} from '../events/event_manager';

const NG_BINDING_CLASS = 'ng-binding';

/**
 * Const of making objects: http://jsperf.com/instantiate-size-of-object
 */
export class View extends api.View {
  boundElements:List;
  boundTextNodes:List;
  /// When the view is part of render tree, the DocumentFragment is empty, which is why we need
  /// to keep track of the nodes.
  rootNodes:List;
  // TODO(tbosch): move componentChildViews, viewContainers, contentTags, lightDoms into
  // a single array with records inside
  componentChildViews: List<View>;
  viewContainers: List<ViewContainer>;
  contentTags: List<Content>;
  lightDoms: List<LightDom>;
  proto: ProtoView;
  _eventManager: EventManager;
  _shadowDomStrategy:ShadowDomStrategy;
  _hydrated: boolean;

  constructor(
      proto:ProtoView, rootNodes:List, eventManager:EventManager,
      shadowDomStrategy:ShadowDomStrategy,
      boundTextNodes: List, boundElements:List, viewContainers:List, contentTags:List) {
    this.proto = proto;
    this.rootNodes = rootNodes;
    this.boundTextNodes = boundTextNodes;
    this.boundElements = boundElements;
    this.viewContainers = viewContainers;
    this.contentTags = contentTags;
    this.lightDoms = ListWrapper.createFixedSize(boundElements.length);
    this.componentChildViews = ListWrapper.createFixedSize(boundElements.length);
    this._eventManager = eventManager;
    this._hydrated = false;
    this._shadowDomStrategy = shadowDomStrategy;
  }

  hydrated() {
    return this._hydrated;
  }

  // TODO: don't use the setter
  setElementProperty(elementIndex:number, propertyName:string, setter:Function, value:Object) {
    setter(this.boundElements[elementIndex], value);
  }

  setText(textIndex:number, value:string) {
    DOM.setText(this.boundTextNodes[textIndex], value);
  }

  listen(elementIndex:number, eventName:string, callback:Function) {
    this._eventManager(this.boundElements[elementIndex], eventName, callback);
  }

  setComponentView(elementIndex:number, childView:View) {
    var element = this.boundElements[elementIndex];

    var lightDom = this._shadowDomStrategy.constructLightDom(this, childView, element);
    this._shadowDomStrategy.attachTemplate(element, childView);
    this.lightDoms[elementIndex] = lightDom;
    this.componentChildViews[elementIndex] = childView;
    if (this._hydrated) {
      childView.hydrate(lightDom);
    }
  }

  getViewContainer(index:number):ViewContainer {
    return this.viewcontainers[index];
  }

  _getDestLightDom(binderIndex) {
    var binder = this.proto.elementBinders[binderIndex];
    var destLightDom = null;
    if (binder.parentIndex !== -1 && binder.distanceToParent === 1) {
      destLightDom = this.lightDoms[binder.parentIndex];
    }
    return destLightDom;
  }

  /**
   * A dehydrated view is a state of the view that allows it to be moved around
   * the view tree.
   *
   * A dehydrated view has the following properties:
   *
   * - all viewcontainers are empty.
   *
   * A call to hydrate/dehydrate does not attach/detach the view from the view
   * tree.
   */
  hydrate(hostLightDom: LightDom) {
    if (this._hydrated) throw new BaseException('The view is already hydrated.');
    this._hydrated = true;

    // viewContainers and content tags
    for (var i = 0; i < this.viewContainers.length; i++) {
      var vc = this.viewContainers[i];
      var destLightDom = this._getDestLightDom(i);
      if (isPresent(vc)) {
        vc.hydrate(destLightDom, hostLightDom);
      }
      var ct = this.contentTags[i];
      if (isPresent(ct)) {
        ct.hydrate(destLightDom);
      }
    }

    // componentChildViews
    for (var i = 0; i < this.componentChildViews.length; i++) {
      var cv = this.componentChildViews[i];
      if (isPresent(cv)) {
        cv.hydrate(this.lightDoms[i]);
      }
    }

    for (var i = 0; i < this.lightDoms.length; ++i) {
      var lightDom = this.lightDoms[i];
      if (isPresent(lightDom)) {
        lightDom.redistribute();
      }
    }
  }

  dehydrate() {
    // Note: preserve the opposite order of the hydration process.

    // componentChildViews
    for (var i = 0; i < this.componentChildViews.length; i++) {
      this.componentChildViews[i].dehydrate();
    }

    // viewContainers and content tags
    if (isPresent(this.viewContainers)) {
      for (var i = 0; i < this.viewContainers.length; i++) {
        var vc = this.viewContainers[i];
        if (isPresent(vc)) {
          vc.dehydrate();
        }
        var ct = this.contentTags[i];
        if (isPresent(ct)) {
          ct.dehydrate();
        }
      }
    }
    this._hydrated = false;
  }
}

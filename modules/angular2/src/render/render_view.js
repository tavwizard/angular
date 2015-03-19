import {DOM} from 'angular2/src/dom/dom_adapter';
import {Promise} from 'angular2/src/facade/async';
import {ListWrapper, MapWrapper, Map, StringMapWrapper, List} from 'angular2/src/facade/collection';

import {RenderElementBinder} from './render_element_binder';
import {RenderViewContainer} from './render_view_container';
import {IMPLEMENTS, int, isPresent, isBlank, BaseException} from 'angular2/src/facade/lang';
import {LightDom} from './shadow_dom/emulation/light_dom';
import {Content} from './shadow_dom/emulation/content_tag';
import {ShadowDomStrategy} from './shadow_dom/shadow_dom_strategy';
import {EventManager} from 'angular2/src/render/events/event_manager';

const NG_BINDING_CLASS = 'ng-binding';

/**
 * Const of making objects: http://jsperf.com/instantiate-size-of-object
 */
export class RenderView {
  boundElements:List;
  boundTextNodes:List;
  /// When the view is part of render tree, the DocumentFragment is empty, which is why we need
  /// to keep track of the nodes.
  rootNodes:List;
  // TODO(tbosch): move componentChildViews, viewContainers, contentTags, lightDoms into
  // a single array with records inside
  componentChildViews: List<RenderView>;
  viewContainers: List<RenderViewContainer>;
  contentTags: List<Content>;
  lightDoms: List<LightDom>;
  proto: ProtoRenderView;
  eventManager: EventManager;
  _hydrated: boolean;

  constructor(
      proto:ProtoRenderView, rootNodes:List, eventManager:EventManager,
      boundTextNodes: List, boundElements:List, viewContainers:List, contentTags:List) {
    this.proto = proto;
    this.rootNodes = rootNodes;
    this.boundTextNodes = boundTextNodes;
    this.boundElements = boundElements;
    this.viewContainers = viewContainers;
    this.contentTags = contentTags;
    this.lightDoms = ListWrapper.createFixedSize(boundElements.length);
    this.componentChildViews = ListWrapper.createFixedSize(boundElements.length);
    this.eventManager = eventManager;
    this._hydrated = false;
  }

  // TODO: don't use the setter
  setElementProperty(elementIndex:number, propertyName:string, setter:Function, value:Object) {
    setter(this.boundElements[elementIndex], value);
  }

  setText(textIndex:number, value:string) {
    DOM.setText(this.boundTextNodes[textIndex], value);
  }

  listen(elementIndex:number, eventName:string, callback:Function) {
    eventManager(this.boundElements[elementIndex], eventName, callback);
  }

  setComponentView(elementIndex:number, childView:RenderView) {
    var element = this.boundElements[elementIndex];
    var strategy = this.proto.shadowDomStrategy;

    var lightDom = strategy.constructLightDom(this, childView, element);
    strategy.attachTemplate(element, childView);
    this.lightDoms[elementIndex] = lightDom;
    this.componentChildViews[elementIndex] = childView;
  }

  _getDestLightDom(binderIndex) {
    var binder = this.proto.elementBinders[binderIndex];
    var destLightDom = null;
    if (isPresent(binder.parent) && binder.distanceToParent === 1) {
      destLightDom = this.lightDoms[binder.parent.index];
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

export class ProtoRenderView {
  element;
  elementBinders:List<RenderElementBinder>;
  instantiateInPlace:boolean;
  rootBindingOffset:int;
  isTemplateElement:boolean;
  shadowDomStrategy: ShadowDomStrategy;
  stylePromises: List<Promise>;

  constructor(
      template,
      shadowDomStrategy:ShadowDomStrategy,
      elementBinders:List<RenderElementBinder>) {
    this.element = template;
    this.elementBinders = elementBinders;
    this.instantiateInPlace = false;
    this.rootBindingOffset = (isPresent(this.element) && DOM.hasClass(this.element, NG_BINDING_CLASS))
      ? 1 : 0;
    this.isTemplateElement = DOM.isTemplateElement(this.element);
    this.shadowDomStrategy = shadowDomStrategy;
    // TODO(tbosch): We should keep this state somewhere else...
    this.stylePromises = [];
  }

  // Create a rootView as if the compiler encountered <rootcmp></rootcmp>,
  // and the component template is already compiled into protoView.
  // Used for bootstrapping.
  static createRootRenderProtoView(protoView: ProtoView,
      insertionElement,
      rootComponentAnnotatedType: DirectiveMetadata,
      shadowDomStrategy: ShadowDomStrategy
  ): ProtoView {

    DOM.addClass(insertionElement, NG_BINDING_CLASS);
    var cmpType = rootComponentAnnotatedType.type;
    var rootProtoView = new ProtoRenderView(insertionElement, shadowDomStrategy);
    rootProtoView.instantiateInPlace = true;
    var binder = rootProtoView.bindElement(null, 0);
    shadowDomStrategy.shimAppElement(rootComponentAnnotatedType, insertionElement);
    return rootProtoView;
  }
}

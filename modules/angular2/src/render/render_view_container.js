import * as viewModule from './render_view';
import {DOM} from 'angular2/src/dom/dom_adapter';
import {ListWrapper, MapWrapper, List} from 'angular2/src/facade/collection';
import {BaseException} from 'angular2/src/facade/lang';
import {isPresent, isBlank} from 'angular2/src/facade/lang';
import {EventManager} from 'angular2/src/render/events/event_manager';
import * as ldModule from './shadow_dom/emulation/light_dom';
import * as vfModule from './render_view_factory';

export class RenderViewContainer {
  _viewFactory: vfModule.RenderViewFactory;
  templateElement;
  defaultProtoView: viewModule.ProtoRenderView;
  _views: List<viewModule.RenderView>;
  _lightDom: ldModule.LightDom;
  _eventManager: EventManager;
  hostLightDom: ldModule.LightDom;
  _hydrated: boolean;

  constructor(viewFactory: vfModule.RenderViewFactory,
              templateElement,
              defaultProtoView: viewModule.ProtoRenderView,
              eventManager: EventManager) {
    this._viewFactory = viewFactory;
    this.templateElement = templateElement;
    this.defaultProtoView = defaultProtoView;

    // The order in this list matches the DOM order.
    this._views = [];
    this.hostLightDom = null;
    this._eventManager = eventManager;
    this._hydrated = false;
  }

  hydrate(destLightDom: ldModule.LightDom, hostLightDom: ldModule.LightDom) {
    this._hydrated = true;
    this.hostLightDom = hostLightDom;
    this._lightDom = destLightDom;
  }

  dehydrate() {
    this.hostLightDom = null;
    this._lightDom = null;
    this.clear();
    this._hydrated = false;
  }

  clear() {
    for (var i = this._views.length - 1; i >= 0; i--) {
      this.remove(i);
    }
  }

  get(index: number): viewModule.RenderView {
    return this._views[index];
  }

  get length() {
    return this._views.length;
  }

  _siblingToInsertAfter(index: number) {
    if (index == 0) return this.templateElement;
    return ListWrapper.last(this._views[index - 1].rootNodes);
  }

  // TODO(rado): profile and decide whether bounds checks should be added
  // to the methods below.
  create(atIndex=-1): viewModule.RenderView {
    if (!this._hydrated) throw new BaseException(
        'Cannot create views on a dehydrated ViewContainer');
    // TODO(rado): replace with viewFactory.
    var newView = this._viewFactory.getView(defaultProtoView, this._eventManager);
    // insertion must come before hydration so that element injector trees are attached.
    this.insert(newView, atIndex);
    newView.hydrate(this.hostLightDom);

    // new content tags might have appeared, we need to redistrubute.
    if (isPresent(this.hostLightDom)) {
      this.hostLightDom.redistribute();
    }
    return newView;
  }

  insert(view, atIndex=-1): viewModule.RenderView {
    if (atIndex == -1) atIndex = this._views.length;
    ListWrapper.insert(this._views, atIndex, view);
    if (isBlank(this._lightDom)) {
      RenderViewContainer.moveViewNodesAfterSibling(this._siblingToInsertAfter(atIndex), view);
    } else {
      this._lightDom.redistribute();
    }

    return view;
  }

  remove(atIndex=-1) {
    if (atIndex == -1) atIndex = this._views.length - 1;
    var view = this.detach(atIndex);
    view.dehydrate();
    this._viewFactory.returnView(view);
  }

  /**
   * The method can be used together with insert to implement a view move, i.e.
   * moving the dom nodes while the directives in the view stay intact.
   */
  detach(atIndex=-1): viewModule.RenderView {
    if (atIndex == -1) atIndex = this._views.length - 1;
    var detachedView = this.get(atIndex);
    ListWrapper.removeAt(this._views, atIndex);
    if (isBlank(this._lightDom)) {
      RenderViewContainer.removeViewNodesFromParent(this.templateElement.parentNode, detachedView);
    } else {
      this._lightDom.redistribute();
    }
    // content tags might have disappeared we need to do redistribution.
    if (isPresent(this.hostLightDom)) {
      this.hostLightDom.redistribute();
    }
    return detachedView;
  }

  contentTagContainers() {
    return this._views;
  }

  nodes():List {
    var r = [];
    for (var i = 0; i < this._views.length; ++i) {
      r = ListWrapper.concat(r, this._views[i].rootNodes);
    }
    return r;
  }

  static moveViewNodesAfterSibling(sibling, view) {
    for (var i = view.rootNodes.length - 1; i >= 0; --i) {
      DOM.insertAfter(sibling, view.rootNodes[i]);
    }
  }

  static removeViewNodesFromParent(parent, view) {
    for (var i = view.rootNodes.length - 1; i >= 0; --i) {
      DOM.removeChild(parent, view.rootNodes[i]);
    }
  }
}

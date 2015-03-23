import * as viewModule from './view';
import {ListWrapper, MapWrapper, List} from 'angular2/src/facade/collection';
import {BaseException} from 'angular2/src/facade/lang';
import {Injector} from 'angular2/di';
import * as eiModule from 'angular2/src/core/compiler/element_injector';
import {isPresent, isBlank} from 'angular2/src/facade/lang';
import * as renderApi from 'angular2/render_api';
import * as vfModule from './view_factory';

/**
 * @publicModule angular2/angular2
 */
export class ViewContainer {
  _viewFactory: vfModule.ViewFactory;
  parentView: viewModule.View;
  defaultProtoView: viewModule.ProtoView;
  _views: List<viewModule.View>;
  elementInjector: eiModule.ElementInjector;
  appInjector: Injector;
  hostElementInjector: eiModule.ElementInjector;
  render: renderApi.ViewContainerRef;
  _renderer: renderApi.Renderer;

  constructor(renderer: renderApi.Renderer,
              viewFactory: vfModule.ViewFactory,
              renderViewContainer: renderApi.ViewContainerRef,
              parentView: viewModule.View,
              defaultProtoView: viewModule.ProtoView,
              elementInjector: eiModule.ElementInjector) {
    this._viewFactory = viewFactory;
    this._renderer = renderer;
    this.render = renderViewContainer;
    this.parentView = parentView;
    this.defaultProtoView = defaultProtoView;
    this.elementInjector = elementInjector;

    // The order in this list matches the DOM order.
    this._views = [];
    this.appInjector = null;
    this.hostElementInjector = null;
  }

  hydrate(appInjector: Injector, hostElementInjector: eiModule.ElementInjector) {
    this.appInjector = appInjector;
    this.hostElementInjector = hostElementInjector;
  }

  dehydrate() {
    this.appInjector = null;
    this.hostElementInjector = null;
    // Note: Can't use this.clear here as we don't want to
    // change the render side, only want to tell
    // it that we don't need the render view any more!
    for (var i = this._views.length - 1; i >= 0; i--) {
      this._detach(i, false);
      this._viewFactory.returnView(this._views[i]);
    }
    this._views = [];
  }

  clear() {
    for (var i = this._views.length - 1; i >= 0; i--) {
      this.remove(i);
    }
  }

  get(index: number): viewModule.View {
    return this._views[index];
  }

  get length() {
    return this._views.length;
  }

  hydrated() {
    return isPresent(this.appInjector);
  }

  // TODO(rado): profile and decide whether bounds checks should be added
  // to the methods below.
  create(atIndex=-1): viewModule.View {
    if (!this.hydrated()) throw new BaseException(
        'Cannot create views on a dehydrated ViewContainer');
    var newView = this._viewFactory.getView(defaultProtoView);
    this._insert(newView, atIndex);
    return newView;
  }

  _insert(view, atIndex=1): viewModule.View {
    if (atIndex == -1) atIndex = this._views.length;
    ListWrapper.insert(this._views, atIndex, view);

    this.parentView.changeDetector.addChild(view.changeDetector);
    this._linkElementInjectors(view);

    // insertion must come before hydration so that element injector trees are attached.
    if (!view.hydrated()) {
      view.hydrate(
        this.appInjector, this.hostElementInjector,
        this.parentView.context, this.parentView.locals
      );
    }
    return view;
  }

  insert(view, atIndex=-1): viewModule.View {
    this.renderer.insertView(this.render, view.render, atIndex);
    return this._insert(view, atIndex);
  }

  remove(atIndex=-1) {
    if (atIndex == -1) atIndex = this._views.length - 1;

    var view = this.detach(atIndex);
    this._viewFactory.returnView(view);
    // view is intentionally not returned to the client.
  }

  _detach(atIndex=-1, detachRender=true): viewModule.View {
    if (atIndex == -1) atIndex = this._views.length - 1;
    var detachedView = this.get(atIndex);
    ListWrapper.removeAt(this._views, atIndex);
    detachedView.changeDetector.remove();
    this._unlinkElementInjectors(detachedView);
    if (detachRender) {
      this.renderer.detachView(this.render, detachedView.render);
    }
    return detachedView;
  }

  /**
   * The method can be used together with insert to implement a view move, i.e.
   * moving the dom nodes while the directives in the view stay intact.
   */
  detach(atIndex=-1): viewModule.View {
    return this._detach(atIndex, true);
  }

  _linkElementInjectors(view) {
    for (var i = 0; i < view.rootElementInjectors.length; ++i) {
      view.rootElementInjectors[i].parent = this.elementInjector;
    }
  }

  _unlinkElementInjectors(view) {
    for (var i = 0; i < view.rootElementInjectors.length; ++i) {
      view.rootElementInjectors[i].parent = null;
    }
  }
}

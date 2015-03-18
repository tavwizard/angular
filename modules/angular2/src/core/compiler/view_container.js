import * as viewModule from './view';
import {ListWrapper, MapWrapper, List} from 'angular2/src/facade/collection';
import {BaseException} from 'angular2/src/facade/lang';
import {Injector} from 'angular2/di';
import * as eiModule from 'angular2/src/core/compiler/element_injector';
import {isPresent, isBlank} from 'angular2/src/facade/lang';
import {EventManager} from 'angular2/src/render/events/event_manager';
import {RenderViewContainer} from 'angular2/src/render/render_view_container';
import * as vfModule from './view_factory';

/**
 * @publicModule angular2/angular2
 */
export class ViewContainer {
  _viewFactory: vfModule.ViewFactory;
  parentView: viewModule.View;
  defaultProtoView: viewModule.ProtoView;
  _views: List<viewModule.View>;
  _eventManager: EventManager;
  elementInjector: eiModule.ElementInjector;
  appInjector: Injector;
  hostElementInjector: eiModule.ElementInjector;
  render: RenderViewContainer;

  constructor(viewFactory: vfModule.ViewFactory,
              renderViewContainer: RenderViewContainer,
              parentView: viewModule.View,
              defaultProtoView: viewModule.ProtoView,
              elementInjector: eiModule.ElementInjector,
              eventManager: EventManager) {
    this._viewFactory = viewFactory;
    this.render = renderViewContainer;
    this.parentView = parentView;
    this.defaultProtoView = defaultProtoView;
    this.elementInjector = elementInjector;

    // The order in this list matches the DOM order.
    this._views = [];
    this.appInjector = null;
    this.hostElementInjector = null;
    this._eventManager = eventManager;
  }

  hydrate(appInjector: Injector, hostElementInjector: eiModule.ElementInjector) {
    this.appInjector = appInjector;
    this.hostElementInjector = hostElementInjector;
  }

  dehydrate() {
    this.appInjector = null;
    this.hostElementInjector = null;
    this.clear();
  }

  clear() {
    this.render.clear();
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
    var renderView = this.render.create(atIndex);

    // TODO(rado): replace with viewFactory.
    var newView = this._viewFactory.getView(renderView, defaultProtoView,
      this.hostElementInjector, this._eventManager
    );
    // insertion must come before hydration so that element injector trees are attached.
    this._insert(newView, atIndex);

    newView.hydrate(
      this.appInjector, this.hostElementInjector,
      this.parentView.context, this.parentView.locals
    );
    return newView;
  }

  _insert(view, atIndex=1): viewModule.View {
    if (atIndex == -1) atIndex = this._views.length;
    ListWrapper.insert(this._views, atIndex, view);

    this.parentView.changeDetector.addChild(view.changeDetector);
    this._linkElementInjectors(view);

    return view;
  }

  insert(view, atIndex=-1): viewModule.View {
    this.render.insert(view.render, atIndex);
    return this._insert(view, atIndex);
  }

  remove(atIndex=-1) {
    if (atIndex == -1) atIndex = this._views.length - 1;
    this.render.remove(atIndex);

    var view = this._detach(atIndex);
    view.dehydrate();
    // TODO(rado): this needs to be delayed until after any pending animations.
    this._viewFactory.returnView(view);
    // view is intentionally not returned to the client.
  }

  _detach(atIndex=-1): viewModule.View {
    if (atIndex == -1) atIndex = this._views.length - 1;
    var detachedView = this.get(atIndex);
    ListWrapper.removeAt(this._views, atIndex);
    detachedView.changeDetector.remove();
    this._unlinkElementInjectors(detachedView);
    return detachedView;
  }

  /**
   * The method can be used together with insert to implement a view move, i.e.
   * moving the dom nodes while the directives in the view stay intact.
   */
  detach(atIndex=-1): viewModule.View {
    return this._detach(atIndex);
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

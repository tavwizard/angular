import {Directive} from 'angular2/src/core/annotations/annotations'
import {NgElement} from './ng_element';
import * as viewModule from './view';
import * as eiModule from './element_injector';
import {ShadowDomStrategy} from 'angular2/src/render/shadow_dom/shadow_dom_strategy';
import {EventManager} from 'angular2/src/render/events/event_manager';
import {ListWrapper} from 'angular2/src/facade/collection';
import {Type} from 'angular2/src/facade/lang';
import {ViewFactory} from './view_factory';

export class PrivateComponentLocation {
  _elementInjector:eiModule.ElementInjector;
  _elt:NgElement;
  _view:viewModule.View;
  _viewFactory:ViewFactory;
  _renderer:Renderer;

  constructor(renderer: Renderer, viewFactory:ViewFactory, elementInjector:eiModule.ElementInjector, elt:NgElement, view:viewModule.View){
    this._elementInjector = elementInjector;
    this._elt = elt;
    this._view = view;
    this._viewFactory = viewFactory;
    this._renderer = renderer;
  }

  createComponent(type:Type, annotation:Directive, componentProtoView:viewModule.ProtoView) {
    var context = this._elementInjector.createPrivateComponent(type, annotation);

    var view = this._viewFactory.getView(componentProtoView, this._elementInjector);

    this._renderer.setComponentView(
      this._view.render,
      this._elementInjector.getElementBinderIndex(),
      view.render
    );
    ListWrapper.push(this._view.componentChildViews, view);

    view.hydrate(this._elementInjector.getShadowDomAppInjector(), this._elementInjector, context, null);
    this._view.changeDetector.addChild(view.changeDetector);
  }
}

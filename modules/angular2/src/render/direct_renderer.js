import {
  Renderer, Template, ViewRef, ViewContainerRef, BoundElementRef, BoundTextRef, ProtoViewRef
} from './api';
import {View} from './view/view';
import {ViewContainer} from './view/view_container';
import {ProtoView} from './view/proto_view';
import {ViewFactory} from './view/view_factory';
import {Compiler} from './compiler/compiler';
import {ShadowDomStrategy} from './shadow_dom/shadow_dom_strategy';

export class DirectRenderer extends Renderer {
  _compiler: Compiler;
  _viewFactory: ViewFactory;

  constructor(
      compiler: Compiler, viewFactory: ViewFactory) {
    this._compiler = compiler;
    this._viewFactory = viewFactory;
  }

  _getViewContainer(vc:ViewContainerRef) {
    return vc.view.viewContainers[vc.viewContainerIndex];
  }

  // TODO(tbosch): union type return ProtoView or Promise<ProtoView>
  compile(template:Template) {
    return this._compiler.compile(template);
  }

  // this will always return data in sync
  createRootView(selectorOrElement):ViewRef {
    return this._viewFactory.getRootView(selectorOrElement);
  }

  createView(protoView:ProtoViewRef):ViewRef {
    return this._viewFactory.getView(protoView);
  }

  destroyView(view:ViewRef) {
    this._viewFactory.returnView(view);
  }

  insertViewIntoContainer(vc:ViewContainerRef, view:ViewRef, atIndex=-1):void {
    this._getViewContainer(vc).insert(view, atIndex);
  }

  detachViewFromContainer(vc:ViewContainerRef, view:ViewRef):void {
    this._getViewContainer(vc).detach(view);
  }

  setElementProperty(view:ViewRef, elementIndex:number, propertyName:string, propertyValue:any):void {
    view.setElementProperty(elementIndex, propertyName, propertyValue);
  }

  setComponentView(view:ViewRef, elementIndex:number, nestedView:ViewRef):void {
    view.setComponentView(elementIndex, nestedView);
  }

  setText(view:ViewRef, textNodeIndex:number, text:string):void {
    view.setText(textNodeIndex, text);
  }

  listen(view:ViewRef, elementIndex:number, eventName:string, callback:Function):void {
    view.listen(elementIndex, eventName, callback);
  }
}
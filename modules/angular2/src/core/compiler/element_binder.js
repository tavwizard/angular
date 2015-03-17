import {int, isBlank, BaseException} from 'angular2/src/facade/lang';
import * as eiModule from './element_injector';
import {DirectiveMetadata} from './directive_metadata';
import {List, StringMap} from 'angular2/src/facade/collection';
import {ProtoView} from './view';
import {RenderElementBinder} from 'angular2/src/render/render_element_binder';

export class ElementBinder {
  protoElementInjector:eiModule.ProtoElementInjector;
  componentDirective:DirectiveMetadata;
  viewportDirective:DirectiveMetadata;
  textNodeIndices:List<int>;
  nestedProtoView: ProtoView;
  events:StringMap;
  render:RenderElementBinder;
  constructor(
      renderElementBinder: RenderElementBinder,
      protoElementInjector: eiModule.ProtoElementInjector, componentDirective:DirectiveMetadata,
      viewportDirective:DirectiveMetadata) {
    this.render = renderElementBinder;
    this.protoElementInjector = protoElementInjector;
    this.componentDirective = componentDirective;
    this.viewportDirective = viewportDirective;
    // updated later when events are bound
    this.events = null;
    // updated later when text nodes are bound
    this.textNodeIndices = null;
    // updated later, so we are able to resolve cycles
    this.nestedProtoView = null;
  }
}

import {int, isBlank, BaseException} from 'angular2/src/facade/lang';
import * as eiModule from './element_injector';
import {DirectiveMetadata} from './directive_metadata';
import {List, StringMap} from 'angular2/src/facade/collection';
import {ProtoView} from './proto_view';

export class ElementBinder {
  protoElementInjector:eiModule.ProtoElementInjector;
  componentDirective:DirectiveMetadata;
  viewportDirective:DirectiveMetadata;
  nestedProtoView: ProtoView;
  events:StringMap;
  constructor(
      protoElementInjector: eiModule.ProtoElementInjector, componentDirective:DirectiveMetadata,
      viewportDirective:DirectiveMetadata,
      nestedProtoView: ProtoView,
      events: StringMap) {
    this.protoElementInjector = protoElementInjector;
    this.componentDirective = componentDirective;
    this.viewportDirective = viewportDirective;
    this.nestedProtoView = nestedProtoView;
    this.events = events;
  }
}

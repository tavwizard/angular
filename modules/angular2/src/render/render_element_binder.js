import {int, isBlank, BaseException} from 'angular2/src/facade/lang';
import {List, StringMap} from 'angular2/src/facade/collection';
import {ProtoRenderView} from './render_view';

export class RenderElementBinder {
  isViewContainer:boolean;
  nestedProtoView:ProtoRenderView;
  textNodeIndices:List<int>;
  contentTagSelector:string;
  parent:RenderElementBinder;
  index:int;
  distanceToParent:int;
  constructor(
      index:int, parent:RenderElementBinder, distanceToParent: int,
      isViewContainer:boolean, textNodeIndices:List<int>, contentTagSelector:string,
      nestedProtoView:ProtoRenderView) {
    if (isBlank(index)) {
      throw new BaseException('null index not allowed.');
    }

    this.parent = parent;
    this.index = index;
    this.distanceToParent = distanceToParent;
    this.isViewContainer = isViewContainer;
    this.nestedProtoView = nestedProtoView;
    this.textNodeIndices = textNodeIndices;
    this.contentTagSelector = contentTagSelector;
  }
}

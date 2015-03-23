import {List} from 'angular2/src/facade/collection';
import {ProtoView} from './proto_view';

export class ElementBinder {
  contentTagSelector: string;
  textNodeIndices: List<number>;
  nestedProtoView: ProtoView;
  constructor({
    textNodeIndices,
    contentTagSelector,
    nestedProtoView
  }) {
    this.textNodeIndices = textNodeIndices;
    this.contentTagSelector = contentTagSelector;
    this.nestedProtoView = nestedProtoView;
  }
}

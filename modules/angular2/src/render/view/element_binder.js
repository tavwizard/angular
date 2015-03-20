import * as api from '../api';

export class ElementBinder extends api.ElementBinder {
  contentTagSelector: string;
  constructor({
    index, parentIndex, distanceToParent, directives, nestedProtoView,
    elementDescription, initAttrs, propertyBindings, variableBindings,
    eventBindings, propertyInterpolations, textBindings,
    contentTagSelector
  }) {
    super({
      index: index, parentIndex: parentIndex, distanceToParent: distanceToParent, directives: directives,
      nestedProtoView: nestedProtoView,
      elementDescription: elementDescription, initAttrs: initAttrs, propertyBindings: propertyBindings,
      variableBindings: variableBindings,
      eventBindings: eventBindings, propertyInterpolations: propertyInterpolations,
      textBindings: textBindings
    });
    this.contentTagSelector = contentTagSelector;
  }
}

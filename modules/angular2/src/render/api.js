import {List, Map} from 'angular2/src/facade/collection';

export class ElementBinder {
  index:number;
  parentIndex:number;
  distanceToParent:number;
  parentWithDirectivesIndex:number;
  distanceToParentWithDirectives:number;
  directiveIndices:List<number>;
  nestedProtoView:ProtoView;
  elementDescription:string;
  // attributes of the element that are not part of bindings.
  // E.g. they are used to initialize directive properties
  initAttrs:Map<string, string>;
  propertyBindings: Map<string, string>;
  // Mapping from property name to interpolation expression
  propertyInterpolations: Map<string, string>;
  variableBindings: Map<string, string>;
  eventBindings: Map<string, string>;
  // List of text expression strings
  textBindings: List<string>;

  constructor({
    index, parentIndex, distanceToParent, parentWithDirectivesIndex,
    distanceToParentWithDirectives, directiveIndices, nestedProtoView,
    elementDescription, initAttrs, propertyBindings, variableBindings,
    eventBindings, propertyInterpolations, textBindings
  }) {
    this.index = index;
    this.parentIndex = parentIndex;
    this.distanceToParent = distanceToParent;
    this.parentWithDirectivesIndex = parentWithDirectivesIndex;
    this.distanceToParentWithDirectives = distanceToParentWithDirectives;
    this.directiveIndices = directiveIndices;
    this.nestedProtoView = nestedProtoView;
    this.elementDescription = elementDescription;
    this.initAttrs = initAttrs;
    this.propertyBindings = propertyBindings;
    this.variableBindings = variableBindings;
    this.eventBindings = eventBindings;
    this.propertyInterpolations = propertyInterpolations;
    this.textBindings = textBindings;
  }
}

export class ProtoView {
  render: ProtoViewRef;
  elementBinders:List<ElementBinder>;
  variableBindings: Map<string, string>;

  constructor({render, elementBinders, variableBindings}) {
    this.render = render;
    this.elementBinders = elementBinders;
    this.variableBindings = variableBindings;
  }
}

// An opaque reference to a ProtoView
export class ProtoViewRef {}

// An opaque reference to a View
export class ViewRef {}

export class ViewContainerRef {
  view:ViewRef;
  viewContainerIndex:number;
  constructor(view:ViewRef, viewContainerIndex: number) {
    this.view = view;
    this.viewContainerIndex = viewContainerIndex;
  }
}

export class Template {
  id: string;
  absUrl: string;
  inline: string;
  directiveSelectors: List<string>;
  constructor({id, absUrl, inline, directiveSelectors}) {
    this.id = id;
    this.absUrl = absUrl;
    this.inline = inline;
    this.directiveSelectors = directiveSelectors;
  }
}

export class Renderer {
  // TODO(tbosch): union type return ProtoView or Promise<ProtoView>
  compile(template:Template) {}

  createView(protoView:ProtoViewRef):ViewRef {}

  // Note: This does NOT remove the view from
  // a ViewContainer nor it's parent component!
  destroyView(view:ViewRef):void {}

  // this will always return data in sync
  createRootView(selectorOrElement):ViewRef {}

  insertViewIntoContainer(vc:ViewContainerRef, view:ViewRef, atIndex=-1):void {}

  // Note: We can't detach based on an index
  // as otherwise we would need to return the detached View in sync,
  // which is not possible over a remote protocol
  /**
   * The method can be used together with insert to implement a view move, i.e.
   * moving the dom nodes while the directives in the view stay intact.
   * Note: The detached view cannot be inserted into another ViewContainer!
   */
  detachViewFromContainer(vc:ViewContainerRef, view:ViewRef):void {}

  setElementProperty(view:ViewRef, elementIndex:number, propertyName:string, propertyValue:any):void {}

  setComponentView(view:ViewRef, elementIndex:number, nestedView:ViewRef):void {}

  setText(view:ViewRef, textNodeIndex:number, text:string):void {}

  // TODO(tbosch): think about how to serialize callbacks
  // - maybe keep a local WeakMap with ids?
  listen(view:ViewRef, elementIndex:number, eventName:string, callback:Function):void {}

  // To be called at end of VmTurn
  flush():void {}
}

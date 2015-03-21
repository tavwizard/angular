import {List, Map} from 'angular2/src/facade/collection';

export class ElementBinder {
  index:number;
  parentIndex:number;
  distanceToParent:number;
  directives:List<DirectiveMetadata>;
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
  // Mapping from text node index to and interpolation expression
  textBindings: Map<number, string>;

  constructor({
    index, parentIndex, distanceToParent, directives, nestedProtoView,
    elementDescription, initAttrs, propertyBindings, variableBindings,
    eventBindings, propertyInterpolations, textBindings
  }) {
    this.index = index;
    this.parentIndex = parentIndex;
    this.distanceToParent = distanceToParent;
    this.directives = directives;
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
  elementBinders:List<ElementBinder>;
  variableBindings: Map<string, string>;

  constructor({elementBinders, variableBindings}) {
    this.elementBinders = elementBinders;
    this.variableBindings = variableBindings;
  }
}

export class View {
  setElementProperty(boundElementIndex:number, propertyName:string, propertyValue:any):void {}

  setComponentView(boundElementIndex:number, view:View):void {}

  setText(boundTextIndex:number, text:string):void {}

  // TODO(tbosch): think about how to serialize callbacks
  // - maybe keep a local WeakMap with ids?
  listen(elementIndex:number, eventName:string, callback:Function):void {}

  getViewContainer(index:number):ViewContainer {}
}

// Note: This API is minimal.
// E.g. use methods on Renderer for creation/destruction of views
export class ViewContainer {
  insert(view:View, atIndex=-1):void {}

  // Note: We can't detach based on an index
  // as otherwise we would need to return the detached View in sync,
  // which is not possible over a remote protocol
  /**
   * The method can be used together with insert to implement a view move, i.e.
   * moving the dom nodes while the directives in the view stay intact.
   * Note: The detached view cannot be inserted into another ViewContainer!
   */
  detach(view:View):void {}
}

export class Template {
  id: string;
  absUrl: string;
  inline: string;
  directives: List<DirectiveMetadata>;
  constructor({id, absUrl, inline, directives}) {
    this.id = id;
    this.absUrl = absUrl;
    this.inline = inline;
    this.directives = directives;
  }
}

export class DirectiveMetadata {
  index:number;
  selector:string;
  isComponent:boolean;
  constructor(index, selector, isComponent) {
    this.index = index;
    this.selector = selector;
    this.isComponent = isComponent;
  }
}

export class Renderer {
  // TODO(tbosch): union type return ProtoView or Promise<ProtoView>
  compile(template:Template) {}

  // this will always return data in sync
  createRootView(selectorOrElement, protoView:ProtoView):View {}

  createView(protoView:ProtoView):View {}

  // Note: This does NOT remove the view from
  // a ViewContainer nor it's parent component!
  destroyView(view:View):void {}

  // To be called at end of VmTurn
  flush():void {}
}

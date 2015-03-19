import {isPresent} from 'angular2/src/facade/lang';
import {ListWrapper} from 'angular2/src/facade/collection';
import {ProtoRenderView} from './render_view';
import {RenderElementBinder} from './render_element_binder';
import {ShadowDomStrategy} from './shadow_dom/shadow_dom_strategy';

export class RenderProtoViewBuilder {
  rootElement;
  elements:List<RenderElementBinderBuilder>;
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.elements = [];
  }

  bindElement():RenderElementBinderBuilder {
    var builder = new RenderElementBinderBuilder(this.elements.length);
    ListWrapper.push(this.elements, builder);
    return builder;
  }

  build(shadowDomStrategy:ShadowDomStrategy):ProtoRenderView {
    var elementBinders = [];
    ListWrapper.forEach(this.elements, (ebb) => {
      var nestedView = isPresent(ebb.nestedProtoView) ? ebb.nestedProtoView.build(shadowDomStrategy) : null;
      var parent = isPresent(ebb.parent) ? elementBinders[ebb.parent.index] : null;
      var elBinder = new RenderElementBinder(ebb.index, parent, ebb.distanceToParent,
          ebb.hasViewContainerDirective, ebb.textIndicesInParent, ebb.contentTagSelector,
          nestedView);
      ListWrapper.push(elementBinders, elBinder);
    });
    var pv = new ProtoRenderView(this.rootElement, shadowDomStrategy, elementBinders);
    return pv;
  }
}

export class RenderElementBinderBuilder {
  index:number;
  parent: RenderElementBinderBuilder;
  distanceToParent: number;
  hasViewContainerDirective: boolean;
  nestedProtoView:RenderProtoViewBuilder;
  textIndicesInParent:List<number>;
  contentTagSelector:string;

  constructor(index) {
    this.index = index;
    this.parent = null;
    this.distanceToParent = 0;
    this.hasViewContainerDirective = false;
    this.nestedProtoView = null;
    this.textIndicesInParent = [];
    this.contentTagSelector = null;
  }

  setParent(parent:RenderElementBinderBuilder, distanceToParent):RenderElementBinderBuilder {
    this.parent = parent;
    this.distanceToParent = distanceToParent;
    this.hasViewContainerDirective = false;
    return this;
  }

  setHasViewContainerDirective(value: boolean):RenderElementBinderBuilder {
    this.hasViewContainerDirective = value;
    return this;
  }

  bindNestedProtoView():RenderProtoViewBuilder {
    if (isPresent(nestedProtoView)) {
      throw new BaseException('Only one nested view per element is allowed');
    }
    this.nestedProtoView = new RenderProtoViewBuilder();
    return this.nestedProtoView;
  }

  /**
   * Adds a text node binding
   */
  bindText(indexInParent:number) {
    ListWrapper.push(this.textIndicesInParent, indexInParent);
  }

  setContentTagSelector(value:string) {
    this.contentTagSelector = value;
  }
}

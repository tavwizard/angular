import {isPresent} from 'angular2/src/facade/lang';
import {List, ListWrapper, Map, MapWrapper} from 'angular2/src/facade/collection';
import {AST, ChangeDetection, BindingRecord} from 'angular2/change_detection';

import {ElementBinder} from './element_binder';
import {ProtoView} from './view';

import {RenderProtoViewBuilder, RenderElementBinderBuilder} from 'angular2/src/render/render_proto_view_builder';
import {ShadowDomStrategy} from 'angular2/src/render/shadow_dom/shadow_dom_strategy';

export class ProtoViewBuilder {
  render:RenderProtoViewBuilder;
  elements:List<ElementBinderBuilder>;
  variables:List<_Variable>;

  constructor(render: RenderProtoViewBuilder) {
    this.elements = [];
    this.variables = [];
    this.render = render;
  }

  bindElement():ElementBinderBuilder {
    var builder = new ElementBinderBuilder(this.elements.length, this.render.bindElement());
    ListWrapper.push(this.elements, builder);
    return builder;
  }

  bindVariable(contextName:string, templateName:string) {
    ListWrapper.push(this.variables, new _Variable(contextName, templateName));
  }

  build(changeDetection:ChangeDetection, shadowDomStrategy:ShadowDomStrategy):ProtoView {
    var protoRenderView = this.render.build(shadowDomStrategy);
    var elementBinders = [];
    var nestedProtoViews = [];
    var bindingRecords = [];
    var boundTextNodeCount = 0;
    ListWrapper.forEach(this.elements, (ebb) => {
      var nestedView = null;
      if (isPresent(ebb.nestedProtoView)) {
        nestedView = ebb.nestedProtoView.build(changeDetection, shadowDomStrategy);
        ListWrapper.push(nestedProtoView, nestedView);
      }

      // TODO fill bindingRecords
      ListWrapper.forEach(ebb.textExpressions, (expression) => {
        var memento = boundTextNodeCount++;
        ListWrapper.push(bindingRecords, new BindingRecord(expression, memento, null));
      });

      var events = null; // TODO
      // TODO When present the component directive must be first
      var protoElementInjector = null; // TODO
      var elBinder = new ElementBinder(
        protoElementInjector,
        isPresent(ebb.componentDirective) ? ebb.componentDirective.directive : null,
        isPresent(ebb.viewportDirective) ? ebb.viewportDirective.directive : null,
        nestedView,
        events
      );
      ListWrapper.push(elementBinders, elBinder);
    });
    var eventHandlers = []; // TODO
    var variableBindings = []; // TODO
    var protoLocals = MapWrapper.create(); // TODO

    var pv = new ProtoView(
      protoRenderView,
      changeDetection.createProtoChangeDetector('dummy'),
      elementBinders,
      eventHandlers,
      bindingRecords,
      variableBindings,
      protoLocals
    );
    ListWrapper.forEach(nestedProtoViews, (nestedView) => {
      nestedView.parent = pv;
    });
    return pv;
  }
}

export class ElementBinderBuilder {
  render: RenderElementBinderBuilder;
  index: number;
  parent: ElementBinderBuilder;
  distanceToParent: number;
  componentDirective:DirectiveBinderBuilder;
  viewportDirective:DirectiveBinderBuilder;
  otherDirectives:List<DirectiveBinderBuilder>;
  textExpressions:List<AST>;
  properties:List<_Property>;
  events:List<_Event>;
  nestedProtoView:ProtoViewBuilder;
  variables:List<_Variable>;

  constructor(index:number, render: RenderElementBinderBuilder) {
    this.index = index;
    this.render = render;
    this.parent = null;
    this.distanceToParent = -1;
    this.events = [];
    this.componentDirective = null;
    this.viewportDirective = null;
    this.otherDirectives = [];
    this.textExpressions = [];
    this.variables = [];
    this.nestedProtoView = null;
  }

  bindNestedProtoView():ProtoViewBuilder {
    if (isPresent(nestedProtoView)) {
      throw new BaseException('Only one nested view per element is allowed');
    }
    this.nestedProtoView = new ProtoViewBuilder(this.render.bindNestedProtoView());
    return this.nestedProtoView;
  }

  bindDirective(directive: DirectiveMetadata):DirectiveBinderBuilder {
    var builder = new DirectiveBinderBuilder(this.render, directive);
    ListWrapper.push(this.directives, builder);
    return builder;
  }

  setParent(parent:ElementBinderBuilder, distanceToParent) {
    this.render.setParent(parent.render, distanceToParent);
    this.parent = parent;
    this.distanceToParent = distanceToParent;
  }

  setContentTagSelector(contentTagSelector:string) {
    this.render.setContentTagSelector(contentTagSelector);
  }

  /**
   * Adds a text node binding
   */
  bindText(indexInParent:number, expression:AST) {
    this.render.bindText(indexInParent);
    ListWrapper.push(this.textExpressions, expression);
  }

  /**
   * Adds an element property binding
   */
  bindProperty(expression:AST, setterName:string, setter:SetterFn) {
    ListWrapper.push(this.properties, new _Property(expression, setterName, setter));
  }

  /**
   * Adds an event binding.
   *
   * The event is evaluated in the context of the view.
   *
   * @param {string} eventName
   * @param {AST} expression
   */
  bindEvent(eventName:string, expression:AST) {
    ListWrapper.push(this.events, new _Event(eventName, expression));
  }

  bindVariable(contextName:string, templateName:string) {
    ListWrapper.push(this.variables, new _Variable(contextName, templateName));
  }
}

export class DirectiveBinderBuilder {
  render:RenderElementBinderBuilder;
  directive: DirectiveMetadata;
  component: boolean;
  viewport: boolean;
  events:List<_Event>;
  properties:List<_Property>;

  constructor(render: RenderElementBinderBuild, directive: DirectiveMetadata) {
    this.render = render;
    this.directive = directive;
    this.events = [];
    this.properties = [];
    this.viewport = false;
    this.component = false;
  }

  setViewport(value:boolean):DirectiveBinderBuilder {
    this.viewport = value;
    this.render.setHasViewContainerDirective(true);
    return this;
  }

  setComponent(value:boolean):DirectiveBinderBuilder {
    this.component = value;
    return this;
  }

  /**
   * Adds an event binding for the directive.
   *
   * The event is evaluated in the context of
   * the current directive.
   *
   * @param {string} eventName
   * @param {AST} expression
   */
  bindEvent(eventName:string, expression:AST) {
    ListWrapper.push(this.events, new _Event(eventName, expression));
  }

  /**
   * Adds a directive property binding for the directive.
   */
  bindProperty(
    expression:AST,
    setterName:string,
    setter:SetterFn) {
    ListWrapper.push(this.properties, new _Property(expression, setterName, setter));
  }
}

class _Variable {
  contextName: string;
  templateName: string;

  constructor(contextName:string, templateName:string) {
    this.contextName = contextName;
    this.templateName = templateName;
  }
}

class _Property {
  expression:AST;
  setterName:string;
  setter:SetterFn;
  constructor(expression:AST, setterName:string, setter:SetterFn) {
    this.expression = expression;
    this.setterName = setterName;
    this.setter = setter;
  }
}

class _Event {
  eventName:string;
  expression:AST;
  constructor(eventName, expression) {
    this.eventName = eventName;
    this.expression = expression;
  }
}


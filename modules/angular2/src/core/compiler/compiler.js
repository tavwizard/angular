import {Type, isBlank, isPresent, BaseException, normalizeBlank, stringify} from 'angular2/src/facade/lang';
import {Promise, PromiseWrapper} from 'angular2/src/facade/async';
import {List, ListWrapper, Map, MapWrapper} from 'angular2/src/facade/collection';

import {DirectiveMetadataReader} from './directive_metadata_reader';
import {ProtoView} from './proto_view';
import {ElementBinder} from './element_binder';
import {TemplateResolver} from './template_resolver';
import {Component, DynamicComponent} from '../annotations/annotations';
import {Template} from '../annotations/template';
import {ComponentUrlMapper} from './component_url_mapper';
import {UrlResolver} from 'angular2/src/services/url_resolver';
import {ProtoViewBuilder} from './proto_view_builder';
import {ChangeDetection, Parser} from 'angular2/change_detection';

import * as renderApi from 'angular2/render_api';

/**
 * Cache that stores the ProtoView of the template of a component.
 * Used to prevent duplicate work and resolve cyclic dependencies.
 * @publicModule angular2/angular2
 */
export class CompilerCache {
  _cache:Map;
  constructor() {
    this._cache = MapWrapper.create();
  }

  set(component:Type, protoView:ProtoView) {
    MapWrapper.set(this._cache, component, protoView);
  }

  get(component:Type):ProtoView {
    var result = MapWrapper.get(this._cache, component);
    return normalizeBlank(result);
  }

  clear() {
    MapWrapper.clear(this._cache);
  }
}

/**
 * The compiler loads and translates the html templates of components into
 * nested ProtoViews. To decompose its functionality it uses
 * the CompilePipeline and the CompileSteps.
 * @publicModule angular2/angular2
 */
export class Compiler {
  _reader: DirectiveMetadataReader;
  _compilerCache:CompilerCache;
  _compiling:Map<Type, Promise>;
  _templateResolver: TemplateResolver;
  _componentUrlMapper: ComponentUrlMapper;
  _urlResolver: UrlResolver;
  _appUrl: string;
  _renderer: renderApi.Renderer;
  _changeDetection: ChangeDetection;
  _parser: Parser;

  constructor(reader: DirectiveMetadataReader,
              cache:CompilerCache,
              templateResolver: TemplateResolver,
              componentUrlMapper: ComponentUrlMapper,
              urlResolver: UrlResolver,
              renderer: renderApi.Renderer,
              parser: Parser,
              changeDetection: ChangeDetection) {
    this._reader = reader;
    this._compilerCache = cache;
    this._compiling = MapWrapper.create();
    this._templateResolver = templateResolver;
    this._componentUrlMapper = componentUrlMapper;
    this._urlResolver = urlResolver;
    this._appUrl = urlResolver.resolve(null, './');
    this._renderer = renderer;
    this._parser = parser;
    this._changeDetection = changeDetection;
  }

  compile(component: Type):Promise<ProtoView> {
    // TODOz uncomment try/catch again
    // try {
      var protoView = this._compile(component);
      return PromiseWrapper.isPromise(protoView) ? protoView : PromiseWrapper.resolve(protoView);
    // } catch (ex) {
    //   return PromiseWrapper.reject(ex);
    // }
  }

  // TODO(vicb): union type return ProtoView or Promise<ProtoView>
  _compile(component: Type) {
    var protoView = this._compilerCache.get(component);
    if (isPresent(protoView)) {
      // The component has already been compiled into a ProtoView,
      // returns a resolved Promise.
      return protoView;
    }

    var pvPromise = MapWrapper.get(this._compiling, component);
    if (isPresent(pvPromise)) {
      // The component is already being compiled, attach to the existing Promise
      // instead of re-compiling the component.
      // It happens when a template references a component multiple times.
      return pvPromise;
    }

    var template = this._templateResolver.resolve(component);

    protoView = this._compileTemplate(template, component);
    if (PromiseWrapper.isPromise(protoView)) {
      pvPromise = protoView.then( (pv) => {
        MapWrapper.delete(this._compiling, component, pvPromise);
        return pv;
      });
      MapWrapper.set(this._compiling, component, pvPromise);
      return pvPromise;
    } else {
      return protoView;
    }
  }

  _compileTemplate(template: Template, component: Type) {
    var componentUrl = this._componentUrlMapper.getUrl(component);
    var baseUrl = this._urlResolver.resolve(this._appUrl, componentUrl);
    var templateAbsUrl = null;
    if (isPresent(template.url)) {
      templateAbsUrl = this._urlResolver.resolve(baseUrl, template.url);
    }

    var directives = this._flattenDirectives(template);
    var renderDirectives = [];
    for (var i=0; i<directives.length; i++) {
      var directive = directives[i];
      ListWrapper.push(renderDirectives, new renderApi.DirectiveMetadata(
        i,
        directive.annotation.selector,
        (directive.annotation instanceof Component || directive.annotation instanceof DynamicComponent)
      ));
    }
    var renderTemplate = new renderApi.Template({
      id: stringify(component),
      absUrl: templateAbsUrl,
      inline: template.inline,
      directives: renderDirectives
    });

    var renderProtoView = this._renderer.compile(renderTemplate);
    if (PromiseWrapper.isPromise(renderProtoView)) {
      return renderProtoView.then( (rpv) => this._createProtoView(rpv, component, directives) );
    } else {
      return this._createProtoView(renderProtoView, component, directives);
    }
  }

  _createProtoView(renderProtoView: renderApi.ProtoView, component: Type, directives: List<DirectiveMetadata>) {
    var protoView = new ProtoViewBuilder(this._changeDetection, this._parser)
      .setComponentDirectives(directives)
      .setRenderProtoView(renderProtoView)
      .build();
    if (PromiseWrapper.isPromise(protoView)) {
      return protoView.then( (pv) => this._compileNestedProtoViews(pv) );
    } else {
      return this._compileNestedProtoViews(protoView);
    }
  }

  _compileNestedProtoViews(protoView:ProtoView) {
    // Compile all the components from the template
    var nestedPVPromises = [];
    for (var i = 0; i < protoView.elementBinders.length; i++) {
      var eb = protoView.elementBinders[i];
      if (isPresent(eb.componentDirective) && !(eb.componentDirective.annotation instanceof DynamicComponent)) {
        this._compileNestedProtoView(eb, nestedPVPromises);
      }
    }

    if (nestedPVPromises.length > 0) {
      // Returns ProtoView Promise when there are any asynchronous nested ProtoViews.
      // The promise will resolved after nested ProtoViews are compiled.
      return PromiseWrapper.all(nestedPVPromises);
    } else {
      return protoView;
    }
  }

  _compileNestedProtoView(elementBinder: ElementBinder, promises: List<Promise>) {
    var protoView = this._compile(elementBinder.componentDirective.type);

    if (PromiseWrapper.isPromise(protoView)) {
      ListWrapper.push(
        promises,
        protoView.then(function(pv) { elementBinder.nestedProtoView = pv;})
      );
    } else {
      elementBinder.nestedProtoView = protoView;
    }
  }

  _flattenDirectives(template: Template):List<Type> {
    if (isBlank(template.directives)) return [];

    var directives = [];
    this._flattenList(template.directives, directives);
    return ListWrapper.map(
      directives,
      (d) => this._reader.read(d)
    );
  }

  _flattenList(tree:List<any>, out:List<Type>) {
    for (var i = 0; i < tree.length; i++) {
      var item = tree[i];
      if (ListWrapper.isList(item)) {
        this._flattenList(item, out);
      } else {
        ListWrapper.push(out, item);
      }
    }
  }

}



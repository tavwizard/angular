import {PromiseWrapper} from 'angular2/src/facade/async';
import {List, ListWrapper} from 'angular2/src/facade/collection';

import {Template} from '../api';
import {CompilePipeline} from './compile_pipeline';
import {TemplateLoader} from './template_loader';
import {Parser} from 'angular2/change_detection';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';
import {CssProcessor} from '../shadow_dom/css_processor';

import {PropertyBindingParser} from './property_binding_parser';
import {TextInterpolationParser} from './text_interpolation_parser';
import {DirectiveParser} from './directive_parser';
import {ViewSplitter} from './view_splitter';
import {ElementBinderInheriter} from './element_binder_inheriter';

export class Compiler {
  _templateLoader: TemplateLoader;
  _parser: Parser;
  _shadowDomStrategy: ShadowDomStrategy;
  _cssProcessor: CssProcessor;

  constructor(templateLoader: TemplateLoader, parser: Parser, shadowDomStrategy: ShadowDomStrategy, cssProcessor: CssProcessor) {
    this._templateLoader = templateLoader;
    this._parser = parser;
    this._shadowDomStrategy = shadowDomStrategy;
    this._cssProcessor = cssProcessor;
  }

  createSteps(template: Template, stylePromises: List<Promise>) {
    return [
      new ViewSplitter(),
      this._cssProcessor.getCompileStep(template, this._shadowDomStrategy, stylePromises),
      this._shadowDomStrategy.getTemplateCompileStep(template),
      new PropertyBindingParser(this._parser),
      new DirectiveParser(template.directives),
      new TextInterpolationParser(),
      new ElementBinderInheriter()
    ];
  }

  compile(template: Template) {
    var tplElement = this._templateLoader.load(template);

    if (PromiseWrapper.isPromise(tplElement)) {
      pvPromise = PromiseWrapper.then(tplElement,
        (el) => this._compileTemplate(template, el),
        (_) => { throw new BaseException(`Failed to load the template ${template.id}`); }
      );
      return pvPromise;
    }
    return this._compileTemplate(template, tplElement);

  }

  // TODO(tbosch): union type return ProtoView or Promise<ProtoView>
  _compileTemplate(template: Template, tplElement) {
    var stylePromises = [];
    var pipeline = new CompilePipeline(this.createSteps(template, stylePromises));
    var compileElements;

    // TODOz uncomment try/catch again
    // try {
      compileElements = pipeline.process(tplElement, template.id);
    // } catch(ex) {
    //   return PromiseWrapper.reject(ex);
    // }

    var protoView = compileElements[0].inheritedProtoView.build();

    if (stylePromises.length > 0) {
      // The protoView is ready after all asynchronous styles are ready
      var syncProtoView = protoView;
      protoView = PromiseWrapper.all(stylePromises).then((_) => syncProtoView);
    }

    return protoView;
  }
}
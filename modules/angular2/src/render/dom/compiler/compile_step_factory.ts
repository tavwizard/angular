/// <reference path="../../../../typings/es6-promise/es6-promise.d.ts" />

import {List} from 'angular2/src/facade/collection';

import {Parser} from 'angular2/change_detection';
import {Template} from '../../api';
import {CompileStep} from './compile_step';
import {PropertyBindingParser} from './property_binding_parser';
import {TextInterpolationParser} from './text_interpolation_parser';
import {DirectiveParser} from './directive_parser';
import {ViewSplitter} from './view_splitter';
import {ShadowDomCompileStep} from '../shadow_dom/shadow_dom_compile_step';
import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';

export class CompileStepFactory {
  createSteps(template: Template, subTaskPromises: List<Promise<any>>):List<CompileStep> {
    return null;
  }
}

export class DefaultStepFactory extends CompileStepFactory {
  _parser: Parser;
  _shadowDomStrategy: ShadowDomStrategy;

  constructor(parser: Parser, shadowDomStrategy) {
    super();
    this._parser = parser;
    this._shadowDomStrategy = shadowDomStrategy;
  }

  createSteps(template: Template, subTaskPromises: List<Promise<any>>):List<CompileStep> {
    return [
      new ViewSplitter(this._parser),
      new PropertyBindingParser(this._parser),
      new DirectiveParser(this._parser, template.directives),
      new TextInterpolationParser(this._parser),
      new ShadowDomCompileStep(this._shadowDomStrategy, template, subTaskPromises)
    ];
  }
}

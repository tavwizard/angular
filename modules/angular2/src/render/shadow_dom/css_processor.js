import {DOM} from 'angular2/src/dom/dom_adapter';

import {isPresent} from 'angular2/src/facade/lang';
import {List} from 'angular2/src/facade/collection';

import {CompileStep} from '../compiler/compile_step';
import {CompileElement} from '../compiler/compile_element';
import {CompileControl} from '../compiler/compile_control';

import {ShadowDomStrategy} from './shadow_dom_strategy';

import {Template} from '../api';

/**
 * Processes the <style> tags during the compilation:
 * - Apply any given transformers,
 * - Apply the shadow DOM strategy style step.
 */
export class CssProcessor {
  _transformers: List<CssTransformer>;

  constructor(transformers: List<CssTransformer>) {
    this._transformers = transformers;
  }

  /**
   * Returns a compile step to be added to the compiler pipeline.
   *
   * @param {Template} template
   * @param {ShadowDomStrategy} shadowDomStrategy
   * @param {List} stylePromises List of style promises to wait for
   */
  getCompileStep(template: Template, shadowDomStrategy: ShadowDomStrategy,
    stylePromises: List<Promise>) {
    var strategyStep = shadowDomStrategy.getStyleCompileStep(template, stylePromises);
    return new _CssProcessorStep(strategyStep, this._transformers);
  }
}

export class CssTransformer {
  transform(styleElement) {};
}

class _CssProcessorStep extends CompileStep {
  _strategyStep: CompileStep;
  _transformers: List<CssTransformer>;

  constructor(strategyStep: CompileStep, transformers: List<CssTransformer>) {
    super();
    this._strategyStep = strategyStep;
    this._transformers = transformers;
  }

  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    if (DOM.tagName(current.element) == 'STYLE') {
      current.ignoreBindings = true;

      if (isPresent(this._transformers)) {
        var styleEl = current.element;
        for (var i = 0; i < this._transformers.length; i++) {
          this._transformers[i].transform(styleEl);
        }
      }

      if (isPresent(this._strategyStep)) {
        this._strategyStep.process(parent, current, control);
      }
    }
  }
}

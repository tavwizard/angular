import {isPresent} from 'angular2/src/facade/lang';
import {DOM} from 'angular2/src/dom/dom_adapter';

import * as api from '../api';
import {NG_BINDING_CLASS} from './util';

export class ProtoView extends api.ProtoView {
  element;
  isTemplateElement:boolean;
  instantiateInPlace:boolean;
  rootBindingOffset:int;

  constructor({
    elementBinders, variableBindings,
    element, instantiateInPlace
  }) {
    super({elementBinders: elementBinders, variableBindings: variableBindings});
    this.element = element;
    this.isTemplateElement = DOM.isTemplateElement(this.element);
    this.instantiateInPlace = instantiateInPlace;
    this.rootBindingOffset = (isPresent(this.element) && DOM.hasClass(this.element, NG_BINDING_CLASS)) ? 1 : 0;
  }
}
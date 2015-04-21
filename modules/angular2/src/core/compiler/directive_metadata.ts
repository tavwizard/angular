import {Type} from 'angular2/src/facade/lang';
import {List} from 'angular2/src/facade/collection';
import {DirectiveAnnotation} from 'angular2/src/core/annotations/annotations'
import {ResolvedBinding} from 'angular2/di';

/**
 * Combination of a type with the Directive annotation
 */
export class DirectiveMetadata {
  type:Type;
  annotation:DirectiveAnnotation;
  resolvedInjectables:List<ResolvedBinding>;

  constructor(type:Type, annotation:DirectiveAnnotation, resolvedInjectables:List<ResolvedBinding>) {
    this.annotation = annotation;
    this.type = type;
    this.resolvedInjectables = resolvedInjectables;
  }
}
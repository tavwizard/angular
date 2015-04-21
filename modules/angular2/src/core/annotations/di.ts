import {CONST, addAnnotation} from 'angular2/src/facade/lang';
import {DependencyAnnotationClass} from 'angular2/di';

/**
 * Specifies that a function for setting host properties should be injected.
 *
 * NOTE: This is changing pre 1.0.
 *
 * The directive can inject a property setter that would allow setting this property on the host element.
 *
 * @exportedAs angular2/annotations
 */
export class PropertySetterAnnotation extends DependencyAnnotationClass {
  propName: string;
  //@CONST()
  constructor(propName) {
    super();
    this.propName = propName;
  }

  get token() {
    return Function;
  }
}

export function PropertySetter(propName:string) {
  return (c) => { addAnnotation(c, new PropertySetterAnnotation(propName)); }
}

/**
 * Specifies that a constant attribute value should be injected.
 *
 * The directive can inject constant string literals of host element attributes.
 *
 * ## Example
 *
 * Suppose we have an `<input>` element and want to know its `type`.
 *
 * ```html
 * <input type="text">
 * ```
 *
 * A decorator can inject string literal `text` like so:
 *
 * ```javascript
 * @Decorator({
 *   selector: `input'
 * })
 * class InputDecorator {
 *   constructor(@Attribute('type') type) {
 *     // type would be `text` in this example
 *   }
 * }
 * ```
 *
 * @exportedAs angular2/annotations
 */
export class AttributeAnnotation extends DependencyAnnotationClass {
  attributeName: string;
  //@CONST()
  constructor(attributeName) {
    super();
    this.attributeName = attributeName;
  }

  get token() {
    //Normally one would default a token to a type of an injected value but here
    //the type of a variable is "string" and we can't use primitive type as a return value
    //so we use instance of Attribute instead. This doesn't matter much in practice as arguments
    //with @Attribute annotation are injected by ElementInjector that doesn't take tokens into account.
    return this;
  }
}

export function Attribute(attributeName:string) {
  return (c) => { addAnnotation(c, new AttributeAnnotation(attributeName)); }
}
	  
/**
 * Specifies that a [QueryList] should be injected.
 *
 * See: [QueryList] for usage and example.
 *
 * @exportedAs angular2/annotations
 */
export class QueryAnnotation extends DependencyAnnotationClass {
  directive;
  //@CONST()
  constructor(directive) {
    super();
    this.directive = directive;
  }
}

export function Query(directive) {
  return (c) => { addAnnotation(c, new QueryAnnotation(directive)); }
}
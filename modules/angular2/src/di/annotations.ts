import {CONST, addAnnotation} from "angular2/src/facade/lang";

/**
 * A parameter annotation that creates a synchronous eager dependency.
 *
 * ```
 * class AComponent {
 *   constructor(@Inject(MyService) aService:MyService) {}
 * }
 * ```
 *
 * @exportedAs angular2/di_annotations
 */
export class InjectAnnotation {
  token;
  //@CONST()
  constructor(token) {
    this.token = token;
  }
}

export function Inject(token) {
  return (c) => { addAnnotation(c, new InjectAnnotation(token)); }
}

/**
 * A parameter annotation that creates an asynchronous eager dependency.
 *
 * ```
 * class AComponent {
 *   constructor(@InjectPromise(MyService) aServicePromise:Promise<MyService>) {
 *     aServicePromise.then(aService:MyService => ...);
 *   }
 * }
 * ```
 *
 * @exportedAs angular2/di_annotations
 */
export class InjectPromiseAnnotation {
  token;
  //@CONST()
  constructor(token) {
    this.token = token;
  }
}

export function InjectPromise(token) {
  return (c) => { addAnnotation(c, new InjectPromiseAnnotation(token)); }
}

/**
 * A parameter annotation that creates a synchronous lazy dependency.
 *
 * ```
 * class AComponent {
 *   constructor(@InjectLazy(MyService) aServiceFn:Function) {
 *     var aService:MyService = aServiceFn();
 *   }
 * }
 * ```
 *
 * @exportedAs angular2/di_annotations
 */
export class InjectLazyAnnotation {
  token;
  //@CONST()
  constructor(token) {
    this.token = token;
  }
}

export function InjectLazy(token) {
  return (c) => { addAnnotation(c, new InjectLazyAnnotation(token)); }
}

/**
 * A parameter annotation that marks a dependency as optional. (Injects `null` if not found.)
 * ```
 * class AComponent {
 *   constructor(@Optional() aService:MyService) {
 *     this.aService = aService;
 *   }
 * }
 * ```
 *
 * @exportedAs angular2/di_annotations
 */
export class OptionalAnnotation {
  //@CONST()
  constructor() {
  }
}

export function Optional() {
  return (c) => { addAnnotation(c, new OptionalAnnotation()); }
}

/**
 * `DependencyAnnotation` is used by the framework to extend DI.
 *
 * Only annotations implementing `DependencyAnnotation` will be added
 * to the list of dependency properties.
 *
 * For example:
 *
 * ```
 * class Parent extends DependencyAnnotation {}
 * class NotDependencyProperty {}
 *
 * class AComponent {
 *   constructor(@Parent @NotDependencyProperty aService:AService) {}
 * }
 * ```
 *
 * will create the following dependency:
 *
 * ```
 * new Dependency(Key.get(AService), [new Parent()])
 * ```
 *
 * The framework can use `new Parent()` to handle the `aService` dependency
 * in a specific way.
 *
 * @exportedAs angular2/di_annotations
 */
export class DependencyAnnotationClass {
  //@CONST()
  constructor() {
  }

  get token() {
    return null;
  }
}

export function DependencyAnnotation() {
  return (c) => { addAnnotation(c, new DependencyAnnotationClass()); }
}

/**
 * A marker annotation that marks a class as available to `Injector`s for creation. Used by tooling for generating 
 * constructor stubs. 
 *
 * ```
 * class NeedsService {
 *   constructor(svc:UsefulService) {}
 * }
 *
 * @Injectable
 * class UsefulService {}
 * ```
 * @exportedAs angular2/di_annotations
 */
export class InjectableAnnotation {
  //@CONST()
  constructor() {
  }
}

export function Injectable() {
  return (c) => { addAnnotation(c, new InjectableAnnotation()); }
}

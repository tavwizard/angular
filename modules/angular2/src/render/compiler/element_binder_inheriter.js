import {int, isPresent, isBlank} from 'angular2/src/facade/lang';
import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';

/**
 * Copies CompileElement.inheritedElementBinder
 * from parent so that the next run can still access it.
 */
export class ElementBinderInheriter extends CompileStep {
  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    if (isBlank(current.inheritedElementBinder) && isPresent(parent)) {
      current.inheritedElementBinder = parent.inheritedElementBinder;
      current.distanceToParentBinder = parent.distanceToParentBinder + 1;
    } else if (isPresent(parent)) {
      current.inheritedElementBinder.setParent(parent.inheritedElementBinder, current.distanceToParentBinder);
      current.distanceToParentBinder = 0;
    }
  }
}

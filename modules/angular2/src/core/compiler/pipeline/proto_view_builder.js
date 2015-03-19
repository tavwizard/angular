import {isPresent, BaseException} from 'angular2/src/facade/lang';
import {ListWrapper, MapWrapper} from 'angular2/src/facade/collection';

import {ProtoViewBuilder} from '../proto_view_builder';
import {ProtoView} from '../view';
import {ChangeDetection} from 'angular2/change_detection';

import {CompileStep} from './compile_step';
import {CompileElement} from './compile_element';
import {CompileControl} from './compile_control';
import {ShadowDomStrategy} from 'angular2/src/render/shadow_dom/shadow_dom_strategy';
import {ProtoViewBuilder} from '../proto_view_builder';
import {RenderProtoViewBuilder} from 'angular2/src/render/render_proto_view_builder';

/**
 * Creates ProtoViews and forwards variable bindings from parent to children.
 *
 * Fills:
 * - CompileElement#inheritedProtoView
 *
 * Reads:
 * - (in parent): CompileElement#inheritedProtoView
 * - (in parent): CompileElement#variableBindings
 * - CompileElement#isViewRoot
 */
export class ProtoViewBuilderCS extends CompileStep {
  process(parent:CompileElement, current:CompileElement, control:CompileControl) {
    var inheritedProtoView = null;
    if (current.isViewRoot) {
      if (isPresent(parent)) {
        inheritedProtoView = parent.inheritedElementBinder.bindNestedProtoView(current.element);
      } else {
        inheritedProtoView = new ProtoViewBuilder(new RenderProtoViewBuilder(current.element));
      }

      if (isPresent(parent)) {
        // When current is a view root, the variable bindings are set to the *nested* proto view.
        // The root view conceptually signifies a new "block scope" (the nested view), to which
        // the variables are bound.
        if (isPresent(parent.variableBindings)) {
          MapWrapper.forEach(parent.variableBindings, (mappedName, varName) => {
            inheritedProtoView.bindVariable(varName, mappedName);
          });
        }
      }
    } else if (isPresent(parent)) {
      inheritedProtoView = parent.inheritedProtoView;
    }

    current.inheritedProtoView = inheritedProtoView;
  }
}

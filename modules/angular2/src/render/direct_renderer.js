import {Renderer, Template} from './api';
import {View} from './view/view';
import {ViewContainer} from './view/view_container';
import {ProtoView} from './view/proto_view';
import {ViewFactory} from './view/view_factory';
import {Compiler} from './compiler/compiler';
import {ShadowDomStrategy} from './shadow_dom/shadow_dom_strategy';

export class DirectRenderer extends Renderer {
  _compiler: Compiler;
  _viewFactory: ViewFactory;

  constructor(
      compiler: Compiler, viewFactory: ViewFactory) {
    this._compiler = compiler;
    this._viewFactory = viewFactory;
  }

  // TODO(tbosch): union type return ProtoView or Promise<ProtoView>
  compile(template:Template) {
    return this._compiler.compile(template);
  }

  // this will always return data in sync
  createRootView(selectorOrElement):View {
    return this._viewFactory.getRootView(selectorOrElement);
  }

  createView(protoView:ProtoView):View {
    return this._viewFactory.getView(protoView);
  }

  destroyView(view:View) {
    this._viewFactory.returnView(view);
  }
}
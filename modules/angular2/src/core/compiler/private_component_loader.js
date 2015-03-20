import {Compiler} from './compiler';
import {ShadowDomStrategy} from 'angular2/src/render/shadow_dom/shadow_dom_strategy';
import {EventManager} from 'angular2/src/render/events/event_manager';
import {DirectiveMetadataReader} from 'angular2/src/core/compiler/directive_metadata_reader';
import {PrivateComponentLocation} from './private_component_location';
import {Type} from 'angular2/src/facade/lang';


export class PrivateComponentLoader {
  compiler:Compiler;
  directiveMetadataReader:DirectiveMetadataReader;

  constructor(compiler:Compiler, directiveMetadataReader:DirectiveMetadataReader) {
    this.compiler = compiler;
    this.directiveMetadataReader = directiveMetadataReader;
  }

  load(type:Type, location:PrivateComponentLocation) {
    var annotation = this.directiveMetadataReader.read(type).annotation;
    return this.compiler.compile(type).then((componentProtoView) => {
      location.createComponent(
        type, annotation,
        componentProtoView);
    });
  }
}

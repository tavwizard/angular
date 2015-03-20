import {ShadowDomStrategy} from '../shadow_dom/shadow_dom_strategy';
import {EventManager} from '../events/event_manager';
import {ElementPropertyAccessor} from './element_property_accessor';

export class ViewServices {
  eventManager: EventManager;
  shadowDomStrategy:ShadowDomStrategy;
  propertyAccessor:ElementPropertyAccessor;

  constructor(
      eventManager:EventManager,
      shadowDomStrategy:ShadowDomStrategy,
      propertyAccessor:ElementPropertyAccessor
    ) {
    this.eventManager = eventManager;
    this.shadowDomStrategy = shadowDomStrategy;
    this.propertyAccessor = propertyAccessor;
  }
}

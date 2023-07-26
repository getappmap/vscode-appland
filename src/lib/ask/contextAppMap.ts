import { AppMap, Event, EventNavigator, buildAppMap } from '@appland/models';

export default function contextAppMap(appmap: AppMap, scopeEvents: Event[]): AppMap {
  const { events } = appmap;

  const roots: Event[] = [];
  const filterEvents: Event[] = [...scopeEvents];
  for (const event of scopeEvents) {
    for (const ancestor of new EventNavigator(event).ancestors()) {
      filterEvents.push(ancestor.event);
      if (ancestor.event.httpServerRequest) {
        roots.push(ancestor.event);
        break;
      }
      if (!ancestor.event.parent) roots.push(ancestor.event);
    }
    for (const child of event.children) {
      filterEvents.push(child);
      for (const child2 of child.children) {
        filterEvents.push(child2);
        for (const child3 of child2.children) {
          filterEvents.push(child3);
          for (const child4 of child3.children) filterEvents.push(child4);
        }
      }
    }
  }
  for (const root of roots) {
    for (const child of root.children) {
      filterEvents.push(child);
      for (const child2 of child.children) {
        filterEvents.push(child2);
        for (const child3 of child2.children) {
          filterEvents.push(child3);
          for (const child4 of child3.children) filterEvents.push(child4);
        }
      }
    }
  }

  const eventIds = new Set(filterEvents.map((e) => e.id));
  return buildAppMap({
    events: events.filter((e) => eventIds.has(e.callEvent.id)),
    classMap: appmap.classMap.roots.map((c) => ({ ...c.data })),
    metadata: appmap.metadata,
  }).build();
}

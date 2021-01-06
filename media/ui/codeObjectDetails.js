import Models from '@appland/models';

export default class CodeObjectDetails extends Models.EventSource {
  /**
   * @param {any} container 
   * @param {Object<ClassMap,events>} appmap 
   */
  constructor(container, appmap) {
    super();

    this.container = container;
    this.appmap = appmap;
    this.openSourceLocation = (/** @type {string} */ path) => { console.log(path); }
  }

  get classMap() {
    return this.appmap.classMap;
  }

  get rootNode() {
    return this.appmap.events.dataStore.rootEvent;
  }

  render() {
    this.container.innerHTML = '';
  }

  renderLocations(codeObject, content) {
    if (codeObject.locations.length > 0) {
      let label = 'Source location';
      if ( codeObject.locations.length > 1 ) {
        label += 's';
      }

      content
        .append('h5')
        .classed('source-locations', true)
        .text(label);
      content
        .append('ul')
        .classed('source-locations detail-list', true)
        .call((ul) => {
          ul
            .selectAll('.source-location')
            .data(codeObject.locations)
            .enter()
            .append('li')
            .append('a')
            .classed('source-location', true)
            .attr('href', 'javascript: void(0)')
            .on('click', (path) => {
              this.emit('openSourceLocation', path)
            })
            .text((d) => d)
            ;
        });
    }
  }

  codeObjectForEvent(event) {
    const location = [event.path, event.lineno].filter(n => n).join(':');
    const types = /** @type {Array<CodeObject>} */ this.classMap.codeObjectsAtLocation(location);
    if (types.length === 0) {
      return;
    }
    return types[0];
  }
}
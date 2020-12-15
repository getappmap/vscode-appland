export default class CodeObjectDetails extends Models.EventSource {
  /**
   * @param {any} container 
   * @param {Object<classMap,events>} appmap 
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
    return this.appmap.events.rootNode;
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
}
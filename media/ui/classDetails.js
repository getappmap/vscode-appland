import CodeObjectDetails from "./codeObjectDetails.js";

export default class ClassDetails extends CodeObjectDetails {
  render(cls) {
    super.render();

    const functions = /** @type {Set<CallNode>} */ new Set();
    const httpServerRequests = /** @type {Set<CallNode>} */ new Set();
    const invocationEvents = /** @type {Array<CallNode>} */ new Array();
    const sqlQueries = /** @type {Array<CallNode>} */[];
    this.rootNode.forEach((/** @type {CallNode} */ node, /** @type {Array<CallNode>} */ stack) => {
      const location = [node.input.path, node.input.lineno].filter(n => n).join(':');
      const types = /** @type {Array<CodeObject>} */ this.classMap.codeObjectsAtLocation(location);
      if (types.length === 0) {
        return;
      }
      const type = types[0];
      if (type.classOf === cls.classOf) {
        invocationEvents.push(node);
        stack.filter((node) => node.input.http_server_request).forEach(httpServerRequests.add.bind(httpServerRequests))
        if (type.type === 'function') {
          functions.add(type);
        }
      }
    });
    invocationEvents.forEach((/** @type {CallNode} */ node) => {
      node.forEach((/** @type {CallNode} */ child) => {
        if (child.input.sql_query) {
          sqlQueries.push(child);
        }
      });
    });

    d3.select(this.container)
      .append('h4')
      .text(cls.name);
    const content = d3.select(this.container)
      .append('div')
      .classed('content', true)

    if (functions.size > 0) {
      content
        .append('h5')
        .text('Functions');
      content
        .append('ul')
        .classed('functions detail-list', true)
        .call((ul) => {
          ul
            .selectAll('.function')
            .data(Array.from(functions), (d) => d.id)
            .enter()
            .append('li')
            .append('a')
            .classed('function', true)
            .attr('href', 'javascript: void(0)')
            .on('click', (fn) => {
              this.emit('selectFunction', fn)
            })
            .text((d) => d.name)
            ;
        });
    }

    this.renderLocations(cls, content);

    if (httpServerRequests.size > 0) {
      content
        .append('h5')
        .text('HTTP server requests');
      content
        .append('ul')
        .classed('http-server-requests detail-list', true)
        .call((ul) => {
          ul
            .selectAll('.http-server-request')
            .data(Array.from(httpServerRequests).map((e) => e.input), (d) => d.id)
            .enter()
            .append('li')
            .append('a')
            .attr('href', 'javascript: void(0)')
            .on('click', (event) => {
              this.emit('selectHTTPServerRequest', event)
            })
            .text((d) => `${d.http_server_request.request_method} ${d.http_server_request.path_info}`)
            ;
        });
    }

    if (sqlQueries.length > 0) {
      content
        .append('h5')
        .text('SQL queries');

      content
        .append('ul')
        .classed('sql-queries detail-list', true)
        .call((ul) => {
          ul
            .selectAll('.sql-query')
            .data(sqlQueries.map((e) => e.input), (d) => d.id)
            .enter()
            .append('li')
            .append('a')
            .attr('href', 'javascript: void(0)')
            .on('click', (event) => {
              this.emit('selectSQLQuery', event)
            })
            .text((_, i) => `Query ${i}`) // d.sql_query.sql
            ;
        });
    }
  }
}
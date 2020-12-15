import CodeObjectDetails from "./codeObjectDetails.js";

export default class FunctionDetails extends CodeObjectDetails {
  render(fn) {
    super.render();

    const callEvents = /** @type {Array<CallNode>} */ new Array();
    this.rootNode.forEach((/** @type {CallNode} */ node, /** @type {Array<CallNode>} */ stack) => {
      if ( stack.length <= 1 ) {
        return;
      }
      const callerType = this.codeObjectForEvent(stack[stack.length - 2].input);
      if ( !callerType ) {
        return;
      }
      const calleeType = this.codeObjectForEvent(stack[stack.length - 1].input);
      if ( !calleeType ) {
        return;
      }

      if ( callerType == fn || calleeType == fn ) {
        callEvents.push({ caller: stack[stack.length - 2], callee: stack[stack.length - 1] });
      }
    });

    d3.select(this.container)
      .append('h5')
      .append('a')
      .attr('href', 'javascript: void(0)')
      .on('click', (_) => {
        this.emit('selectClass', fn.parent)
      })
      .html(`&laquo; ${escape(fn.parent.name)}`);

    d3.select(this.container)
      .append('h4')
      .text(`Function ${[ fn.static ? '.' : '#', fn.name ].join('')}`);
    const content = d3.select(this.container)
      .append('div')
      .classed('content', true)

    this.renderLocations(fn, content);

    if (callEvents.length > 0) {
      content
        .append('h5')
        .text('Events');
      content
        .append('ul')
        .classed('call-events detail-list', true)
        .call((ul) => {
          ul
            .selectAll('.call-event')
            .data(Array.from(callEvents), (d) => [ d.caller.input.id, d.callee.input.id ].join(':'))
            .enter()
            .append('li')
            .append('a')
            .attr('href', 'javascript: void(0)')
            .on('click', (d) => {
              this.emit('selectCallNode', d.caller)
            })
            .text((d) => {
              const caller = this.codeObjectForEvent(d.caller.input);
              const callee = this.codeObjectForEvent(d.callee.input);
              return `${caller.name} -> ${callee.name} [${d.caller.input.id}]`;
            });
        });
    }
  }
}

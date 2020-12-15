import CodeObjectDetails from "./codeObjectDetails.js";

export default class FunctionDetails extends CodeObjectDetails {
  render(fn) {
    super.render();

    d3.select(this.container)
      .append('h4')
      .text(fn.name);
    const content = d3.select(this.container)
      .append('div')
      .classed('content', true)

    this.renderLocations(fn, content);
  }
}

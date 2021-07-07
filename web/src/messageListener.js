export default class MessageListener {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options || {};
  }
}

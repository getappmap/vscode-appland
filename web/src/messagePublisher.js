import MessageListener from './messageListener';

function addListener(messagePublisher, event, callback, options) {
  let eventListeners = messagePublisher.eventListeners[event];
  if (!eventListeners) {
    eventListeners = [];
    messagePublisher.eventListeners[event] = eventListeners;
  }

  eventListeners.push(new MessageListener(callback, options));
}
export default class MessagePublisher {
  constructor(vscode) {
    this.vscode = vscode;
    this.eventListeners = {};
    window.addEventListener('message', (event) => {
      const message = event.data;
      let eventListeners = this.eventListeners[message.type];
      if (!eventListeners) {
        // The undefined key matches events which have no listeners.
        eventListeners = this.eventListeners[undefined] || [];
      }

      eventListeners.forEach((listener) => {
        listener.callback(message);
      });

      // Drop event listeners if they are set to only fire once
      this.eventListeners[message.type] = eventListeners.filter(
        (listener) => !listener.options.once
      );
    });
  }

  on(event, callback) {
    addListener(this, event, callback);
    return this;
  }

  once(event, callback) {
    addListener(this, event, callback, { once: true });
    return this;
  }

  async rpc(event, data, timeout = 60000) {
    const message = { command: event, data };
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(
        () => reject(new Error(`request for ${event} timed out (${timeout} ms)`)),
        timeout
      );

      this.once(event, (response) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });

      this.vscode.postMessage(message, '*');
    });
  }
}

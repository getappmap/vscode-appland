export default function handleAppMapMessages(app, vscode) {
  app.$on('request-resolve-location', (location) => {
    app.$emit('response-resolve-location', {
      location,
      externalUrl: location,
    });
  });

  app.$on('viewSource', ({ location }) => {
    vscode.postMessage({ command: 'viewSource', text: location });
  });

  // KEG: I'm not sure where this is used, but I'm not 100% sure that it doesn't do anything. So, leaving
  // it here for now.
  app.$on('copyToClipboard', (stringToCopy) => {
    vscode.postMessage({
      command: 'copyToClipboard',
      stringToCopy,
    });
  });

  app.$on('exportSVG', (svgString) => {
    vscode.postMessage({ command: 'exportSVG', svgString });
  });

  app.$on('exportJSON', (appmapData) => {
    vscode.postMessage({ command: 'exportJSON', appmapData });
  });

  app.$on('saveFilter', (filter) => {
    vscode.postMessage({ command: 'saveFilter', filter });
  });

  app.$on('deleteFilter', (filter) => {
    vscode.postMessage({ command: 'deleteFilter', filter });
  });

  app.$on('defaultFilter', (filter) => {
    vscode.postMessage({ command: 'defaultFilter', filter });
  });

  window.addEventListener('error', (event) => {
    vscode.postMessage({
      command: 'reportError',
      error: {
        message: event.error.message,
        stack: event.error.stack,
      },
    });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'requestAppmapState':
        vscode.postMessage({
          command: 'appmapStateResult',
          state: app.getAppMapState(),
        });
        break;
      case 'setAppmapState':
        app.setAppMapState(message.state);
        break;
      case 'updateSavedFilters':
        app.updateFilters(message.savedFilters);
        break;
      default:
        break;
    }
  });
}

/* eslint @typescript-eslint/naming-convention: 0 */

const doNothing = () => {
  // nop
};

export default {
  createStatusBarItem() {
    return {
      show() {
        return '';
      },
    };
  },
  showInputBox() {
    return '';
  },
  showErrorMessage: doNothing,
  showInformationMessage: doNothing,
  workspaceFolders: [],
  createOutputChannel: () => ({
    append: doNothing,
    appendLine: doNothing,
    clear: doNothing,
    hide: doNothing,
    name: '',
    show: doNothing,
    dispose: doNothing,
  }),
};

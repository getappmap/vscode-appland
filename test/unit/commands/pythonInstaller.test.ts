import type { IExtensionApi as PythonExtension } from '../../../types/ms-python';
import '../mock/vscode';
import PythonInstaller from '../../../src/commands/installer/python';
import Sinon from 'sinon';
import MockVSCode from '../mock/vscode';

const SIGNED_INT_MAX = Math.pow(2, 31) - 1;

describe('PythonInstaller', () => {
  let tools: Array<string> = [];
  const mockPythonExtension = {
    environments: {
      getActiveEnvironmentPath: () => ({ id: 'test', path: 'test' }),
      resolveEnvironment: () => Promise.resolve({ tools }),
    },
  } as unknown as PythonExtension;

  let pythonInstaller: PythonInstaller;
  beforeEach(() => (pythonInstaller = new PythonInstaller()));
  afterEach(() => {
    tools = [];
    Sinon.restore();
  });

  describe('obtainTerminal', () => {
    describe('with a managed environment', () => {
      beforeEach(() => {
        tools.push('test');
      });

      it('waits for the Python extension to activate', () => {
        // By adding a 'tool', we're indicating that something manages the Python environment.
        tools.push('test');

        const createTerminal = Sinon.stub(MockVSCode.window, 'createTerminal').callsFake(() => {
          const newTerminal = createTerminal.wrappedMethod.apply(MockVSCode.window);
          setTimeout(() => newTerminal.sendText('<activate>'), 16);
          return newTerminal;
        });

        // Nothing to assert here.
        // If the method fails to recognize `sendText` was called, this test will timeout.
        return pythonInstaller['obtainTerminal'](mockPythonExtension, 'test', {}, SIGNED_INT_MAX);
      });

      it('times out if the Python extension does not activate', () => {
        // Nothing to assert here.
        // As long as this function returns before the test times out this test should pass, indicating that
        // the `sendText` timeout period was exceeded and a terminal was returned.
        return pythonInstaller['obtainTerminal'](mockPythonExtension, 'test', {}, 0);
      });
    });

    describe('without a managed environment', () => {
      it('returns a terminal immediately', () => {
        // Nothing to assert here.
        // If the method fails to recognize `sendText` was called, this test will timeout.
        return pythonInstaller['obtainTerminal'](mockPythonExtension, 'test', {}, SIGNED_INT_MAX);
      });
    });
  });
});

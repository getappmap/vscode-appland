import path from 'path';

const expectedJarPath = path.join('${userHome}', '.appmap', 'lib', 'java', 'appmap.jar');

export const FakeConfig = {
  get() {
    return [];
  },
  update() {
    return;
  },
};

export const ExpectedLaunchConfig = {
  type: 'java',
  name: 'Run with AppMap',
  request: 'launch',
  mainClass: '',
  vmArgs: `-javaagent:${expectedJarPath}`,
};

export const ExpectedTestConfig = {
  name: 'Test with AppMap',
  vmArgs: [
    `-javaagent:${expectedJarPath}`,
    '-Dappmap.output.directory=${command:appmap.getAppmapDir}',
  ],
};

import { writeFile } from 'fs';
import { resolve } from 'path';
import { promisify } from 'util';

export const ProjectA = resolve(__dirname, '../../../../test/fixtures/workspaces/project-a');

export default async function preconfigure(): Promise<void> {
  console.log(`Installing settings.json in ${ProjectA}/.vscode/settings.json`);
  await promisify(writeFile)(
    resolve(ProjectA, '.vscode/settings.json'),
    JSON.stringify({
      'appMap.inspectEnabled': true,
      'appMap.findingsEnabled': true,
      'appMap.indexCommand': `echo 'hello world'`,
    })
  );
}

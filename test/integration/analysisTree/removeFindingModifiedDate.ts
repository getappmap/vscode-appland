import { join } from 'path';
import { ProjectSeveralFindings } from '../util';
import { readFile, writeFile } from 'fs/promises';
import { Finding } from '@appland/scanner';
import { debug } from 'console';

export async function removeFindingModifiedDate(findingsPath: string) {
  let findingsData: any;
  try {
    const findingsStr = await readFile(join(ProjectSeveralFindings, findingsPath), 'utf8');
    findingsData = JSON.parse(findingsStr);
  } catch (e) {
    debug(e);
    return;
  }
  const findings = findingsData.findings as Finding[];
  let modified = false;
  for (const finding of findings) {
    for (const field of ['scopeModifiedDate', 'eventsModifiedDate']) {
      if (finding[field]) {
        modified = true;
        delete finding[field];
      }
    }
  }
  if (modified)
    await writeFile(join(ProjectSeveralFindings, findingsPath), JSON.stringify(findingsData));
}

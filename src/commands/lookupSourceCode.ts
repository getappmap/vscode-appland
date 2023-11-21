import { readFile } from 'fs/promises';
import { fileExists } from '../util';
import { join } from 'path';

// TODO: This is not working
// const LANGUAGE_REGEXP_MAP: Record<string, RegExp> = {
//   '.rb': new RegExp(`def\\s+\\w+.*?\\n(.*?\\n)*?^end\\b`, 'gm'),
//   '.java': new RegExp(
//     `(?:public|private|protected)?\\s+(?:static\\s+)?(?:final\\s+)?(?:synchronized\\s+)?(?:abstract\\s+)?(?:native\\s+)?(?:strictfp\\s+)?(?:transient\\s+)?(?:volatile\\s+)?(?:\\w+\\s+)*\\w+\\s+\\w+\\s*\\([^)]*\\)\\s*(?:throws\\s+\\w+(?:,\\s*\\w+)*)?\\s*\\{(?:[^{}]*\\{[^{}]*\\})*[^{}]*\\}`,
//     'gm'
//   ),
//   '.py': new RegExp(`def\\s+\\w+.*?:\\n(.*?\\n)*?`, 'gm'),
//   '.js': new RegExp(
//     `(?:async\\s+)?function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{(?:[^{}]*\\{[^{}]*\\})*[^{}]*\\}`,
//     'gm'
//   ),
// };

export default async function lookupSourceCode(
  directory: string,
  location: string
): Promise<string | undefined> {
  const [path, lineNoStr] = location.split(':');

  const fileName = join(directory, path);
  if (!(await fileExists(fileName))) return;

  const fileContent = await readFile(fileName, 'utf-8');
  let functionContent: string | undefined;
  if (lineNoStr) {
    const lineno = parseInt(lineNoStr, 10);
    const lines = fileContent.split('\n');
    functionContent = lines.slice(lineno - 1, lineno + 10).join('\n');

    // const extension = path.substring(path.lastIndexOf('.'));
    // const regex = LANGUAGE_REGEXP_MAP[extension];

    // if (regex) {
    //   const match = regex.exec(fileContent);
    //   if (match) {
    //     const lines = match[0].split('\n');
    //     const startLine = parseInt(lineno, 10);
    //     const endLine = startLine + lines.length - 1;
    //     if (startLine <= endLine) {
    //       functionContent = lines.slice(startLine - 1, endLine).join('\n');
    //     }
    //   }
    // }
  } else {
    functionContent = fileContent;
  }

  return functionContent;
}

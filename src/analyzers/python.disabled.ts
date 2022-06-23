import { WorkspaceFolder } from 'vscode';
import { Result } from '.';

export default function analyze(folder: WorkspaceFolder): Result {
  return {
    features: {
      lang: {
        title: 'Python',
        score: 'bad',
        text: `Python is not currently supported by AppMap.`,
      },
    },
    name: folder.name,
    score: 0,
  };
}

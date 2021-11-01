import { WorkspaceFolder } from 'vscode';
import { Result } from '.';

export default function analyze(folder: WorkspaceFolder): Result {
  return {
    features: {
      lang: {
        score: 'bad',
        text: `This project looks like it's written in a language not currently supported by AppMap.`,
      },
    },
    name: folder.name,
    score: 0,
  };
}

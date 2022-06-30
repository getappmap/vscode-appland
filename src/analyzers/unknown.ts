import { WorkspaceFolder } from 'vscode';
import { ProjectAnalysis } from '.';

export default function analyze(folder: WorkspaceFolder): ProjectAnalysis {
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

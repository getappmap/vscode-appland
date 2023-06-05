import { WorkspaceFolder } from 'vscode';
import { ProjectAnalysis } from '.';

export default function analyze(folder: WorkspaceFolder): ProjectAnalysis {
  return {
    features: {
      lang: {
        score: 'unsupported',
        text: `AppMap works with Ruby, Java, Python and JavaScript. None of those languages were detected in this project.`,
      },
    },
    name: folder.name,
    score: 0,
  };
}

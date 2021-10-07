import * as vscode from 'vscode';
const fs = vscode.workspace.fs;

import { Result, scoreValue, Features } from '.';

export default async function analyze(folder: vscode.WorkspaceFolder): Promise<Result | null> {
  const pyfiles = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folder, '**/__init__.py')
  );
  if (pyfiles.length == 0) return null;

  const tips: Features = {
    lang: {
      title: 'Python',
      score: 'good',
      text: "This project looks like Python. It's one of languages supported by AppMap!",
    },
  };

  try {
    const decoder = new TextDecoder();
    const rawReqs = await fs.readFile(vscode.Uri.joinPath(folder.uri, 'requirements.txt'));
    const requirements = decoder.decode(rawReqs);

    if (/^django/m.test(requirements)) {
      tips.web = {
        title: 'Django',
        score: 'good',
        text:
          'This project uses Django. AppMap enables recording web requests and remote recording.',
      };
    } else {
      // TODO: add flask
      tips.web = {
        score: 'bad',
        text:
          "This project doesn't seem to use a supported web framework. Remote recording won't be possible.",
      };
    }

    if (/^pytest/m.test(requirements)) {
      tips.test = {
        score: 'good',
        title: 'pytest',
        text: 'This project uses Pytest. Test execution can be automatically recorded.',
      };
    } else {
      // TODO: add flask
      tips.test = {
        score: 'bad',
        text:
          "This project doesn't seem to use a supported test framework. Automatic test recording won't be possible.",
      };
    }
  } catch (_) {
    tips.lang = {
      title: 'Python',
      score: 'ok',
      text: `This project is written in Python, but we couldn't find a supported package manager config file in the project.`,
    };
  }

  return {
    name: folder.name,
    confidence: pyfiles.length,
    features: tips,
    score: scoreValue(...Object.entries(tips).map(([, t]) => t.score)),
  };
}

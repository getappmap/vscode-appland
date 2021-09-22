import * as vscode from 'vscode';
const fs = vscode.workspace.fs;

import { Result, Score } from '.';

export async function analyze(folder: vscode.WorkspaceFolder): Promise<Result | null> {
  const pyfiles = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.py'));
  if (pyfiles.length == 0) return null;

  const modules = pyfiles.map((file) => {
    return vscode.workspace
      .asRelativePath(file, false)
      .replace(/\/__init__.py/, '')
      .replace(/\.py$/, '')
      .replace(/\//g, '.');
  });

  const tips = [
    {
      score: Score.Good,
      text: "This project looks like Python. It's one of languages supported by AppMap!",
    },
  ];

  try {
    const decoder = new TextDecoder();
    const rawReqs = await fs.readFile(vscode.Uri.joinPath(folder.uri, 'requirements.txt'));
    const requirements = decoder.decode(rawReqs);

    if (/^django/m.test(requirements)) {
      tips.push({
        score: Score.Good,
        text:
          'This project uses Django. AppMap enables recording web requests and remote recording.',
      });
    } else {
      // TODO: add flask
      tips.push({
        score: Score.Bad,
        text:
          "This project doesn't seem to use a supported web framework. Remote recording won't be possible.",
      });
    }

    if (/^pytest/m.test(requirements)) {
      tips.push({
        score: Score.Good,
        text: 'This project uses Pytest. Test execution can be automatically recorded.',
      });
    } else {
      // TODO: add flask
      tips.push({
        score: Score.Bad,
        text:
          "This project doesn't seem to use a supported test framework. Automatic test recording won't be possible.",
      });
    }
  } catch (_) {
    tips.push({
      score: Score.Bad,
      text: `We couldn't find <code>requirements.txt</code> file in the project.`,
    });
  }

  return {
    confidence: pyfiles.length,
    tips: tips,
    classes: modules,
    score: tips.reduce((s, t) => s + t.score, 0),
  };
}

import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { Result, scoreValue, Features } from '.';
import utfDecoder from '../utfDecoder';
const fs = workspace.fs;

type DependencyFinder = (name: string) => boolean;

async function pipDependencies(folder: WorkspaceFolder): Promise<DependencyFinder | null> {
  try {
    const requirements = utfDecoder(
      await fs.readFile(Uri.joinPath(folder.uri, 'requirements.txt'))
    );
    return (name) => {
      return new RegExp(`^${name}(\\W|$)`, 'mi').test(requirements);
    };
  } catch (_) {
    return null;
  }
}

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const pyfiles = await workspace.findFiles(new RelativePattern(folder, '**/__init__.py'));
  if (pyfiles.length == 0) return null;

  const tips: Features = {
    lang: {
      title: 'Python',
      score: 'good',
      text: "This project looks like Python. It's one of languages supported by AppMap!",
    },
  };

  const dependency = await pipDependencies(folder);

  if (dependency) {
    if (dependency('django')) {
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

    if (dependency('pytest')) {
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
  } else {
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

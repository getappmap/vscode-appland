import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { Result, scoreValue, Features } from '.';
import { fileWordScanner, DependencyFinder } from './deps';
import utfDecoder from '../utfDecoder';
const fs = workspace.fs;

async function pipDependencies(folder: WorkspaceFolder): Promise<DependencyFinder> {
  const requirements = utfDecoder(await fs.readFile(Uri.joinPath(folder.uri, 'requirements.txt')));
  return (name) => {
    return new RegExp(`^${name}(\\W|$)`, 'mi').test(requirements);
  };
}

const pyprojectDependencies = fileWordScanner('pyproject.toml');

async function grepFiles(pattern: string, folder: WorkspaceFolder) {
  async function grepFile(file: PromiseLike<Uint8Array>) {
    const text = utfDecoder(await file);
    if (text.search(pattern) < 0) return Promise.reject();
    return Promise.resolve();
  }

  const files = await workspace.findFiles(new RelativePattern(folder, '**/*.py'));

  return Promise.any(files.map(fs.readFile).map(grepFile)).then(
    () => true,
    () => false
  );
}

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const pyfiles = await workspace.findFiles(new RelativePattern(folder, '**/__init__.py'));
  if (pyfiles.length == 0) return null;

  const features: Features = {
    lang: {
      title: 'Python',
      score: 'good',
      text: "This project looks like Python. It's one of languages supported by AppMap!",
    },
  };

  try {
    const dependency = await Promise.any([pipDependencies(folder), pyprojectDependencies(folder)]);
    if (dependency('django')) {
      features.web = {
        title: 'Django',
        score: 'good',
        text:
          'This project uses Django. AppMap enables recording web requests and remote recording.',
      };
    } else if (dependency('flask')) {
      features.web = {
        title: 'flask',
        score: 'good',
        text:
          'This project uses flask. AppMap enables recording web requests and remote recording.',
      };
    } else {
      features.web = {
        score: 'bad',
        text:
          "This project doesn't seem to use a supported web framework. Remote recording won't be possible.",
      };
    }

    if (dependency('pytest')) {
      features.test = {
        score: 'good',
        title: 'pytest',
        text: 'This project uses Pytest. Test execution can be automatically recorded.',
      };
    } else if (await grepFiles('unittest', folder)) {
      features.test = {
        score: 'good',
        title: 'unittest',
        text: 'This project uses unittest. Test execution can be automatically recorded.',
      };
    } else {
      features.test = {
        score: 'bad',
        text:
          "This project doesn't seem to use a supported test framework. Automatic test recording won't be possible.",
      };
    }
  } catch (_) {
    features.lang = {
      title: 'Python',
      score: 'ok',
      text: `This project is written in Python, but we couldn't find a supported package manager config file in the project.`,
    };
  }

  return {
    name: folder.name,
    confidence: pyfiles.length,
    features: features,
    score: scoreValue(...Object.entries(features).map(([, t]) => t.score)),
  };
}

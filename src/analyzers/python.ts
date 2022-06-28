import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { Result, overallScore, Features } from '.';
import { fileWordScanner, DependencyFinder } from './deps';
import utfDecoder from '../utfDecoder';
const fs = workspace.fs;

async function pipDependencies(folder: WorkspaceFolder): Promise<DependencyFinder> {
  const requirements = utfDecoder(await fs.readFile(Uri.joinPath(folder.uri, 'requirements.txt')));
  const finder = (name) => {
    return new RegExp(`^${name}(\\W|$)`, 'mi').test(requirements);
  };
  finder.filename = 'requirements.txt';
  return finder;
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
  const features: Features = {
    lang: {
      title: 'Python',
      score: 'ok',
      text: `Python is currently in Open Beta and is not fully supported. Please read the docs before proceeding.`,
    },
  };

  try {
    const dependency = await Promise.any([pipDependencies(folder), pyprojectDependencies(folder)]);
    features.lang.depFile = dependency.filename;
    if (dependency('django')) {
      features.web = {
        title: 'Django',
        score: 'ok',
        text:
          'This project uses Django. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    } else if (dependency('flask')) {
      features.web = {
        title: 'flask',
        score: 'bad',
        text: 'Flask is not currently supported.',
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
        score: 'ok',
        title: 'pytest',
        text: 'This project uses pytest. Test execution can be automatically recorded.',
      };
    } else if (await grepFiles('unittest', folder)) {
      features.test = {
        score: 'ok',
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
      text: `This looks like a Python project without a package manager. Python is currently in Open Beta and is not fully supported. Please read the docs before proceeding.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

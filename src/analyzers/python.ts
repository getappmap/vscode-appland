import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { ProjectAnalysis, overallScore, Features } from '.';
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
const pipfileDependencies = fileWordScanner('Pipfile');

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

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis | null> {
  const features: Features = {
    lang: {
      title: 'Python',
      score: 'ok',
      text: `Python is currently in Open Beta and is not fully supported. Please read the docs before proceeding.`,
    },
  };

  try {
    const dependency = await Promise.any([
      pipDependencies(folder),
      pipfileDependencies(folder),
      pyprojectDependencies(folder),
    ]);
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
        score: 'ok',
        text: 'Flask support is currently in Beta. Please read the docs.',
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

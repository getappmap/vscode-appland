import { RelativePattern, Uri, workspace, WorkspaceFolder } from 'vscode';
import { ProjectAnalysis, Features, overallScore } from '.';
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

const pipfileDependencies = fileWordScanner('Pipfile');
const poetryDependencies = fileWordScanner('poetry.lock');

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
      score: 'ga',
      text: `This project uses Python. It's one of the languages supported by AppMap.`,
    },
  };

  try {
    const dependency = await Promise.any([
      pipDependencies(folder),
      pipfileDependencies(folder),
      poetryDependencies(folder),
    ]);
    features.lang.depFile = dependency.filename;
    if (dependency('django')) {
      features.web = {
        title: 'Django',
        score: 'ga',
        text: 'This project uses Django. AppMap can record the HTTP requests served by your app.',
      };
    } else if (dependency('flask')) {
      features.web = {
        title: 'flask',
        score: 'ga',
        text: 'This project uses Flask. AppMap can record the HTTP requests served by your app.',
      };
    }

    if (dependency('pytest')) {
      features.test = {
        title: 'pytest',
        score: 'ga',
        text: 'This project uses pytest. AppMap can record your  tests.',
      };
    } else if (await grepFiles('unittest', folder)) {
      features.test = {
        score: 'ga',
        title: 'unittest',
        text: 'This project uses unittest. AppMap can record your tests.',
      };
    }
  } catch (e) {
    console.warn(e);
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

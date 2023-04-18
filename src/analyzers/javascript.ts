import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore, Feature } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';
import assert from 'assert';

const fs = workspace.fs;

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis | null> {
  const features: Features = {
    lang: {
      title: 'JavaScript',
      score: 'ok',
      text: `JavaScript is currently in Open Beta. Please read the docs before proceeding.`,
      depFile: 'package.json',
      plugin: '@appland/appmap-agent-js',
      pluginType: 'package',
    },
  };

  try {
    const { dependencies, devDependencies } = await readPkg(folder.uri);

    if (dependencies?.express) {
      features.web = {
        title: 'express.js',
        score: 'ok',
        text: 'This project uses Express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }

    const testFeature =
      detectTest(devDependencies, 'mocha', '>= 8') || detectTest(devDependencies, 'jest', '>= 25');
    if (testFeature) features.test = testFeature;
  } catch (_) {
    features.lang = {
      title: 'JavaScript',
      score: 'ok',
      text: `This looks like a JavaScript project without a dependency file. JavaScript is currently in Open Beta. Please read the docs before proceeding.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

type Dependency = Record<string, string | undefined>;

async function readPkg(uri: Uri): Promise<{
  dependencies?: Dependency;
  devDependencies?: Dependency;
}> {
  const file = await fs.readFile(Uri.joinPath(uri, 'package.json'));
  const json = utfDecoder(file);
  const pkg: unknown = JSON.parse(json);
  assert(pkg && typeof pkg === 'object');
  assert(!('dependencies' in pkg) || typeof pkg.dependencies === 'object');
  assert(!('devDependencies' in pkg) || typeof pkg.devDependencies === 'object');
  return pkg;
}

function detectTest(
  dep: Dependency | undefined,
  testPackage: string,
  constraint: string
): Feature | undefined {
  const version = dep && dep[testPackage];
  if (!version) return undefined;
  if (version === 'latest' || semverIntersects(constraint, version))
    return {
      title: testPackage,
      score: 'ok',
      text: `This project uses ${testPackage}. Test execution can be automatically recorded.`,
    };
  else
    return {
      title: testPackage,
      score: 'bad',
      text: `This project uses an unsupported version of ${testPackage}. You need version ${constraint} to automatically record test execution.`,
    };
}

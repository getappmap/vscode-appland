import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, Feature, overallScore } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';
import assert from 'assert';

const fs = workspace.fs;

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis | null> {
  const features: Features = {
    lang: {
      title: 'JavaScript',
      score: 'early-access',
      text: `This project uses JavaScript. AppMap provides early access support for JavaScript, primarily for Node.js.`,
      depFile: 'package.json',
      plugin: '@appland/appmap-agent-js',
      pluginType: 'package',
    },
  };

  let packageConfig:
    | {
        dependencies?: Dependency;
        devDependencies?: Dependency;
      }
    | undefined;
  try {
    packageConfig = await readPkg(folder.uri);
  } catch (e) {
    console.warn(e);
  }

  if (packageConfig) {
    const { dependencies, devDependencies } = packageConfig;
    if (dependencies?.express) {
      features.web = {
        title: 'express.js',
        score: 'early-access',
        text: 'This project uses Express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }

    const testFeature =
      detectTest(devDependencies, 'mocha', '>= 8') || detectTest(devDependencies, 'jest', '>= 25');
    if (testFeature) features.test = testFeature;
  } else {
    features.lang = {
      title: 'JavaScript',
      score: 'early-access',
      text: `This project uses JavaScript. You can add AppMap to this project by creating a package.json file.`,
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
      score: 'early-access',
      text: `This project uses ${testPackage}. You can record AppMaps of your tests.`,
    };
  else
    return {
      title: testPackage,
      score: 'unsupported',
      text: `This project uses an unsupported version of ${testPackage}. You need version ${constraint} to record AppMaps of your tests.`,
    };
}

import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, Feature, overallScore } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';
import assert from 'assert';
import { parseSyml } from '@yarnpkg/parsers';

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

  let dependencies: Dependencies | undefined;
  try {
    dependencies = {
      ...(await readPkg(folder.uri)),
      ...(await readPkgLock(folder.uri)),
      ...(await readYarnLock(folder.uri)),
    };
  } catch (e) {
    console.warn(e);
  }

  if (dependencies) {
    if (dependencies?.express) {
      features.web = {
        title: 'express.js',
        score: 'early-access',
        text: 'This project uses Express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }

    const testFeature =
      detectTest(dependencies, 'mocha', '>= 8') || detectTest(dependencies, 'jest', '>= 25');
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

type Dependencies = Record<string, string | undefined>;

async function readPkg(uri: Uri): Promise<Dependencies> {
  const pkg = await readJsonObject(Uri.joinPath(uri, 'package.json'));

  let result: Dependencies = {};

  if ('dependencies' in pkg) {
    assert(typeof pkg.dependencies === 'object');
    result = { ...pkg.dependencies };
  }

  if ('devDependencies' in pkg) {
    assert(typeof pkg.devDependencies === 'object');
    result = { ...result, ...pkg.devDependencies };
  }

  return result;
}

async function readPkgLock(uri: Uri): Promise<Dependencies> {
  try {
    const pkgLock = await readJsonObject(Uri.joinPath(uri, 'package-lock.json'));
    assert(
      'dependencies' in pkgLock && pkgLock.dependencies && typeof pkgLock.dependencies === 'object'
    );
    const { dependencies } = pkgLock;
    const versions = Object.entries(dependencies).map(([pkg, { version }]) => [pkg, version]);
    return Object.fromEntries(versions);
  } catch {
    // failure reading this file is not fatal
    return {};
  }
}

async function readJsonObject(uri: Uri): Promise<object> {
  const file = await fs.readFile(uri);
  const json = utfDecoder(file);
  const pkg: unknown = JSON.parse(json);
  assert(pkg && typeof pkg === 'object');
  return pkg;
}

async function readYarnLock(uri: Uri): Promise<Dependencies> {
  try {
    const file = await fs.readFile(Uri.joinPath(uri, 'yarn.lock'));
    const packages = parseSyml(utfDecoder(file));
    assert(packages && typeof packages === 'object');
    const versions = Object.entries(packages).map(([pkg, { version }]) => [
      parseYarnPkgSpec(pkg).name,
      version,
    ]);
    return Object.fromEntries(versions);
  } catch {
    // failure reading this file is not fatal
    return {};
  }
}

function detectTest(
  dep: Dependencies | undefined,
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

type YarnPkgSpec = {
  name: string;
  srcVer?: string;
};

export function parseYarnPkgSpec(spec: string): YarnPkgSpec {
  const [name, srcVer] = spec.split(/(?!^)@/, 2);
  return { name, srcVer };
}

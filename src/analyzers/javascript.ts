import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore, Feature } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';
import { PackageJson } from 'type-fest';

const fs = workspace.fs;

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis> {
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

  let pkg: PackageJson | undefined;
  try {
    const file = await fs.readFile(Uri.joinPath(folder.uri, 'package.json'));
    const json = utfDecoder(file);
    pkg = JSON.parse(json);
  } catch (_) {
    features.lang = {
      title: 'JavaScript',
      score: 'ok',
      text: `This looks like a JavaScript project without a dependency file. JavaScript is currently in Open Beta. Please read the docs before proceeding.`,
    };
  }

  if (pkg) {
    if (pkg.dependencies?.express) {
      features.web = {
        title: 'express.js',
        score: 'ok',
        text:
          'This project uses Express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }

    features.test = detectTestFrameworks(pkg);
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

function detectTestFrameworks(pkg: PackageJson): Feature | undefined {
  if (!pkg.devDependencies) return;

  const { mocha, jest } = pkg.devDependencies;

  if (mocha) {
    if (mocha === 'latest' || semverIntersects('>=8', mocha)) {
      return {
        title: 'mocha',
        score: 'ok',
        text: `This project uses Mocha. Test execution can be automatically recorded.`,
      };
    } else {
      return {
        title: 'mocha',
        score: 'bad',
        text:
          'This project uses an unsupported version of Mocha. You need at least version 8 to automatically record test execution.',
      };
    }
  }

  if (jest) {
    if (semverIntersects('<25', jest))
      return {
        title: 'jest',
        score: 'ok', // should this be 'bad'?
        text: `This project uses Jest. Test execution can probably be automatically recorded, but we haven't verified if it works with your particular version. Please let us know if it works for you.`,
      };

    return {
      title: 'jest',
      score: 'ok', // don't we use 'good' anymore?
      text: `This project uses Jest. Test execution can be automatically recorded.`,
    };
  }
}

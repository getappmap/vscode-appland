import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';

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

  let pkg: any; // eslint-disable-line @typescript-eslint/no-explicit-any
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
        text: 'This project uses Express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }

    if (pkg.devDependencies?.mocha) {
      const { mocha: mochaVersion } = pkg.devDependencies;
      if (mochaVersion === 'latest' || semverIntersects('>=8', mochaVersion)) {
        features.test = {
          title: 'mocha',
          score: 'ok',
          text: `This project uses Mocha. Test execution can be automatically recorded.`,
        };
      } else {
        features.test = {
          title: 'mocha',
          score: 'bad',
          text: 'This project uses an unsupported version of Mocha. You need at least version 8 to automatically record test execution.',
        };
      }
    }
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, Result, overallScore } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';

const fs = workspace.fs;

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const features: Features = {
    lang: {
      title: 'JavaScript',
      score: 'ok',
      text: `JavaScript is currently in Open Beta and is not fully supported. Please read the docs before proceeding.`,
      depFile: 'package.json',
      plugin: '@appland/appmap-agent-js',
      pluginType: 'package',
    },
  };

  try {
    const file = await fs.readFile(Uri.joinPath(folder.uri, 'package.json'));
    const json = utfDecoder(file);
    const pkg = JSON.parse(json);

    if (pkg.dependencies?.express) {
      features.web = {
        title: 'express.js',
        score: 'ok',
        text:
          'This project uses express. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
      };
    }
    if (pkg.devDependencies?.mocha) {
      if (semverIntersects('>=8', pkg.devDependencies.mocha)) {
        features.test = {
          title: 'mocha',
          score: 'ok',
          text: `This project uses mocha. Test execution can be automatically recorded.`,
        };
      } else {
        features.test = {
          title: 'mocha',
          score: 'bad',
          text:
            'This project uses an unsupported version of mocha. You need at least version 8 to automatically record test execution.',
        };
      }
    }
  } catch (_) {
    features.lang = {
      title: 'JavaScript',
      score: 'ok',
      text: `This looks like a JavaScript project without a dependency file. JavaScript is currently in Open Beta and is not fully supported. Please read the docs before proceeding.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

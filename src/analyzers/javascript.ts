import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { Features, Result, scoreValue } from '.';
import utfDecoder from '../utfDecoder';
import semverIntersects from 'semver/ranges/intersects';

const fs = workspace.fs;

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const features: Features = {
    lang: {
      title: 'JavaScript',
      score: 'good',
      text: "This project looks like JavaScript. It's one of languages supported by AppMap!",
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
        score: 'good',
        text:
          'This project uses express.js. AppMap enables recording web requests and remote recording.',
      };
    }
    if (pkg.devDependencies?.mocha) {
      if (semverIntersects('>=8', pkg.devDependencies.mocha)) {
        features.test = {
          title: 'mocha',
          score: 'good',
          text: `This project uses mocha. Test execution can be automatically recorded.`,
        };
      } else {
        features.test = {
          title: 'mocha',
          score: 'bad',
          text:
            'This project uses mocha, but the version is too old. You need at least version 8 to automatically record test execution.',
        };
      }
    }
  } catch (_) {
    features.lang = {
      title: 'JavaScript',
      score: 'ok',
      text: `This project looks like JavaScript, but we couldn't read a supported dependency file.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: scoreValue(...Object.entries(features).map(([, t]) => t.score)),
  };
}

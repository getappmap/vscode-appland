import { WorkspaceFolder } from 'vscode';
import { Features, Result, scoreValue } from '.';
import { fileWordScanner } from './deps';

const scanGemfile = fileWordScanner('Gemfile');

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const features: Features = {
    lang: {
      title: 'Ruby',
      score: 'good',
      text: "This project looks like Ruby. It's one of languages supported by AppMap!",
    },
  };

  try {
    const dependency = await scanGemfile(folder);
    features.lang.depFile = dependency.filename;
    if (dependency('rails')) {
      features.web = {
        title: 'Rails',
        score: 'good',
        text:
          'This project uses Rails. AppMap enables recording web requests and remote recording.',
      };
    }

    for (const framework of ['minitest', 'rspec', 'cucumber']) {
      if (dependency(framework)) {
        features.test = {
          title: framework,
          score: 'good',
          text: `This project uses ${framework}. Test execution can be automatically recorded.`,
        };
        break;
      }
    }
  } catch (_) {
    features.lang = {
      title: 'Ruby',
      score: 'ok',
      text: `This project looks like Ruby, but we couldn't find a Gemfile.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: scoreValue(...Object.entries(features).map(([, t]) => t.score)),
  };
}

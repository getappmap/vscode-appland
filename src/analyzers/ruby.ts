import { WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore } from '.';
import { fileWordScanner } from './deps';

const scanGemfile = fileWordScanner('Gemfile');

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis> {
  const features: Features = {
    lang: {
      title: 'Ruby',
      score: 'good',
      text: "This project looks like Ruby. It's one of the languages supported by AppMap.",
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
          'This project uses Rails. AppMap will automatically recognize web requests, SQL queries, and key framework functions during recording.',
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
      text: `This project looks like Ruby. It's one of the languages supported by AppMap, but no Gemfile was detected.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

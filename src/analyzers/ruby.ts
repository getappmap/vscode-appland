import { WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore } from '.';
import { fileWordScanner } from './deps';

const scanGemfile = fileWordScanner('Gemfile');

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis | null> {
  const features: Features = {
    lang: {
      title: 'Ruby',
      score: 'ga',
      text: "This project uses Ruby. It's one of the languages supported by AppMap.",
    },
  };

  try {
    const dependency = await scanGemfile(folder);
    features.lang.depFile = dependency.filename;
    if (dependency('rails')) {
      features.web = {
        title: 'Rails',
        score: 'ga',
        text: 'This project uses Rails. AppMap can record the HTTP requests served by your app.',
      };
    }

    for (const framework of ['Minitest', 'RSpec']) {
      if (dependency(framework.toLowerCase())) {
        features.test = {
          title: framework,
          score: 'ga',
          text: `This project uses ${framework}. AppMap can record your tests.`,
        };
        break;
      }
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

import { WorkspaceFolder } from 'vscode';
import { Features, ProjectAnalysis, overallScore } from '.';
import { fileWordScanner } from './deps';

export default async function analyze(folder: WorkspaceFolder): Promise<ProjectAnalysis | null> {
  const features: Features = {
    lang: {
      title: 'Java',
      score: 'ga',
      text: "This project uses Java. It's one of the languages supported by AppMap.",
    },
  };

  try {
    const dependency = await Promise.any(
      ['pom.xml', 'build.gradle'].map((f) => fileWordScanner(f)(folder))
    );
    features.lang.depFile = dependency.filename;
    if (dependency.filename == 'pom.xml') {
      features.lang.plugin = 'com.appland:appmap-maven-plugin';
      features.lang.pluginType = 'plugin';
    } else {
      features.lang.plugin = 'com.appland.appmap';
      features.lang.pluginType = 'plugin';
    }
    if (dependency('spring')) {
      features.web = {
        title: 'Spring',
        score: 'ga',
        text: 'This project uses Spring. AppMap can record the HTTP requests served by your app.',
      };
    }

    for (const framework of ['junit', 'testng']) {
      if (dependency(framework)) {
        features.test = {
          title: framework,
          score: 'ga',
          text: `This project uses ${framework}. AppMap can record your tests.`,
        };
        break;
      }
    }
  } catch (_) {
    features.lang = {
      title: 'Java',
      score: 'early-access',
      text: `This project uses Java. It's one of the languages supported by AppMap, but no supported dependency file was found.`,
    };
  }

  return {
    name: folder.name,
    features: features,
    score: overallScore(features),
  };
}

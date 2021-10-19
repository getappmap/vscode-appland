import { RelativePattern, workspace, WorkspaceFolder } from 'vscode';
import { Features, Result, scoreValue } from '.';
import { fileWordScanner } from './deps';

export default async function analyze(folder: WorkspaceFolder): Promise<Result | null> {
  const javafiles = await workspace.findFiles(new RelativePattern(folder, '**/*.java'));
  if (javafiles.length == 0) return null;

  const features: Features = {
    lang: {
      title: 'Java',
      score: 'good',
      text: "This project looks like Java. It's one of languages supported by AppMap!",
    },
  };

  try {
    const dependency = await Promise.any(
      ['pom.xml', 'build.gradle'].map((f) => fileWordScanner(f)(folder))
    );
    if (dependency('spring')) {
      features.web = {
        title: 'Spring',
        score: 'good',
        text:
          'This project uses Spring. AppMap enables recording web requests and remote recording.',
      };
    }

    for (const framework of ['junit', 'testng']) {
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
      title: 'Java',
      score: 'ok',
      text: `This project looks like Java, but we couldn't find a supported dependency file.`,
    };
  }

  return {
    name: folder.name,
    confidence: javafiles.length,
    features: features,
    score: scoreValue(...Object.entries(features).map(([, t]) => t.score)),
  };
}

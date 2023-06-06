import { WorkspaceFolder } from 'vscode';
import LanguageResolver from '../services/languageResolver';
import { systemNodeVersion, nvmNodeVersion } from '../services/command';
import assert from 'assert';

import JavaAnalyzer from './java';
import JavascriptAnalyzer from './javascript';
import PythonAnalyzer from './python';
import RubyAnalyzer from './ruby';
import UnknownAnalyzer from './unknown';

const analyzers = {
  java: JavaAnalyzer,
  javascript: JavascriptAnalyzer,
  python: PythonAnalyzer,
  ruby: RubyAnalyzer,
  unknown: UnknownAnalyzer,
};

export type Score = 'unsupported' | 'early-access' | 'ga';
export const SCORE_VALUES: Record<Score, number> = { unsupported: 0, 'early-access': 1, ga: 2 };
export const OVERALL_SCORE_VALUES: Record<Score, number> = {
  unsupported: 1,
  'early-access': 2,
  ga: 3,
};

export function scoreValue(...scores: Score[]): number {
  return scores.reduce((s, x) => s + SCORE_VALUES[x], 0);
}

export function overallScore(result: Features): number {
  const languageScore = result.lang.score;

  if (languageScore === 'unsupported') return OVERALL_SCORE_VALUES['unsupported'];

  // standard scoring
  return scoreValue(...Object.entries(result).map(([, t]) => t.score));
}

export type Feature = {
  title?: string;
  score: Score;
  text: string;
};

export type Features = {
  lang: Feature & { depFile?: string; plugin?: string; pluginType?: string };
  web?: Feature;
  test?: Feature;
};

export type AppMapSummary = {
  path: string;
  name?: string;
  requests?: number;
  sqlQueries?: number;
  functions?: number;
};

export type ProjectAnalysis = {
  features: Features;
  score: number;
  name: string;
  path?: string;
  nodeVersion?: NodeVersion;
};

export type WithAppMaps = {
  appMaps: Readonly<Array<AppMapSummary>>;
  numHttpRequests: number;
  numAppMaps: number;
};

export type NodeVersion = {
  major: number;
  minor: number;
  patch: number;
};

export async function analyze(
  folder: WorkspaceFolder
): Promise<(ProjectAnalysis & Partial<WithAppMaps>)[]> {
  const languages = await LanguageResolver.getLanguages(folder);
  const results: (ProjectAnalysis & Partial<WithAppMaps>)[] = [];
  for (let i = 0; i < languages.length; i++) {
    const language = languages[i];
    const analyzer = analyzers[language];
    if (analyzer) {
      const result = await analyzer(folder);
      assert(result);

      result.nodeVersion = await getNodeVersion(folder);
      result.path = folder.uri.fsPath;
      results[i] = result;
    }
  }
  return results.filter(Boolean);
}

async function getNodeVersion(folder: WorkspaceFolder): Promise<NodeVersion | undefined> {
  const nvmVersion = await nvmNodeVersion(folder);
  if (nvmVersion) {
    return parseNodeVersion(nvmVersion);
  }

  const systemVersion = await systemNodeVersion();
  if (systemVersion instanceof Error) {
    return undefined;
  }

  return parseNodeVersion(systemVersion);
}

function parseNodeVersion(versionString: string): NodeVersion | undefined {
  const digits = versionString
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(Number);

  while (digits.length < 3) digits.push(0);

  return {
    major: digits[0],
    minor: digits[1],
    patch: digits[2],
  };
}

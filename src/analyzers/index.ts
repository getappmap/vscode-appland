import { WorkspaceFolder } from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import LanguageResolver from '../services/languageResolver';
import { systemNodeVersion, nvmNodeVersion } from '../services/command';

export type Score = 'bad' | 'ok' | 'good';
export const SCORE_VALUES = { bad: 0, ok: 1, good: 2 };
export const OVERALL_SCORE_VALUES = { bad: 1, ok: 2, good: 3 };

export function scoreValue(...scores: Score[]): number {
  return scores.reduce((s, x) => s + SCORE_VALUES[x], 0);
}

export function overallScore(result: Features): number {
  const languageScore = result.lang.score;
  const webFrameworkScore = result?.web?.score || 'bad';
  const testFrameworkScore = result?.test?.score || 'bad';

  // score edge cases
  if (languageScore === 'bad') return OVERALL_SCORE_VALUES['bad'];
  if (languageScore === 'ok' && (webFrameworkScore === 'ok' || testFrameworkScore === 'ok')) {
    return OVERALL_SCORE_VALUES['ok'];
  }

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
): Promise<ProjectAnalysis & Partial<WithAppMaps>> {
  // TODO: Use the 'language' field in appmap.yml instead
  const language = await LanguageResolver.getLanguage(folder);
  const analyzer = (await import(`./${language}`)).default;
  const result = await analyzer(folder);

  result.nodeVersion = await getNodeVersion(folder);
  result.path = folder.uri.fsPath;

  return result;
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

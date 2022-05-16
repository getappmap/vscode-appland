import { WorkspaceFolder } from 'vscode';
import LanguageResolver from '../services/languageResolver';

export type Score = 'bad' | 'ok' | 'good';
const SCORE_VALUES = { bad: 0, ok: 1, good: 2 };

export function scoreValue(...scores: Score[]): number {
  return scores.reduce((s, x) => s + SCORE_VALUES[x], 0);
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

export type Result = {
  features: Features;
  score: number;
  name: string;
  path?: string;
};

export async function analyze(folder: WorkspaceFolder): Promise<Result> {
  const path = folder.uri.fsPath;
  const language = await LanguageResolver.getLanguage(path);
  const analyzer = (await import(`./${language}`)).default;
  const result = await analyzer(folder);
  result.path = path;
  return result;
}

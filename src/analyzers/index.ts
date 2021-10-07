import { WorkspaceFolder } from 'vscode';
import python from './python';

const ANALYZERS = [python];

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
  lang: Feature;
  web?: Feature;
  test?: Feature;
};

export type Result = {
  confidence: number;
  features: Features;
  score: number;
  name: string;
  path?: string;
};

export async function analyze(folder: WorkspaceFolder): Promise<Result> {
  const results = await Promise.all(ANALYZERS.map((a) => a(folder)));
  const best = results.sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))[0] || {
    confidence: 0,
    features: {
      lang: {
        score: 'bad',
        text: `This project looks like it's written in a language not currently supported by AppMap.`,
      },
    },
    name: folder.name,
    score: 0,
  };

  best.path = folder.uri.fsPath;
  return best;
}

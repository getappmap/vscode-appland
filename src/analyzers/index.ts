import { WorkspaceFolder } from 'vscode';
import { analyze as python } from './python';

const ANALYZERS = [python];

export enum Score {
  Bad,
  Ok,
  Good,
}

export type Tip = {
  score: Score;
  text: string;
};

export type Result = {
  confidence: number;
  tips: Tip[];
  modules: string[];
  score: number;
};

export async function analyze(folder: WorkspaceFolder): Promise<Result> {
  const results = await Promise.all(ANALYZERS.map((a) => a(folder)));
  const best = results.sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))[0];
  if (best) return best;

  return {
    confidence: 0,
    tips: [
      {
        score: Score.Bad,
        text: `This project looks like it's written in a language not currently supported by AppMap.`,
      },
    ],
    modules: [],
    score: 0,
  };
}

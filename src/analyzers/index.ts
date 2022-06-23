import { WorkspaceFolder } from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
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

export type AppMapSummary = {
  path: string;
  name?: string;
  requests?: number;
  sqlQueries?: number;
  functions?: number;
};

export type Result = {
  features: Features;
  score: number;
  name: string;
  path?: string;
};

export type WithAppMaps = {
  appMaps: Readonly<Array<AppMapSummary>>;
};

function getBestAppMaps(appMaps: AppMapLoader[], maxCount = 10): AppMapSummary[] {
  return appMaps
    .map(({ descriptor }) => ({
      path: descriptor.resourceUri.fsPath,
      name: descriptor.metadata?.name as string,
      requests: descriptor.numRequests as number,
      sqlQueries: descriptor.numQueries as number,
      functions: descriptor.numFunctions as number,
    }))
    .sort((a, b) => {
      const scoreA = a.requests * 100 + a.sqlQueries * 100 + a.functions * 100;
      const scoreB = b.requests * 100 + b.sqlQueries * 100 + b.functions * 100;
      return scoreB - scoreA;
    })
    .slice(0, maxCount);
}

export async function analyze(
  folder: WorkspaceFolder,
  appMapCollection?: AppMapCollection
): Promise<Result & Partial<WithAppMaps>> {
  // TODO: Use the 'language' field in appmap.yml instead
  const agent = await LanguageResolver.getAgent(folder);
  const language = agent.enabled ? agent.language : `${agent.language}.disabled`;
  const analyzer = (await import(`./${language}`)).default;
  const result = await analyzer(folder);

  if (appMapCollection) {
    const appMaps = appMapCollection.allAppMapsForWorkspaceFolder(folder);
    result.appMaps = getBestAppMaps(appMaps);
  }

  result.path = folder.uri.fsPath;
  return result;
}

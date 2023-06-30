import { AppMapSummary } from '../analyzers';
import { SUPPORTED_LANGUAGES } from '../services/languageResolver';
import { SampleCodeObjects } from '../services/projectStateService';
import { FindingsDomainCounts } from '../services/projectStateService';
import Feature from './feature';

export default interface ProjectMetadata {
  name: string;
  path: string;
  score?: number;
  hasNode?: boolean;
  agentInstalled?: boolean;
  appMapsRecorded?: boolean;
  analysisPerformed?: boolean;
  investigatedFindings?: boolean;
  generatedOpenApi?: boolean;
  appMapOpened?: boolean;
  numFindings?: number;
  numHttpRequests?: number;
  numAppMaps?: number;
  // Most preferred language available.
  language?: Feature;
  // All recognized languages.
  languages?: Feature[];
  // Test framework recognized in the preferred language, if any.
  testFramework?: Feature;
  // Web framework recognized in the preferred language, if any.
  webFramework?: Feature;
  appMaps?: Readonly<Array<AppMapSummary>>;
  sampleCodeObjects?: SampleCodeObjects;
  findingsDomainCounts?: FindingsDomainCounts;
}

export function isLanguageSupported(project?: ProjectMetadata): boolean {
  if (!project) return false;

  return !!project.languages?.some(
    (language) =>
      language.name &&
      SUPPORTED_LANGUAGES.includes(
        language.name.toLowerCase() as (typeof SUPPORTED_LANGUAGES)[number]
      )
  );
}

export function hasSupportedFramework(project?: ProjectMetadata): boolean {
  if (!project) return false;

  return !!(
    (project.webFramework && project.webFramework.score > 0) ||
    (project.testFramework && project.testFramework.score > 0)
  );
}

import { PathLike, promises as fs } from 'fs';
import { Uri } from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
import TelemetryDataProvider from '../telemetryDataProvider';
import LanguageResolver, { UNKNOWN_LANGUAGE } from '../../services/languageResolver';
import { fileExists, getRecords } from '../../util';
import ErrorCode from './errorCodes';
import ProjectMetadata from '../../workspace/projectMetadata';
import { TerminalConfig } from '../../commands/installAgent';
import * as vscode from 'vscode';
import { Finding } from '@appland/scanner';

export const DEBUG_EXCEPTION = new TelemetryDataProvider({
  id: 'appmap.debug.exception',
  async value({ exception }: { exception: Error }): Promise<string> {
    return exception.stack || '';
  },
});

export const DEBUG_ERROR_CODE = new TelemetryDataProvider({
  id: 'appmap.debug.error_code',
  async value({ errorCode }: { errorCode?: ErrorCode }): Promise<string> {
    return ErrorCode[errorCode || ErrorCode.Unknown];
  },
});

export const DEBUG_LOG = new TelemetryDataProvider({
  id: 'appmap.debug.log',
  async value({ log }: { log?: string }) {
    return log;
  },
});

export const VIEW_ID = new TelemetryDataProvider({
  id: 'appmap.view.id',
  async value({ viewId }: { viewId: string }): Promise<string> {
    return viewId;
  },
});

export const TEXT = new TelemetryDataProvider({
  id: 'appmap.text',
  async value({ text }: { text: string }): Promise<string> {
    return text;
  },
});

export const RESULT = new TelemetryDataProvider({
  id: 'appmap.result',
  async value({ result }: { result: string }): Promise<string> {
    return result;
  },
});

export const CTA_ID = new TelemetryDataProvider({
  id: 'appmap.cta.id',
  async value({ id }: { id: string }): Promise<string> {
    return id;
  },
});

export const CTA_PLACEMENT = new TelemetryDataProvider({
  id: 'appmap.cta.placement',
  async value({ placement }: { placement: 'notification' | 'sidebar' }): Promise<string> {
    return placement;
  },
});

export const FILE_PATH = new TelemetryDataProvider({
  id: 'appmap.file.path',
  async value({ uri, rootDirectory }: { uri: Uri; rootDirectory?: PathLike }) {
    if (!rootDirectory) {
      // If we cannot resolve a relative path, bail out.
      return undefined;
    }

    return path.relative(rootDirectory as string, uri.fsPath);
  },
});

export const FILE_SHA_256 = new TelemetryDataProvider({
  id: 'appmap.file.sha_256',
  async value({ uri }: { uri: Uri }) {
    const hash = createHash('sha256');
    hash.update(await fs.readFile(uri.fsPath));
    return hash.digest('hex');
  },
});

export const FILE_SIZE = new TelemetryDataProvider({
  id: 'appmap.file.size',
  async value({ uri }: { uri: Uri }) {
    return (await fs.stat(uri.fsPath)).size.toString();
  },
});

export const FILE_METADATA = new TelemetryDataProvider({
  id: 'appmap.file.metadata',
  async value({ metadata }: { metadata?: Record<string, unknown> }) {
    return getRecords({ ...metadata, git: undefined, fingerprints: undefined }, undefined, String);
  },
});

export const AGENT_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.agent.config_present',
  async value({ rootDirectory }: { rootDirectory: PathLike }) {
    const isPresent = await fileExists(path.join(rootDirectory.toString(), 'appmap.yml'));
    return String(isPresent);
  },
});

export const SCANNER_CONFIG_PRESENT = new TelemetryDataProvider({
  id: 'appmap.scanner.config_present',
  async value({ rootDirectory }: { rootDirectory: PathLike }) {
    const isPresent = await fileExists(path.join(rootDirectory.toString(), 'appland-scanner.yml'));
    return String(isPresent);
  },
});

export const PROJECT_LANGUAGE = new TelemetryDataProvider({
  id: 'appmap.project.language',
  cache: true,
  async value(data: { rootDirectory?: string; metadata?: Record<string, unknown> }) {
    // If metadata is available, use the language property.
    if (data.metadata) {
      const language = data.metadata.language as Record<string, string> | undefined;
      if (language?.name) {
        return language.name;
      }
    }

    // If no root directory is specified, we cannot resolve a langauge, so exit early.
    if (!data.rootDirectory) {
      return UNKNOWN_LANGUAGE;
    }

    return (await LanguageResolver.getLanguage(data.rootDirectory)) || UNKNOWN_LANGUAGE;
  },
});

export const PROJECT_LANGUAGE_DISTRIBUTION = new TelemetryDataProvider({
  id: 'appmap.project.language_distribution',
  cache: true,
  async value({ rootDirectory }: { rootDirectory: string }) {
    const languageDistribution = await LanguageResolver.getLanguageDistribution(rootDirectory);
    return JSON.stringify(languageDistribution);
  },
});

export const PROJECT_PATH = new TelemetryDataProvider<{ rootDirectory: string }, string>({
  id: 'appmap.project.path',
  cache: false,
  value: ({ rootDirectory }) => rootDirectory,
});

export const RECORDING_ENDPOINT_URL = new TelemetryDataProvider({
  id: 'appmap.remote_recording.endpoint_url',
  async value({ url }: { url: string }) {
    return url;
  },
});

export const RECORDING_STATUS_CODE = new TelemetryDataProvider({
  id: 'appmap.remote_recording.status_code',
  async value({ code }: { code: number }) {
    return String(code);
  },
});

export const IS_TELEMETRY_ENABLED = new TelemetryDataProvider({
  id: 'appmap.enabled',
  async value({ enabled }: { enabled: boolean }) {
    return String(enabled);
  },
});

export const IS_INSTALLABLE = new TelemetryDataProvider({
  id: 'appmap.project.installable',
  async value({ project }: { project: ProjectMetadata }) {
    const isInstallable = project?.score && project.score > 1;
    return String(isInstallable);
  },
});

export const HAS_INSTALLABLE_PROJECT = new TelemetryDataProvider({
  id: 'appmap.project.any_installable',
  async value({ projects }: { projects: ProjectMetadata[] }) {
    const isInstallable = projects.some((project) => project?.score && project.score > 1);
    return String(isInstallable);
  },
});

export const DEFAULT_TERMINALS = new TelemetryDataProvider({
  id: 'vscode.workspace.default_terminals',
  cache: true,
  async value({ defaultTerminals }: { defaultTerminals: TerminalConfig }) {
    return JSON.stringify(defaultTerminals);
  },
});

export const HAS_DEVCONTAINER = new TelemetryDataProvider({
  id: 'appmap.project.has_devcontainer',
  async value({ rootDirectory }: { rootDirectory: string }) {
    const devContainerPattern = new vscode.RelativePattern(
      rootDirectory,
      '{devcontainer,.devcontainer}.json'
    );
    const devContainerJson = await vscode.workspace.findFiles(
      devContainerPattern,
      '**/node_modules/**',
      1
    );
    const hasDevContainer = devContainerJson.length !== 0;
    return String(hasDevContainer);
  },
});

export const DEPENDENCIES = new TelemetryDataProvider({
  id: 'appmap.project',
  cache: true,
  async value({ project }: { project: ProjectMetadata }) {
    try {
      const packageJsonPath = path.join(project.path, 'package.json');
      const packageJsonFile = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonFile);
      const result = {
        dependencies: Object.keys(packageJson.dependencies || {})
          .sort()
          .join(','),
        dev_dependencies: Object.keys(packageJson.devDependencies || {})
          .sort()
          .join(','),
      };

      // Don't emit an entry if the value is empty
      Object.entries(result).forEach(([k, v]) => {
        if (!v) delete result[k];
      });

      return result;
    } catch {
      // do nothing
      // the file may not event exist
    }
  },
});

export const FINDING_SUMMARY = new TelemetryDataProvider({
  id: 'appmap.finding',
  async value({ finding }: { finding: Finding }) {
    return {
      rule: finding.ruleId,
      impact_domain: finding.impactDomain?.toLowerCase(),
      hash: finding.hash,
      hash_v2: finding.hash_v2,
    };
  },
});

export const FINDINGS_SUMMARY = new TelemetryDataProvider({
  id: 'appmap.analysis',
  async value({ findings }: { findings: ReadonlyArray<Finding> }) {
    const result = findings
      .map((finding) => ({
        rule: finding.ruleId,
        impactDomain: finding.impactDomain?.toLowerCase(),
      }))
      .reduce(
        (acc, finding) => {
          acc.rules.add(finding.rule);
          acc.impactDomains.add(finding.impactDomain);
          return acc;
        },
        { rules: new Set(), impactDomains: new Set() }
      );

    return {
      rules: Array.from(result.rules).join(','),
      impact_domains: Array.from(result.impactDomains).join(','),
    };
  },
});

export const DOCS_PATH = new TelemetryDataProvider({
  id: 'appmap.docs_path',
  async value({ path }: { path: string }) {
    return path;
  },
});

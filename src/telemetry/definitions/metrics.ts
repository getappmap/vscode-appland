import { Finding } from '@appland/scanner';
import { workspace } from 'vscode';
import TelemetryDataProvider from '../telemetryDataProvider';

export const APPMAP_JSON = new TelemetryDataProvider({
  id: 'appmap.json',
  async value({ metrics }: { metrics: Record<string, number> }) {
    return metrics;
  },
});

export const NUM_WORKSPACE_FOLDERS = new TelemetryDataProvider({
  id: 'num_workspace_folders',
  async value() {
    return workspace.workspaceFolders?.length || 0;
  },
});

export const NUM_FINDINGS = new TelemetryDataProvider({
  id: 'num_findings',
  async value({ findings }: { findings: ReadonlyArray<Finding> }) {
    const uniqueCounts: { [key: string]: Set<string> } = {};
    const totalCounts: { [key: string]: number } = {};

    findings.forEach((finding) => {
      if (finding.impactDomain) {
        const uniqueKey = `num_unique_${finding.impactDomain?.toLowerCase()}`;
        const totalKey = `num_${finding.impactDomain?.toLowerCase()}`;
        uniqueCounts[uniqueKey] = uniqueCounts[uniqueKey] || new Set();
        uniqueCounts[uniqueKey].add(finding.hash_v2);
        totalCounts[totalKey] = (totalCounts[totalKey] || 0) + 1;
      }
    });

    return {
      num_total_findings: findings.length,
      num_unique_findings: new Set(findings.map((f) => f.hash_v2)).size,
      ...totalCounts,
      ...Object.entries(uniqueCounts).reduce((acc, [k, v]) => {
        acc[k] = v.size;
        return acc;
      }, {} as Record<string, number>),
    };
  },
});

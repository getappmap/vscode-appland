import fetch from 'node-fetch';

export interface GitHubContentExclusion {
  rules: Rule[];
  last_updated_at: string;
  scope: Scope;
}

interface Rule {
  source: {
    name: string;
    type: string;
  };
  paths: string[];
}

type Scope = 'all' | 'repo';

export default async function fetchGHExclusions(
  githubToken: string,
  scope: Scope = 'all',
  repos?: string[]
): Promise<GitHubContentExclusion[]> {
  const url = new URL('https://api.github.com/copilot_internal/content_exclusion');
  url.searchParams.set('scope', scope);
  if (repos) url.searchParams.set('repos', repos.join(','));
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${githubToken}`,
    },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Failed to fetch exclusions: ${response.statusText}`);

  return response.json();
}

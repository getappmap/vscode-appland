/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import Handlebars from 'handlebars';
import { SearchRpc } from '@appland/rpc';
import { Metadata } from '@appland/models';
import { RPCClient } from './rpcClient';

const TEMPLATE = `## Query

\`\`\`{{#if searchResponse.results.length}}{{ language_name searchResponse.results.[0].appmap }}{{/if}}
{{{ query }}}
\`\`\`

<details>
<summary>
Tokenized query
</summary>

\`\`\`
{{ tokenizedQuery }}
\`\`\`
</details>

## Search results

{{#each searchResponse.results}}

---

  {{#with (appmap_metadata appmap)}}
### [{{ name }}]({{ appmap_path ../appmap }})
  {{/with}}

  {{#if explanation}}
{{{explanation}}}
  {{/if}}

Most relevant code objects:

  {{#each events}}
* \`\`\`{{{ inline fqid }}}\`\`\`
  {{/each}}

<details>
<summary>
About this AppMap
</summary>

  {{#with (appmap_metadata appmap)}}
| Field | Value |
| --- | --- |
| Score | {{ ../score }} |
| Project | {{ ../../folder.name }} |
| Language | {{ language.name }} |
| Frameworks | {{#each frameworks}}{{ name }} {{/each}} |
| Recorder | {{ recorder.name }} ({{ recorder.type }}) |
    {{#if source_location}}
| Source location | [{{ source_location }}]({{ file_path source_location }}) |
    {{/if}}
    {{#if exception}}
| Exception | {{ exception.class }}: {{ exception.message }} |
    {{/if}}
| AppMap file | [{{ ../appmap }}]({{ appmap_path ../appmap }}) |
  {{/with}}
</details>

<details>
<summary>
Code object details
</summary>

  {{#each events}}

#### \`\`\`{{{ inline fqid }}}\`\`\`

  | Field | Value |
  | --- | --- |
  | Score | {{ score }} |
    {{#if location }}
  | Location | [{{ location }}]({{ file_path location }}) |
    {{/if}}
  {{/each}}

</details>

{{/each}}
`;

const VIEW = Handlebars.compile(TEMPLATE);

function appmapFile(appmapId: string | undefined): string | undefined {
  if (!appmapId) return;

  let appmap = appmapId;
  if (!appmap.endsWith('.appmap.json')) appmap = [appmap, '.appmap.json'].join('');
  return appmap;
}

export default async function renderSearchResults(
  rpc: RPCClient,
  folder: vscode.WorkspaceFolder,
  query: string,
  tokenizedQuery: string,
  searchResponse: SearchRpc.SearchResponse
): Promise<string> {
  const metadata = new Map<string, Metadata>();
  for (const result of searchResponse.results) {
    const md = await rpc.metadata(result.appmap);
    metadata.set(result.appmap, md);
  }

  const appmap_metadata = (appmapId: string) => {
    return metadata.get(appmapId);
  };

  const appmap_path = (appmapId: string) => {
    return appmapFile(appmapId);
  };

  const file_path = (location: string) => {
    const tokens = location.split(':');
    if (tokens.length === 1) return tokens;

    const lineno = tokens.pop();
    return [tokens.join(':'), lineno].join('#');
  };

  const inline = (str: string): string => {
    const result = str.replaceAll('\n', ' ').replaceAll(/\s+/g, ' ').trim();
    if (result.length < 200) return result;
    else return [result.slice(0, 200), '...'].join('');
  };

  const language_name = (appmapId: string) => {
    const md = appmap_metadata(appmapId);
    return md?.language?.name;
  };

  const helpers = {
    appmap_path,
    appmap_metadata,
    file_path,
    inline,
    language_name,
  };

  return VIEW({ folder, query, tokenizedQuery, searchResponse }, { helpers });
}

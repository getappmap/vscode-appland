import { ViewColumn, WebviewPanel, window, workspace } from 'vscode';
import { analyze, Feature, Score } from './analyzers';

const COLUMN = ViewColumn.One;

let panel: WebviewPanel | null = null;

export default async function openWorkspaceOverview(): Promise<void> {
  if (panel) {
    panel.reveal(COLUMN);
    return;
  }

  panel = window.createWebviewPanel('overview', 'AppMap Quickstart', COLUMN, {
    enableScripts: true,
  });
  panel.onDidDispose(() => (panel = null));
  workspace.onDidChangeWorkspaceFolders(refresh);

  return refresh();
}

async function resultRows(): Promise<string[]> {
  function classOfScore(score: number): Score {
    if (score < 2) return 'bad';
    if (score < 3) return 'ok';
    return 'good';
  }

  function tdOfFeature(feature?: Feature) {
    if (!feature) return `<td class="bad">—</td>`;
    return `<td class="${feature.score}" title="${feature.text}">${feature.title || '—'}</td>`;
  }

  const folders = workspace.workspaceFolders;

  if (!folders) return []; // TODO: show some info

  const rows: string[] = [];

  const results = (await Promise.all(folders.map(analyze))).sort((a, b) => b.score - a.score);

  for (const folder of results) {
    const {
      name,
      path,
      score,
      features: { lang, web, test },
    } = folder;

    const klass = classOfScore(score);

    rows.push(`<tr class="${klass}"
        data-path="${encodeURI(path || '')}"
        data-score="${klass}"
        data-lang="${lang.title?.toLowerCase() || ''}"
        data-depfile="${lang.depFile || ''}"
        data-type="${lang.pluginType || ''}"
        data-plugin="${lang.plugin || ''}">
      <th>${name}</th>
      ${tdOfFeature(lang)}
      ${tdOfFeature(test)}
      ${tdOfFeature(web)}
    </tr>`);
  }

  return rows;
}

async function refresh(): Promise<void> {
  if (!panel) return;

  const rows = await resultRows();

  panel.webview.html = `
    <head>
      <style>
        :root {
          --appmap-border: #7F6BE6;
        }

        body {
          color: var(--vscode-foreground);
        }

        section {
          max-width: 1280px;
          background: var(--vscode-welcomePage-tileBackground);
          margin: 1em auto;
          border-radius: 8px;
          filter: drop-shadow(2px 2px 2px var(--vscode-welcomePage-tileShadow));
          padding: 2em;
        }

        h1 {
          margin-block-start: 0;
          font-size: 2em;
        }

        h2 {
          margin-block-end: 0;
        }

        header {
          margin-block-end: 2em;
        }

        table {
          width: 100%;
          text-align: right;
          border: 1px solid var(--appmap-border);
          border-radius: 8px;
          border-spacing: 0;
        }

        tr :first-child {
          text-align: left;
          padding-left: 6ex;
          position: relative;
        }

        tr.selected {
          background: var(--vscode-list-inactiveSelectionBackground);
        }

        td, th {
          padding: 1em 2ex;
        }

        thead tr th {
          border-bottom: 1px solid var(--appmap-border);
        }

        tbody tr :first-child:before {
          position: absolute;
          border: 0.2em solid var(--icon-color);
          border-radius: 50%;
          width: 1em;
          height: 1em;
          left: 2ex;
          color: var(--icon-color);
          top: 0.9em;
          text-align: center;
          line-height: 1em;
        }

        tr.good :first-child:before {
          content: "✔";
          --icon-color: green;
        }

        tr.ok :first-child:before {
          content: "·";
          --icon-color: var(--vscode-problemsWarningIcon-foreground);
        }

        tr.bad :first-child:before {
          content: "×";
          --icon-color: var(--vscode-problemsErrorIcon-foreground);
        }

        td.ok {
          color: var(--vscode-list-warningForeground);
        }

        td.bad {
          color:  var(--vscode-list-errorForeground);
        }

        tr.ok, tr.bad {
          opacity: 0.6;
        }

        p.command {
          border-radius: 8px;
          border: thin solid var(--appmap-border);
          padding: 1em;
          position: relative;
          overflow: hidden;
        }

        p.command:after {
          bottom: 0;
          width: 3em;
          content: "⧉";
          right: 0;
          position: absolute;
          text-align: center;
          background: #7f6be677;
          height: 100%;
          top: 0;
          border-left: thin solid var(--appmap-border);
          line-height: 3em;
        }
      </style>
    </head>
    <body>
      <section>
        <header>
          <h1>AppMap Quickstart</h1>
        </header>
        <main>
          <article>
            <h2>1. Select a suitable project</h2>
            <p>To make sure that your projects are suitable for mapping, we make a couple of quick
            requirement checks on your workspace to help you find a project to start AppMapping.
            Select a suitable project from the table below.</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Project name (${rows.length})</th>
                  <th scope="col">Language</th>
                  <th scope="col">Test framework</th>
                  <th scope="col">Web framework</th>
                </tr>
              </thead>
              <tbody>
                ${rows.join('\n')}
              </tbody>
            </table>
          </article>
          &nbsp;
          <article class="explain good ok">
            <h2>2. Install AppMap agent</h2>
            <p>The AppMap agent watches your code as it executes and generates traces you can
            examine visually to understand exactly how it works from running it,
            executing test cases or recording a live interactive session of a web service.</p>
            <p class="explain ok">It appears this project might not be a good choice for your first AppMap.
            We recommend you pick another project; proceed at your own risk.</p>
            <p>To install the agent:</p>
            <ul>
              <li>add <code id="plugin">appmap</code> <span id="pluginType">pickage</span> as a dependency to the project <code id="depfile"></code></li>
              <li>create <code>appmap.yml</code> configuration file</li>
            </ul>
            <p>Refer to <a id="docref-step2" href="https://appland.com/docs/quickstart/vscode/step-2">AppMap documentation</a> for details.
              You can also run a script that will guide your through this process:</p>
            <p class="command"><code>
              npx @appland/appmap install <span id="directory"></span>
            </code></p>
            <p><i>Note: you should take care to run it in the project's environment so it can correctly detect runtimes and libraries.</i></p>
            <h2>3. Analyze running code</h2>
            <p>To analyze your application with AppMap, the application code has to be run with the agent to record AppMap files:</p>
            <ul>
              <li>AppMaps will be automatically recorded from test cases when you run the tests</li>
              <li>When troubleshooting or when you don't have tests, start the application and record AppMaps manually using remote recording</li>
            </ul>
            <p>Refer to <a id="docref-step3" href="https://appland.com/docs/quickstart/vscode/step-3">AppMap documentation</a> for details.
            <p><i>Note: you need to run tests or record a running application with the AppMap agent in order to see AppMaps in your project.</i></p>
          </article>
          <article class="explain bad">
            <p>For your first AppMap, we recommend a project that:</p>
            <ul>
              <li>is a web application or a web service</li>
              <li>is written in Python (Django or Flask), Ruby (Rails) or Java (Spring)</li>
              <li>has reasonably comprehensive integration test suite
            </ul>
            <p><b>Please open a project meeting these recommendations to proceed.</b></p>
            <!-- let's do this later
            <p>Prefer an example? Try this, that or these instead.#TODO</p> 
            -->
          </article>
        </main>
      </section>
      <script>
        function explain(state) {
          if (!state) state = 'bad';
          for (const ex of document.querySelectorAll('.explain')) {
            ex.style.display = 'none';
          }
          for (const ex of document.querySelectorAll('.explain.' + state)) {
            ex.style.display = 'block';
          }
        }

        function select(target) {
          for (const tr of document.querySelectorAll('tbody tr')) {
            tr.classList.remove('selected');
          }
          if (target) {
            target.classList.add('selected');
            explain(target.dataset.score);
            document.querySelector('#directory').innerText = decodeURI(target.dataset.path);
            document.querySelector('#plugin').innerText = target.dataset.plugin || 'appmap';
            document.querySelector('#pluginType').innerText = target.dataset.type || 'package';
            document.querySelector('#depfile').innerText = target.dataset.depfile;
            document.querySelector('#docref-step2').href = 'https://appland.com/docs/quickstart/vscode/' + target.dataset.lang + '-step-2.html';
            document.querySelector('#docref-step3').href = 'https://appland.com/docs/quickstart/vscode/' + target.dataset.lang + '-step-3.html';
          } else {
            explain('bad');
          }
        }

        for (const tr of document.querySelectorAll('tbody tr')) {
          tr.addEventListener('click', (e) => select(e.target.closest('tr')));
        }

        select(document.querySelector('tbody tr'));

        for (const cmd of document.querySelectorAll('.command')) {
          cmd.addEventListener('click', (e) => {
            navigator.clipboard.writeText(e.target.closest('.command').innerText);
          });
        }
      </script>
    </body>
  `;
}

import {
  commands,
  Disposable,
  ExtensionContext,
  ViewColumn,
  WebviewPanel,
  window,
  workspace,
} from 'vscode';
import * as semver from 'semver';
import { analyze, Feature, Score } from '../analyzers';
import { randomBytes } from 'crypto';
import { COPY_INSTALL_COMMAND, OPEN_VIEW, Telemetry } from '../telemetry';
import ExtensionState from '../configuration/extensionState';
import extensionSettings from '../configuration/extensionSettings';

const COLUMN = ViewColumn.One;

let panel: WebviewPanel | null = null;

const VIEW_ID: Readonly<string> = 'appmap.views.openWorkspaceOverview';

export default async function projectPickerWebview(
  context: ExtensionContext,
  properties: ExtensionState
): Promise<void> {
  context.subscriptions.push(
    commands.registerCommand('appmap.openWorkspaceOverview', openWorkspaceOverview)
  );

  const firstVersionInstalled = semver.coerce(properties.firstVersionInstalled);
  if (firstVersionInstalled && semver.gte(firstVersionInstalled, '0.15.0')) {
    // Logic within this block will only be executed if the extension was installed after we began tracking the
    // time of installation. We will use this to determine whether or not our UX improvements are effective, without
    // before rolling them out to our existing user base.

    if (!properties.hasViewedInstallGuide) {
      properties.hasViewedInstallGuide = true;
      if (extensionSettings.instructionsEnabled()) {
        return commands.executeCommand('appmap.openInstallGuide', 'project-picker');
      }

      return commands.executeCommand('appmap.openWorkspaceOverview');
    }
  }
}

async function openWorkspaceOverview(): Promise<void> {
  if (panel) {
    panel.reveal(COLUMN);
    return;
  }

  const subscriptions: Disposable[] = [];
  panel = window.createWebviewPanel(VIEW_ID, 'AppMap — Getting started', COLUMN, {
    enableScripts: true,
    enableCommandUris: true,
  });

  panel.webview.onDidReceiveMessage(messageReceived, null, subscriptions);
  workspace.onDidChangeWorkspaceFolders(refresh, null, subscriptions);

  panel.onDidDispose(
    () => {
      for (const s of subscriptions) s.dispose();
      panel = null;
    },
    null,
    subscriptions
  );

  await refresh();
  Telemetry.sendEvent(OPEN_VIEW, { viewId: VIEW_ID });
}

type CopyMessage = {
  msg: 'copy';
  root: string;
};

function messageReceived(msg: CopyMessage) {
  if (msg.msg != 'copy') {
    console.log(`unknown message received`);
    return;
  }
  Telemetry.sendEvent(COPY_INSTALL_COMMAND, { rootDirectory: msg.root });
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

  const results = (await Promise.all(folders.map((f) => analyze(f)))).sort(
    (a, b) => b.score - a.score
  );

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
  const nonce = randomBytes(18).toString('base64');

  panel.webview.html = `
    <head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'nonce-${nonce}';">
      <style nonce="${nonce}">
        :root {
          --appmap-border: #7F6BE6;
        }

        body {
          color: var(--vscode-foreground);
        }

        .body-text {
          max-width: 550px;
        }

        main {
          counter-reset: step;
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
          counter-increment: step;
        }

        h2::before {
          content: counter(step) ". ";
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

        p.command button {
          bottom: 0;
          padding: 0 2ex;
          color: inherit;
          right: 0;
          position: absolute;
          text-align: center;
          background: #7f6be677;
          height: 100%;
          top: 0;
          border: none;
          border-left: thin solid var(--appmap-border);
          line-height: 3em;
        }

        p.command button:hover {
          background: #7f6be6aa;
        }

        p.command button:active {
          background: #7f6be6ff;
        }

        p.note {
          font-style: italic;
        }

        p.note::before {
          content: "Note: ";
          font-size: large;
          opacity: 0.8;
          font-variant-caps: all-small-caps;
          margin-right: 0.8ex;
          font-style: normal;
        }
      </style>
    </head>
    <body>
      <section>
        <header>
          <h1>Getting started with AppMap</h1>
        </header>
        <main>
          <article>
            <h2>Select a suitable project</h2>
            ${
              rows.length > 0
                ? `
                  <p class="body-text">To make sure that your projects are suitable for mapping, we make a couple of quick
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
                `
                : ''
            }
          </article>
          <article class="explain good ok">
          <br/>
            <h2>Install AppMap agent</h2>
            <p class="body-text">AppMap agent records executing code. It creates JSON files as you execute test cases, run sample programs, or perform interactive sessions with your app. This script will guide you through the installation process. Run it in the project's environment so it can correctly detect runtimes and libraries.</p>
            <p class="explain ok note body-text">It appears this project might not be a good choice for your first AppMap.
            We recommend you pick another project; proceed at your own risk.</p>
            <p class="body-text">If you do not have Node.js installed, or would prefer manual installion of the AppMap agent visit our
            <a id="docref-step2" href="https://appland.com/docs/quickstart/vscode/step-2">installation documentation.</a></p>
            <p class="command"><code>
              npx @appland/appmap install <span id="directory"></span>
            </code></p>
            <br/>
            <h2>Record AppMaps</h2>
            <p>To record AppMaps from a running application or from integration tests <a id="docref-step3" href="https://appland.com/docs/quickstart/vscode/step-3">follow these instructions.</a> </p>
          </article>
          <article class="explain bad">
            <p>For your first AppMap, we recommend a project that:</p>
            <ul>
              <li>is a web application or a web service</li>
              <li>is written in Ruby (Rails) or Java (Spring)</li>
              <li>has a reasonably comprehensive integration test suite</li>
            </ul>
            <p><b>Please open a project meeting these recommendations to proceed.</b></p>
            <!-- let's do this later
            <p>Prefer an example? Try this, that or these instead.#TODO</p> 
            -->
          </article>
        </main>
      </section>
      <script nonce="${nonce}">
      (function() {
        const vscode = acquireVsCodeApi();
        var currentProject;

        function explain(state) {
          if (!state) state = 'bad';
          for (const ex of document.querySelectorAll('.explain')) {
            ex.style.display = 'none';
          }
          for (const ex of document.querySelectorAll('.explain.' + state)) {
            ex.style.display = 'block';
          }
        }

        // Quote path for the command line
        function quote(path) {
          // Don't try to be too smart, shell quoting is an ugly can of worms.
          // Just quote spaces if needed; this is pretty common on some platforms.
          // If the user has funnier characters in paths, they should be smart
          // enough to deal with them.
          if (path.includes(' ')) return '"' + path + '"';
          return path;
        }

        function select(target) {
          for (const tr of document.querySelectorAll('tbody tr')) {
            tr.classList.remove('selected');
          }
          if (target) {
            target.classList.add('selected');
            const d = currentProject = target.dataset;
            const path = decodeURI(d.path);
            explain(d.score);
            document.querySelector('#directory').innerText = quote(path);
            document.querySelector('#docref-step2').href = 'https://appland.com/docs/quickstart/vscode/' + d.lang + '-step-2.html';
            document.querySelector('#docref-step3').href = 'https://appland.com/docs/quickstart/vscode/' + d.lang + '-step-3.html';
          } else {
            explain('bad');
          }
        }

        for (const tr of document.querySelectorAll('tbody tr')) {
          tr.addEventListener('click', (e) => select(e.target.closest('tr')));
        }

        select(document.querySelector('tbody tr'));

        function sendCopyEvent() {
          vscode.postMessage({msg: 'copy', root: currentProject.path});
        }

        for (const cmd of document.querySelectorAll('.command')) {
          const button = document.createElement('button');
          button.innerText = '⧉';
          button.title = 'Copy to clipboard';
          cmd.appendChild(button);
          cmd.addEventListener('copy', sendCopyEvent);
          button.addEventListener('click', (e) => {
            sendCopyEvent();
            const btn = e.target;
            navigator.clipboard.writeText(btn.closest('.command').firstChild.innerText);
            btn.innerText = "Copied";
            setTimeout(() => btn.innerText = '⧉', 1000);
          });
        }
      })();
      </script>
    </body>
  `;
}

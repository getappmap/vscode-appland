import * as vscode from 'vscode';
import { analyze as analyzeProject, Tip } from './analyzers';

const COLUMN = vscode.ViewColumn.One;

const panels = new Map<vscode.WorkspaceFolder, vscode.WebviewPanel>();

export default async function openProjectOverview(): Promise<void> {
  const window = vscode.window;

  const folder =
    vscode.workspace.workspaceFolders?.length == 1
      ? vscode.workspace.workspaceFolders[0]
      : await window.showWorkspaceFolderPick();

  if (!folder) return;

  if (panels.has(folder)) {
    panels.get(folder)?.reveal(COLUMN);
    return;
  }

  const panel = window.createWebviewPanel('overview', `AppMap – ${folder.name} overview`, COLUMN);
  panels.set(folder, panel);
  panel.onDidDispose(() => panels.delete(folder));

  panel.webview.html = await analyze(folder);
}

function formatTips(tips: Tip[]) {
  const lis = ''.concat(...tips.map(({ score, text }) => `<li class="${score}">${text}</li>`));
  return `<ul>${lis}</ul>`;
}

function formatResult(scoreNum: number) {
  const score = ['bad', 'bad', 'ok', 'good', 'good'][scoreNum];
  const text = {
    // TODO: add links
    bad: `Unfortunately AppMap probably won't work very well here; unless you know what you're doing, try with a different project.
      (Let us know if you want us to consider supporting projects like this!)`,
    ok: `This project is missing some features that would make it more suited for using with AppMap.
      Try loading a different project or consult the documentation if you want to try anyway.`,
    good: `This project looks like a great one to start your AppMapping adventure!`,
  }[score];
  return `<p class="result ${score}">${text}</p>`;
}

function formatModules(modules: string[]) {
  const lis = ''.concat(...modules.map((module) => `<li>${module}</li>`));
  return `<ul>${lis}</ul>`;
}

async function analyze(folder: vscode.WorkspaceFolder): Promise<string> {
  const { tips, modules, score } = await analyzeProject(folder);

  let doc = `
    <head>
      <style>
        header {
          max-width: 950px;
          font-size: larger;
        }
        article {
          display: flex;
          flex-direction: row;
        }
        section {
          max-width: 400px;
          border-radius: 10px;
          padding: 2em;
          background: black;
          margin: 2ex;
        }
        h2 {
          margin-top: 0px;
        }
        ul {
          padding-left: 1ex;
        }
        .overview li {
          margin: 0.5ex;
        }
        li.good {
          list-style: "✓";
          padding-inline-start: 1ex;
        }
        li.good::marker {
          color: green;
        }
        li.bad {
          list-style: "×";
          padding-inline-start: 1ex;
        }
        li.bad::marker {
          color: red;
        }
      </style>
    <body>
    <header>
      <h1>Quickstart: ${folder.name}</h1>
      <p>
        AppMap watches your code as it executes and generates traces you can
        examine visually to understand exactly how it works.
      </p>
      <p>
        To do that, you first need to hook a special AppMap agent in your code
        and then run it normally, executing test cases or recording a live
        interactive session of a web service.
      </p>
      <p>
        Not all projects are equally suitable for mapping, especially if it's your
        first time using AppMap. For this reason, we make a couple of checks to help
        you find a suitable introductory projects while still working with the code
        you're familiar with.
      </p>
    </header>
    <article>
    <section id="overview">
      <h2>Project overview</h2>
      <p>We've quickly examined your project and here's what we found out:</p>
      ${formatTips(tips)}
      ${formatResult(score)}
    </section>
  `;

  if (modules.length > 0) {
    doc += `
      <section id="modules">
      <h2>Modules</h2>
      <p>
        Here is the list of modules we found in your project.
        Using AppMap, you can see exactly how they work and interact!
      </p>
      ${formatModules(modules)}
      </section>
    `;
  }

  doc += '</article></body>';

  return doc;
}

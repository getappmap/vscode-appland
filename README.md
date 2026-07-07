[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

## Runtime-aware AI starts here

**Live code behavior, for your eyes and your AI tools, in Visual Studio Code.**

AppMap records how your application actually runs, with zero code changes. Every run becomes
interactive sequence diagrams, dependency maps, flame graphs, and trace views. The same runtime data
is available to any AI coding agent through the Model Context Protocol (MCP). GitHub Copilot,
Claude, Cursor, and any other MCP-capable agent can query real execution traces instead of guessing
from static code.

People see the map. Agents query the trace. One run, same ground truth.

## Why developers use it

- **A visual check on your AI's work.** On complex changes the diff outgrows what anyone can hold in
  their head. AppMap shows what the change actually did at runtime, so your approval rests on
  evidence, not on the AI's own explanation.
- **Debug in one query, not fifteen greps.** The request path, the SQL, and the exception are one
  trace away, for you and your agent.
- **Give your agent ground truth.** Answers from real execution over MCP, not guesses from static
  code.

## Works with any AI coding agent via MCP

AppMap includes an MCP server that exposes your recorded runtime data as read-only query tools. Any
MCP-capable coding agent can connect and ask how your application actually ran. Which endpoints are
slow. Where time is spent. What SQL was issued. What exceptions occurred. How a single request
executed end to end.

The extension keeps the query index up to date automatically as you record. Point your agent at the
server and start asking questions.

Agents can rank function and SQL hotspots, inspect call trees with captured parameters and return
values, find related recordings, and compare per-route latency between git branches.

Get started:

- [Configure the AppMap MCP server for any AI coding agent](https://appmap.io/docs/reference/appmap-mcp.html)
- [AppMap for Visual Studio Code reference](https://appmap.io/docs/reference/vscode.html)
- [Record AppMap Data](https://appmap.io/docs/get-started-with-appmap/making-appmap-data.html)

## Ways to use AppMap with your AI

- **Explain unfamiliar code.** Ask your agent how a feature works. It answers from recorded
  requests, SQL queries, and call trees.
- **Diagnose bugs.** A call tree query returns the executed frames for the flow under investigation,
  with captured parameters and return values.
- **Compare before and after.** Record the same flows on your base branch and your PR branch;
  sequence diagram diffs and compare reports show extra calls, changed SQL, and new downstream
  dependencies.
- **Scan for behavioral defects.** The built-in code scanners check recorded behavior for structural
  code quality defects, as distinct from static defects: N+1 queries, missing authentication,
  secrets in logs, slow queries. Findings appear in the editor.
- **Generate OpenAPI definitions** from observed HTTP traffic.

### The cost, measured

A controlled AppMap study (June 2026) compared trace-augmented and static agents on the same bugs
and the same models. The trace-augmented agent held 100% diagnostic accuracy as the tool-call budget
tightened to three calls; the static agent fell from 91% to 28%. One call tree query returned the
frames that the static agent reconstructed with about fifteen file-reading calls. A compact model
paired with trace data reached 88% verified fixes at $0.57 per fix; a frontier model without traces
reached 95% at $1.16. Recording a trace consumes no model tokens; the running application produces
it.

## See what your code actually does

![AppMap diagrams of a recorded test run in Visual Studio Code](https://github.com/getappmap/vscode-appland/blob/master/images/walkthrough/record-appmaps.png?raw=true)

- **Sequence diagrams** show the full request path, from HTTP to database, from one recording.
- **Dependency maps** reveal the running architecture: services, code, SQL, and how they connect.
- **Flame graphs and trace views** pinpoint performance bottlenecks and logic errors.
- **Zero effort capture.** AppMap records code execution, data flow, HTTP, SQL, and exceptions
  automatically as your tests or your app run. No code changes.

## What AppMap does

- Captures real-time snapshots of code execution, data flow, and behavior with zero effort and no
  code changes.
- Renders that behavior as interactive diagrams people can inspect in the editor.
- Feeds the same runtime context to AI assistants over MCP: GitHub Copilot, Anthropic Claude,
  Cursor, Google Gemini, and your own local LLMs.
- Grounds explanations, reviews, and fixes in what your application just did, not in guesses from
  static code.

## Get started

1. **Install
   [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from
   within the code editor or from the marketplace.
2. **Sign in with an email address, or with GitHub or GitLab.** Guided setup configures the
   recording agent for your project (Java, Python, Ruby, Node.js).
3. **Run your tests or exercise your app.** AppMap Data is recorded automatically, diagrams appear
   in the editor, and the query index stays fresh for your AI agent.
4. **Connect your agent** using the
   [MCP configuration guide](https://appmap.io/docs/reference/appmap-mcp.html).

## Documentation

AppMap is open source and built for enterprise environments: recordings and analysis stay local, and
the data spec is public. For detailed information
[visit our documentation](https://appmap.io/docs/appmap-docs.html).

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE) |
[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

To learn more about AppMap security, see the [security disclosure](https://appmap.io/security).

This extension is for individual developers working in the code editor. Check out the
[pricing page](https://appmap.io/pricing).

[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

## Runtime-aware AI starts here

**Live code behavior, for your eyes and your AI tools, in Visual Studio Code.**

AppMap records how your application actually runs, with zero code changes. It turns every run into
interactive sequence diagrams, dependency maps, flame graphs, and trace views you can read, and
makes the same runtime data available to any AI coding agent through the Model Context Protocol
(MCP). GitHub Copilot, Claude, Cursor, and any other MCP-capable agent can query real execution
traces instead of guessing from static code.

People see the map. Agents query the trace. One run, same ground truth.

![AppMap diagrams of a recorded test run in Visual Studio Code](https://github.com/getappmap/vscode-appland/blob/master/images/walkthrough/record-appmaps.png?raw=true)

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

## See what your code actually does

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

AppMap is open source and built for enterprise environments: recordings and analysis stay local,
and the data spec is public. For detailed information
[visit our documentation](https://appmap.io/docs/appmap-docs.html).

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE) |
[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

To learn more about AppMap security, see the [security disclosure](https://appmap.io/security).

AppMap is free for every developer and for organizations under 250 employees. Larger organizations
standardizing on AppMap are supported with a [support contract](https://appmap.io/pricing).

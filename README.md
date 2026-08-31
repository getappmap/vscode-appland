[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

> ### Enterprise users
>
> If your company installs AppMap for you, some settings are already set by an administrator. Before
> you install AppMap or change a setting, ask your AppMap administrator, or read your company's own
> setup documentation, for example in Confluence.

### Runtime evidence for AI-assisted development

#### **See how every change behaves before it merges, in Visual Studio Code**

AI tools generate code changes faster than anyone can read them. Reviewing an AI-generated change
today means reading a diff and guessing how it will behave. The diff shows what the code says. It
cannot show what the code does when it runs.

AppMap closes that gap. It records your application while it runs and turns the recording into two
things: pictures of behavior for you, and behavior data for your AI, over MCP. You understand the
code you are shipping, and your agent works from what the code did, instead of a guess.

![How AppMap works with your coding agent](https://github.com/getappmap/vscode-appland/blob/master/images/appmap-mcp-flow.png?raw=true)

## Key Benefits

### Understand AI-generated code before you ship it

An AI assistant can change hundreds of lines in one pull request. Reading all of it, and holding it
in your head, is the hardest part of working with AI. AppMap shows you the behavior of the change
as diagrams: which functions ran, which SQL queries were made, which HTTP requests were handled,
and where exceptions came from. You check what the change does, and you make sure it does what you
expect.

### Pictures of behavior for you

A new SQL query, a changed call path, or a slow spot is hard to find in a diff and easy to see in a
picture. Sequence diagrams, dependency maps, flame graphs, and trace views show you what your code
did when it ran.

![Dependency map of a running application: services, code, and SQL, and how they connect](https://github.com/getappmap/vscode-appland/blob/master/images/dependency-map.webp?raw=true)

### Behavior data for your AI

Your coding agent reads the same recordings over MCP. When it debugs, reviews, or explains your
code, it works from recorded behavior. AppMap works with Claude Code, Cursor, GitHub Copilot,
Windsurf, and any MCP-capable coding agent. Navie chat is still available inside the editor.

### The extension keeps your runtime data fresh

Runtime data is only useful when it is current, and nobody wants to maintain it by hand. That is
the extension's job. It installs the AppMap command-line tools and keeps them updated. It watches
your project and indexes every new recording, so the MCP server always has fresh data to serve.
The data stays on your machine, as files in your project.

You can work this way and never open an AppMap panel. Record by running your tests, then ask
questions from your chat. Many people use AppMap entirely through their coding agent, and the
extension keeps the data fresh underneath.

### Review code changes in a new way

Ask your coding agent to review a change using AppMap recordings, not just the diff. The agent
reads what the code says and what the code did, and it can answer questions the diff alone cannot:

- Is the changed code covered by runtime traces?
- Does the change cover every scenario of the bug or feature, in the right place?
- Does it touch things outside the area it was meant to change?
- Does it change the application's security controls?
- Does it add a known performance problem, such as an N+1 query?

Here is a real example, anonymized. A code change added a timeout to each of two AI backend calls.
Every test passed, because each call was correct on its own. The recorded trace showed that the
fallback call got a second, fresh clock, so the worst-case user wait doubled. No unit test could
fail on this. The defect lived in the relationship between two calls, and the trace was the only
artifact that looked there.

![A real finding, re-created and anonymized: a nightly trace comparison flagged one changed baseline after a change that passed every test](https://github.com/getappmap/vscode-appland/blob/master/images/drift-watch-finding.png?raw=true)

*A real finding, re-created and anonymized. Every test passed. The trace comparison caught the
doubled timeout.*

If a change has no runtime coverage, the review says so, and the fix is direct: add a test that
runs the changed code. The more of your app you record, the more the review can check. The review
runs wherever your agent runs, on your machine, and teams can centralize the same review later.

### Nothing leaves your machine

Recording and the MCP server both run in your development environment. AppMap data is saved as
files in your project.

## What AppMap Does

- Records code execution, data flow, and behavior while your app runs. You do not change any code.

- Serves that data to coding agents over MCP.

- Draws diagrams you can read: sequence diagram, dependency map, flame graph, and trace view.

- Checks recordings against heuristic rules for known problems, such as N+1 queries.

## Using AppMap with your coding agent

The AppMap MCP server gives your agent 13 read-only query tools. They include `get_call_tree`,
`find_calls`, `find_queries`, and `find_requests`.

To set it up in Claude Code, run `claude mcp add appmap -- appmap query mcp`. For another agent, add
`"appmap": { "command": "appmap", "args": ["query", "mcp"] }` to its MCP servers configuration.

You do not have to open the AppMap panels to get this. Installing the extension installs the AppMap
command-line tools, keeps them updated, and keeps your recordings indexed while you work. Your
agent can query the data even if you never leave the chat.

AppMap also publishes [skills for coding agents](https://github.com/getappmap/skills), including a
skill that sets up AppMap on a repository from scratch.

For more detail, see the
[AppMap MCP server reference](https://appmap.io/docs/reference/appmap-mcp.html).

## Navie Chat

Navie still works inside the editor. It answers questions using the same AppMap data, without
leaving your editor. The `@explain`, `@plan`, `@generate`, `@test`, `@diagram`, `@search`,
`@review`, and `@help` commands work as before. See the
[Navie command reference](https://appmap.io/docs/using-navie-ai/navie-commands.html).

## Get started

1. **Install
   [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from
   within the code editor or from the marketplace.

2. **Sign in with an email address, or with GitHub or GitLab.**

3. **Record your app** by
   [making AppMap data for your project](https://appmap.io/docs/get-started-with-appmap/making-appmap-data.html),
   either by running your test cases or by recording a short interaction with your app.

4. **Connect your coding agent.** In Claude Code, run `claude mcp add appmap -- appmap query mcp`.
   For another agent, add `"appmap": { "command": "appmap", "args": ["query", "mcp"] }` to its MCP
   servers configuration. See the
   [setup reference](https://appmap.io/docs/reference/appmap-mcp.html).

## Using AppMap Data

AppMap diagrams include:

- **Sequence Diagram** to follow the runtime flow of calls made by your application.
- **Dependency Map** to see which libraries and frameworks were used at runtime.
- **Flame Graph** to spot performance issues and bottlenecks.
- **Trace View** to perform detailed function call and data flow tracing.

![Sequence diagram of a recorded HTTP request, including its SQL queries](https://github.com/getappmap/vscode-appland/blob/master/images/sequence.jpg?raw=true)

![Function calls with parameters and return values](https://github.com/getappmap/vscode-appland/blob/master/images/call-tree.webp?raw=true)

![SQL queries with bindings and source](https://github.com/getappmap/vscode-appland/blob/master/images/queries.jpg?raw=true)

## Requirements

AppMap records Node.js, Java and Kotlin, Ruby, and Python, with .NET, React, Swift, and Go in
alpha. It works particularly well with web application frameworks such as Nest.js, Next.js,
Spring, Ruby on Rails, Django, and Flask.

Looking for support for your language or stack? New languages appear first on
[our GitHub](https://github.com/getappmap).

Refer to the [documentation](https://appmap.io/docs/appmap-docs.html) for the latest information on
supported languages, frameworks, and versions.

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE) |
[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

To learn more about the security of AppMap, and how your data is used, see the AppMap
[security disclosure](https://appmap.io/security).

There is [no fee](https://appmap.io/pricing) for personal use of AppMap. Pricing for premium
features and integrations is listed on [AppMap's Pricing Page](https://appmap.io/pricing).

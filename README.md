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

AI tools generate code changes faster than anyone can read them. A diff shows what the code says, not which calls, queries, and side effects occurred when it ran. AppMap records your application while it runs and turns the recording into diagrams for you and data your coding agent queries over MCP. The review is based on what the code did.

<img src="https://github.com/getappmap/vscode-appland/blob/master/images/gold-traces-workflow.png?raw=true" alt="Coding agents work the branches. The Gold Traces live on main. Every change is compared against the baseline, and the baseline advances after the merge." width="420">

## Key benefits of this extension

### The extension stores and configures AppMap on your machine

The extension installs the AppMap command-line tools, keeps them updated, and stores and indexes every recording locally, so the MCP server always has fresh data to serve. You can use AppMap entirely through your coding agent: record by running your tests, then ask questions from your chat. The AppMap skills for coding agents configure your repository:

- [`appmap-record`](https://github.com/getappmap/skills/tree/main/appmap-record) turns on recording.
- [`appmap-label`](https://github.com/getappmap/skills/tree/main/appmap-label) tunes what gets recorded.
- [`appmap-gold-traces`](https://github.com/getappmap/skills/tree/main/appmap-gold-traces) keeps the Gold Trace set.
- [`appmap-review`](https://github.com/getappmap/skills/tree/main/appmap-review) runs the behavioral review.

### Store behavior with the code

Gold Traces are the runtime behaviors a team has approved, committed in the `gold_traces/` directory alongside the code. A developer or coding agent opening the repository starts with the same Gold Traces: behavior that cannot be inferred from the source, current at every commit, and the baseline every change is verified against. Every trace is sanitized before it is committed. See [Gold Traces on appmap.io](https://appmap.io/architecture).

![Record locally, commit the key traces, agents query over MCP, compare at review, and the baseline advances after the merge](https://github.com/getappmap/vscode-appland/blob/master/images/gold-traces-lifecycle.png?raw=true)

Found a `gold_traces/` directory in a repository? Someone on the team keeps runtime behavior versioned with the code. This extension reads those traces as diagrams, and your coding agent can query them over MCP.

## The value of AppMap data to AI coding

### Understand AI-generated code before you ship it

An AI assistant can change hundreds of lines in one pull request. AppMap shows you the behavior of the change as diagrams: which functions ran, which SQL queries were made, which HTTP requests were handled, and where exceptions came from. Your coding agent reads the same evidence over MCP. It often has no application environment, database, or credentials, so it works from the recorded behavior, which it can query but does not create. AppMap works with Claude Code, Cursor, GitHub Copilot, Windsurf, and any MCP-capable coding agent.

![Dependency map of a running application: services, code, and SQL, and how they connect](https://github.com/getappmap/vscode-appland/blob/master/images/dependency-map.webp?raw=true)

### Review code changes in a new way

Ask your coding agent for a behavioral review: a review of the change that uses AppMap recordings, not just the diff. It compares the change against the recorded baseline and reports what the change did when it ran: API changes and drift, SQL impact, security-affecting paths, unexpected side effects, and performance changes.

![A behavioral review of the working tree against the baseline: one medium finding, fixed during review, one trace changed](https://github.com/getappmap/vscode-appland/blob/master/images/behavioral-review-card.png?raw=true)

*A real review of one change, from one of our own production applications. The fix was applied and re-recorded during the review.*

### Nothing leaves your machine, or your repository

AppMap has no cloud data plane. Recording and the MCP server run in your development environment, and AppMap data is saved as files in your project. Gold Traces go only where your repository goes. Usage telemetry is separate and can be routed to your own systems or disabled. See the [security disclosure](https://appmap.io/security).

## Set up your coding agent

The AppMap MCP server gives your agent 13 read-only query tools, including `get_call_tree`, `find_calls`, `find_queries`, and `find_requests`. In Claude Code, run `claude mcp add appmap -- appmap query mcp`. For another agent, add `"appmap": { "command": "appmap", "args": ["query", "mcp"] }` to its MCP servers configuration. See the [AppMap MCP server reference](https://appmap.io/docs/reference/appmap-mcp.html). AppMap also includes its own chat, Navie, which answers questions from the same evidence without leaving the editor ([Navie command reference](https://appmap.io/docs/using-navie-ai/navie-commands.html)).

## Get started

1. **Install
   [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from
   within the code editor or from the marketplace.

2. **Sign in with an email address, or with GitHub or GitLab.**

3. **Record your app** by
   [making AppMap data for your project](https://appmap.io/docs/get-started-with-appmap/making-appmap-data.html),
   either by running your test cases or by recording a short interaction with your app.

4. **Connect your coding agent** using the setup above.

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

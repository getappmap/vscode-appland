[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

AppMap is a runtime code analysis and observability-enhanced AI coding assistant for senior
developers. It knows how your code works at runtime to help you deliver high-quality software
features faster.

AppMap will automatically generate code-linked runtime data about your Java, Python, Node.js, or
Ruby application without needing to add custom instrumentation or OTEL spans.

AppMap’s AI coding assistant, Navie, will analyze and explain your application like a senior
software developer or software architect. Navie can co-develop complex new features and
functionality with you.

Navie AI knows about your code’s APIs, database queries, web service request flows, application
security architecture, and more—and how they all fit together and interact.

AppMap and Navie will help you:

- Understand and reverse engineer complex codebases.
- Troubleshoot and debug code.
- Design and refactor features that span many internal files, APIs, services, and databases.
- Find and fix performance issues like N+1 queries.
- Detect and fix insecure code such as missing or faulty permissions, data leakage, mishandling of
  secrets, etc.

#### How it works:

You’ll start by configuring the AppMap language library for your project. Then you’ll make a
recording of the code you are working on by running your application in your development environment
with AppMap enabled. AppMap data files will automatically be generated and stored on your local file
system.

Once you’ve recorded AppMap data, you are ready to open Navie and start conversations with the AI.

#### Navie can:

- Explain code or application behavior, including queries, web service requests, and more.
- Make code suggestions like a senior software developer.
- Find the potential performance problems or dynamic security flaws in existing or newly written
  code.
- Help you document application behavior changes for a PR.

Navie’s code recommendations span files, functions, APIs, databases, and more.

Naive answers are backed up by references to AppMap data. Naive presents this data alongside the
chat discussion, and you can also open and use AppMap diagrams independently of Navie. AppMap
diagrams include:

- Sequence diagrams of code behavior.
- Flame graphs for performance analysis.
- Dependency graphs of runtime interactions.
- Trace views of detailed code flows.
- Analysis of runtime code defects (Findings).

[![AppMap video](https://appmap.io/assets/img/yt-play.png)](https://www.youtube.com/watch?v=fHiTHZhtFZM)

---

## Requirements

Supported programming languages: Node.js, Java (+ Kotlin), Ruby, and Python.

AppMap works particularly well with web application frameworks such as: Nest.js, Next.js, Spring,
Ruby on Rails, Django, and Flask.

To start making AppMaps, you’ll need to install and configure the AppMap client agent for your
project using the AppMap installer.

Then, you’ll make AppMaps by running your app—either by
[running test cases](https://appmap.io/docs/recording-methods.html#recording-test-cases), or by
[recording a short interaction with your app](https://appmap.io/docs/recording-methods.html#remote-recording).

## AppMap Features

### AppMap Navie AI

AppMap Navie AI is a chat interface that provides insight about your project. Navie uses your
AppMaps and code snippets to provide you with helpful explanations about your software and specific
code suggestions that are more relevant to your codebase than typical generative AI coding
assistants.

When you ask Navie a question, it will retrieve and display relevant AppMaps of your code so you can
see how the AI arrived at the code suggestions.

[![AppMap Navie AI](https://appmap.io/assets/img/navie-answer-example-thumb.jpeg 'Appmap Navie AI')](https://appmap.io/assets/img/navie-answer-example.png)

### Runtime behavior visualization

AppMap for Visual Studio Code includes a variety of interactive diagrams to help you understand your
application's runtime behavior.

[![AppMaps in the Sidebar](https://appmap.io/assets/img/appmap-tree-in-sidebar-thumb.jpeg 'AppMaps in the Sidebar')](https://appmap.io/assets/img/appmap-tree-in-sidebar.png)

**Sequence Diagrams** to follow the runtime flow of calls made by your application:

[![Sequence Diagrams](https://appmap.io/assets/img/ide-sequence-diag-thumb.jpeg 'Sequence Diagrams')](https://appmap.io/assets/img/ide-sequence-diag.png)

**Dependency Maps** to see which libraries and frameworks were used at runtime:

[![Dependency Maps](https://appmap.io/assets/img/ide-dependency-map-thumb.jpeg 'Dependency Maps')](https://appmap.io/assets/img/ide-dependency-map.png)

**Flame Graphs** to spot performance issues and bottlenecks:

[![Flame Graphs](https://appmap.io/assets/img/ide-vscode-flame-graph-thumb.jpeg 'Flame Graphs')](https://appmap.io/assets/img/ide-vscode-flame-graph.png)

**Trace Views** to perform detailed function call and data flow tracing:

[![Trace Views](https://appmap.io/assets/img/ide-trace-view-thumb.jpeg 'Trace Views')](https://appmap.io/assets/img/ide-trace-view.png)

### AppMap Integration with Confluence

Interactive AppMap visualizations are exportable as fully interactive AppMap diagrams to Confluence
from your code editor. Any filters applied to the AppMap visualization will be preserved in the
interactive Confluence image. AppMap for Confluence works is a Confluence Forge application with
Confluence Cloud. Learn more about
[AppMap’s Atlassian integration](https://marketplace.atlassian.com/apps/1233075/appmap-for-confluence?hosting=cloud&tab=overview).

### AppMap in CI

The same features available in this plugin are
[also available for CI systems](https://appmap.io/docs/analysis/in-ci.html). AppMap analyzes your
applications after your CI tests run, and produces a report in GitHub containing behavior changes,
failed test analysis, runtime API differences, performance issues, and dynamic security flaws:

[![Summary report](https://appmap.io/assets/img/summary-report-thumb.jpeg 'Summary Report')](https://appmap.io/assets/img/summary-report.png)

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE)

[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

AppMap graphs, runtime recordings, diagrams, and data are created and stored locally on your Machine
in a directory that you choose.

AppMap for Visual Studio Code does not require any permissions to your web hosted code repo in order
to run.

Using AppMap’s integrations with Confluence, GitHub Actions, and Chat AI integration features
requires access to code snippets and AppMap data either within your own accounts or via AppMap’s
accounts; see the AppMap [security disclosure](https://appmap.io/security) for detailed information
about each integration.

Sign in via GitHub or GitLab is required only to obtain a license key to start using AppMap in your
code editor, or you can request a trial license on [getappmap.com](https://getappmap.com).

There is [no fee](https://appmap.io/pricing) for personal use of AppMap, pricing for premium
features and integrations are listed on [AppMap’s Pricing Page](https://appmap.io/pricing).

## Getting started with AppMap

[Documentation](https://appmap.io/docs/appmap-overview.html) for guides and videos.

[GitHub](https://github.com/getappmap) for our repository and open source projects.

[Blog](https://appmap.io/blog/) for user stories and product announcements.

[Slack](https://appmap.io/slack) or email for support and community conversations: support@appmap.io

Follow us on [Twitter @GetAppMap](https://twitter.com/getappmap).

Watch our demos on [YouTube](https://www.youtube.com/channel/UCxVv4gVnr2Uf2PSzoELZUcg).

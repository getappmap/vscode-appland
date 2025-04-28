[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

### Runtime‑aware AI starts here

#### **Live code behavior, surfaced to your AI tools in Visual Studio Code**

AppMap Navie for Visual Studio Code brings the power of real-time execution data and AI-driven insights right
to your code editor. No more guessing what your code does under the hood. Navie watches your
application run and uses that live context to provide **smarter suggestions**, **faster debugging**,
and **runtime-aware code reviews**.

## Key Benefits

### Smarter AI assistance

Navie combines static analysis with live AppMap traces, so you can ask things like _"What just
happened?"_ and get answers based on the actual runtime flow, HTTP calls, SQL queries, exceptions,
I/O, and more.

### Faster debugging & fewer defects

Pinpoint performance bottlenecks and logic errors through automatically generated sequence diagrams,
flame graphs, dependency maps, and trace views.

### Context‑aware code reviews

From security checks to maintainability recommendations, Navie’s `@review` mode analyzes your
current branch changes against your base branch with runtime insights.

### Zero fine‑tuning required

Works out-of-the-box with enterprise‑ready LLMs—simply plug in your API key or let Navie default to
GitHub Copilot or AppMap’s built‑in endpoint.

![implement-redis](https://github.com/getappmap/vscode-appland/assets/511733/46243179-893e-474c-925a-91b385c3468d)

## What AppMap Does

- Captures real‑time snapshots of code execution, data flow, and behavior with zero effort and no
  code changes.

- Feeds runtime context to AI assistants like Navie, GitHub Copilot, Anthropic Claude, Google
  Gemini, OpenAI, and your own local LLMs.

- Delivers deep code explanations, diagrams, implementation plans, tests, and patch-ready code
  snippets, all grounded in what your application just did.

## Get started

1. **Install
   [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from
   within the code editor or from the marketplace.

2. **Sign in with an email address, or with GitHub or GitLab** and Navie will be available in
   `@explain` mode. This enables Navie to respond to general coding and development questions and
   answer questions about using AppMap data.

3. **Ask Navie** for guidance recording AppMap data specific to interactions or code scenarios
   you're interested in analyzing.

## Chat Modes

Navie provides different modes of interaction for an efficient workflow and optimized results from
AI-assisted coding.

![Chat Modes](https://github.com/getappmap/vscode-appland/blob/master/images/command-palette-menu.jpg?raw=true)

- **`@explain` (default)**: Navie makes context-aware suggestions, provides specific solutions, and
  reasons about the larger context of the specific code being worked on.

- **`@plan`**: Navie focuses the AI response on building a detailed implementation plan for the
  relevant query. This will focus Navie on only understanding the problem and the application to
  generate a step-by-step plan.

- **`@generate`**: Activate code generation mode by beginning any question with the prefix
  "@generate". In this mode Navie's response are optimized to include code snippets you can use
  directly in the files are working on.

- **`@test`**: Navie's responses are optimized for test case creation, such as unit testing or
  integration testing. This prefix will understand how your tests are currently written and provide
  updated tests based on features or code that is provided.

- **`@diagram`**: Navie will create and render a Mermaid compatible diagram within the Navie chat
  window. You can open this diagram in the [Mermaid Live Editor](https://mermaid.live), copy the
  Mermaid Definitions to your clipboard, save to disk, or expand a full window view.

- **`@search`**: By leveraging smart search capabilities, this command will locate specific code
  elements, relevant modules, or examples.

- **`@review`**: This command will review the code changes on your current branch and provide
  actionable insights on various aspects of code, ensuring alignment with best practices in areas
  such as code quality, security, and maintainability.

- **`@help`**: Activate help mode by beginning any question with the prefix "@help". This mode
  offers assistance with using AppMap, including guidance for generating and leveraging AppMap data
  effectively.

## Pinned Context

Pin specific data files to your conversation with Navie to include data sources you know are
relevant to the issue. This includes pinning the text of the issue itself, and Navie responses.

![Pinned Context](https://github.com/getappmap/vscode-appland/blob/master/images/pinned-context.jpg?raw=true)

## Making AppMap Data

You can improve the quality and accuracy of Navie AI by
[making AppMap Data for your project](https://appmap.io/docs/get-started-with-appmap/making-appmap-data.html).

#### Documentation

Navie is an open-source extension built with enterprise needs in mind, delivering a flexible LLM
backend that allows organizations to fine-tune their AI solutions at scale. With advanced features
like customizable token limits, robust automation tools, and seamless integration with existing
workflows.

For detailed information [visit our documentation](https://appmap.io/docs/appmap-docs.html).

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE) |
[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

To learn more about security of AppMap, or the use of data with AI when using Navie, see the AppMap
[security disclosure](https://appmap.io/security) for more detailed information and discussion.

There is [no fee](https://appmap.io/pricing) for personal use of AppMap for graphing and limited
Navie use. Pricing for premium features and integrations are listed on
[AppMap’s Pricing Page](https://appmap.io/pricing).

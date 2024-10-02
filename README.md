[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

AppMap is a developer tools platform powered by runtime analysis and AI. It's composed of three components:

* Navie - AI code architect.
* AppMap data - Runtime traces of your application runtime.
* AppMap diagrams - Interactive visualizations of AppMap data.

Navie is the first AI code architect with the context to understand how your app works when it runs, like a principal engineer or software architect. AppMap data provides Navie with accurate information about application behavior, APIs, database queries, and more, providing valuable context so you can ask more challenging questions and get better answers.

![implement-redis](https://github.com/getappmap/vscode-appland/assets/511733/46243179-893e-474c-925a-91b385c3468d)

## Get started
1. **Install [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from within the code editor or from the marketplace.  

2. **Sign in with an email address, or with GitHub or GitLab** and Navie will be available in `@explain` mode. This enables Navie to respond to general coding and development questions and answer questions about using AppMap data.

3. **Ask Navie** for guidance recording AppMap data specific to interactions or code scenarios you're interested in analyzing.
   

## Examples
[Here are some examples](https://appmap.io/product/examples/navie) of Navie making context-aware suggestions, providing tactical solutions, and reasoning about the larger context of the specific code being worked on.

## Chat Modes

Navie provides different modes of interaction to assist you with your code and project. Here's a quick overview:

- **`@explain` (default)**: Navie makes context-aware suggestions, provides specific solutions, and reasons about the larger context of the specific code being worked on.

- **`@plan`**: Navie focuses the AI response on building a detailed implementation plan for the relevant query. This will focus Navie on only understanding the problem and the application to generate a step-by-step plan.

- **`@generate`**: Activate code generation mode by beginning any question with the prefix "@generate". In this mode Navie's response are optimized to include code snippets you can use directly in the files are working on.

- **`@test`**: Navie's responses are optimized for test case creation, such as unit testing or integration testing. This prefix will understand how your tests are currently written and provide updated tests based on features or code that is provided. 

- **`@diagram`**:  Navie will create and render a Mermaid compatible diagram within the Navie chat window. You can open this diagram in the [Mermaid Live Editor](https://mermaid.live), copy the Mermaid Definitions to your clipboard, save to disk, or expand a full window view.

- **`@help`**: Activate help mode by beginning any question with the prefix "@help". This mode offers assistance with using AppMap, including guidance for generating and leveraging AppMap data effectively.

**💡 Ask Navie - Using the lightbulb**: This feature is available in the Code Action menu when you have code selected. Choosing ‘Ask Navie’ from the Code Actions Menu initiates a new Navie chat populated with the snippet of selected code, enabling Navie answers based on that specific code snippet. Similarly, if you select some code in the active code window and open Navie, the selected code will be passed along.

**Ask Navie about a specific AppMap visualization**: You can target your question more specifically to an AppMap, representing a test case, API call, or other interaction by clicking the “Ask Navie” box on any AppMap you open.

## Bring your own key or model for Navie

In order to configure Navie for your own LLM, certain environment variables need to be set for AppMap services. Refer to the [AppMap documentation](https://appmap.io/docs/navie/bring-your-own-model.html) for details on how to do that.

## Creating AppMap Data

Ask Navie to guide you through the process of making AppMap data, or navigate to the Record AppMaps screen in your code editor.

You’ll start by configuring the AppMap language library for your project. Then you’ll make a recording of the code you are working on by running your application in your development environment with AppMap enabled. AppMap data files will automatically be generated and stored on your local file system.

Once you’ve recorded AppMap data, Navie's awareness of your application’s behavior and code will be significantly upgraded.

Using AppMap data Navie can:
* Explain code or application behavior, including queries, web service requests, and more.
* Make code suggestions like a senior software developer.
* Find the potential performance problems or dynamic security flaws in existing or newly written code.
* Help you document application behavior changes for a PR.
* Navie’s code recommendations span multiple files, functions, APIs, databases, and more.

Naive answers are backed up by references to AppMap data. Naive presents this data alongside the chat discussion, and you can also open and use AppMap diagrams independently of Navie.

AppMap diagrams include:

* **Sequence Diagrams** to follow the runtime flow of calls made by your application.
* **Dependency Maps** to see which libraries and frameworks were used at runtime.
* **Flame Graphs** to spot performance issues and bottlenecks.
* **Trace Views** to perform detailed function call and data flow tracing.

![appmap-visualizations-2](https://github.com/getappmap/vscode-appland/assets/1229326/13cb6ecc-8ee6-4d3e-8f26-d7bd2ecd9b22)

#### Requirements for making AppMap data

Supported programming languages: Node.js, Java (+ Kotlin), Ruby, and Python.
AppMap works particularly well with web application frameworks such as: Nest.js, Next.js, Spring, Ruby on Rails, Django, and Flask.

To start making AppMap data, you’ll need to install and configure the AppMap client agent for your project.

Make AppMap data by running your app—either by [running test cases](https://appmap.io/docs/recording-methods.html#recording-test-cases), or by [recording a short interaction with your app](https://appmap.io/docs/recording-methods.html#remote-recording).

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE)  |  [Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

To learn more about security of AppMap, or the use of data with AI when using Navie, see the AppMap [security disclosure](https://appmap.io/security) for more detailed information and discussion.

There is [no fee](https://appmap.io/pricing) for personal use of AppMap for graphing and limited Navie use. Pricing for premium features and integrations are listed on [AppMap’s Pricing Page](https://appmap.io/pricing).

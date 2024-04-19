[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://github.com/getappmap/vscode-appland)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

AppMap is an AI coding assistant that understands how your app works.

AppMap records data about your running application, stores it locally, and uses it to improve the accuracy of generative AI models. AppMap data can also be used to create interactive visualizations of code behavior.

Navie is AppMap’s chat interface. When asked a question, Navie will search through your locally stored AppMap data to identify relevant information and use it to provide truly context-aware answers, specific to your app.  

By default Navie proxies requests to OpenAI. This can be changed to a back end of your choice, or configured to use your own OpenAI account.


### Get started
1. **Install [the AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap)** from within the code editor or from the marketplace.  

2. **Sign in with an email address, or with GitHub or GitLab** and Navie will be available in `@explain` mode. This enables Navie to respond to general coding and development questions and answer questions about using AppMap data.

3. **Ask Navie** for guidance recording AppMap data specific to interactions or code scenarios you're interested in analyzing.

### Examples
Here are some examples of Navie making context-aware suggestions, providing tactical solutions, and reasoning about the larger context of the specific code being worked on.

1. [Find and fix slow API endpoints in a FastAPI app](https://appmap.io/navie/how-to/fix-slow-api-endpoints-in-a-fastapi-app-with-navie/)
2. [Find and fix a database performance issue in Ruby on Rails](https://appmap.io/navie/how-to/find-and-fix-a-database-performance-issue-in-ruby-on-rails/)
3. [Quickly add a new feature to a complex Python app](https://appmap.io/navie/how-to/adding-a-new-feature-to-a-complex-python-application/)
4. [Fixing performance issues with MongoDB in a MERN app](https://appmap.io/navie/how-to/fixing-performance-issues-with-mongodb-in-a-mern-app/)

### Chat Modes

Navie provides different modes of interaction to assist you with your code and project. Here's a quick overview:

- **`@explain` (default)**: Navie makes context-aware suggestions, provides specific solutions, and reasons about the larger context of the specific code being worked on.

- **`@help`**: Activate help mode by beginning any question with the prefix "@help". This mode offers assistance with using AppMap, including guidance for generating and leveraging AppMap data effectively.

- **`@generate`**: Activate code generation mode by beginning any question with the prefix "@generate". In this mode Navie's response are optimized to include code snippets you can use directly in the files are working on.

**💡 Ask Navie - Using the lightbulb -**: This feature is available in the Code Action menu when you have code selected. Choosing ‘Ask Navie’ from the Code Actions Menu initiates a new Navie chat populated with the snippet of selected code, enabling Navie answers based on that specific code snippet.

### Bring your own key or model

In order to configure Navie for your own LLM, certain environment variables need to be set for AppMap services. Refer to the [AppMap documentation](https://appmap.io/docs/navie/bring-your-own-model.html) for details on how to do that.

### Creating and using context sources

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

TODO: GIF of AppMaps

#### Requirements for making AppMap data

Supported programming languages: Node.js, Java (+ Kotlin), Ruby, and Python.
AppMap works particularly well with web application frameworks such as: Nest.js, Next.js, Spring, Ruby on Rails, Django, and Flask.

To start making AppMaps, you’ll need to install and configure the AppMap client agent for your project using the AppMap installer.

Then, you’ll make AppMaps by running your app—either by [running test cases](https://appmap.io/docs/recording-methods.html#recording-test-cases), or by [recording a short interaction with your app](https://appmap.io/docs/recording-methods.html#remote-recording).

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE)  |  [Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

AppMap graphs, runtime recordings, diagrams, and data are created and stored locally on your Machine in a directory that you choose.

AppMap for Visual Studio Code does not require any permissions to your web hosted code repo in order to run.

Using AppMap’s integrations with Confluence, GitHub Actions, and Chat AI integration features requires access to code snippets and AppMap data either within your own accounts or via AppMap’s accounts; see the AppMap [security disclosure](https://appmap.io/security) for detailed information about each integration.

Sign in via GitHub or GitLab is required only to obtain a license key to start using AppMap in your code editor, or you can request a trial license on [getappmap.com](https://getappmap.com).

There is [no fee](https://appmap.io/pricing) for personal use of AppMap, pricing for premium features and integrations are listed on [AppMap’s Pricing Page](https://appmap.io/pricing).

## Getting started with AppMap

[Documentation](https://appmap.io/docs/appmap-overview.html) for guides and videos.

[GitHub](https://github.com/getappmap) for our repository and open source projects.

[Blog](https://appmap.io/blog/) for user stories and product announcements.

[Slack](https://appmap.io/slack) or email for support and community conversations: support@appmap.io

Follow us on [Twitter @GetAppMap](https://twitter.com/getappmap).

Watch our demos on [YouTube](https://www.youtube.com/channel/UCxVv4gVnr2Uf2PSzoELZUcg).

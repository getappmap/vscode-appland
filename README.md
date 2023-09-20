[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![GitHub Stars](https://img.shields.io/github/stars/getappmap/vscode-appland?style=social)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)
[![Slack](https://img.shields.io/badge/Slack-Join%20the%20community-green)](https://appmap.io/slack)

# AppMap for Visual Studio Code

AppMap is a free and open-source runtime code analysis tool.

AppMap records code execution traces, collecting information about how your code works and what it
does. Then it presents this information as interactive diagrams that you can search and navigate. In
the diagrams, you can see exactly how functions, web services, data stores, security, I/O, and
dependent services all work together when application code runs.

[![AppMap video](https://appmap.io/assets/img/yt-play.png)](https://www.youtube.com/watch?v=fHiTHZhtFZM)

---

## Requirements

Supported web applications and API frameworks: Ruby on Rails, Django, Flask, Express, and Spring.

Supported programming languages: Java, Python, Ruby, TypeScript/JavaScript (for Node.js applications
only).

To start making AppMaps, you’ll need to install and configure the AppMap client agent for your
project. Then, you’ll make AppMaps by running your app - either by
[running test cases](https://appmap.io/docs/recording-methods.html#recording-test-cases), or by
[recording a short interaction with your app](https://appmap.io/docs/recording-methods.html#remote-recording).

## AppMap Features

### Runtime behavior visualization

AppMap for Visual Studio Code includes a variety of interactive diagrams to help you understand your
application's runtime behavior.

**Sequence Diagrams** to follow the runtime flow of calls made by your application:

[![Sequence Diagrams](https://appmap.io/assets/img/ide-sequence-diag-thumb.jpeg 'Sequence Diagrams')](https://appmap.io/assets/img/ide-sequence-diag.png)

**Dependency Maps** to see which libraries and frameworks were used at runtime:

[![Dependency Maps](https://appmap.io/assets/img/ide-dependency-map-thumb.jpeg 'Dependency Maps')](https://appmap.io/assets/img/ide-dependency-map.png)

**Flame Graphs** to spot performance issues and bottlenecks:

[![Flame Graphs](https://appmap.io/assets/img/ide-vscode-flame-graph-thumb.jpeg 'Flame Graphs')](https://appmap.io/assets/img/ide-vscode-flame-graph.png)

**Trace Views** to perform detailed function call and data flow tracing:

[![Trace Views](https://appmap.io/assets/img/ide-trace-view-thumb.jpeg 'Trace Views')](https://appmap.io/assets/img/ide-trace-view.png)

### Runtime analysis

After making recordings of how your application behaved at runtime, AppMap analyzes those recordings
to automatically detect performance issues like N+1 queries, and security flaws such as faulty
authentication logic.

### AppMap in CI

The same features available in this plugin are
[also available for CI systems](https://appmap.io/docs/analysis/in-ci.html). AppMap analyses your
applications after your CI tests run, and produces a report in GitHub containing behavior changes,
failed test analysis, runtime API differences, performance issues, and dynamic security flaws:

[![Summary report](https://appmap.io/assets/img/summary-report-thumb.jpeg 'Summary Report')](https://appmap.io/assets/img/summary-report.png)

## Licensing and Security

[Open source MIT license](https://github.com/getappmap/vscode-appland/blob/master/LICENSE)

[Terms and conditions](https://appmap.io/community/terms-and-conditions.html)

**Data usage:** AppMap runtime recordings and diagrams are created and stored locally on your
machine. AppMap for Visual Studio Code does not require any permissions to your web hosted code repo
in order to run. For more information, see the AppMap
[security disclosure](https://appmap.io/security).

Sign-in via GitHub or GitLab is required only to obtain a license key to start using AppMap in your
code editor.

There is [no fee](https://appmap.io/pricing) for personal use of AppMap.

## Getting started with AppMap

[Documentation](https://appmap.io/docs/appmap-overview.html) for guides and videos.

[GitHub](https://github.com/getappmap) for our repository and open source projects.

[Blog](https://appmap.io/blog/) for user stories and product announcements.

[Slack](https://appmap.io/slack) or email for support and community conversations: support@appmap.io

Follow us on [Twitter @GetAppMap](https://twitter.com/getappmap).

Watch our demos on [YouTube](https://www.youtube.com/channel/UCxVv4gVnr2Uf2PSzoELZUcg).

[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap) [![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)  [![GitHub Stars](https://img.shields.io/github/stars/applandinc/vscode-appland?style=social)](https://marketplace.visualstudio.com/items?itemName=appland.appmap) [![Discord](https://img.shields.io/discord/766016904056930325)](https://discord.com/invite/N9VUap6)
# AppMap for Visual Studio Code
AppMap supports **Django**, **Flask**, **Spring**, and **Rails** projects.

AppMap is an open-source software analysis tool for understanding web services and web applications built with **Java**, **Ruby**, or **Python**. To generate AppMaps you will need to install the AppMap agent for your project:

#### Run this command from within the top level directory of your project:
``` bash
npx @appland/appmap install-agent
```
### Spring Project Requirements
For first time usage of AppMap for Java, the best results come with web app/services such as Spring framework or Tomcat apps. AppMap has specific features that work well with these projects - recording web services and SQL. 

| Required Framework version | Required Java version | Required Node.js version* |
| -------------------------- | --------------------- | ------------------------- |
| Spring       v. ???        |       JDK 8+          | Node.js 12+               |


### Django and Flask Project Requirements
AppMap for Python requires either the Django or Flask framework. 

| Required Framework version | Required Python Version | Required Node.js version* |
| -------------------------- | ----------------------- | ------------------------- |
| Django v.3.2.x or 2.2.x  Flask  v.2.0.x    |  >=3.6  | Node.js 12+               |


### Rails Project Requirements
AppMap for Ruby requires Ruby on Rails.

| Required Framework version | Required Ruby Version | Required Node.js version* |
| -------------------------- | --------------------- | ------------------------- |
|   Rails Version 5, 6       |    2.5, 2.6, 2.7      | Node.js 12+               |

 


Navigate your code more efficiently with interactive, accurate software architecture diagrams right in your IDE. 
In two minutes you can go from installing this plugin to exploring maps of your code's architecture. 

![AppMap](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/vscode-sidebyside.png)

Visit [dev.to/appland](https://dev.to/appland) for popular articles about AppMap use cases and tutorials.


## Quickstart
Follow the instructions in the **[AppMap quickstart](https://appland.com/docs/quickstart/)** guide.


## Summary of features
- Interactive Code Analyzer that records and processes dynamic execution traces of running code
- Dependency Map that displays key application components and how they are interrelated during execution 
- Execution Trace diagrams that visualize code and data flows:
  - Web service endpoints
  - Function calls
  - SQL commands
  - REST calls
  - Semantic code labels
- List of SQL queries generated automatically from executed code
- List of Web services generated automatically from executed code
- Direct navigation from diagrams to sources
- Filtering by class, package, function or label


## Resources
- [Documentation](https://appland.com/docs/)
- [AppMap FAQ](https://appland.com/docs/faq.html)
- Join us on [Discord](https://discord.com/invite/N9VUap6) and [GitHub](https://github.com/applandinc/vscode-appland)
- Support email: [support@app.land](mailto:support@app.land)


## About AppMap
See [AppMap overview](https://appland.com/docs/appmap-overview.html) to learn how AppMap works and how it accelerates development processes.


## Twitter
- [AppMap Ruby](https://twitter.com/appmapruby)
- [AppMap Python](https://twitter.com/appmappython)
- [AppMap Java](https://twitter.com/appmapjava)

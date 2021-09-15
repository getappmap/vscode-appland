[![Version](https://img.shields.io/visual-studio-marketplace/v/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap) [![Avg Stars](https://img.shields.io/visual-studio-marketplace/stars/appland.appmap)](https://marketplace.visualstudio.com/items?itemName=appland.appmap)  [![GitHub Stars](https://img.shields.io/github/stars/applandinc/vscode-appland?style=social)](https://marketplace.visualstudio.com/items?itemName=appland.appmap) [![Discord](https://img.shields.io/discord/766016904056930325)](https://discord.com/invite/N9VUap6)
# AppMap for Visual Studio Code

Navigate your code more efficiently with interactive, accurate software architecture diagrams right in your IDE. 
In two minutes you can go from installing this plugin to exploring maps of your code's architecture. 

![AppMap](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/vscode-sidebyside.png)

Visit [dev.to/appland](https://dev.to/appland) for popular articles about AppMap use cases and tutorials.

AppMap supports **Spring**, **Django**, **Flask**, and **Rails** projects. To generate AppMaps you will need to install the AppMap agent for your project.

&nbsp;

Run this command from within the top level directory of your project:
``` bash
npx @appland/appmap install-agent
```  
&nbsp;

---  
### Requirements
AppMap is intended for mapping web services and web applications, and works seamlessly with these popular frameworks.

**Spring**
| Required Framework version | Required Language version |
| -------------------------- | --------------------- |
| Spring (any version)        |       JDK 8+          |

**Django** 
| Required Framework version | Required Language Version |
| -------------------------- | ----------------------- |
| Django v.3.2.x, 2.2.x   |  Python >=3.6  |

**Flask** 
| Required Framework version | Required Language Version |
| -------------------------- | ----------------------- |
| Flask  v.2.0.x  |  Python >=3.6  |

**Rails**
| Required Framework version | Required Language Version |
| -------------------------- | --------------------- |
|   Rails Version 5, 6       |   Ruby  2.6, 2.7, 3    |  

---
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

# AppLand for Visual Studio Code

AppLand captures live recordings of your application and generates beautiful, interactive diagrams.

Developers use AppLand to:
- Onboard to code architecture, with no extra work for the team 
- Conduct code and design reviews using live and accurate data
- Troubleshoot hard-to-understand bugs with visuals 

[Join us on Discord](https://discord.com/invite/N9VUap6) | [appland.org](https://appland.org)

## Installation
Install through VS Code extensions. Search for `AppLand`

Visual Studio Code Market Place: [AppLand](https://marketplace.visualstudio.com/items?itemName=AppLandInc.appland)

Alternatively, install in VS Code: Launch VS Code Quick Open (Ctrl+P / Cmd+P), paste the following command, and press enter.
```
ext install AppLandInc.appland
```
To generate AppMap files, an AppMap client must be installed and configured for your project. If it's not already, you can find the language client for your project along with setup instructions on GitHub:

- [AppMap client for Ruby](https://github.com/applandinc/appmap-ruby)
- [AppMap client for Java](https://github.com/applandinc/appmap-java)


## Usage
Open an `*.appmap.json` file in Visual Studio Code to view diagrams of the recording.
### Commands
This extension adds the following commands:
- `AppLand: Open most recently modified AppMap file`

# Instructions for Java Projects


## Installation

Install the extension with the `Install` button in the Marketplace.

## Initial setup of the client

The client is required for recording AppMaps when running tests in VS Code.

1. Download the most recent `appmap.jar` from [https://github.com/applandinc/appmap-java/releases](https://github.com/applandinc/appmap-java/releases). 
2. Then follow the `Configuration chapter` in [github.com/applandinc/appmap-java](github.com/applandinc/appmap-java#configuration).

## Recording an AppMap

The Java client is run as a Java agent and must be started along with the JVM. This is typically done by passing the `-javaagent` argument to your JVM, for example

`java -javaagent:$HOME/appmap.jar <java command arguments>`


### Debug information for links to source files

AppMap diagrams feature links to original source code. In order for the links to work, please make sure to compile your source code with the debug information enabled.

### Maven, Maven Surefire, and Gradle

The `appmap-java` project on GitHub has [instructions for running the `appmap.jar` Java agent within the Maven, Surefire, or Gradle](https://github.com/applandinc/appmap-java/blob/master/README.md#other-examples).


### JUnit
You can use the `Java Test Runner` extension to record AppMaps from your JUnit tests.

1. Install the Java Test Runner extension from [the Marketplace](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-test).
2. Open the workspace settings json file and add the `-javaagent` parameter to the `vmArgs` section, replace `${HOME}` with your home directory or where you saved the file:
    - `"vmArgs": [ "-Xmx512M", "-javaagent:${HOME}/appmap.jar" ],`
    - See detailed instructions for the Java Test Runner configuration [here](https://github.com/Microsoft/vscode-java-test/wiki/Run-with-Configuration).

![Java Test Runner Configuration](./media/005.png "Java Test Runner Configuration")

Run your JUnit test and the AppMap JSON file will be generated. You can start them from the Test Explorer:

![Java Test Explorer](./media/006.png "Java Test Explorer")


## Location of AppMaps in the file tree navigator

For Java apps, the files will be created in the workspace folder unless you configure the working directory differently in the Java Test Runner settings.


## Using the AppMap diagram

Please go back to the instructions in [README.md](../README.md#using-the-appmap-diagram "README").
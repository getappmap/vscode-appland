# AppMap Tutorial: Mapping a Java Application in Visual Studio Code

This tutorial will walk you through the process of AppMapping an open source `Spring PetClinic Sample Application` implemented in Java and Spring Boot. You will map this application with the [AppMap for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=appland.appmap).

### Prerequisites

 - Basic familiarity with git, Visual Studio Code and Java
 - Java 8 or newer and git installed in your environment (macOS, Windows, Linux)

### Structure

This tutorial is split into three sections:
- Install Visual Studio Code and the AppMap extension 
- Setup and build the `Spring-PetClinic` application locally
- Setup, record and open AppMaps recorded from tests


# Install Visual Studio Code & the AppMap extension 
1. Install the official build of Visual Studio Code - [visit the Visual Studio Code site](https://code.visualstudio.com/)
2. Install AppMap for Visual Studio Code from the marketplace - [visit AppMap in the Marketplace](https://marketplace.visualstudio.com/items?itemName=appland.appmap)

Alternatively, install and start Visual Studio Code, open the Extensions tab and search for `AppMap` in the extensions list. Install the AppMap extension.

# Build the Spring PetClinic Sample Application

The [Spring PetClinic Sample Application project](https://github.com/land-of-apps/spring-petclinic/tree/main) comes with detailed setup instructions. The setup steps are described in this guide for your convenience.

## Clone the repository

Start with a local clone of the `PetClinic` repository. In your working folder, clone the repo:

```shell
git clone -b main https://github.com/land-of-apps/spring-petclinic.git
```

## Open the PetClinic project in Visual Studio Code

Start Visual Studio Code and open the folder with the `PetClinic` repository. You should see the `pom.xml`, `readme.md` and other files in the root folder.

![Spring-PetClinic project in Visual Studio Code](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-project.png)

### Build the application

It is a good practice to setup and run applications before mapping them as it is easier to catch setup and build problems specific to the applications and their dependencies this way.

To build and run the application:

1. Navigate to the project root folder and run the following command that will build the application and run its tests:
```shell
./mvnw package
```

2. Start the application with   
```shell
./mvnw spring-boot:run
```

3. After a few moments, the application will be running. You can open its web interface on [http://localhost:8080](http://localhost:8080).

2. Shut down the running application with `CTRL-C`

If you have encountered any problems during these steps, please contact us on [Discord](https://discord.com/invite/N9VUap6).

# Setup AppMaps

In this demo, the AppMap Maven plugin is used for recording AppMaps in running JUnit tests. The Maven plugin does not need any explicit installation steps but it requires the `appmap.yml` configuration file for its function.

## Configure appmap.yml

The AppMap Maven plugin configuration is stored in the `appmap.yml` file in the root directory of Java projects. 

1. Create a new file called `appmap.yml` in the root folder of the `Spring-PetClinic` project, and copy/paste this configuration in it: 
   
```yaml
name: spring-petclinic
packages:
- path: org.springframework.samples.petclinic
```
The file lists all packages and classes that will be recorded in AppMaps, in this example all code objects in the `org.springframework.samples.petclinic` package.

![The appmap.yml file in Visual Studio Code](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmapyml.png)

The format of `appmap.yml` is documented in the [appmap-java documentation](https://github.com/applandinc/appmap-java/blob/master/README.md). `appmap.yml` can be fine tuned to include/exclude individual packages, classes and methods.

# Record and interact with AppMaps

Before proceeding, please check that
- the `Spring-PetClinic` application has been successfully built
- The `appmap.yml` exists in the root folder of the project and is properly configured
- you have Visual Studio Code running with the `Spring-PetClinic` project folder open

## Run tests, record AppMaps

### Run tests

The AppMap setup is now complete and the application can be recorded when `JUnit` tests are run with the Maven `appmap` plugin.

1. In the shell, run:

```shell
./mvnw com.appland:appmap-maven-plugin:prepare-agent test
```

The test suite will be run and AppMap files recorded from tests will be created in the `target/appmap` folder of the project.

![AppMap files in the tmp folder](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmaps.png)

# Working with AppMaps in Visual Studio Code
Now that you have the AppMaps recorded, let's open them in the Visual Studio Code.

## Open an AppMap file

1. The recorded AppMap files are in the `target/appmap` folder of the project.

2. Let's open an AppMap with a good code coverage. Navigate to the `target/appmap` folder in the file explorer
   and open any of the `.appmap.json` files with the word `Controller` in its name.

![Show Owner AppMap](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmap.png)

Please note that database operations are not recorded by the AppMap agent for this simple application with in-memory database. View the demonstration video below and join our [Discord server](https://discord.com/invite/N9VUap6) for examples of complete Java appmaps that include database operations.

## Interact with the AppMap diagrams

1. Hide the file explorer by clicking on its icon in the left hand icon bar.

1. Right-click on the packages in the AppMap and expand them to see individual classes.

1. Click on the `Pet` class (or any other class) and click on the `View source` button in the nav bar to open its source file.

2. Explore the `Dependency map`. Click on any component and edge in the map, expand/collapse packages and HTTP endpoints, investigate their details in the left hand navigation bar

3. Switch to the `Trace` view to see how the code and data flows in the application

4. To see how AppMaps can be used for fast mastering of new-to-you code
<a href="https://www.loom.com/share/327f17cf25de499e9254bde366137306"> watch this demonstration video<img src="https://cdn.loom.com/sessions/thumbnails/327f17cf25de499e9254bde366137306-with-play.gif"></a> 

5. Additional information about AppMaps and their benefits can be found in the AppMap for Visual Studio Code [online documentation](https://github.com/applandinc/vscode-appland/blob/master/README.md)

6. Explore not only the previously recorded AppMaps but see how code modifications change the way the application runs. Modify the code, re-run the tests with the AppMap recording enabled and observe the changes in the dependencies and flows

7. AppMap your application. Follow the steps outlined in this tutorial and map your application in minutes

8. Tell your friends and colleagues. AppMaps are a fun way to learn how code works but they are also great for sharing your software designs with others

## Share your AppMaps with us!
We would love to see the AppMaps of your application in the Gallery in Discord. [Join us](https://discord.com/invite/N9VUap6) and our diverse community and share your AppMaps there!


Your AppLand team.

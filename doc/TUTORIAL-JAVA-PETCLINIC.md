# AppMap Tutorial: Mapping a Java Application in Visual Studio Code

This tutorial will walk you through the process of AppMapping an open source `Spring PetClinic Sample Application` implemented in Java and Spring Boot. You will map this application with the [AppMap for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=appland.appmap).

### Prerequisites

 - Basic familiarity with git, Docker, Visual Studio Code and Java
 - Java 8 or newer, Docker and git installed in your environment (macOS, Windows, Linux)

### Structure

This tutorial is split into three sections:
- Install Visual Studio Code and the AppMap extension 
- Setup and build the `Spring-Framework-PetClinic` application locally
- Setup, record and open AppMaps recorded from tests


# Install Visual Studio Code & the AppMap extension 
1. Install the official build of Visual Studio Code - [visit the Visual Studio Code site](https://code.visualstudio.com/)
2. Install AppMap for Visual Studio Code from the marketplace - [visit AppMap in the Marketplace](https://marketplace.visualstudio.com/items?itemName=appland.appmap)

Alternatively, install and start Visual Studio Code, open the Extensions tab and search for `AppMap` in the extensions list. Install the AppMap extension.

# Build the Spring PetClinic Sample Application

The [Spring Framework PetClinic](https://github.com/spring-petclinic/spring-framework-petclinic) sample application comes with detailed setup instructions. The setup steps are covered in this guide for your convenience.

## Clone the repository

Start with a local clone of the `Spring-Framwork-PetClinic` repository. In your working folder, clone the repo:

```shell
git clone https://github.com/spring-petclinic/spring-framework-petclinic
cd spring-framework-petclinic
```

## Install and start a MySQL Docker image

To mimic a real-life application and to record realistic AppMaps with database operations, this tutorial runs the PetClinic application with the MySQL backend. The fastest way to install and setup a MySQL instance is using a Docker image:

```shell
docker run -e MYSQL_USER=petclinic -e MYSQL_PASSWORD=petclinic -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=petclinic -p 3306:3306 mysql:5.7.8
```


## Open the PetClinic project in Visual Studio Code

Start Visual Studio Code and open the folder with the `Spring-Framework-PetClinic` repository. You should see the `pom.xml`, `readme.md` and other files in the root folder.

![Spring-PetClinic project in Visual Studio Code](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-project.png)

### Build the application

It is a good practice to setup and run applications before mapping them as it is easier to catch problems specific to the applications and their dependencies this way.

To build and run the PetClinic application:

1. In the project root folder, run the following command that will build the application, run tests and start it:

```shell
./mvnw jetty:run-war -P MySQL
```

2. After a few moments, the application will be running. You can open its web interface on [http://localhost:8080](http://localhost:8080)

3. Shut down the running application with `CTRL-C`

If you have encountered any problems during these steps, please contact us on [Discord](https://discord.com/invite/N9VUap6) or [support@app.land](mailto:support@app.land).

# Setup AppMaps

In this demo, the AppMap Maven plugin is used for recording AppMaps in running JUnit tests. The Maven plugin requires the `appmap.yml` configuration file for its function.

## Configure appmap.yml

The AppMap configuration is stored in the `appmap.yml` file in the root directory of the project. 

1. Create a new file called `appmap.yml` in the root folder of the `Spring-Framework-PetClinic` project, and copy/paste this configuration in it: 
   
```yaml
name: spring-framework-petclinic
packages:
- path: org.springframework.samples.petclinic
```
The file lists all packages and classes that will be recorded in AppMaps, in this example all code objects in the `org.springframework.samples.petclinic` package.

![The appmap.yml file in Visual Studio Code](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmapyml.png)

The format of `appmap.yml` is documented in the [appmap-java documentation](https://github.com/applandinc/appmap-java/blob/master/README.md). `appmap.yml` can be fine tuned to include/exclude individual packages, classes and methods.

# Record and interact with AppMaps

Before proceeding, please check that
- the `Spring-Framework-PetClinic` application has been successfully built, started and shut down
- The `appmap.yml` exists in the root folder of the project and is properly configured
- you have Visual Studio Code running with the `Spring-Framework-PetClinic` project folder open

## Run tests, record AppMaps

### Run tests

The AppMap setup is now complete and the application can be recorded when `JUnit` tests are run with the Maven `appmap` plugin.

1. In the shell, run:

```shell
./mvnw com.appland:appmap-maven-plugin:prepare-agent -P MySQL test
```

This command runs the `test` phase with the `MySQL` application profile and activates the `prepare-agent` goal of the AppMap plugin that starts the AppMap recording agent during tests. The test suite will now be run and AppMap files will be recorded in the `tmp` folder of the project.

![AppMap files in the tmp folder](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmaps.png)

## Open an AppMap file

Now that you have the AppMaps recorded, let's open them in the Visual Studio Code.

1. The recorded AppMap files are in the `tmp` folder of the project.

2. Let's open an AppMap that shows how the Create pet form works.
Navigate to the `tmp` folder in the file explorer and press  `CTRL|COMMAND P` to find a file by its name

3. Type `Pet Creation Success` (three words) in the search box and pick the top `.appmap.json` file in the results. An AppMap viewer now opens.
   
1. Hide the file explorer by clicking on its icon in the left hand icon bar.

### Interact with the AppMap

1. Right-click on the packages in the AppMap and expand them to see individual classes.

3. Click on the `PetValidator` class (or any other class) and click on the `View source` button in the nav bar to open its source file.

4. Explore the `Dependency map`. Click on any component and edge in the map, expand/collapse packages and HTTP endpoints, investigate their details in the left hand navigation bar

5. Switch to the `Trace` view to see how the code and data flows in the application


![Create Pet AppMap](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmap-create-pet.png)


### Inspect database operations

The `Spring-Framework-PetClinic` application offers a rather simple set of tests that don't cover both Web Service requests and database operations in a single test case, unlike typical Spring applications. To inspect database operations in this example, open a different AppMap:

1. Press  `CTRL|COMMAND P` to find a file by its name

2. Type `Add Visit for Pet` in the search box and pick the top `.appmap.json` file. An AppMap viewer now opens. The picture below shows the Dependency Map with all packages expanded.
3. Click on the database icon in the map and explore the SQL commands in the map and in the Trace.

![Add Visit for a Pet AppMap](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/petclinic-appmap-jdbc.png)


# Learn more about interactive AppMap diagrams


1. To see how AppMaps can be used for fast mastering of new-to-you code
<a href="https://www.loom.com/share/327f17cf25de499e9254bde366137306"> watch this demonstration video

<img src="https://cdn.loom.com/sessions/thumbnails/327f17cf25de499e9254bde366137306-with-play.gif"></a> 

2. Additional information about AppMaps and their benefits can be found in the AppMap for Visual Studio Code [online documentation](https://github.com/applandinc/vscode-appland/blob/master/README.md)

1. Explore not only the previously recorded AppMaps but see how code modifications change the way the application runs. Modify the code, re-run the tests with the AppMap recording enabled and observe the changes in the dependencies and flows

1. AppMap your application. Follow the steps outlined in this tutorial and map your application in minutes

1. Tell your friends and colleagues. AppMaps are a fun way to learn how code works but they are also great for sharing your software designs with others

## Share your AppMaps with us!
We would love to see the AppMaps of your application in the Gallery in Discord. [Join us](https://discord.com/invite/N9VUap6) and our diverse community and share your AppMaps there!


Your AppLand team.

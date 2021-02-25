# AppMap Tutorial: Mapping a Python Application in Visual Studio Code

This tutorial will walk you through the process of AppMapping an open source application `chipy.org` implemented in Python and Dango. You will map this application with the [AppMap for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=appland.appmap).

### Prerequisites
 - Basic familiarity with git, Visual Studio Code, Python and Django
 - git and Docker installed in your environment (macOS, Windows+WSL, Linux)

### Structure

This tutorial is split into three sections:
- Install Visual Studio Code and the AppMap extension 
- Setup and build the `chipy.org` application in a Docker image
- Setup, record and open AppMaps recorded from `chipy.org` tests


# Install Visual Studio Code & the AppMap extension 
1. Install the official build of Visual Studio Code - [visit the Visual Studio Code site](https://code.visualstudio.com/)
2. Install AppMap for Visual Studio Code from the marketplace - [visit AppMap in the Marketplace](https://marketplace.visualstudio.com/items?itemName=appland.appmap)

Alternatively, install and start Visual Studio Code, open the Extensions tab and search for `AppMap` in the extensions list. Install the AppMap extension.

# Build the chipy.org application

The [Chicago Python User Group Website project](https://github.com/chicagopython/chipy.org) comes with detailed setup instructions. The setup steps are described in this guide for your convenience.

## Clone the repository

Start with a local clone of the `chipy.org` repository. In your working folder, clone the repo:

```shell
% git clone https://github.com/chicagopython/chipy.org.git
```

## Open the chipy.org project in Visual Studio Code

Start Visual Studio Code and open the folder with the `chipy.org` repository. You should see the `README.md` and other files in the root folder.

![chipy.org project in Visual Studio Code](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/chipyorg-project.png)



### Setup chipy.org with Docker

It is a good practice to setup and run applications before mapping them as it is easier to catch setup and build problems specific to the applications and their dependencies this way.

If you use Windows 10, consult the [installation guide](https://github.com/chicagopython/chipy.org#installation) for setup of the build enviornment, specifically the `make` tool.

To build and run the application:

1. Navigate to the chipy.org folder and run the setup command
```shell
% make setup_env
```

2. Start the application with   
```shell
% make up
```

3. Migrate the database
```shell
% make migrate
```

- optionally, run `make superuser` to create a superuser if you plan to try the superuser support in the app

4. Open the app in the browser. At this point, the application can be accessed on [http://localhost:8000](http://localhost:8000)

5. Run tests

```shell
% make test
```

If you have encountered any problems during these steps, please consult the [installation guide](https://github.com/chicagopython/chipy.org#installation) or contact us on [Discord](https://discord.com/invite/N9VUap6).

# Setup AppMaps

The `appmap` Python package and the `appmap.yml` configuration file are required for recording AppMaps from tests.

## Configure appmap.yml

The `appmap` package configuration is stored in an `appmap.yml` file in the root directory of Python projects. Create a new file called `appmap.yml` in the root folder of the `chipy.org` folder, and copy/paste these configuration lines in it. The file lists all packages and classes that will be recorded, in this example all objects in the `chipy_org` package:

```yaml
name: chipy.org

packages:
- path: chipy_org
```

The format of `appmap.yml` is documented in the [appmap-python documentation](https://github.com/applandinc/appmap-python/blob/master/README.md). `appmap.yml` can be fine tuned to include/exclude individual packages, classes and methods.

## Install the appmap package in the Docker image

1. Open shell in the running Docker image
```shell
% make shell
```

2. Install the `appmap` Python package
```shell
# pip install appmap
```


# Record and interact with AppMaps

Before proceeding, please check that
- the chicopy.org application has been successfully built and running in a Docker container
- the chicopy.org tests ran successfully
- the `appmap` Python package has been successfully installed in the running Docker image
- you have Visual Studio Code running with the chipy.org project folder open

## Run tests, record AppMaps

The AppMap setup is now complete and the application can be recorded when `pytest` tests are run. The recorder will be activated when the env variable `APPMAP` is set to `true`. 

1. In the running Docker image shell, run

```shell
# APPMAP=true pytest
```

The test suite will be run and AppMap files recorded from tests will be created in the `tmp/appmap/pytest` folder of the project.


# Working with AppMaps in Visual Studio Code
Now that you have the AppMaps recorded, let's open them in the Visual Studio Code.

## Open an AppMap file

1. The recorded AppMap files are in the `tmp/appmap/pytest` folder of the `chipy.org` project.

2. Let's open AppMaps that cover the rsvp functionality of the application.
Navigate to the `tmp/appmap/pytest` folder in the file explorer and press  `CTRL|COMMAND SHIFT P` 

3. Type `rsvp` in the search box and pick any of the .appmap.json files from the results. An AppMap viewer now opens.

![AppMaps in a folder](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/chipyorg-appmaps.png)

## Interact with the AppMap diagrams

1. Hide the file explorer by clicking on its icon in the left hand icon bar.

![AppMap details](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/chipyorg-appmap-details.png)

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

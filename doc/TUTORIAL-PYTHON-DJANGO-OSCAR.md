# AppMap Tutorial: Mapping a Python Application in VS Code

This tutorial will walk you through appmapping of a popular opensource application `django-oscar` implemented in Python and Dango. We will map the application using the [AppMap extension](https://marketplace.visualstudio.com/items?itemName=appland.appmap) in Visual Studio Code.

### Prerequisites
 - Basic familiarity with git, VSCode studio, Python and Django
 - git, Python (3.9) and installed in your environment (macOS, Windows+WSL, Linux)

### Structure

This tutorial is split into three sections:
- Install the VSCode studio with the AppMap extension 
- Setup and build the `django-oscar` application locally
- Setup, record and open AppMaps recorded from `django-oscar` tests


# Install VSCode & the AppMap extension 
1. Install the official build of Visual Studio Code - [visit the VSCode site](https://code.visualstudio.com/)
2. Install AppMap for VSCode from the marketplace - [visit AppMap in the Marketplace](https://marketplace.visualstudio.com/items?itemName=appland.appmap)

Alternatively, install and start VSCode, open the Extensions tab and search for `AppMap` in the extensions list. Install the AppMap extension.

# Build django-oscar

The [django-oscar project](https://github.com/django-oscar/django-oscar) comes with detailed [local setup instructions](https://django-oscar.readthedocs.io/en/latest/internals/contributing/development-environment.html). All elementary setup steps are described in this guide.

## Clone the repository

Let's make a local copy of the `django-oscar` repository from AppLand's clone of this application on github. In your working folder, clone the repo:

```sh-session
% git clone -b master git@github.com:land-of-apps/django-oscar

Cloning into 'django-oscar'...
Enter passphrase for key '___':
... snip ...
```

## Open the django-oscar project in VSCode

Start VSCode and open the folder with the `django-oscar` project.

![django-oscar project in VSCode](https://vscode-appmap.s3.us-east-2.amazonaws.com/media/django-oscar-project.png)



### Setup django-oscar locally

It is a good practice to setup and run applications before mapping them. It is easier to catch setup and build problems specific to the applications and their dependencies this way.

These are the required steps:

1. Create a new Python environment for the application. This example uses Python3 venv
```shell
% python3 -m venv django-oscar
% source django-oscar/bin/activate
```

2. It is always a good idea to update your toolchain before building an app   
```shell
% pip install -U pip setuptools
```

3. Build the app
```shell
% make install
```
- Optionally, follow the `dgango-oscar`'s instructions for sandbox installation to start the installation locally.

4. Run the tests
The detailed instructions for running tests are [here](https://django-oscar.readthedocs.io/en/latest/internals/contributing/running-tests.html). This command will create a new virtual environment, install all dependencies and run `pytest`:

```shell
% make test
```

You can run individual test cases as well, i.e.

```shell
% py.test tests/integration/offer/test_availability.py::TestASuspendedOffer
```

# Setup AppMaps

The appmap module and its configuration file are required for recording AppMaps of the application from tests.

### Install the appmap module
```shell
% pip install appmap
```

## Configure appmap.yml

The appmap module configuration is stored in an `appmap.yml` file in the root directory of the project. Create a new file called `appmap.yml` in the root folder of the `django-oscar` folder, and copy/paste this configuration in it. It lists all modules and classes that will be recorded by appmap when the tests are run:

```yaml
name: django-oscar

packages:
- path: django-oscar
- path: sandbox
- path: src
- path: tests
```

The format of the file is explained in great depth in the [appmap-python documentation](https://github.com/applandinc/appmap-python/blob/master/README.md). In our example, all classes in the packages listed above will be recorded. `appmap.yml` can be fine tuned to include/exclude individual packages, classes or even methods.

# Record and interact with AppMaps

If your VS Code IDE is not running, start it now and open the `django-oscar` folder as the project root.

## Run tests, record AppMaps

The AppMap setup is now complete and the application is ready for recording when `pytest` tests are run. The recorder will be activated whe the env variable `APPMAP` is set to `true`:

```shell
% APPMAP=true make test
```

AppMap files recorded from tests will be created in the `tmp/appmap/pytest` folder of the project.


### Run a selected test

[todo find and describe how to find, open and run a good test]

# Working with AppMaps
Now that your AppMap recorder works, let's open your new AppMap file in the IDE.

## Open an AppMap file

Press `CTRL|COMMAND SHIFT P` in the IDE, then type `AppMap` in the search box and select the `AppMap: Open most recently modified AppMap file` action from the list. This opens the new AppMap file that you have just recorded in the interactive AppMap viewer.

Alternatively, you can find the recorded AppMap files in the `/tmp/appmap/pytest` folder of the `django-oscar` project.

[todo a screenshot of the VSCode with the appmap]


## Interact with the AppMap diagrams

Explore the `Dependency map`. Click on any component and edge in the map, expand/collapse packages and HTTP endpoints, investigate their details in the left navigation bar.

Switch to the `Trace` view to see how the code and data flows in the application.

<a href="https://www.loom.com/share/327f17cf25de499e9254bde366137306"> <p>Watch the Master your code with AppMap video</p> <img src="https://cdn.loom.com/sessions/thumbnails/327f17cf25de499e9254bde366137306-with-play.gif"> </a> 

Additional information about AppMaps and their benefits is in the AppMap for VSCode [online documentation](https://github.com/applandinc/vscode-appland/blob/master/README.md).


# Share your AppMaps with us!
Thank you for your interest in AppMaps! We would love to see the AppMaps of your applications in our AppMap gallery in Discord. [Join us](https://discord.com/invite/N9VUap6) and our diverse community in Discord today.


# Reference configuration
If you are not successful making the application mapping work as described in this tutorial, compare your configuration with a pre-configured version of the application in the `appland` branch of the django-oscar github repository managed by AppLand. 

Github: [https://github.com/land-of-apps/django-oscar/tree/appland](https://github.com/land-of-apps/django-oscar/tree/appland)

```sh-session
% git clone -b appland git@github.com:land-of-apps/django-oscar
```

Your AppLand team.






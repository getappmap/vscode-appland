# AppMap Tutorial: Mapping a Ruby Application in VS Code

This tutorial will walk you through appmapping of a popular opensource application `ifme` implemented in Ruby on Rails with the AppMap extension in Visual Studio Code.

### Prerequisites
 - Basic familiarity with git, VSCode studio, Ruby on Rails and postgres
 - git, Ruby (2.6, 2.7) and postgres installed in your environment (macOS, Windows+WSL, Linux)

### Structure

This tutorial is split into three sections:
- Install the VSCode studio with the AppMap extension 
- Build and run the `ifme` application
- Setup, record and open AppMaps recorded from ifme tests


# Install VSCode & the AppMap extension 
1. Install the official build of Visual Studio Code - [visit official site](https://code.visualstudio.com/)
2. Install AppMap for VSCode from the marketplace - [AppMap in Marketplace](https://marketplace.visualstudio.com/items?itemName=appland.appmap)

Alternatively, start the VSCode after installation, open the Extensions tab and search for "AppMap" in the extensions list. Install the AppMap extension from the list.

# Build and run ifme

## Clone the ifme repository

Let's make a local copy of the `ifme` repository from AppLand's clone of `ifme` on github. In your working folder, clone the repo:

```sh-session
% git clone -b master git@github.com:land-of-apps/ifme

Cloning into 'ifme'...
Enter passphrase for key '___':
remote: Enumerating objects: 31955, done.
remote: Total 31955 (delta 0), reused 0 (delta 0), pack-reused 31955
Receiving objects: 100% (31955/31955), 61.11 MiB | 7.72 MiB/s, done.
Resolving deltas: 100% (23303/23303), done.
```

## Open the ifme project in VSCode

Start VSCode and open the folder with the `ifme` project.

_{image: 101.png, a screenshot of the VSCode with the ifme folder open}_


### Build ifme

It is a good practice to build and run applications before mapping them. It is easier to catch setup and build problems specific to the applications this way.


The `ifme` installation instructions are linked from the `README.md` file in the `ifme` folder. You can preview the `README.md` file in VSCode (with the help of one of the Markdown extensions), or open the instructions in [ifme wiki](https://github.com/ifmeorg/ifme/wiki/Installation).

These are the required steps:

1. If your ruby version is different from 2.6.6, edit the `.ruby-version` and `Gemfile` files in the ifme root folder and change the ruby version to your installed version in both files, i.e. to `2.7.2`
2. open terminal in VSCode (`CTRL ~`) or your favorite terminal application and go to the ifme directory. Then run
```sh-session
% bundle install
```

If you see errors installing the `puma` gem, try:

```sh-session
% bundle config build.puma --with-cflags="-Wno-error=implicit-function-declaration"
% bundle install
```

3. Initialize the test environment and database. Make sure that your local postgres instance is running before starting the database setup.
```sh-session
% bin/rake setup_workspace
% bin/rake db:setup db:test:prepare
```

You should see output similar to this:
```sh-session
Created database 'ifme_development'
Created database 'ifme_test'
```
### Run ifme
Start the app with
```sh-session
% bin/start_app
```

After a few moments, the application will start and the logs in the console will eventually stop scrolling. You may spot a message in the logs that the application has been started on 0.0.0.0:3000. 

Let's open the running ifme application in the web browser: [http://localhost:3000](http://localhost:3000)

If everything works as expected, you should see the ifme home page. If not, please consult the [ifme wiki](https://github.com/ifmeorg/ifme/wiki/Installation).

### Stop ifme
Shut the application down before running the tests. Press `CTRL C` in the terminal window.

# Setup AppMaps

The AppMap ruby gem and configuration file are required for recording dynamic traces - AppMaps - of the application, let us set them both up now. Additional detailed instruction are available in [appmap-ruby github](https://github.com/applandinc/appmap-ruby/blob/master/README.md).

You can preview and follow the steps in this video as well:

<a href="https://www.loom.com/share/78ab32a312ff4b85aa8827a37f1cb655"> <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/78ab32a312ff4b85aa8827a37f1cb655-with-play.gif">
<p>Quick and easy setup of the AppMap gem for Rails - Watch Video</p> </a>

## Setup the appmap gem

Add `gem 'appmap'` to beginning of the ifme `Gemfile`. We recommend that you add the `appmap` gem to the `:development, :test` group. After the updates, the ifme Gemfile content should look like this:

```ruby
# frozen_string_literal: true

source 'https://rubygems.org'
ruby '~> 2.6.6'

group :development, :test do
  gem 'appmap'
end

gem 'puma'
gem 'rack-rewrite'
gem 'rails', '~> 6.0.3'

#... snip ...
```

Now install the gem with
```sh-session
% bundle install
```

## Setup the appmap railtie

Because `ifme` is a Rails application, adding a railtie is required for its mapping. The railtie should only be added for Rails apps.

Open the `config/application.rb` file in the IDE and append this line to the "require section":
```ruby
require 'appmap/railtie' if defined?(AppMap)
```
so the content of the file looks similar to this:

```ruby
# frozen_string_literal: true

require_relative 'boot'
require_relative 'locale'
require 'rails/all'
require 'appmap/railtie' if defined?(AppMap)


# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

#... snip ...
```


## Configure appmap.yml

The previous steps added the appmap recording gem to the ifme application. We will now instruct the recorder what application classes and packages should be included in the recorded traces.

The configuration is stored in an `appmap.yml` file in the root directory of the project. Create a new file called `appmap.yml` in the ifme folder, and copy/paste this configuration in it:

```yaml
name: ifme

packages:
- path: app/controllers
- path: app/helpers
- path: app/mailers
- path: app/models
- path: app/services
- path: app/uploaders
```

The format of the file is explained in great depth in the [appmap-ruby documentation](https://github.com/applandinc/appmap-ruby/blob/master/README.md). In our example, all classes in the packages listed above will be recorded. appmap.yml can be fine tuned to include/exclude individual packages, classes or even methods, as described in the detailed documentation mentioned above.

## Configure RSpec tests

AppMaps can be recorded using several approaches but this tutorial uses ifme's RSpec tests because they are a great source of traces for visualization and analysis for this well written and well tested application.

To enable recording of RSpec tests, open the `spec/spec_helper.rb` file in the editor and add this line
```ruby
require 'appmap/rspec'
```
to the require section so that the top of the file looks similar to this:
```ruby
# frozen_string_literal: true

# This file is copied to spec/ when you run 'rails generate rspec:install'
ENV['RAILS_ENV'] ||= 'test'

require 'simplecov'
SimpleCov.start 'rails'

require 'appmap/rspec'

require File.expand_path('../config/environment', __dir__)
require 'rspec/rails'
require 'rspec/collection_matchers'
require 'capybara/rails'
require 'capybara/rspec'

include Warden::Test::Helpers
Warden.test_mode!

#... snip ...
```

## Run tests, record appmaps

The AppMap setup is now complete and the application is ready for recording when RSpec tests are run. The recorder will be activated when tests are run and the env variable APPMAP is set to true. This command will run and create AppMaps for all RSpec tests:

```sh-session
# APPMAP=true bundle exec rspec
```

Let us find and run a specific test as ifme has many available:

- Press `CTRL|COMMAND SHIFT F` in the IDE to open the find-in-files dialog
- Enter `creates a moment` in the search field. A test case that creates a new "moment" will show in the results
- Click on the found result (`moments_controller_spec.rb` / `creates a moment`) to open the test case in the editor
- Review the test and note the line item of the test - it should be `89`
```ruby
    context 'when valid params are supplied' do
      it 'creates a moment' do
        expect { post_create valid_moment_params }
          .to change(Moment, :count).by(1)
      end
```

_{image: 102.png, a screenshot of the VSCode with the rspec test in the editor}_


Open your terminal window and run the test:

```sh-session
% APPMAP=true bundle exec rspec spec/controllers/moments_controller_spec.rb:89

Configuring AppMap from path appmap.yml
Configuring AppMap recorder for RSpec

... snip ...

Finished in 0.45773 seconds (files took 6.13 seconds to load)
3 examples, 0 failures

Randomized with seed 65463

Coverage report generated for RSpec to /Users/funny/path/ifme/coverage. 697 / 3881 LOC (17.96%) covered.
```

_Et voilà!_ Your first AppMap of ifme has just been recorded.

# Working with AppMaps
Now that your AppMap recorder works, let's open your new AppMap file in the IDE.

## Open an AppMap file

Press `CTRL|COMMAND SHIFT P` in the IDE, then type `AppMap` in the search box and select the `AppMap: Open most recently modified AppMap file` action from the list. This opens the new AppMap file that you have just recorded in the interactive AppMap viewer.

Alternatively, you can find the recorded AppMap files in the `/tmp/appmap/rspec` folder of the `ifme` project.

_{image: 103.png, a screenshot of the VSCode with the appmap}_


## Interact with the AppMap diagrams

Explore the `Dependency map`. Click on any component and edge in the map, expand/collapse packages and HTTP endpoints, investigate their details in the left navigation bar.

Switch to the `Trace` view to see how the code and data flows in the application.

<a href="https://www.loom.com/share/327f17cf25de499e9254bde366137306"> <p>Watch the Master your code with AppMap video</p> <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/327f17cf25de499e9254bde366137306-with-play.gif"> </a> 

Additional information about AppMaps and their benefits is in the AppMap for VSCode [online documentation](https://github.com/applandinc/vscode-appland/blob/master/README.md).


# Share your AppMaps with us!
Thank you for your interest in AppMaps! We would love to see the AppMaps of your applications in our AppMap gallery in Discord. [Join us](https://discord.com/invite/N9VUap6) and our diverse community in Discord today.


# Reference configuration
If you are not successful making the application mapping work as described in this tutorial, compare your configuration with a pre-configured version of the application in the `appland` branch of the ifme github repository managed by AppLand. 

Github: [https://github.com/land-of-apps/ifme/tree/appland](https://github.com/land-of-apps/ifme/tree/appland)

```sh-session
% git clone -b appland git@github.com:land-of-apps/ifme
```

Your AppLand team.







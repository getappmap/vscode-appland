#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'stringio'
require 'appmap'
require 'appmap/command/agent_setup/init'

def capture_stdout
  original_stdout = $stdout
  stdout = StringIO.new
  $stdout = stdout

  yield

  return stdout.string
ensure
  $stdout = original_stdout
end

if File.exist?('appmap.yml')
  puts 'AppMap configuration already exists. Aborting.'
  exit 1
end

init_result = capture_stdout do
  AppMap::Command::AgentSetup::Init.new('appmap.yml').perform
end

File.write('appmap.yml', JSON.parse(init_result)['configuration']['contents'])
puts 'AppMap configuration created.'

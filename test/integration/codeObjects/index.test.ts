import assert from 'assert';
import { exists } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { CodeObjectEntry } from '../../../src/services/classMapIndex';
import {
  ExampleAppMap,
  ExampleAppMapIndexDir,
  initializeWorkspace,
  repeatUntil,
  touch,
  waitFor,
  waitForExtension,
} from '../util';

describe('CodeObjects', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('index is created on startup', async () => {
    const extension = vscode.extensions.getExtension('appland.appmap');
    assert(extension);

    const classMapFile = join(ExampleAppMapIndexDir, 'classMap.json');
    await repeatUntil(
      async () => touch(ExampleAppMap),
      `classMap.json should be generated`,
      async () => promisify(exists)(classMapFile)
    );

    const appMapService = extension.exports;
    assert.ok(appMapService.classMap);
    await waitFor(`ClassMap not available`, async () => {
      if (!appMapService.classMap) return false;
      return (await appMapService.classMap.classMap()).length > 0;
    });

    const classMap = await appMapService.classMap.classMap();
    const printCodeObject = (buffer: string[], depth: number, codeObject: CodeObjectEntry) => {
      buffer.push(['  '.repeat(depth), codeObject.fqid].join(''));
      codeObject.children.forEach(printCodeObject.bind(this, buffer, depth + 1));
      return buffer;
    };
    const classMapDescription: string[] = [];
    classMap.forEach(printCodeObject.bind(this, classMapDescription, 0));
    assert.strictEqual(
      `folder:root->Code
  package:actionpack
    class:actionpack/ActionDispatch
      class:actionpack/ActionDispatch::Integration
        class:actionpack/ActionDispatch::Integration::Runner
          function:actionpack/ActionDispatch::Integration::Runner#before_setup
      class:actionpack/ActionDispatch::Request
        class:actionpack/ActionDispatch::Request::Session
          function:actionpack/ActionDispatch::Request::Session#[]
          function:actionpack/ActionDispatch::Request::Session#destroy
          function:actionpack/ActionDispatch::Request::Session#clear
          function:actionpack/ActionDispatch::Request::Session#[]=
      class:actionpack/ActionDispatch::Cookies
        class:actionpack/ActionDispatch::Cookies::CookieJar
          function:actionpack/ActionDispatch::Cookies::CookieJar#update
          function:actionpack/ActionDispatch::Cookies::CookieJar#[]
          function:actionpack/ActionDispatch::Cookies::CookieJar#[]=
    class:actionpack/ActionController
      class:actionpack/ActionController::Instrumentation
        function:actionpack/ActionController::Instrumentation#process_action
        function:actionpack/ActionController::Instrumentation#redirect_to
      class:actionpack/ActionController::Renderers
        function:actionpack/ActionController::Renderers#render_to_body
  package:activesupport
    class:activesupport/ActiveSupport
      class:activesupport/ActiveSupport::Callbacks
        class:activesupport/ActiveSupport::Callbacks::CallbackSequence
          function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_before
          function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_after
  package:logger
    class:logger/Logger
      class:logger/Logger::LogDevice
        function:logger/Logger::LogDevice#write
  package:activerecord
    class:activerecord/ActiveRecord
      class:activerecord/ActiveRecord::Relation
        function:activerecord/ActiveRecord::Relation#records
  package:ruby
    class:ruby/String
      function:ruby/String#unpack
      function:ruby/String#unpack1
  package:app
    package:app/controllers
      class:app/controllers/SessionsController
        function:app/controllers/SessionsController#create
      class:app/controllers/MicropostsController
        function:app/controllers/MicropostsController#index
    package:app/helpers
      class:app/helpers/SessionsHelper
        function:app/helpers/SessionsHelper#log_in
        function:app/helpers/SessionsHelper#remember
        function:app/helpers/SessionsHelper#logged_in?
        function:app/helpers/SessionsHelper#current_user
      class:app/helpers/LoggedInHelper
        function:app/helpers/LoggedInHelper#logged_in_api_user
    package:app/models
      class:app/models/User
        function:app/models/User#remember
        function:app/models/User.new_remember_token
        function:app/models/User.digest
  package:json
    class:json/JSON
      class:json/JSON::Ext
        class:json/JSON::Ext::Generator
          class:json/JSON::Ext::Generator::State
            function:json/JSON::Ext::Generator::State#generate
        class:json/JSON::Ext::Parser
          function:json/JSON::Ext::Parser#parse
  package:openssl
    class:openssl/OpenSSL
      class:openssl/OpenSSL::Cipher
        function:openssl/OpenSSL::Cipher#encrypt
        function:openssl/OpenSSL::Cipher#decrypt
database:Queries
  query:begin transaction
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."id" = ? LIMIT ?
  query:SELECT "users".* FROM "users" WHERE "users"."id" = ? LIMIT ?
  query:SELECT "users".* FROM "users" WHERE "users"."email" = ? LIMIT ?
  query:SAVEPOINT active_record_1
  query:UPDATE "users" SET "remember_digest" = ?, "updated_at" = ? WHERE "users"."id" = ?
  query:RELEASE SAVEPOINT active_record_1
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC
  query:rollback transaction
http:HTTP server requests
  route:POST /login
  route:GET /microposts`.trim(),
      classMapDescription.join('\n')
    );
  });
});

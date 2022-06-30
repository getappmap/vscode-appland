import assert from 'assert';
import { exists } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { touch } from '../../../src/lib/touch';
import {
  ExampleAppMap,
  ExampleAppMapIndexDir,
  initializeWorkspace,
  printCodeObject,
  repeatUntil,
  waitFor,
  waitForAppMapServices,
} from '../util';

describe('CodeObjects', () => {
  beforeEach(initializeWorkspace);
  beforeEach(
    waitForAppMapServices.bind(
      null,
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    )
  );
  afterEach(initializeWorkspace);

  it('index is created on startup', async () => {
    const appMapService = await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );
    assert.ok(appMapService.classMap);

    const classMapFile = join(ExampleAppMapIndexDir, 'classMap.json');
    await repeatUntil(
      async () => touch(ExampleAppMap),
      `classMap.json should be generated`,
      async () => promisify(exists)(classMapFile)
    );

    await waitFor(`ClassMap not available`, async () => {
      if (!appMapService.classMap) return false;
      return (await appMapService.classMap.classMap()).length > 0;
    });

    const classMap = await appMapService.classMap.classMap();
    const classMapDescription: string[] = [];
    classMap.forEach(printCodeObject.bind(null, classMapDescription, 0));
    assert.strictEqual(
      classMapDescription.join('\n'),
      `folder:root->Code
  package:actionpack
    class:actionpack/ActionController
      class:actionpack/ActionController::Instrumentation
        function:actionpack/ActionController::Instrumentation#process_action
        function:actionpack/ActionController::Instrumentation#redirect_to
      class:actionpack/ActionController::Renderers
        function:actionpack/ActionController::Renderers#render_to_body
    class:actionpack/ActionDispatch
      class:actionpack/ActionDispatch::Cookies
        class:actionpack/ActionDispatch::Cookies::CookieJar
          function:actionpack/ActionDispatch::Cookies::CookieJar#[]
          function:actionpack/ActionDispatch::Cookies::CookieJar#[]=
          function:actionpack/ActionDispatch::Cookies::CookieJar#update
      class:actionpack/ActionDispatch::Integration
        class:actionpack/ActionDispatch::Integration::Runner
          function:actionpack/ActionDispatch::Integration::Runner#before_setup
      class:actionpack/ActionDispatch::Request
        class:actionpack/ActionDispatch::Request::Session
          function:actionpack/ActionDispatch::Request::Session#[]
          function:actionpack/ActionDispatch::Request::Session#[]=
          function:actionpack/ActionDispatch::Request::Session#clear
          function:actionpack/ActionDispatch::Request::Session#destroy
  package:activerecord
    class:activerecord/ActiveRecord
      class:activerecord/ActiveRecord::Relation
        function:activerecord/ActiveRecord::Relation#records
  package:activesupport
    class:activesupport/ActiveSupport
      class:activesupport/ActiveSupport::Callbacks
        class:activesupport/ActiveSupport::Callbacks::CallbackSequence
          function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_after
          function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_before
  package:app
    package:app/controllers
      class:app/controllers/MicropostsController
        function:app/controllers/MicropostsController#index
      class:app/controllers/SessionsController
        function:app/controllers/SessionsController#create
    package:app/helpers
      class:app/helpers/LoggedInHelper
        function:app/helpers/LoggedInHelper#logged_in_api_user
      class:app/helpers/SessionsHelper
        function:app/helpers/SessionsHelper#current_user
        function:app/helpers/SessionsHelper#log_in
        function:app/helpers/SessionsHelper#logged_in?
        function:app/helpers/SessionsHelper#remember
    package:app/models
      class:app/models/User
        function:app/models/User.digest
        function:app/models/User.new_remember_token
        function:app/models/User#remember
  package:json
    class:json/JSON
      class:json/JSON::Ext
        class:json/JSON::Ext::Generator
          class:json/JSON::Ext::Generator::State
            function:json/JSON::Ext::Generator::State#generate
        class:json/JSON::Ext::Parser
          function:json/JSON::Ext::Parser#parse
  package:logger
    class:logger/Logger
      class:logger/Logger::LogDevice
        function:logger/Logger::LogDevice#write
  package:openssl
    class:openssl/OpenSSL
      class:openssl/OpenSSL::Cipher
        function:openssl/OpenSSL::Cipher#decrypt
        function:openssl/OpenSSL::Cipher#encrypt
  package:ruby
    class:ruby/String
      function:ruby/String#unpack
      function:ruby/String#unpack1
database:Queries
  query:begin transaction
  query:RELEASE SAVEPOINT active_record_1
  query:rollback transaction
  query:SAVEPOINT active_record_1
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."id" = ? LIMIT ?
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC
  query:SELECT "users".* FROM "users" WHERE "users"."email" = ? LIMIT ?
  query:SELECT "users".* FROM "users" WHERE "users"."id" = ? LIMIT ?
  query:UPDATE "users" SET "remember_digest" = ?, "updated_at" = ? WHERE "users"."id" = ?
http:HTTP server requests
  route:GET /microposts
  route:POST /login
`.trim()
    );
  });
});

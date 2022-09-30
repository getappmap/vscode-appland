import assert from 'assert';
import { exists } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import {
  ExampleAppMapIndexDir,
  initializeWorkspace,
  printCodeObject,
  waitFor,
  waitForAppMapServices,
  withAuthenticatedUser,
} from '../util';

describe('CodeObjects', () => {
  withAuthenticatedUser();

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
    await waitFor(`classMap.json not generated`, async () => promisify(exists)(classMapFile));
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
          function:actionpack/ActionDispatch::Request::Session#delete
          function:actionpack/ActionDispatch::Request::Session#destroy
  package:actionview
    class:actionview/ActionView
      class:actionview/ActionView::Resolver
        function:actionview/ActionView::Resolver#find_all
  package:activejob
    class:activejob/ActiveJob
      class:activejob/ActiveJob::Enqueuing
        function:activejob/ActiveJob::Enqueuing#enqueue
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
      class:activesupport/ActiveSupport::LazyLoadHooks
        function:activesupport/ActiveSupport::LazyLoadHooks.run_load_hooks
  package:app
    package:app/controllers
      class:app/controllers/MicropostsController
        function:app/controllers/MicropostsController#create
        function:app/controllers/MicropostsController#destroy
        function:app/controllers/MicropostsController#index
      class:app/controllers/SessionsController
        function:app/controllers/SessionsController#create
      class:app/controllers/StaticPagesController
        function:app/controllers/StaticPagesController#home
      class:app/controllers/UsersController
        function:app/controllers/UsersController#page_number
        function:app/controllers/UsersController#show
    package:app/helpers
      class:app/helpers/ApplicationHelper
        function:app/helpers/ApplicationHelper#full_title
      class:app/helpers/LoggedInHelper
        function:app/helpers/LoggedInHelper#logged_in_api_user
        function:app/helpers/LoggedInHelper#logged_in_user
      class:app/helpers/SessionsHelper
        function:app/helpers/SessionsHelper#current_user
        function:app/helpers/SessionsHelper#current_user?
        function:app/helpers/SessionsHelper#log_in
        function:app/helpers/SessionsHelper#logged_in?
        function:app/helpers/SessionsHelper#remember
      class:app/helpers/UsersHelper
        function:app/helpers/UsersHelper#gravatar_for
    package:app/models
      class:app/models/Micropost
        function:app/models/Micropost#display_image
      class:app/models/User
        function:app/models/User.digest
        function:app/models/User.new_remember_token
        function:app/models/User#feed
        function:app/models/User#following?
        function:app/models/User#remember
    package:app/views
      class:app/views/app_views_layouts__footer_html_erb
        function:app/views/app_views_layouts__footer_html_erb.render
      class:app/views/app_views_layouts__header_html_erb
        function:app/views/app_views_layouts__header_html_erb.render
      class:app/views/app_views_layouts__shim_html_erb
        function:app/views/app_views_layouts__shim_html_erb.render
      class:app/views/app_views_microposts__micropost_html_erb
        function:app/views/app_views_microposts__micropost_html_erb.render
      class:app/views/app_views_shared__error_messages_html_erb
        function:app/views/app_views_shared__error_messages_html_erb.render
      class:app/views/app_views_shared__feed_html_erb
        function:app/views/app_views_shared__feed_html_erb.render
      class:app/views/app_views_shared__micropost_form_html_erb
        function:app/views/app_views_shared__micropost_form_html_erb.render
      class:app/views/app_views_shared__stats_html_erb
        function:app/views/app_views_shared__stats_html_erb.render
      class:app/views/app_views_shared__user_info_html_erb
        function:app/views/app_views_shared__user_info_html_erb.render
      class:app/views/app_views_static_pages_home_html_erb
        function:app/views/app_views_static_pages_home_html_erb.render
      class:app/views/app_views_users__follow_form_html_erb
        function:app/views/app_views_users__follow_form_html_erb.render
      class:app/views/app_views_users__follow_html_erb
        function:app/views/app_views_users__follow_html_erb.render
      class:app/views/app_views_users_show_html_erb
        function:app/views/app_views_users_show_html_erb.render
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
  package:psych
    class:psych/Psych
      function:psych/Psych.load
      function:psych/Psych.parse
      function:psych/Psych.parse_stream
  package:ruby
    class:ruby/Kernel
      function:ruby/Kernel#eval
    class:ruby/Marshal
      function:ruby/Marshal.dump
    class:ruby/String
      function:ruby/String#unpack
      function:ruby/String#unpack1
database:Queries
  query:begin transaction
  query:DELETE FROM "active_storage_attachments" WHERE "active_storage_attachments"."id" = ?
  query:DELETE FROM "microposts" WHERE "microposts"."id" = ?
  query:INSERT INTO "active_storage_attachments" ("name", "record_type", "record_id", "blob_id", "created_at") VALUES (?, ?, ?, ?, ?)
  query:INSERT INTO "active_storage_blobs" ("key", "filename", "content_type", "metadata", "byte_size", "checksum", "created_at") VALUES (?, ?, ?, ?, ?, ?, ?)
  query:INSERT INTO "microposts" ("content", "user_id", "created_at", "updated_at") VALUES (?, ?, ?, ?)
  query:PRAGMA table_info("active_storage_blobs")
  query:RELEASE SAVEPOINT active_record_1
  query:rollback transaction
  query:SAVEPOINT active_record_1
  query:SELECT "active_storage_attachments".* FROM "active_storage_attachments" WHERE "active_storage_attachments"."record_id" = ? AND "active_storage_attachments"."record_type" = ? AND "active_storage_attachments"."name" = ? LIMIT ?
  query:SELECT "active_storage_blobs".* FROM "active_storage_blobs" WHERE "active_storage_blobs"."id" = ? LIMIT ?
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."id" = ? LIMIT ?
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? AND "microposts"."id" = ? ORDER BY "microposts"."created_at" DESC LIMIT ?
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC
  query:SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC LIMIT ? OFFSET ?
  query:SELECT "microposts".* FROM "microposts" WHERE (user_id IN (SELECT followed_id FROM relationships
                     WHERE  follower_id = 762146111)
                     OR user_id = 762146111) ORDER BY "microposts"."created_at" DESC LIMIT ? OFFSET ?
  query:SELECT "users".* FROM "users" WHERE "users"."email" = ? LIMIT ?
  query:SELECT "users".* FROM "users" WHERE "users"."id" = ? LIMIT ?
  query:SELECT 1 AS one FROM "microposts" WHERE "microposts"."user_id" = ? LIMIT ?
  query:SELECT 1 AS one FROM "users" INNER JOIN "relationships" ON "users"."id" = "relationships"."followed_id" WHERE "relationships"."follower_id" = ? AND "users"."id" = ? LIMIT ?
  query:SELECT COUNT(*) FROM "microposts"
  query:SELECT COUNT(*) FROM "microposts" WHERE "microposts"."user_id" = ?
  query:SELECT COUNT(*) FROM "microposts" WHERE (user_id IN (SELECT followed_id FROM relationships
                     WHERE  follower_id = 762146111)
                     OR user_id = 762146111)
  query:SELECT COUNT(*) FROM "users" INNER JOIN "relationships" ON "users"."id" = "relationships"."followed_id" WHERE "relationships"."follower_id" = ?
  query:SELECT COUNT(*) FROM "users" INNER JOIN "relationships" ON "users"."id" = "relationships"."follower_id" WHERE "relationships"."followed_id" = ?
  query:SELECT sql FROM
  (SELECT * FROM sqlite_master UNION ALL
   SELECT * FROM sqlite_temp_master)
WHERE type = 'table' AND name = 'active_storage_blobs'

  query:UPDATE "microposts" SET "updated_at" = ? WHERE "microposts"."id" = ?
  query:UPDATE "users" SET "remember_digest" = ?, "updated_at" = ? WHERE "users"."id" = ?
http:HTTP server requests
  route:DELETE /microposts/{id}
  route:GET /
  route:GET /microposts
  route:GET /users/{id}
  route:POST /login
  route:POST /microposts
`.trim()
    );
  });
});

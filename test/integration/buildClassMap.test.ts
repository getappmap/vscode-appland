import * as vscode from 'vscode';
import { join } from 'path';
import { buildClassMap } from '../../src/lib/buildClassMap';
import { FixtureDir, printCodeObject } from './util';
import assert, { AssertionError } from 'assert';
import { CodeObjectEntry, CodeObjectEntryRootType } from '../../src/lib/CodeObjectEntry';

describe('buildClassMap', () => {
  it('normalizes embedded package names', async () => {
    const appmapFilePath = join(
      FixtureDir,
      'classMaps',
      'ScannerJobsController_authenticated_user_admin_can_defer_a_finding.json'
    );
    const mockFolder = {} as vscode.WorkspaceFolder;

    const resolver = () => mockFolder;
    const { classMap } = await buildClassMap(
      new Set([vscode.Uri.file(appmapFilePath).toString()]),
      resolver
    );
    const classMapDescription: string[] = [];
    const code = classMap.find((coe) => coe.fqid === 'folder:root->Code');
    assert.ok(code, 'folder:root->Code is not found');
    code.children.forEach(printCodeObject.bind(null, classMapDescription, 0));

    const hasOneToken = (coe: CodeObjectEntry) => {
      assert.ok(
        !(coe.type === CodeObjectEntryRootType.PACKAGE && coe.name.split('/').length > 1),
        `Expected ${coe.fqid} ${coe.name} to have exactly one token`
      );
      coe.children.forEach((child) => hasOneToken(child));
    };
    classMap.forEach((coe) => hasOneToken(coe));

    assert.deepStrictEqual(
      classMapDescription,
      `package:actionpack
  class:actionpack/ActionController
    class:actionpack/ActionController::Instrumentation
      function:actionpack/ActionController::Instrumentation#process_action
    class:actionpack/ActionController::Renderers
      function:actionpack/ActionController::Renderers#render_to_body
  class:actionpack/ActionDispatch
    class:actionpack/ActionDispatch::Cookies
      class:actionpack/ActionDispatch::Cookies::CookieJar
        function:actionpack/ActionDispatch::Cookies::CookieJar#[]
        function:actionpack/ActionDispatch::Cookies::CookieJar#[]=
        function:actionpack/ActionDispatch::Cookies::CookieJar#update
    class:actionpack/ActionDispatch::Request
      class:actionpack/ActionDispatch::Request::Session
        function:actionpack/ActionDispatch::Request::Session#[]
package:activesupport
  class:activesupport/ActiveSupport
    class:activesupport/ActiveSupport::Callbacks
      class:activesupport/ActiveSupport::Callbacks::CallbackSequence
        function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_after
        function:activesupport/ActiveSupport::Callbacks::CallbackSequence#invoke_before
package:app
  package:app/controllers
    class:app/controllers/ApplicationController
      function:app/controllers/ApplicationController#authorize_mini_profiler
      function:app/controllers/ApplicationController#configuration
      function:app/controllers/ApplicationController#current_user?
    class:app/controllers/ScannerJobsController
      function:app/controllers/ScannerJobsController#defer
    package:app/controllers/concerns
      class:app/controllers/concerns/AnonymousAccess
        function:app/controllers/concerns/AnonymousAccess#anonymous_access?
      class:app/controllers/concerns/CurrentUser
        class:app/controllers/concerns/CurrentUser::Memo
          function:app/controllers/concerns/CurrentUser::Memo#get
        function:app/controllers/concerns/CurrentUser#check_current_user
        function:app/controllers/concerns/CurrentUser#current_user
        function:app/controllers/concerns/CurrentUser#early_access_enabled?
        function:app/controllers/concerns/CurrentUser#ensure_early_access
        function:app/controllers/concerns/CurrentUser#ensure_eula_accepted
        function:app/controllers/concerns/CurrentUser#lookup_session_user
      class:app/controllers/concerns/InTransaction
        function:app/controllers/concerns/InTransaction#in_transaction
      class:app/controllers/concerns/MuteLogging
        function:app/controllers/concerns/MuteLogging#mute_logging
      class:app/controllers/concerns/ThirdPartyClients
        function:app/controllers/concerns/ThirdPartyClients#build_installation_clients
      class:app/controllers/concerns/ThirdPartyRepository
        function:app/controllers/concerns/ThirdPartyRepository#repositories
      class:app/controllers/concerns/UpdateCommitStatus
        function:app/controllers/concerns/UpdateCommitStatus#update_commit_status
      class:app/controllers/concerns/WithAuthentication
        function:app/controllers/concerns/WithAuthentication#with_authentication
  package:app/models
    class:app/models/Configuration
      function:app/models/Configuration.find
      function:app/models/Configuration#attributes
      function:app/models/Configuration#attributes=
    class:app/models/ScannerFinding
      function:app/models/ScannerFinding.defer
    class:app/models/ScannerJob
      function:app/models/ScannerJob.fetch
    class:app/models/Search
      function:app/models/Search#filter
    class:app/models/ThirdPartyIntegration
      function:app/models/ThirdPartyIntegration.get_installation_ids
      function:app/models/ThirdPartyIntegration.get_repositories
    class:app/models/User
      function:app/models/User.find_by_id!
    package:app/models/app
      class:app/models/app/App
        class:app/models/app/App::Search
          function:app/models/app/App::Search#base_dataset
          function:app/models/app/App::Search#find_by_id!
        class:app/models/app/App::Show
          function:app/models/app/App::Show#org
    package:app/models/dao
      class:app/models/dao/DAO
        class:app/models/dao/DAO::Mapset
          function:app/models/dao/DAO::Mapset#vacuum
        class:app/models/dao/DAO::PublicResource
          function:app/models/dao/DAO::PublicResource.coerce
          function:app/models/dao/DAO::PublicResource.scope
        class:app/models/dao/DAO::Scenario
          function:app/models/dao/DAO::Scenario#before_save
          function:app/models/dao/DAO::Scenario#raw_data
          function:app/models/dao/DAO::Scenario#store_raw_data
          function:app/models/dao/DAO::Scenario#validate
        class:app/models/dao/DAO::SequelUtil
          function:app/models/dao/DAO::SequelUtil.build_where_clause
        class:app/models/dao/DAO::ToModel
          function:app/models/dao/DAO::ToModel#to_model
      package:app/models/dao/scanner
        class:app/models/dao/scanner/DAO
          class:app/models/dao/scanner/DAO::Scanner
            class:app/models/dao/scanner/DAO::Scanner::Finding
              function:app/models/dao/scanner/DAO::Scanner::Finding#to_model
    package:app/models/mapset
      class:app/models/mapset/Mapset
        class:app/models/mapset/Mapset::Build
          function:app/models/mapset/Mapset::Build#save!
          function:app/models/mapset/Mapset::Build#valid?
          function:app/models/mapset/Mapset::Build#validate
        class:app/models/mapset/Mapset::Show
          function:app/models/mapset/Mapset::Show#app
        class:app/models/mapset/Mapset::Vacuum
          function:app/models/mapset/Mapset::Vacuum#perform
    package:app/models/normalize
      class:app/models/normalize/Normalize
        class:app/models/normalize/Normalize::HTTPServerRequest
          function:app/models/normalize/Normalize::HTTPServerRequest#normalize
          function:app/models/normalize/Normalize::HTTPServerRequest#write_client_normalized_path_info
        class:app/models/normalize/Normalize::SQL
          function:app/models/normalize/Normalize::SQL#normalize
          function:app/models/normalize/Normalize::SQL#normalize_sql
          function:app/models/normalize/Normalize::SQL#normalize_sql_default
    package:app/models/scanner_job
      class:app/models/scanner_job/ScannerJob
        class:app/models/scanner_job/ScannerJob::Build
          function:app/models/scanner_job/ScannerJob::Build#save!
          function:app/models/scanner_job/ScannerJob::Build#valid?
          function:app/models/scanner_job/ScannerJob::Build#validate
        class:app/models/scanner_job/ScannerJob::Show
          function:app/models/scanner_job/ScannerJob::Show#app
          function:app/models/scanner_job/ScannerJob::Show#findings
          function:app/models/scanner_job/ScannerJob::Show#mapset
    package:app/models/scenario
      class:app/models/scenario/Scenario
        class:app/models/scenario/Scenario::Build
          function:app/models/scenario/Scenario::Build#apply_default_metadata
          function:app/models/scenario/Scenario::Build#build
          function:app/models/scenario/Scenario::Build#normalize_events
          function:app/models/scenario/Scenario::Build#save!
          function:app/models/scenario/Scenario::Build#valid?
          function:app/models/scenario/Scenario::Build#validate
          function:app/models/scenario/Scenario::Build#validate_data
        class:app/models/scenario/Scenario::SaveScenario
          function:app/models/scenario/Scenario::SaveScenario#save_scenario
        class:app/models/scenario/Scenario::ScenarioData
          function:app/models/scenario/Scenario::ScenarioData#metadata
          function:app/models/scenario/Scenario::ScenarioData#scenario_data
    package:app/models/user
      class:app/models/user/User
        class:app/models/user/User::Show
          function:app/models/user/User::Show#accept_eula?
          function:app/models/user/User::Show#admin?
          function:app/models/user/User::Show#member_of?
  package:app/services
    class:app/services/ApplicationService
      function:app/services/ApplicationService#client=
    class:app/services/ApplicationServiceClient
      function:app/services/ApplicationServiceClient#client
    class:app/services/GitHub
      class:app/services/GitHub::Clients
        class:app/services/GitHub::Clients::App
          function:app/services/GitHub::Clients::App#authenticate_installation
    package:app/services/git_hub
      package:app/services/git_hub/clients
        class:app/services/git_hub/clients/GitHub
          class:app/services/git_hub/clients/GitHub::Clients
            class:app/services/git_hub/clients/GitHub::Clients::App
              function:app/services/git_hub/clients/GitHub::Clients::App#installation_client
package:json
  class:json/JSON
    class:json/JSON::Ext
      class:json/JSON::Ext::Generator
        class:json/JSON::Ext::Generator::State
          function:json/JSON::Ext::Generator::State#generate
      class:json/JSON::Ext::Parser
        function:json/JSON::Ext::Parser#parse
package:lib
  package:lib/appland
    class:lib/appland/Appland
      class:lib/appland/Appland::Util
        function:lib/appland/Appland::Util.version_match?
package:logger
  class:logger/Logger
    class:logger/Logger::LogDevice
      function:logger/Logger::LogDevice#write
package:octokit
  class:octokit/Octokit
    class:octokit/Octokit::Configurable
      function:octokit/Octokit::Configurable.keys
package:openssl
  class:openssl/OpenSSL
    class:openssl/OpenSSL::Cipher
      function:openssl/OpenSSL::Cipher#decrypt
      function:openssl/OpenSSL::Cipher#encrypt
    class:openssl/OpenSSL::PKey
      class:openssl/OpenSSL::PKey::PKey
        function:openssl/OpenSSL::PKey::PKey#sign
package:ruby
  class:ruby/String
    function:ruby/String#unpack
    function:ruby/String#unpack1
`
        .trim()
        .split('\n')
    );
  });
});

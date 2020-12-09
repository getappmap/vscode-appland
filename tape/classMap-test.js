// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const test = require('tape');
const ClassMap = require('../media/models/classMap');
const fs = require('fs');

function readJSON(name) {
  return JSON.parse(fs.readFileSync(`./tape/data/${name}`));
}

const scenario = readJSON('user_page_scenario.appmap.json');
const userPageClassMap = new ClassMap(scenario.classMap);

test('ClassMap', (t) => {
  t.test('should have root ids', (t) => {
    t.deepEqual(userPageClassMap.roots.map((co) => co.id), [ 'json', 'net/http', 'openssl', 'app/models', 'app/controllers' ])
    t.end();
  });
  t.test('should have root names', (t) => {
    t.deepEqual(userPageClassMap.roots.map((co) => co.name), [ 'json', 'net/http', 'openssl', 'app/models', 'app/controllers' ])
    t.deepEqual(Array.from(new Set(userPageClassMap.roots.map((co) => co.location))), [ undefined ])
    t.end();
  });
  t.test('package should not have a locations list', (t) => {
    const modelsPackage = userPageClassMap.codeObjectFromId('app/models');
    t.deepEqual(modelsPackage.locations, []);
    t.end();
  });
  t.test('class should have locations list', (t) => {
    const userClass = userPageClassMap.codeObjectFromId('app/models/User::Show');
    t.deepEqual(userClass.locations, [ 'app/models/user.rb' ]);
    t.end();
  });
  t.test('function should have locations list', (t) => {
    const userClass = userPageClassMap.codeObjectFromId('app/models/User::Show#accept_eula?');
    t.deepEqual(userClass.locations, [ 'app/models/user.rb:109' ]);
    t.end();
  });
  t.test('function can be looked up by location', (t) => {
    const userClass = userPageClassMap.codeObjectsAtLocation('app/models/user.rb:109');
    t.deepEqual(userClass.map((co) => co.id), [ 'app/models/User::Show#accept_eula?' ]);
    t.end();
  });
});

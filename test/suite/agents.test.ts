// import assert from 'assert';
import AppMapAgentRuby from '../../src/agent/appMapAgentRuby';

suite('AppMap agents', () => {
  suite('Ruby', () => {
    const agent = new AppMapAgentRuby();

    test('install', async function() {
      this.skip();

      await agent.install('.');
    });

    test('install', async function() {
      this.skip();

      await agent.init('.');
    });

    test('files', async function() {
      this.skip();

      await agent.files('.');
    });

    test('status', async function() {
      this.skip();

      await agent.status('.');
    });
  });
});

// import assert from 'assert';
import AppMapAgentRuby from '../../src/agent/appMapAgentRuby';

describe('AppMap agents', () => {
  describe('Ruby', () => {
    const agent = new AppMapAgentRuby();

    it('install', async function() {
      this.skip();

      await agent.install('.');
    });

    it('install', async function() {
      this.skip();

      await agent.init('.');
    });

    it('files', async function() {
      this.skip();

      await agent.files('.');
    });

    it('status', async function() {
      this.skip();

      await agent.status('.');
    });
  });
});

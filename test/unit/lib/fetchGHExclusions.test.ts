import { expect } from 'chai';
import nock from 'nock';

import fetchGHExclusions, { GitHubContentExclusion } from '../../../src/lib/fetchGHExclusions';

describe('fetchGHExclusions', () => {
  const githubToken = 'test-token';
  const apiUrl = 'https://api.github.com';

  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch exclusions successfully', async () => {
    const mockResponse: GitHubContentExclusion[] = [
      {
        rules: [{ source: { name: 'test', type: 'type' }, paths: ['path1', 'path2'] }],
        last_updated_at: '2023-01-01T00:00:00Z',
        scope: 'all',
      },
    ];

    nock(apiUrl)
      .get('/copilot_internal/content_exclusion')
      .query({ scope: 'all' })
      .reply(200, mockResponse);

    const exclusions = await fetchGHExclusions(githubToken, 'all');
    expect(exclusions).to.deep.equal(mockResponse);
  });

  it('should return an empty array for 404 response', async () => {
    nock(apiUrl).get('/copilot_internal/content_exclusion').query({ scope: 'all' }).reply(404);

    const exclusions = await fetchGHExclusions(githubToken, 'all');
    expect(exclusions).to.deep.equal([]);
  });

  it('should throw an error for non-200 and non-404 responses', async () => {
    nock(apiUrl).get('/copilot_internal/content_exclusion').query({ scope: 'all' }).reply(500);

    try {
      await fetchGHExclusions(githubToken, 'all');
      throw new Error('Expected fetchGHExclusions to throw an error');
    } catch (err) {
      expect(err).to.be.an.instanceOf(Error);
      expect((err as Error).message).to.equal('Failed to fetch exclusions: Internal Server Error');
    }
  });
});

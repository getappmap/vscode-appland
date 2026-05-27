import { expect } from 'chai';
import SplunkTelemetryReporter from '../../../src/telemetry/splunkTelemetryReporter';

describe('SplunkTelemetryReporter', () => {
  it('throws on invalid URL', () => {
    // URL constructor throws if protocol is missing or URL is otherwise malformed
    expect(() => {
      new SplunkTelemetryReporter('invalid-url', 'token', {});
    }).to.throw();
  });

  it('works with valid URL', () => {
    const reporter = new SplunkTelemetryReporter('https://splunk.example.com:8088', 'token', {});
    expect(reporter).to.be.instanceOf(SplunkTelemetryReporter);
  });
});

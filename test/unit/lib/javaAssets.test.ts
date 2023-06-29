import { default as chai, expect } from 'chai';
import { default as chaiAsPromised } from 'chai-as-promised';
import sinon from 'sinon';
import '../mock/vscode';
import JavaAssetDownloader from '../../../src/lib/javaAssetDownloader';
import JavaAssets, { AssetStatus } from '../../../src/services/javaAssets';
import LockfileSynchronizer from '../../../src/lib/lockfileSynchronizer';

chai.use(chaiAsPromised);

describe('JavaAssets', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    JavaAssets.status = AssetStatus.Pending;
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('error handling', () => {
    beforeEach(() => {
      sandbox
        .stub(JavaAssetDownloader.prototype, 'installLatestJavaJar')
        .rejects(new Error('test error'));
    });

    it('raises an exception if raiseOnError is true', async () => {
      const promise = JavaAssets.installLatestJavaJar(true);
      await expect(promise).to.be.rejectedWith(Error, 'test error');
      expect(JavaAssets.status).to.eq(AssetStatus.Error);
    });

    it('ignores exceptions if raiseOnError is false', async () => {
      const promise = JavaAssets.installLatestJavaJar(false);
      await expect(promise).to.eventually.be.eq(undefined);
      expect(JavaAssets.status).to.eq(AssetStatus.Error);
    });
  });

  describe('status', () => {
    beforeEach(() => {
      console.log('@@@');
      sandbox.stub(JavaAssetDownloader.prototype, 'installLatestJavaJar').resolves();
    });

    it('reflects the download status of the lock holder', async () => {
      const statusesObserved: AssetStatus[] = [];
      JavaAssets.onStatusChanged((status) => statusesObserved.push(status));

      await JavaAssets.installLatestJavaJar(false);

      expect(statusesObserved).to.deep.eq([AssetStatus.Updating, AssetStatus.UpToDate]);
    });

    it('reflects the download status of the waiting instance', async () => {
      // By stubbing the execute method we can effectively simulate the waiting instance
      // by emitting the relevant events.
      const stub = sandbox.stub(LockfileSynchronizer.prototype, 'execute');
      return new Promise((resolve) => {
        stub.callsFake(async () => {
          stub.thisValues[0].emit('wait');
          expect(JavaAssets.status).to.eq(AssetStatus.Updating);

          stub.thisValues[0].emit('success');
          expect(JavaAssets.status).to.eq(AssetStatus.UpToDate);

          return Promise.resolve();
        });

        JavaAssets.installLatestJavaJar(false).then(() => {
          expect(stub.callCount).to.eq(1);
          resolve();
        });
      });
    });
  });
});

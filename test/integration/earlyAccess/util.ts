import { RuntimeAnalysisCtaServiceInstance } from '../../../src/services/runtimeAnalysisCtaService';

export async function waitForEligibility(
  serviceInstances: RuntimeAnalysisCtaServiceInstance[],
  expected: boolean,
  timeout = 10 * 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const msg = `timeout exceeded waiting for eligibility to be ${expected}`;
      reject(new Error(msg));
    }, timeout);

    const disposibles = serviceInstances.map((i) =>
      i.onCheckEligibility((eligible) => {
        if (eligible === expected) {
          disposibles.forEach((d) => d.dispose());
          resolve();
        }
      })
    );
  });
}

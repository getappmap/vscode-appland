/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const onDidChangeSessions = (..._args: any[]) => {
  return {
    dispose: () => {
      /* noop */
    },
  };
};

export const getSession = (..._args: any[]) => {
  return undefined;
};

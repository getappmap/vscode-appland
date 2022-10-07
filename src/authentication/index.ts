// This was previously exported within `appmapServerAuthenticationProvider.ts`, however by doing so
// it introduces dependencies which rely on transpiled content (HTML files). This works in the packaged
// extension (because of Webpack), but fails during tests. As a quick fix, this export has been moved out.
export const AUTHN_PROVIDER_NAME = 'appmap.server';

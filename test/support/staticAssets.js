// tsup bundles .html/.svg as text (see tsup.config.ts loaders); ts-node has no
// equivalent, so teach CommonJS to load them as strings for tests.
const fs = require('fs');

for (const ext of ['.html', '.svg']) {
  require.extensions[ext] = (module, filename) => {
    module.exports = fs.readFileSync(filename, 'utf8');
  };
}

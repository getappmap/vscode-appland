#!/usr/bin/env node

import * as fs from 'fs/promises';
import JSZip from 'jszip';

async function main(vsixPath: string, siteConfigPath: string) {
  // 1. Extract the VSIX
  const contents = await fs.readFile(vsixPath);
  const zip = await JSZip.loadAsync(new Uint8Array(contents));

  const packageJsonFile = zip.file('extension/package.json');
  if (!packageJsonFile) {
    console.error('Error: package.json not found in VSIX');
    process.exit(1);
  }

  const packageJsonContent = await packageJsonFile.async('string');

  const siteConfigContent = await fs.readFile(siteConfigPath, 'utf8');
  if (!siteConfigContent) {
    console.error('Error: site-config.json not found or empty');
    process.exit(1);
  }
  const siteConfig = JSON.parse(siteConfigContent);

  zip.file('extension/package.json.orig', packageJsonContent);
  const packageJson = JSON.parse(packageJsonContent);

  // 3. Update package.json based on site-config.json
  if (!packageJson.contributes || !packageJson.contributes.configuration) {
    packageJson.contributes = {
      configuration: {
        properties: {},
      },
    };
  }
  const configProperties = packageJson.contributes.configuration.properties;

  for (const key in siteConfig) {
    console.log(`Setting ${key} to ${JSON.stringify(siteConfig[key])}`);
    if (!configProperties[key]) {
      // Add new properties with empty markdownDescription to hide them
      configProperties[key] = {
        type: typeof siteConfig[key],
        default: siteConfig[key],
        markdownDescription: '',
      };
    } else {
      // Update existing properties
      configProperties[key].default = siteConfig[key];
    }
  }

  // 4. Add site-config.json to the VSIX folder for reference
  zip.file('extension/site-config.json', siteConfigContent);

  // 5. Update the version number
  let version = packageJson.version;
  // add +YYYYmmDD to the version
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateSuffix = `+${yyyy}${mm}${dd}`;

  if (!version.includes('+')) {
    version += dateSuffix;
  } else {
    version = version.split('+')[0] + dateSuffix;
  }

  // Write the updated package.json
  zip.file('extension/package.json', JSON.stringify({ ...packageJson, version }, null, 2));

  const outputVsixPath = vsixPath.replace(/\.vsix$/, `-${yyyy}${mm}${dd}.vsix`);

  // 6. Repack the VSIX
  const newContents = await zip.generateAsync({ type: 'uint8array' });
  await fs.writeFile(outputVsixPath, newContents);

  console.log(`Successfully modified VSIX. New file is at: ${outputVsixPath}`);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: bundleConfig <input.vsix> <site-config.json>');
  process.exitCode = 1;
}
const [vsixPath, siteConfigPath] = args;
main(vsixPath, siteConfigPath).catch((err) => {
  console.error('Error:', err);
  process.exitCode = 1;
});

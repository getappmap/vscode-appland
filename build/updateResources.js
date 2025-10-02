const { readFile, writeFile, stat } = require('fs/promises');
const { join } = require('path');

const resourceDir = join(__dirname, '..', 'resources');

function fetchLatestNpmVersion(packageName) {
  const url = `https://registry.npmjs.org/${packageName}`;
  return fetch(url)
    .then((res) => res.json())
    .then((data) => data['dist-tags'].latest);
}

function fetchLatestGitHubReleaseVersion(repo) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  return fetch(url)
    .then((res) => res.json())
    .then((data) => data.tag_name.replace(/^v/, ''));
}

function downloadGitHubRelease(repo, version) {
  const url = `https://github.com/${repo}/releases/download/v${version}/appmap-${version}.jar`;
  return fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => writeFile(join(resourceDir, `appmap-${version}.jar`), Buffer.from(data)));
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

async function main() {
  const appmapVersion = await fetchLatestNpmVersion('@appland/appmap');
  const scannerVersion = await fetchLatestNpmVersion('@appland/scanner');
  const agentJarVersion = await fetchLatestGitHubReleaseVersion('getappmap/appmap-java');
  const jarExists = await fileExists(join(resourceDir, `appmap-${agentJarVersion}.jar`));
  const versionDeclarations = await readFile(join(resourceDir, 'versions.json'), 'utf-8').then(
    JSON.parse
  );

  let changed = false;
  if (versionDeclarations['appmap'] !== appmapVersion) {
    console.log(`Updating appmap to v${appmapVersion}...`);
    changed = true;
  }
  if (versionDeclarations['scanner'] !== scannerVersion) {
    console.log(`Updating scanner to v${scannerVersion}...`);
    changed = true;
  }
  if (versionDeclarations['appmap-java.jar'] !== agentJarVersion || !jarExists) {
    console.log(`Downloading appmap-java.jar v${agentJarVersion}...`);
    downloadGitHubRelease('getappmap/appmap-java', agentJarVersion);
    changed = true;
  }

  if (!changed) {
    console.log('All resources are up to date. No changes have been made.');
    return;
  }

  await writeFile(
    join(resourceDir, 'versions.json'),
    JSON.stringify(
      {
        appmap: appmapVersion,
        scanner: scannerVersion,
        'appmap-java.jar': agentJarVersion,
      },
      null,
      2
    )
  );
}

main();

const { readFile, writeFile, stat } = require('fs/promises');
const { join } = require('path');

const resourceDir = join(__dirname, '..', 'resources');

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
  const agentJarVersion = await fetchLatestGitHubReleaseVersion('getappmap/appmap-java');
  const jarExists = await fileExists(join(resourceDir, `appmap-${agentJarVersion}.jar`));
  const versionDeclarations = await readFile(join(resourceDir, 'versions.json'), 'utf-8').then(
    JSON.parse
  );

  if (versionDeclarations['appmap-java.jar'] === agentJarVersion && jarExists) {
    console.log('All resources are up to date. No changes have been made.');
    return;
  }

  console.log(`Downloading appmap-java.jar v${agentJarVersion}...`);
  await downloadGitHubRelease('getappmap/appmap-java', agentJarVersion);

  await writeFile(
    join(resourceDir, 'versions.json'),
    JSON.stringify({ 'appmap-java.jar': agentJarVersion }, null, 2)
  );
}

main();

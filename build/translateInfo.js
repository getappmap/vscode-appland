#!/usr/bin/env node

// The translate methods below transform the output of `yarn info --json` into
// the same JSON format output by `yarn list --json` so that vsce can properly
// parse the output. vsce does not support the new `yarn info` format.
function translateChildren(children) {
  return (children.Dependencies || []).map((child) => translateV3toV1(child));
}

function translateV3toV1(dependency) {
  return {
    name: dependency.value || dependency.descriptor,
    children: translateChildren(dependency.children || []),
  };
}

process.stdin.resume();
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', function(chunk) {
  buffer += chunk;
});

process.stdin.on('end', () => {
  const lines = buffer.toString().split(/\r?\n/);

  const trees = [];
  lines.forEach((line) => {
    if (line === '') return;
    const tree = JSON.parse(line);
    trees.push(translateV3toV1(tree));
  });

  console.log(JSON.stringify({ type: 'tree', data: { type: 'list', trees } }));
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { run as jscodeshift } from 'jscodeshift/src/Runner.js';
import * as prettier from 'prettier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { level } = parseArgs({
  options: {
    level: {
      type: 'string',
      default: '1',
      short: 'l',
    },
  },
}).values;

function checkFileExists(file) {
  return fs
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

// Create a submission staging directory
await fs.mkdir('./submit', { recursive: true });

// Copy the files to the submit stage
await fs.cp(`./levels/${level}/codemod-starter.js`, './submit/submission.cjs');
await fs.cp(`./levels/${level}/input.js`, './submit/input.js');
if (await checkFileExists('./submission.js')) {
  await fs.cp('./submission.js', './submit/submission.cjs');
}

// Run the transform
await jscodeshift(
  path.join(__dirname, './submit/submission.cjs'),
  [path.join(__dirname, './submit/input.js')],
  {}
);

// Run the transformed code through Prettier and write the result back to file
const transformedCode = await fs.readFile('./submit/input.js', { encoding: 'utf-8'});
const formattedCode = await prettier.format(transformedCode, { parser: 'babel' })
await fs.writeFile('./submit/input.js', formattedCode);

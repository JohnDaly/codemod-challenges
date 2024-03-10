import './style.css';
import 'xterm/css/xterm.css';

import { WebContainer } from '@webcontainer/api';
import { codeToHtml } from 'shiki/index.mjs';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import * as monaco from 'monaco-editor';

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance;

async function installDependencies(terminal) {
  // Install dependencies
  const installProcess = await webcontainerInstance.spawn('npm', ['install']);

  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  // Wait for install command to exit
  return installProcess.exit;
}

function getLevel() {
  return levelSelectEl.value;
}

async function loadLevel() {
  const level = getLevel();
  const inputText = await webcontainerInstance.fs.readFile(
    `./levels/${level}/input.js`,
    'utf-8'
  );
  inputContainer.innerHTML = await codeToHtml(inputText, {
    lang: 'javascript',
    theme: 'github-dark-dimmed',
  });
  const outputText = await webcontainerInstance.fs.readFile(
    `./levels/${level}/output.js`,
    'utf-8'
  );
  outputContainer.innerHTML = await codeToHtml(outputText, {
    lang: 'javascript',
    theme: 'github-dark-dimmed',
  });
  codeEditor.setValue(
    await webcontainerInstance.fs.readFile(
      `./levels/${level}/codemod-starter.js`,
      'utf-8'
    )
  );
  submissionContainer.innerHTML = '';
  submissionResultEl.innerHTML = '';
}

/** @param {string} content*/
async function writeSubmissionFile(content) {
  await webcontainerInstance.fs.writeFile('/submission.js', content);
}

window.addEventListener('load', async () => {
  const fitAddon = new FitAddon();
  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.loadAddon(fitAddon);
  terminal.open(terminalEl);
  fitAddon.fit();

  window.addEventListener('resize', () => {
    fitAddon.fit();
  });

  codeEditor.onDidChangeModelContent((e) => {
    writeSubmissionFile(codeEditor.getValue());
  });

  submitButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const serverProcess = await webcontainerInstance.spawn('npm', [
      'run',
      'transform',
      '--',
      '--level',
      getLevel(),
    ]);
    serverProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal.write(data);
        },
      })
    );
    await serverProcess.exit;
    const submissionText = await webcontainerInstance.fs.readFile(
      './submit/input.js',
      'utf-8'
    );
    submissionContainer.innerHTML = await codeToHtml(submissionText, {
      lang: 'javascript',
      theme: 'github-dark-dimmed',
    });

    // Compare
    const level = getLevel();
    const expectedText = await webcontainerInstance.fs.readFile(
      `./levels/${level}/output.js`,
      'utf-8'
    );
    if (submissionText === expectedText) {
      submissionResultEl.innerHTML = `✅ Submission matches expected output`;
    } else {
      submissionResultEl.innerHTML = `❌ Submission doesn't match expected output`;
    }
  });

  toggleConsoleButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const currentClass = terminalEl.getAttribute('class');
    if (currentClass.includes('terminal-hidden')) {
      terminalEl.setAttribute('class', 'terminal');
      toggleConsoleButton.textContent = 'Hide Terminal';
    } else {
      terminalEl.setAttribute('class', 'terminal terminal-hidden');
      toggleConsoleButton.textContent = 'Show Terminal';
    }
  });

  levelSelectEl.addEventListener('change', async (e) => {
    await loadLevel();
  });

  // Get filesystem snapshot from the server
  const snapshotResponse = await fetch('/filesystem-snapshot');
  const snapshot = await snapshotResponse.arrayBuffer();

  // Call only once
  webcontainerInstance = await WebContainer.boot();
  await webcontainerInstance.mount(snapshot);

  const exitCode = await installDependencies(terminal);
  if (exitCode !== 0) {
    throw new Error('Installation failed');
  }

  await loadLevel();

  document.getElementById('app-content').setAttribute('class', 'app-content');
});

document.querySelector('#app').innerHTML = `
  <h1>Codemod Challenge</h1>
  <p>
    Write a codemod using JSCodeshift to transform the 'INPUT' code so that it matches 'OUTPUT'
  </p>
  <label for="level-select">Level:</label>
  <select name="level" id="level-select">
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3</option>
  </select>
  <br />
  <br />
  <div id="app-content" class="app-content app-content-hidden">
    <div class="container">
      <fieldset>
        <legend>INPUT</legend>
        <div class="code-container" id="input-container">
        </div>
      </fieldset>
      <fieldset>
        <legend>OUTPUT</legend>
        <div class="code-container" id="output-container">
        </div>
      </fieldset>
    </div>
    <br />
    <div class="container-editor-submission">
      <fieldset>
        <legend>
          EDITOR
          <button id="submit-btn">Submit Transform</button>
        </legend>
        <div id="codemod-input"></div>
      </fieldset>
      <fieldset>
        <legend>Submission</legend>
        <div class="code-container" id="submission-container"></div>
        <div id="submission-result"></div>
      </fieldset>
    </div>
    <fieldset>
      <legend>
        <button id="toggle-console-btn">Hide Terminal</button>
      </legend>
      <div class="terminal"></div>
    </fieldset>
  </div>
`;

/** @type {HTMLTextAreaElement | null} */
const terminalEl = document.querySelector('.terminal');

const inputContainer = document.getElementById('input-container');
const outputContainer = document.getElementById('output-container');
const submissionContainer = document.getElementById('submission-container');
const submissionResultEl = document.getElementById('submission-result');
const submitButton = document.getElementById('submit-btn');
const toggleConsoleButton = document.getElementById('toggle-console-btn');
const levelSelectEl = document.getElementById('level-select');

const codeEditor = monaco.editor.create(
  document.getElementById('codemod-input'),
  {
    value: '',
    language: 'typescript',
    minimap: { enabled: false },
    theme: 'vs-dark',
    automaticLayout: true,
    scrollBeyondLastLine: false,
  }
);

#!/usr/bin/env node
// Unified CLI Automation Script for Taqyon
// Implements the workflow in docs/cli_workflow_and_structure.md

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { execSync } = require('child_process');
// --- Utility functions ---
function validateDirName(name) {
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name) || 'Directory name must start with a letter and contain only letters, numbers, underscores, or hyphens.';
}
function parseArgs() {
  // Simple arg parser for --skip-frontend, --skip-backend, project name
  const args = process.argv.slice(2);
  let projectName = null;
  let skipFrontend = false;
  let skipBackend = false;
  let customFrontend = null;
  let customBackend = null;
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === '--skip-frontend') skipFrontend = true;
    else if (args[i] === '--skip-backend') skipBackend = true;
    else if (args[i] === '--frontend-dir' && args[i+1]) { customFrontend = args[i+1]; i++; }
    else if (args[i] === '--backend-dir' && args[i+1]) { customBackend = args[i+1]; i++; }
    else if (!args[i].startsWith('--') && !projectName) projectName = args[i];
  }
  return { projectName, skipFrontend, skipBackend, customFrontend, customBackend };
}

// --- Qt6 detection utility ---
function detectQt6() {
  // Try qmake -v, qtpaths, and common install locations
  try {
    const qmakePath = execSync('which qmake6 || which qmake', { stdio: 'pipe' }).toString().trim();
    if (qmakePath) {
      const qtDir = path.dirname(path.dirname(qmakePath));
      return qtDir;
    }
  } catch {}
  // Try common install locations
  const candidates = [
    '/usr/local/opt/qt6', // Homebrew (macOS)
    '/usr/local/opt/qt',
    '/usr/local/Qt-6',
    '/usr/local/Qt',
    '/opt/qt6',
    '/opt/Qt6',
    '/opt/Qt',
    path.join(os.homedir(), 'Qt', '6.6.0', 'gcc_64'), // Qt online installer (Linux)
    path.join(os.homedir(), 'Qt', '6.6.0', 'clang_64'), // Qt online installer (macOS)
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// --- Main async function ---
async function main() {
  // --- 1. Parse CLI args ---
  const { projectName: argProjectName, skipFrontend: argSkipFrontend, skipBackend: argSkipBackend, customFrontend, customBackend } = parseArgs();

  // --- 2. Prompt for project name if not provided ---
  let projectName = argProjectName;
  if (!projectName) {
    const { pname } = await inquirer.prompt([{
      type: 'input',
      name: 'pname',
      message: 'Project name:',
      validate: validateDirName,
    }]);
    projectName = pname;
  }

  // --- 3. Prompt for skip options if not provided via args ---
  let skipFrontend = argSkipFrontend;
  let skipBackend = argSkipBackend;
  if (!argSkipFrontend && !argSkipBackend) {
    const { scaffoldFrontend, scaffoldBackend } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'scaffoldFrontend',
        message: 'Scaffold frontend?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'scaffoldBackend',
        message: 'Scaffold backend?',
        default: true,
      }
    ]);
    skipFrontend = !scaffoldFrontend;
    skipBackend = !scaffoldBackend;
  }

  // --- 4. Prompt for frontend framework if not skipped ---
  let frontendFramework = null;
  if (!skipFrontend) {
    const { framework } = await inquirer.prompt([{
      type: 'list',
      name: 'framework',
      message: 'Select a frontend framework:',
      choices: ['React', 'Vue', 'Svelte'],
      filter: v => v.trim(),
    }]);
    frontendFramework = framework;
  }

  // --- 5. Prompt for custom directory names (optional) ---
  let frontendDir = customFrontend || 'frontend';
  let backendDir = customBackend || 'backend';
  if (!skipFrontend) {
    const { inputFrontendDir } = await inquirer.prompt([{
      type: 'input',
      name: 'inputFrontendDir',
      message: `Frontend directory name:`,
      default: frontendDir,
      validate: validateDirName,
    }]);
    frontendDir = inputFrontendDir;
  }
  if (!skipBackend) {
    const { inputBackendDir } = await inquirer.prompt([{
      type: 'input',
      name: 'inputBackendDir',
      message: `Backend directory name:`,
      default: backendDir,
      validate: validateDirName,
    }]);
    backendDir = inputBackendDir;
  }

  // --- 6. Prepare directory structure ---
  const rootDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(rootDir)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory "${projectName}" already exists. Overwrite?`,
      default: false,
    }]);
    if (!overwrite) {
      console.log('Aborted.');
      process.exit(1);
    }
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
  fs.mkdirSync(rootDir, { recursive: true });

  // --- Frontend scaffolding (robust) ---
  if (!skipFrontend) {
    const frontendPath = path.join(rootDir, frontendDir);
    let scaffoldingSucceeded = false;
    try {
      let cmd, args;
      if (frontendFramework) {
        if (frontendFramework.toLowerCase() === 'react') {
          cmd = 'npx';
          args = ['create-react-app', '.', '--template', 'typescript'];
        } else if (frontendFramework.toLowerCase() === 'vue') {
          cmd = 'npm';
          args = ['create', 'vue@latest', '.'];
        } else if (frontendFramework.toLowerCase() === 'svelte') {
          cmd = 'npm';
          args = ['create', 'svelte@latest', '.'];
        }
        fs.mkdirSync(frontendPath, { recursive: true });
        console.log(`Scaffolding ${frontendFramework} app in ${frontendPath}...`);
        execSync([cmd, ...args].join(' '), { cwd: frontendPath, stdio: 'inherit' });
        // Check for package.json
        if (!fs.existsSync(path.join(frontendPath, 'package.json')))
          throw new Error('Scaffolding did not produce package.json');
        scaffoldingSucceeded = true;
      } else {
        // No framework selected: write minimal package.json
        fs.mkdirSync(frontendPath, { recursive: true });
        const frontendPkgJson = {
          name: projectName + '-frontend',
          version: "0.1.0",
          private: true,
          scripts: {},
          dependencies: {}
        };
        fs.writeFileSync(
          path.join(frontendPath, 'package.json'),
          JSON.stringify(frontendPkgJson, null, 2)
        );
        scaffoldingSucceeded = true;
        console.log('No frontend framework selected. Wrote minimal frontend/package.json.');
      }
    } catch (err) {
      // Clean up on failure
      if (fs.existsSync(frontendPath)) fs.rmSync(frontendPath, { recursive: true, force: true });
      console.error(`Error: Failed to scaffold frontend.`, err.message);
      process.exit(1);
    }
    if (scaffoldingSucceeded) {
      console.log(`Frontend scaffolding complete: ${frontendDir}/ (${frontendFramework})`);
    }
  }

  // --- Backend scaffolding and Qt6 detection ---
  if (!skipBackend) {
    fs.mkdirSync(path.join(rootDir, backendDir), { recursive: true });
    // Qt6 detection
    let qt6Path = detectQt6();
    if (!qt6Path) {
      const { userQt6Path } = await inquirer.prompt([{
        type: 'input',
        name: 'userQt6Path',
        message: 'Qt6 not found automatically. Please enter the Qt6 installation path (containing lib/cmake/Qt6):',
        validate: p => fs.existsSync(p) ? true : 'Directory does not exist',
      }]);
      qt6Path = userQt6Path;
    }
    // Save to .taqyonrc
    const rcPath = path.join(rootDir, '.taqyonrc');
    fs.writeFileSync(rcPath, JSON.stringify({ qt6Path }, null, 2));
    console.log(`\n[INFO] Qt6 path saved to .taqyonrc. To build the backend, use:`);
    console.log(`   cmake -B build -DCMAKE_PREFIX_PATH=\"${qt6Path}\" && cmake --build build`);
    console.log('Or set CMAKE_PREFIX_PATH in your environment.');
  }

  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });

  // --- 7. Prepare for later steps (no templates/scripts here) ---
  // Placeholders for README, package.json, etc. (not implemented in this subtask)

  // --- 8. Summary ---
  console.log('\nScaffolded project structure:');
  console.log(`  ${projectName}/`);
  if (!skipFrontend) console.log(`    ${frontendDir}/   # ${frontendFramework} (to be set up)`);
  if (!skipBackend) console.log(`    ${backendDir}/    # Qt/C++ backend (to be set up)`);
  console.log(`    docs/`);
  console.log('  (Other files will be generated in later steps)');
  console.log('\nDone!');
}

main();

main();
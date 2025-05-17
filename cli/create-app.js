// ============================================================================
// Taqyon App Scaffolding Module
// ============================================================================

/**
 * @fileoverview
 * Scaffolds a new Taqyon app project (frontend, backend, Qt config, etc).
 * All user prompts use inquirer. All file and Qt operations use utility modules.
 * Exports a single async function: createApp.
 * No CLI argument parsing or subcommand logic is present.
 * Cross-platform and project-path-agnostic.
 */

import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    copyDirRecursiveSync,
    copyDirRecursiveWithReplace,
    copyFileSyncWithDirs,
} from './file-utils.js';
import {
    detectQt6,
    validateQtPath,
} from './qt-utils.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** @type {string} */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates');

// -----------------------------------------------------------------------------
// Main App Scaffolding Function
// -----------------------------------------------------------------------------

/**
 * Scaffolds a new Taqyon app project.
 * Prompts the user for project options, creates directories, copies templates,
 * detects Qt, and writes config/scripts.
 * @returns {Promise<void>}
 */
async function createApp() {
  console.log('Taqyon CLI - Project Scaffolding');

  // ---------------------------
  // 1. Prompt for Project Name
  // ---------------------------
  let projectName;
  try {
    ({ projectName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => !!input.trim() || 'Project name is required.',
      },
    ]));
  } catch (err) {
    console.error('Prompt failed:', err.message);
    process.exit(1);
  }

  // ---------------------------
  // 2. Prompt for Frontend/Backend
  // ---------------------------
  let scaffoldFrontend, scaffoldBackend;
  try {
    const answers = await inquirer.prompt([
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
      },
    ]);
    scaffoldFrontend = answers.scaffoldFrontend;
    scaffoldBackend = answers.scaffoldBackend;
  } catch (err) {
    console.error('Prompt failed:', err.message);
    process.exit(1);
  }

  // ---------------------------
  // 3. Prompt for Frontend Framework
  // ---------------------------
  let frontendFramework = null;
  if (scaffoldFrontend) {
    try {
      const { selectedFramework } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFramework',
          message: 'Select a frontend framework:',
          choices: [
            { name: 'React', value: 'react' },
            { name: 'Vue', value: 'vue' },
            { name: 'Svelte', value: 'svelte' },
          ],
          default: 'react',
        },
      ]);
      frontendFramework = selectedFramework;
    } catch (err) {
      console.error('Prompt failed:', err.message);
      process.exit(1);
    }
  }

  // ---------------------------
  // 3b. Prompt for Frontend Language
  // ---------------------------
  let frontendLanguage = null;
  if (scaffoldFrontend) {
    try {
      const { selectedLanguage } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedLanguage',
          message: 'Select a frontend language:',
          choices: [
            { name: 'JavaScript', value: 'js' },
            { name: 'TypeScript', value: 'ts' },
          ],
          default: 'js',
        },
      ]);
      frontendLanguage = selectedLanguage;
    } catch (err) {
      console.error('Prompt failed:', err.message);
      process.exit(1);
    }
  }

  // ---------------------------
  // 4. Create Project Root Directory
  // ---------------------------
  const projectRoot = path.resolve(process.cwd(), projectName);
  try {
    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create project directory:', err.message);
    process.exit(1);
  }

  // ---------------------------
  // 5. Scaffold Frontend
  // ---------------------------
  if (scaffoldFrontend) {
    try {
      const frontendDir = path.join(projectRoot, 'frontend');
      if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir, { recursive: true });
      }
      // Copy template based on framework
      // Determine template directory based on framework and language
      const templateDirName = `${frontendFramework}-${frontendLanguage}`;
      const frontendTemplateDir = path.join(TEMPLATE_DIR, 'frontend', templateDirName);
      if (!fs.existsSync(frontendTemplateDir)) {
        throw new Error(`Frontend template directory not found: ${frontendTemplateDir}`);
      }
      // Use variable replacement for React and Svelte, plain copy for Vue
      if (frontendFramework === 'react' || frontendFramework === 'svelte') {
        copyDirRecursiveWithReplace(frontendTemplateDir, frontendDir, { projectName });
      } else {
        copyDirRecursiveSync(frontendTemplateDir, frontendDir);
      }
      console.log(`Copied ${frontendFramework} (${frontendLanguage}) template from ${frontendTemplateDir} to ${frontendDir}`);

      // Inject correct bridge/loader files if not present
      const frontendSrcDir = path.join(frontendDir, 'src');
      const frontendPublicDir = path.join(frontendDir, 'public');

      // Bridge: .ts for TypeScript, .js for JavaScript
      let bridgeSrc, bridgeDest;
      if (frontendLanguage === 'ts') {
        bridgeSrc = path.join(frontendTemplateDir, 'src', 'qwebchannel-bridge.ts');
        bridgeDest = path.join(frontendSrcDir, 'qwebchannel-bridge.ts');
        if (!fs.existsSync(bridgeDest) && fs.existsSync(bridgeSrc)) {
          copyFileSyncWithDirs(bridgeSrc, bridgeDest);
          console.log('Injected qwebchannel-bridge.ts into frontend/src.');
        }
      } else {
        bridgeSrc = path.join(TEMPLATE_DIR, 'qwebchannel-bridge.js');
        bridgeDest = path.join(frontendSrcDir, 'qwebchannel-bridge.js');
        if (!fs.existsSync(bridgeDest)) {
          copyFileSyncWithDirs(bridgeSrc, bridgeDest);
          console.log('Injected qwebchannel-bridge.js into frontend/src.');
        }
      }

      // Loader: always .js (no .ts version exists)
      const loaderSrc = path.join(TEMPLATE_DIR, 'qwebchannel-loader.js');
      const loaderDest = path.join(frontendPublicDir, 'qwebchannel-loader.js');
      if (!fs.existsSync(loaderDest)) {
        copyFileSyncWithDirs(loaderSrc, loaderDest);
        console.log('Injected qwebchannel-loader.js into frontend/public.');
      }

      // Patch vite.config.js for Svelte (not Vue/React)
      if (frontendFramework === 'svelte') {
        const viteConfigPath = path.join(frontendDir, 'vite.config.js');
        if (fs.existsSync(viteConfigPath)) {
          let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
          if (!viteConfig.includes('base:')) {
            viteConfig = viteConfig.replace(
              /defineConfig\(\s*{([\s\S]*?)plugins:/,
              "defineConfig({\n  base: './',\n  $1plugins:"
            );
            fs.writeFileSync(viteConfigPath, viteConfig, 'utf8');
            console.log("Patched vite.config.js to set base: './' for file-based loading.");
          }
        }
      }

      // Check for frontend/package.json existence
      const pkgJsonPath = path.join(frontendDir, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) {
        throw new Error('frontend/package.json was not created. Frontend scaffolding failed or incomplete.');
      }

      console.log(`Frontend scaffolding complete: frontend/ (${frontendFramework})`);
    } catch (err) {
      console.error('Frontend scaffolding failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('Frontend scaffolding skipped.');
  }

  // ---------------------------
  // 6. Scaffold Backend
  // ---------------------------
  let detectedQt6Path = null;
  if (scaffoldBackend) {
    try {
      const srcDir = path.join(projectRoot, 'src');
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      // Prompt for backend features
      const { enableLogging, enableDevServer } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enableLogging',
          message: 'Enable logging?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'enableDevServer',
          message: 'Enable dev server?',
          default: true,
        },
      ]);

      // Copy backend template files with placeholder replacement
      const backendTemplateDir = path.join(TEMPLATE_DIR, 'src');
      const replacements = {
        projectName,
        projectVersion: '1.0.0',
        qt6Path: '/path/to/qt6', // Will be replaced after detection
        enableLogging: enableLogging ? '1' : '0',
        enableDevServer: enableDevServer ? '1' : '0',
      };
      copyDirRecursiveWithReplace(backendTemplateDir, srcDir, replacements);
      console.log('Copied backend template files to src/ with placeholder replacement.');

      // Detect Qt6 and add configuration
      detectedQt6Path = detectQt6();
      if (!detectedQt6Path) {
        console.log('\nWARNING: Qt6 was not detected automatically.');
        const { userQtPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'userQtPath',
            message: 'Enter Qt6 installation path (or press Enter to skip):',
          },
        ]);
        if (userQtPath) {
          const validPath = validateQtPath(userQtPath);
          if (validPath) {
            detectedQt6Path = validPath;
          } else {
            console.log('\nWARNING: The provided Qt6 path could not be validated.');
            console.log("The project will still be created, but you'll need to configure Qt manually.");
            console.log('See the README.md file for more information.\n');
          }
        }
      }

      // Create a helper script for building with the correct Qt path
      const isWindows = process.platform === 'win32';
      const buildScriptName = isWindows ? 'build.bat' : 'build.sh';
      const rcPath = path.join(projectRoot, '.taqyonrc');
      fs.writeFileSync(rcPath, JSON.stringify({ qt6Path: detectedQt6Path || null }, null, 2));

      let buildScriptContent;
      if (detectedQt6Path) {
        console.log(`\nQt6 found at: ${detectedQt6Path}`);
        buildScriptContent = isWindows
          ? `@echo off\ncmake -B build -DCMAKE_PREFIX_PATH="${detectedQt6Path}" && cmake --build build\n`
          : `#!/bin/bash\ncmake -B build -DCMAKE_PREFIX_PATH="${detectedQt6Path}" && cmake --build build\n`;
      } else {
        console.log('\nQt6 path not provided. Creating build script with instructions.');
        buildScriptContent = isWindows
          ? `@echo off\necho Qt6 was not detected during project creation.\necho Please specify the path to your Qt6 installation:\nset /p QT_PATH=Qt6 path: \nif not defined QT_PATH (\n  echo No Qt6 path provided. \n  echo You can manually run: cmake -B build -DCMAKE_PREFIX_PATH="path/to/qt6" ^&^& cmake --build build\n  exit /b 1\n)\necho Using Qt6 path: %QT_PATH%\ncmake -B build -DCMAKE_PREFIX_PATH="%QT_PATH%" && cmake --build build\n`
          : `#!/bin/bash\necho "Qt6 was not detected during project creation."\necho "Please specify the path to your Qt6 installation:"\nread -p "Qt6 path: " QT_PATH\nif [ -z "$QT_PATH" ]; then\n  echo "No Qt6 path provided."\n  echo "You can manually run: cmake -B build -DCMAKE_PREFIX_PATH=\\"path/to/qt6\\" && cmake --build build"\n  exit 1\nfi\necho "Using Qt6 path: $QT_PATH"\ncmake -B build -DCMAKE_PREFIX_PATH="$QT_PATH" && cmake --build build\n`;
      }
      fs.writeFileSync(path.join(srcDir, buildScriptName), buildScriptContent);
      if (!isWindows) {
        fs.chmodSync(path.join(srcDir, buildScriptName), 0o755);
      }
      console.log(`Created build helper script: src/${buildScriptName}`);

      // List all files in srcDir for confirmation
      const srcFiles = fs.readdirSync(srcDir);
      srcFiles.forEach((f) => console.log('  src/' + f));
      console.log('Backend scaffolding complete.');
    } catch (err) {
      console.error('Backend scaffolding failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('Backend scaffolding skipped.');
  }

  // ---------------------------
  // 7. Create package.json
  // ---------------------------
  try {
    const packageJson = {
      name: projectName,
      version: '1.0.0',
      description: 'Taqyon project with Qt/C++ backend and JS frontend',
      scripts: {},
      dependencies: {},
      devDependencies: {
        concurrently: '^8.0.0',
        'cross-env': '^7.0.0',
        'wait-on': '^7.0.0',
      },
    };
    const isWindows = process.platform === 'win32';

    if (scaffoldFrontend) {
      packageJson.scripts['frontend:dev'] = 'npm run --if-present --prefix frontend dev';
      packageJson.scripts['frontend:build'] = 'npm run --if-present --prefix frontend build';
    }
    if (scaffoldBackend) {
      if (isWindows) {
        packageJson.scripts['app:build'] = 'cd src && .\\build.bat';
        packageJson.scripts['app:run'] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe) else (echo Application executable not found. Make sure to build successfully first.)`;
        packageJson.scripts['app:run:verbose'] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
        packageJson.scripts['app:run:dev'] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --dev-server http://localhost:3000 --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
        packageJson.scripts['app:run:log'] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --log app.log --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
        packageJson.scripts['app:help'] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --help) else (echo Application executable not found. Make sure to build successfully first.)`;
      } else {
        packageJson.scripts['app:build'] = 'cd src && chmod +x ./build.sh && ./build.sh';
        packageJson.scripts['app:run'] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName}; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        packageJson.scripts['app:run:verbose'] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        packageJson.scripts['app:run:dev'] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --dev-server http://localhost:3000 --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        packageJson.scripts['app:run:log'] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --log app.log --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        packageJson.scripts['app:help'] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --help; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
      }
    }
    if (scaffoldFrontend && scaffoldBackend) {
      if (isWindows) {
        packageJson.scripts['start'] = `npm run build && set ABSOLUTE_PATH=%cd%\\frontend\\dist && if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --verbose --frontend-path "%ABSOLUTE_PATH%") else (echo Application executable not found. Make sure to build successfully first.)`;
        packageJson.scripts['build'] = 'npm run frontend:build && npm run app:build';
        packageJson.scripts['dev'] = 'concurrently -k -r -s first "npm run frontend:dev" "npm run app:build && if not errorlevel 1 (wait-on tcp:localhost:3000 && npm run app:run:dev) else (echo Error: Failed to build Qt application. Check that Qt6 is properly installed with WebEngine and Positioning modules.)"';
      } else {
        packageJson.scripts['start'] = `npm run build && ABSOLUTE_PATH="$(pwd)/frontend/dist" && if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --verbose --frontend-path "$ABSOLUTE_PATH"; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        packageJson.scripts['build'] = 'npm run frontend:build && npm run app:build';
        packageJson.scripts['dev'] = 'concurrently -k -r -s first "npm run frontend:dev" "npm run app:build && if [ $? -eq 0 ]; then wait-on tcp:localhost:3000 && npm run app:run:dev; else echo \'Error: Failed to build Qt application. Check that Qt6 is properly installed with WebEngine and Positioning modules.\'; fi"';
      }
    } else if (scaffoldFrontend) {
      packageJson.scripts['start'] = 'npm run --if-present --prefix frontend';
      packageJson.scripts['build'] = 'npm run --if-present --prefix frontend build';
      packageJson.scripts['dev'] = 'npm run --if-present --prefix frontend dev';
    } else if (scaffoldBackend) {
      packageJson.scripts['start'] = 'npm run app:build && npm run app:run';
      packageJson.scripts['build'] = 'npm run app:build';
    }

    // Add Qt utility scripts
    packageJson.scripts['setup:qt'] =
      'node -e "const fs = require(\'fs\'); const path = process.argv[1]; if(path) { const config = JSON.parse(fs.readFileSync(\'.taqyonrc\', \'utf8\') || \'{}\'); config.qt6Path = path; fs.writeFileSync(\'.taqyonrc\', JSON.stringify(config, null, 2)); console.log(\'Qt6 path updated to \' + path); } else { console.error(\'Please provide a Qt6 path\'); }"';
    packageJson.scripts['test:qt'] =
      'node -e "const fs = require(\'fs\'); try { const config = JSON.parse(fs.readFileSync(\'.taqyonrc\', \'utf8\') || \'{}\'); if(config.qt6Path && fs.existsSync(config.qt6Path)) { console.log(\'Qt6 found at: \' + config.qt6Path); process.exit(0); } else { console.error(\'Qt6 not found at configured path: \' + (config.qt6Path || \'Not configured\')); process.exit(1); }} catch(e) { console.error(\'Error checking Qt6 installation:\', e.message); process.exit(1); }"';
    packageJson.scripts['verify:qt'] =
      "cd src && mkdir -p build && cd build && cmake -L .. | grep -q 'WebEngineWidgets_FOUND:BOOL=TRUE' && echo 'Qt WebEngine is properly configured!' || echo 'ERROR: Qt WebEngine is not properly configured. Make sure Qt is installed with WebEngine support.'";

    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } catch (err) {
    console.error('Failed to create package.json:', err.message);
    process.exit(1);
  }

  // ---------------------------
  // 8. Create README.md
  // ---------------------------
  try {
    let readmeContent = `# ${projectName}\n\nA desktop application created with Taqyon.\n\n`;
    if (scaffoldFrontend) {
      readmeContent += `## Frontend\n\nThe frontend is located in the \`frontend/\` directory and uses ${frontendFramework}.\n\n`;
    }
    if (scaffoldBackend) {
      readmeContent += `## Backend\n\nThe backend is located in the \`src/\` directory and uses Qt.\n\n`;
      // Get qt6Path from the .taqyonrc file if it exists
      let backendQt6Path = null;
      const rcPath = path.join(projectRoot, '.taqyonrc');
      if (fs.existsSync(rcPath)) {
        try {
          const rcContent = fs.readFileSync(rcPath, 'utf8');
          const rcData = JSON.parse(rcContent);
          backendQt6Path = rcData.qt6Path;
        } catch (err) {
          console.error('Warning: Failed to read .taqyonrc file:', err.message);
        }
      }
      if (backendQt6Path) {
        readmeContent += `Qt6 path: \`${backendQt6Path}\`\n\n`;
      } else {
        readmeContent += `### Qt Not Detected\n\n`;
        readmeContent += `Qt6 was not found during project creation. You have several options:\n\n`;
        readmeContent += `1. **Install Qt6**: Download and install from [qt.io](https://www.qt.io/download-qt-installer)\n`;
        readmeContent += `2. **Specify path manually**: When running \`npm run backend:build\`, you will be prompted for the Qt6 path\n`;
        readmeContent += `3. **Edit .taqyonrc**: Update the \`qt6Path\` value in this file with your Qt6 installation path\n\n`;
        readmeContent += `Common Qt6 installation paths:\n`;
        readmeContent += `- macOS: \`~/Qt/6.x.y/macos\` or \`/usr/local/opt/qt6\` (Homebrew)\n`;
        readmeContent += `- Windows: \`C:\\\\Qt\\\\6.x.y\\\\msvc2019_64\`\n`;
        readmeContent += `- Linux: \`~/Qt/6.x.y/gcc_64\` or \`/usr/lib/qt6\`\n\n`;
      }
    }
    readmeContent += `## Development\n\n`;
    readmeContent += `- \`npm start\`: Run the development environment\n`;
    readmeContent += `- \`npm run build\`: Build the project\n`;
    if (scaffoldFrontend) {
      readmeContent += `- \`npm run frontend:dev\`: Run frontend development server\n`;
      readmeContent += `- \`npm run frontend:build\`: Build frontend\n`;
    }
    if (scaffoldBackend) {
      readmeContent += `- \`npm run backend:build\`: Build backend\n`;
      readmeContent += `- \`npm run backend:run\`: Run backend\n`;
    }
    fs.writeFileSync(path.join(projectRoot, 'README.md'), readmeContent);
  } catch (err) {
    console.error('Failed to create README.md:', err.message);
    process.exit(1);
  }

  // ---------------------------
  // 9. Final Output
  // ---------------------------
  console.log('\nProject scaffolded successfully!');
  console.log(`Navigate to your project with: cd ${projectName}`);
  console.log("Run 'npm install' to install dependencies if needed");

  if (scaffoldBackend && !detectedQt6Path) {
    console.log('\nIMPORTANT: Qt6 was not detected during scaffolding!');
    console.log('You have three options to resolve this:');
    console.log('1. Install Qt6 from https://www.qt.io/download-qt-installer');
    console.log("2. When running 'npm run backend:build', you'll be prompted for the Qt6 path");
    console.log("3. Edit .taqyonrc and set the 'qt6Path' value to your Qt6 installation directory");
  }

  console.log("\nRun 'npm start' to start development");
  console.log('Done.');
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { createApp };

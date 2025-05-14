// taqyon-cli.js
// CLI tool for scaffolding a cross-platform Qt/C++ backend (minimal) as per docs/cli_workflow_and_structure.md

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const os = require('os');
const inquirer = require('inquirer');

// --- Qt6 detection utility ---
function detectQt6() {
    // Platform detection
    const platform = process.platform;
    const isWindows = platform === 'win32';
    const isMacOS = platform === 'darwin';
    const isLinux = platform === 'linux';
    
    // Store known Qt versions to check
    const qtVersions = ['6.9.0', '6.8.0', '6.7.0', '6.6.0', '6.5.0', '6.4.0', '6.3.0', '6.2.0']; // QWebEngineView has been added in Qt 6.2.0
    
    // Validation function to check if a directory contains Qt components
    function isValidQtDir(dir) {
        if (!fs.existsSync(dir)) {
            return false;
        }
        
        console.log(`Checking if ${dir} is a valid Qt directory...`);
        
        // Check for key Qt directories/files that should exist in a valid installation
        const markers = [
            path.join(dir, 'lib'),
            path.join(dir, 'include'),
            path.join(dir, 'bin')
        ];
        
        // Check for key Qt directories that should exist
        const hasMarkers = markers.some(marker => fs.existsSync(marker));
        if (!hasMarkers) {
            console.log(`  - Directory markers not found in ${dir}`);
            return false;
        }
        
        // Platform-specific library checks
        let hasLibs = false;
        
        if (isWindows) {
            // Windows: Check for lib/Qt6Core.lib
            hasLibs = fs.existsSync(path.join(dir, 'lib', 'Qt6Core.lib'));
        } else if (isMacOS) {
            // macOS: Check for frameworks in lib or directly Qt Core library
            const macOSLibs = [
                path.join(dir, 'lib', 'QtCore.framework'),    // Without 6 (modern Qt)
                path.join(dir, 'lib', 'libQt6Core.dylib'),    // dylib
                path.join(dir, 'lib', 'libQt6Core.a')         // static lib
            ];
            hasLibs = macOSLibs.some(lib => fs.existsSync(lib));
            
            // If framework not found directly, try reading lib directory
            if (!hasLibs && fs.existsSync(path.join(dir, 'lib'))) {
                try {
                    // Read the lib directory to check for framework directories
                    const libItems = fs.readdirSync(path.join(dir, 'lib'));
                    hasLibs = libItems.some(item => 
                        (item === 'QtCore.framework') || 
                        (item.includes('Qt6Core') && (item.endsWith('.dylib') || item.endsWith('.a')))
                    );
                    
                    if (hasLibs) {
                        console.log(`  - Found Qt libraries in ${path.join(dir, 'lib')}`);
                    }
                } catch (err) {
                    console.log(`  - Error reading lib directory: ${err.message}`);
                }
            }
        } else {
            // Linux: Check for libQt6Core.so
            hasLibs = fs.existsSync(path.join(dir, 'lib', 'libQt6Core.so'));
        }
        
        if (!hasLibs) {
            console.log(`  - Qt Core libraries not found in ${dir}`);
        }
        
        // Check for includes - different structures on different platforms
        let hasIncludes = false;
        
        // Common include locations
        const includeLocations = [
            path.join(dir, 'include', 'QtCore'),
            path.join(dir, 'include', 'QtCore', 'QObject'),
            path.join(dir, 'include', 'Qt6', 'QtCore', 'QObject')
        ];
        
        hasIncludes = includeLocations.some(loc => fs.existsSync(loc));
        
        // For macOS frameworks, headers might be inside the framework
        if (!hasIncludes && isMacOS) {
            const frameworkInclude = path.join(dir, 'lib', 'QtCore.framework', 'Headers');
            hasIncludes = fs.existsSync(frameworkInclude);
            
            if (hasIncludes) {
                console.log(`  - Found Qt headers in framework: ${frameworkInclude}`);
            }
            
            // If still not found, check if any QtXXX directories exist in include
            if (!hasIncludes && fs.existsSync(path.join(dir, 'include'))) {
                try {
                    const includeItems = fs.readdirSync(path.join(dir, 'include'));
                    hasIncludes = includeItems.some(item => item.startsWith('Qt'));
                    
                    if (hasIncludes) {
                        console.log(`  - Found Qt include directories: ${includeItems.filter(item => item.startsWith('Qt')).join(', ')}`);
                    }
                } catch (err) {
                    console.log(`  - Error reading include directory: ${err.message}`);
                }
            }
        }
        
        if (!hasIncludes) {
            console.log(`  - Qt include files not found in ${dir}`);
        }
        
        // Accept directory if it has markers and either libs or includes
        return hasMarkers && (hasLibs || hasIncludes);
    }
    
    // 1. First try to find qmake in PATH which is the most reliable way
    try {
        // Command depends on platform
        const whichCmd = isWindows ? 'where' : 'which';
        
        // Try qmake6 first, then fall back to qmake
        const qmakeCommands = ['qmake6', 'qmake'];
        for (const qmakeCmd of qmakeCommands) {
            const result = spawnSync(whichCmd, [qmakeCmd], { stdio: 'pipe' });
            if (result.status === 0 && result.stdout) {
                const qmakePath = result.stdout.toString().trim().split('\n')[0]; // Take first result
                
                // On Windows, we might need to remove quotes
                const cleanPath = qmakePath.replace(/["']/g, '');
                
                if (cleanPath && fs.existsSync(cleanPath)) {
                    // qmake is typically in the bin directory, so go up two levels
                    const qtDir = path.dirname(path.dirname(cleanPath));
                    if (isValidQtDir(qtDir)) {
                        console.log(`Found Qt via ${qmakeCmd}: ${qtDir}`);
                        return qtDir;
                    }
                }
            }
        }
    } catch (e) {
        // Silently continue if which/where command fails
    }
    
    // 2. Try to find qtpaths which is another reliable way
    try {
        const qtpathsCommands = ['qtpaths6', 'qtpaths'];
        for (const qtpathsCmd of qtpathsCommands) {
            const result = spawnSync(isWindows ? 'where' : 'which', [qtpathsCmd], { stdio: 'pipe' });
            if (result.status === 0 && result.stdout) {
                const qtpathsPath = result.stdout.toString().trim().split('\n')[0];
                const cleanPath = qtpathsPath.replace(/["']/g, '');
                
                if (cleanPath && fs.existsSync(cleanPath)) {
                    // Run qtpaths to get the prefix path
                    const prefixResult = spawnSync(cleanPath, ['--query=QT_INSTALL_PREFIX'], { stdio: 'pipe' });
                    if (prefixResult.status === 0 && prefixResult.stdout) {
                        const qtDir = prefixResult.stdout.toString().trim();
                        if (qtDir && isValidQtDir(qtDir)) {
                            console.log(`Found Qt via ${qtpathsCmd}: ${qtDir}`);
                            return qtDir;
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Silently continue if qtpaths fails
    }
    
    // 3. Check environment variables (especially useful on Windows)
    const envVars = ['QTDIR', 'QT_DIR', 'Qt6_DIR'];
    for (const varName of envVars) {
        const qtDir = process.env[varName];
        if (qtDir && isValidQtDir(qtDir)) {
            console.log(`Found Qt via environment variable ${varName}: ${qtDir}`);
            return qtDir;
        }
    }
    
    // 4. Platform-specific location checks
    let candidates = [];
    
    if (isWindows) {
        // Windows-specific locations
        
        // Program Files locations
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        
        // Add official Qt installer locations (Qt Company)
        for (const version of qtVersions) {
            // Qt online installer - specific version in C:\Qt\{version}
            candidates.push(path.join('C:\\Qt', version, 'msvc2019_64'));
            candidates.push(path.join('C:\\Qt', version, 'msvc2019'));
            candidates.push(path.join('C:\\Qt', version, 'mingw_64'));
            candidates.push(path.join('C:\\Qt', version, 'mingw81_64'));
            candidates.push(path.join('C:\\Qt', version, 'mingw81_32'));
            
            // Qt installed in Program Files
            candidates.push(path.join(programFiles, 'Qt', version, 'msvc2019_64'));
            candidates.push(path.join(programFiles, 'Qt', version, 'mingw_64'));
            candidates.push(path.join(programFilesX86, 'Qt', version, 'msvc2019'));
            candidates.push(path.join(programFilesX86, 'Qt', version, 'mingw_32'));
        }
        
        // General Qt6 directory
        candidates.push(path.join('C:\\Qt\\6'));
        candidates.push(path.join(programFiles, 'Qt\\6'));
        candidates.push(path.join(programFilesX86, 'Qt\\6'));
        
        // Check for MSYS2/MinGW installations
        candidates.push('C:\\msys64\\mingw64\\qt6');
        candidates.push('C:\\msys64\\mingw32\\qt6');
    } 
    else if (isMacOS) {
        // macOS-specific locations
        
        // Official Qt installer locations
        for (const version of qtVersions) {
            // Qt online installer
            candidates.push(path.join(os.homedir(), 'Qt', version, 'macos'));
            candidates.push(path.join(os.homedir(), 'Qt', version, 'clang_64'));
            
            // Older naming schemes
            candidates.push(path.join(os.homedir(), 'Qt', version, 'ios'));
            candidates.push(path.join(os.homedir(), 'Qt', version, 'macx_clang_64'));
        }
        
        // Homebrew locations (standard and Apple Silicon)
        candidates.push('/usr/local/opt/qt6');
        candidates.push('/usr/local/opt/qt@6');
        candidates.push('/usr/local/opt/qt');
        candidates.push('/opt/homebrew/opt/qt6');
        candidates.push('/opt/homebrew/opt/qt@6');
        candidates.push('/opt/homebrew/opt/qt');
        
        // MacPorts locations
        candidates.push('/opt/local/libexec/qt6');
        candidates.push('/opt/local/lib/qt6');
        
        // Standard system-wide installation
        candidates.push('/Library/Frameworks/Qt6');
        candidates.push('/Applications/Qt6');
    } 
    else if (isLinux) {
        // Linux-specific locations
        
        // Official Qt installer locations
        for (const version of qtVersions) {
            // Qt online installer (in home directory)
            candidates.push(path.join(os.homedir(), 'Qt', version, 'gcc_64'));
            candidates.push(path.join(os.homedir(), 'Qt', version));
        }
        
        // Standard system-wide installation locations
        candidates.push('/usr/lib/qt6');
        candidates.push('/usr/lib/x86_64-linux-gnu/qt6');
        candidates.push('/usr/share/qt6');
        candidates.push('/usr/local/lib/qt6');
        candidates.push('/usr/local/qt6');
        
        // Distribution-specific locations (common ones)
        candidates.push('/usr/lib64/qt6');         // Fedora, openSUSE
        candidates.push('/usr/lib/qt');            // Arch Linux
        candidates.push('/opt/qt6');               // Manual installations
        candidates.push('/opt/Qt6');
        
        // Flatpak Qt locations
        candidates.push('/app/lib/qt6');
        candidates.push('/app/lib/x86_64-linux-gnu/qt6');
    }
    
    // Common locations across platforms
    const commonLocations = [
        '/usr/local/Qt-6',
        '/usr/local/Qt6',
        '/usr/local/qt6',
        '/opt/Qt6',
    ];
    
    candidates = [...candidates, ...commonLocations];
    
    // Check all candidate directories
    for (const dir of candidates) {
        if (isValidQtDir(dir)) {
            console.log(`Found Qt in candidate directory: ${dir}`);
            return dir;
        }
    }
    
    // 5. Last resort: search for Qt using 'find' or 'dir' commands in common locations
    try {
        let searchLocations = [];
        let searchCommand = null;
        let searchArgs = [];
        
        if (isWindows) {
            // Windows search for Qt in Program Files
            searchLocations = [
                'C:\\Qt',
                'C:\\Program Files\\Qt',
                'C:\\Program Files (x86)\\Qt'
            ];
            // Using PowerShell to search
            searchCommand = 'powershell';
            searchArgs = ['-Command', 'Get-ChildItem -Path "$SEARCH_PATH" -Filter "Qt6Core.*" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 DirectoryName'];
        } else {
            // Unix-based search in common locations
            searchLocations = [
                '/usr',
                '/usr/local',
                '/opt',
                os.homedir()
            ];
            searchCommand = 'find';
            searchArgs = ['$SEARCH_PATH', '-name', 'libQt6Core.*', '-o', '-name', 'Qt6Core.framework', '-type', 'd', '-o', '-type', 'f', '2>/dev/null', '|', 'head', '-n', '1'];
        }
        
        for (const searchPath of searchLocations) {
            if (!fs.existsSync(searchPath)) continue;
            
            // Replace the search path placeholder
            const args = searchArgs.map(arg => arg.replace('$SEARCH_PATH', searchPath));
            
            const result = spawnSync(searchCommand, args, { 
                stdio: 'pipe',
                shell: true // Required for pipes and redirection
            });
            
            if (result.status === 0 && result.stdout && result.stdout.toString().trim()) {
                const foundPath = result.stdout.toString().trim();
                
                // Extract the Qt directory from the found path
                let qtDir;
                if (foundPath.includes('lib')) {
                    // If we found a library file/dir, go up to the Qt root
                    qtDir = foundPath.split('lib')[0].trim();
                } else if (foundPath.includes('include')) {
                    // If we found an include file/dir, go up to the Qt root
                    qtDir = foundPath.split('include')[0].trim();
                } else if (isWindows) {
                    // On Windows with PowerShell result
                    qtDir = path.dirname(path.dirname(foundPath));
                }
                
                if (qtDir && isValidQtDir(qtDir)) {
                    console.log(`Found Qt via file search: ${qtDir}`);
                    return qtDir;
                }
            }
        }
    } catch (e) {
        // Silently continue if search commands fail
    }
    
    // Nothing found
    return null;
}

// --- Qt6 manual path validation ---
function validateQtPath(qtPath) {
    if (!qtPath) return null;
    
    console.log(`Validating user-provided Qt path: ${qtPath}`);
    
    // Function to check if a directory contains Qt components
    function isUserQtDirValid(dir) {
        if (!fs.existsSync(dir)) {
            console.log(`  - ERROR: Directory ${dir} does not exist`);
            return false;
        }
        
        // Platform detection
        const isWindows = process.platform === 'win32';
        const isMacOS = process.platform === 'darwin';
        
        // Check for key Qt directories/files that should exist in a valid installation
        const markers = [
            path.join(dir, 'lib'),
            path.join(dir, 'include'),
            path.join(dir, 'bin')
        ];
        
        // Check if directory markers exist
        let foundMarkers = [];
        markers.forEach(marker => {
            if (fs.existsSync(marker)) {
                foundMarkers.push(path.basename(marker));
            }
        });
        
        if (foundMarkers.length > 0) {
            console.log(`  - Found Qt directories: ${foundMarkers.join(', ')}`);
        } else {
            console.log(`  - ERROR: No Qt directories found in ${dir}`);
            console.log('    Expected to find: lib, include, bin');
            return false;
        }
        
        // Platform-specific library checks
        let foundLibs = [];
        
        if (isWindows) {
            // Windows: Check for lib/Qt6Core.lib
            const windowsLib = path.join(dir, 'lib', 'Qt6Core.lib');
            if (fs.existsSync(windowsLib)) {
                foundLibs.push('Qt6Core.lib');
            }
        } else if (isMacOS) {
            // macOS: Check for frameworks or dylib files
            const macOSLibs = [
                { path: path.join(dir, 'lib', 'QtCore.framework'), name: 'QtCore.framework' },
                { path: path.join(dir, 'lib', 'libQt6Core.dylib'), name: 'libQt6Core.dylib' },
                { path: path.join(dir, 'lib', 'libQt6Core.a'), name: 'libQt6Core.a' }
            ];
            
            macOSLibs.forEach(lib => {
                if (fs.existsSync(lib.path)) {
                    foundLibs.push(lib.name);
                }
            });
            
            // If framework not found directly, try reading lib directory
            if (foundLibs.length === 0 && fs.existsSync(path.join(dir, 'lib'))) {
                try {
                    // Read the lib directory to check for framework directories
                    const libItems = fs.readdirSync(path.join(dir, 'lib'));
                    const qtLibItems = libItems.filter(item => 
                        (item === 'QtCore.framework') || 
                        (item.includes('Qt6Core') && (item.endsWith('.dylib') || item.endsWith('.a')))
                    );
                    
                    if (qtLibItems.length > 0) {
                        foundLibs = qtLibItems;
                    }
                } catch (err) {
                    console.log(`  - Error reading lib directory: ${err.message}`);
                }
            }
        } else {
            // Linux: Check for libQt6Core.so
            const linuxLib = path.join(dir, 'lib', 'libQt6Core.so');
            if (fs.existsSync(linuxLib)) {
                foundLibs.push('libQt6Core.so');
            }
        }
        
        if (foundLibs.length > 0) {
            console.log(`  - Found Qt libraries: ${foundLibs.join(', ')}`);
        } else {
            console.log(`  - WARNING: No Qt Core libraries found`);
        }
        
        // Check for includes - different structures on different platforms
        let foundIncludes = [];
        
        // Common include locations
        const includeLocations = [
            { path: path.join(dir, 'include', 'QtCore'), name: 'QtCore' },
            { path: path.join(dir, 'include', 'QtCore', 'QObject'), name: 'QtCore/QObject' },
            { path: path.join(dir, 'include', 'Qt6', 'QtCore', 'QObject'), name: 'Qt6/QtCore/QObject' }
        ];
        
        includeLocations.forEach(loc => {
            if (fs.existsSync(loc.path)) {
                foundIncludes.push(loc.name);
            }
        });
        
        // For macOS frameworks, headers might be inside the framework
        if (foundIncludes.length === 0 && isMacOS) {
            const frameworkInclude = path.join(dir, 'lib', 'QtCore.framework', 'Headers');
            if (fs.existsSync(frameworkInclude)) {
                foundIncludes.push('QtCore.framework/Headers');
            }
            
            // If still not found, check if any QtXXX directories exist in include
            if (foundIncludes.length === 0 && fs.existsSync(path.join(dir, 'include'))) {
                try {
                    const includeItems = fs.readdirSync(path.join(dir, 'include'));
                    const qtIncludeItems = includeItems.filter(item => item.startsWith('Qt'));
                    
                    if (qtIncludeItems.length > 0) {
                        foundIncludes = qtIncludeItems;
                    }
                } catch (err) {
                    console.log(`  - Error reading include directory: ${err.message}`);
                }
            }
        }
        
        if (foundIncludes.length > 0) {
            console.log(`  - Found Qt includes: ${foundIncludes.join(', ')}`);
        } else {
            console.log(`  - WARNING: No Qt include files found`);
        }
        
        // Accept the directory if it has at least the basic structure
        // and has either libraries or includes
        return foundMarkers.length > 0 && (foundLibs.length > 0 || foundIncludes.length > 0);
    }
    
    if (isUserQtDirValid(qtPath)) {
        console.log(`✓ User-provided Qt path is valid: ${qtPath}`);
        return qtPath;
    }
    
    // Check some common subdirectories if the main path doesn't work
    const possibleSubdirs = ['macos', 'clang_64', 'gcc_64', 'msvc2019_64', 'lib', 'Qt6'];
    for (const subdir of possibleSubdirs) {
        const fullPath = path.join(qtPath, subdir);
        console.log(`Trying subdirectory: ${fullPath}`);
        if (isUserQtDirValid(fullPath)) {
            console.log(`✓ Found valid Qt path in subdirectory: ${fullPath}`);
            return fullPath;
        }
    }
    
    console.log(`✗ Could not validate the Qt path: ${qtPath}`);
    console.log(`  - Please verify this is the correct directory containing the Qt6 installation`);
    console.log(`  - Try a different directory or install Qt6 from https://www.qt.io/download-qt-installer`);
    
    return null;
}


// --- CLI logic ---

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(question, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

const TEMPLATE_DIR = path.join(__dirname, 'templates');

function copyFileSyncWithDirs(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

function copyDirRecursiveSync(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function replacePlaceholders(content, replacements) {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (key in replacements) {
            return replacements[key];
        }
        return match;
    });
}

function copyDirRecursiveWithReplace(srcDir, destDir, replacements) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursiveWithReplace(srcPath, destPath, replacements);
        } else {
            const content = fs.readFileSync(srcPath, 'utf8');
            const replaced = replacePlaceholders(content, replacements);
            fs.writeFileSync(destPath, replaced, 'utf8');
        }
    }
}

async function main() {
    console.log("Taqyon CLI - Project Scaffolding");

    // Prompt for project name
    let projectName = await prompt("Project name: ");
    if (!projectName) {
        console.error("Project name is required.");
        process.exit(1);
    }

    // Prompt for frontend scaffolding
    let scaffoldFrontend = await prompt("Scaffold frontend? (Y/n): ");
    scaffoldFrontend = scaffoldFrontend === "" || /^y(es)?$/i.test(scaffoldFrontend);

    // Prompt for backend scaffolding
    let scaffoldBackend = await prompt("Scaffold backend? (Y/n): ");
    scaffoldBackend = scaffoldBackend === "" || /^y(es)?$/i.test(scaffoldBackend);

    // Prompt for frontend framework if scaffolding frontend
    let frontendFramework = null;
    if (scaffoldFrontend) {
        const frameworkChoices = [
            { name: 'React', value: 'react' },
            { name: 'Vue', value: 'vue' },
            { name: 'Svelte', value: 'svelte' },
        ];

        const answers = await inquirer.default.prompt([
            {
                type: 'list',
                name: 'selectedFramework',
                message: 'Select a frontend framework:',
                choices: frameworkChoices,
                default: 'react', // Optional: pre-select React
            },
        ]);
        frontendFramework = answers.selectedFramework;
        // console.log(`Selected frontend framework: ${frontendFramework}`); // Optional: confirm selection
    }

    // Create project root
    const projectRoot = path.resolve(process.cwd(), projectName);
    if (!fs.existsSync(projectRoot)) {
        fs.mkdirSync(projectRoot, { recursive: true });
    }

    // Scaffold frontend if enabled
    if (scaffoldFrontend) {
        const frontendDir = path.join(projectRoot, "frontend");
        if (!fs.existsSync(frontendDir)) {
            fs.mkdirSync(frontendDir, { recursive: true });
        }
        // Scaffold using selected framework
        let scaffoldCmd, scaffoldArgs, cwd;
        if (frontendFramework === "react") {
            // Copy the pre-made React template
            const reactTemplateDir = path.join(TEMPLATE_DIR, 'frontend', 'react');
            if (!fs.existsSync(reactTemplateDir)) {
                console.error(`React template directory not found: ${reactTemplateDir}`);
                process.exit(1);
            }
            const frontendReplacements = { projectName };
            copyDirRecursiveWithReplace(reactTemplateDir, frontendDir, frontendReplacements);
            console.log(`Copied React template from ${reactTemplateDir} to ${frontendDir}`);
            // No need for scaffoldCmd, scaffoldArgs, cwd for React template copy
        } else if (frontendFramework === "vue") {
            // Copy the pre-made template instead of running npm create vite
            const vueTemplateDir = path.join(TEMPLATE_DIR, 'frontend', 'vue');
            if (!fs.existsSync(vueTemplateDir)) {
                console.error(`Vue template directory not found: ${vueTemplateDir}`);
                process.exit(1);
            }
            copyDirRecursiveSync(vueTemplateDir, frontendDir);
            console.log(`Copied Vue template from ${vueTemplateDir} to ${frontendDir}`);
        } else if (frontendFramework === "svelte") {
            // Copy the pre-made template instead of running npm create vite
            const svelteTemplateDir = path.join(TEMPLATE_DIR, 'frontend', 'svelte');
            if (!fs.existsSync(svelteTemplateDir)) {
                console.error(`Svelte template directory not found: ${svelteTemplateDir}`);
                process.exit(1);
            }
            // Add replacements for Svelte as well
            const frontendReplacementsForSvelte = { projectName }; 
            copyDirRecursiveWithReplace(svelteTemplateDir, frontendDir, frontendReplacementsForSvelte);
            console.log(`Copied Svelte template from ${svelteTemplateDir} to ${frontendDir}`);
        }
        if (scaffoldCmd) {
            console.log(`Scaffolding ${frontendFramework} app in ${frontendDir}...`);
            const result = spawnSync(scaffoldCmd, scaffoldArgs, { cwd, stdio: "inherit" });
            if (result.error) {
                console.error(`Failed to scaffold ${frontendFramework}:`, result.error);
                process.exit(1);
            }
            if (typeof result.status === "number" && result.status !== 0) {
                console.error(`Frontend scaffolding failed with exit code ${result.status}.`);
                process.exit(result.status || 1);
            }
        }
        // Check for frontend/package.json existence
        const pkgJsonPath = path.join(frontendDir, "package.json");
        if (!fs.existsSync(pkgJsonPath)) {
            console.error("Error: frontend/package.json was not created. Frontend scaffolding failed or incomplete.");
            process.exit(1);
        }
        // --- Inject bridge files only if not present ---
        const frontendSrcDir = path.join(frontendDir, 'src');
        const frontendPublicDir = path.join(frontendDir, 'public');
        const bridgeSrc = path.join(TEMPLATE_DIR, 'qwebchannel-bridge.js');
        const bridgeDest = path.join(frontendSrcDir, 'qwebchannel-bridge.js');
        if (!fs.existsSync(bridgeDest)) {
            copyFileSyncWithDirs(bridgeSrc, bridgeDest);
            console.log('Injected qwebchannel-bridge.js into frontend/src.');
        }
        // Standardize loaderSrc to look in TEMPLATE_DIR, similar to bridgeSrc
        const loaderSrc = path.join(TEMPLATE_DIR, 'qwebchannel-loader.js'); 
        const loaderDest = path.join(frontendPublicDir, 'qwebchannel-loader.js');
        if (!fs.existsSync(loaderDest)) {
            copyFileSyncWithDirs(loaderSrc, loaderDest);
            console.log('Injected qwebchannel-loader.js into frontend/public.');
        }
        console.log(`Frontend scaffolding complete: frontend/ (${frontendFramework})`);
        // --- Patch vite.config.js for correct base path (skip for Vue and React templates) ---
        if (frontendFramework !== "vue" && frontendFramework !== "react") {
            const viteConfigPath = path.join(frontendDir, 'vite.config.js');
            if (fs.existsSync(viteConfigPath)) {
                let viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
                // Insert base: './' if not present
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
    } else {
        console.log("Frontend scaffolding skipped.");
    }

    // Variable to store Qt path
    let detectedQt6Path = null;

    if (scaffoldBackend) {
        const srcDir = path.join(projectRoot, "src");
        if (!fs.existsSync(srcDir)) {
            fs.mkdirSync(srcDir, { recursive: true });
        }
        // Prompt for backend features
        let enableLogging = false;
        let enableDevServer = false;
        let loggingInput = await prompt("Enable logging? (Y/n): ");
        enableLogging = loggingInput === "" || /^y(es)?$/i.test(loggingInput);
        let devServerInput = await prompt("Enable dev server? (Y/n): ");
        enableDevServer = devServerInput === "" || /^y(es)?$/i.test(devServerInput);

        // Copy backend template files with placeholder replacement
        const backendTemplateDir = path.join(TEMPLATE_DIR, 'src');
        const replacements = {
            projectName,
            projectVersion: '1.0.0',
            qt6Path: detectedQt6Path || '/path/to/qt6',
            enableLogging: enableLogging ? '1' : '0',
            enableDevServer: enableDevServer ? '1' : '0',
        };
        copyDirRecursiveWithReplace(backendTemplateDir, srcDir, replacements);
        console.log('Copied backend template files to src/ with placeholder replacement.');

        // Detect Qt6 and add configuration
        detectedQt6Path = detectQt6();
        if (!detectedQt6Path) {
            console.log("\nWARNING: Qt6 was not detected automatically.");
            const userQtPath = await prompt("Enter Qt6 installation path (or press Enter to skip): ");
            if (userQtPath) {
                // Validate the user-provided path
                detectedQt6Path = validateQtPath(userQtPath);
                if (!detectedQt6Path) {
                    console.log("\nWARNING: The provided Qt6 path could not be validated.");
                    console.log("The project will still be created, but you'll need to configure Qt manually.");
                    console.log("See the README.md file for more information.\n");
                }
            }
        }
        // Create a helper script for building with the correct Qt path
        const isWindows = process.platform === 'win32';
        const buildScriptName = isWindows ? "build.bat" : "build.sh";
        // Save to .taqyonrc for future reference even if empty
        const rcPath = path.join(projectRoot, '.taqyonrc');
        fs.writeFileSync(rcPath, JSON.stringify({ qt6Path: detectedQt6Path || null }, null, 2));
        // Create build scripts that either use detected Qt or prompt the user
        let buildScriptContent;
        if (detectedQt6Path) {
            console.log(`\nQt6 found at: ${detectedQt6Path}`);
            buildScriptContent = isWindows 
                ? `@echo off\ncmake -B build -DCMAKE_PREFIX_PATH="${detectedQt6Path}" && cmake --build build\n`
                : `#!/bin/bash\ncmake -B build -DCMAKE_PREFIX_PATH="${detectedQt6Path}" && cmake --build build\n`;
        } else {
            console.log("\nQt6 path not provided. Creating build script with instructions.");
            buildScriptContent = isWindows
                ? `@echo off\necho Qt6 was not detected during project creation.\necho Please specify the path to your Qt6 installation:\nset /p QT_PATH=Qt6 path: \nif not defined QT_PATH (\n  echo No Qt6 path provided. \n  echo You can manually run: cmake -B build -DCMAKE_PREFIX_PATH=\"path/to/qt6\" ^&^& cmake --build build\n  exit /b 1\n)\necho Using Qt6 path: %QT_PATH%\ncmake -B build -DCMAKE_PREFIX_PATH=\"%QT_PATH%\" && cmake --build build\n`
                : `#!/bin/bash\necho "Qt6 was not detected during project creation."\necho "Please specify the path to your Qt6 installation:"\nread -p "Qt6 path: " QT_PATH\nif [ -z "$QT_PATH" ]; then\n  echo "No Qt6 path provided."\n  echo "You can manually run: cmake -B build -DCMAKE_PREFIX_PATH=\"path/to/qt6\" && cmake --build build"\n  exit 1\nfi\necho "Using Qt6 path: $QT_PATH"\ncmake -B build -DCMAKE_PREFIX_PATH="$QT_PATH" && cmake --build build\n`;
        }
        fs.writeFileSync(path.join(srcDir, buildScriptName), buildScriptContent);
        if (!isWindows) {
            fs.chmodSync(path.join(srcDir, buildScriptName), 0o755); // Make executable
        }
        console.log(`Created build helper script: src/${buildScriptName}`);
        console.log("Backend scaffolding complete:");
        // List all files in srcDir for confirmation
        fs.readdirSync(srcDir).forEach(f => console.log("  src/" + f));
    } else {
        console.log("Backend scaffolding skipped.");
    }

    // Create a package.json in the project root with proper scripts
    const packageJson = {
        "name": projectName,
        "version": "1.0.0",
        "description": "Taqyon project with Qt/C++ backend and JS frontend",
        "scripts": {},
        "dependencies": {},
        "devDependencies": {
            "concurrently": "^8.0.0",
            "cross-env": "^7.0.0",
            "wait-on": "^7.0.0"
        }
    };

    // Platform detection for scripts
    const isWindows = process.platform === 'win32';

    // Add appropriate scripts based on what was scaffolded
    if (scaffoldFrontend) {
        packageJson.scripts["frontend:dev"] = "npm run --if-present --prefix frontend dev";
        packageJson.scripts["frontend:build"] = "npm run --if-present --prefix frontend build";
    }

    if (scaffoldBackend) {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            packageJson.scripts["app:build"] = "cd src && .\\build.bat";
            packageJson.scripts["app:run"] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe) else (echo Application executable not found. Make sure to build successfully first.)`;
            packageJson.scripts["app:run:verbose"] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
            packageJson.scripts["app:run:dev"] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --dev-server http://localhost:3000 --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
            packageJson.scripts["app:run:log"] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --log app.log --verbose) else (echo Application executable not found. Make sure to build successfully first.)`;
            packageJson.scripts["app:help"] = `if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --help) else (echo Application executable not found. Make sure to build successfully first.)`;
        } else {
            packageJson.scripts["app:build"] = "cd src && chmod +x ./build.sh && ./build.sh";
            packageJson.scripts["app:run"] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName}; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
            packageJson.scripts["app:run:verbose"] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
            packageJson.scripts["app:run:dev"] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --dev-server http://localhost:3000 --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
            packageJson.scripts["app:run:log"] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --log app.log --verbose; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
            packageJson.scripts["app:help"] = `if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --help; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
        }
    }

    // Add combined scripts if both are scaffolded
    if (scaffoldFrontend && scaffoldBackend) {
        if (isWindows) {
            packageJson.scripts["start"] = `npm run build && set ABSOLUTE_PATH=%cd%\\frontend\\dist && if exist src\\build\\bin\\${projectName}.exe (cd src\\build\\bin && ${projectName}.exe --verbose --frontend-path "%ABSOLUTE_PATH%") else (echo Application executable not found. Make sure to build successfully first.)`;
            packageJson.scripts["build"] = "npm run frontend:build && npm run app:build";
            packageJson.scripts["dev"] = "concurrently -k -r -s first \"npm run frontend:dev\" \"npm run app:build && if not errorlevel 1 (wait-on tcp:localhost:3000 && npm run app:run:dev) else (echo Error: Failed to build Qt application. Check that Qt6 is properly installed with WebEngine and Positioning modules.)\"";
        } else {
            packageJson.scripts["start"] = `npm run build && ABSOLUTE_PATH="$(pwd)/frontend/dist" && if [ -f src/build/bin/${projectName} ]; then cd src/build/bin && ./${projectName} --verbose --frontend-path "$ABSOLUTE_PATH"; else echo 'Application executable not found. Make sure to build successfully first.'; fi`;
            packageJson.scripts["build"] = "npm run frontend:build && npm run app:build";
            packageJson.scripts["dev"] = "concurrently -k -r -s first \"npm run frontend:dev\" \"npm run app:build && if [ $? -eq 0 ]; then wait-on tcp:localhost:3000 && npm run app:run:dev; else echo 'Error: Failed to build Qt application. Check that Qt6 is properly installed with WebEngine and Positioning modules.'; fi\"";
        }
    } else if (scaffoldFrontend) {
        packageJson.scripts["start"] = "npm run --if-present --prefix frontend";
        packageJson.scripts["build"] = "npm run --if-present --prefix frontend build";
        packageJson.scripts["dev"] = "npm run --if-present --prefix frontend dev";
    } else if (scaffoldBackend) {
        packageJson.scripts["start"] = "npm run app:build && npm run app:run";
        packageJson.scripts["build"] = "npm run app:build";
    }

    // Add Qt utility scripts
    packageJson.scripts["setup:qt"] = "node -e \"const fs = require('fs'); const path = process.argv[1]; if(path) { const config = JSON.parse(fs.readFileSync('.taqyonrc', 'utf8') || '{}'); config.qt6Path = path; fs.writeFileSync('.taqyonrc', JSON.stringify(config, null, 2)); console.log('Qt6 path updated to ' + path); } else { console.error('Please provide a Qt6 path'); }\"";
    packageJson.scripts["test:qt"] = "node -e \"const fs = require('fs'); try { const config = JSON.parse(fs.readFileSync('.taqyonrc', 'utf8') || '{}'); if(config.qt6Path && fs.existsSync(config.qt6Path)) { console.log('Qt6 found at: ' + config.qt6Path); process.exit(0); } else { console.error('Qt6 not found at configured path: ' + (config.qt6Path || 'Not configured')); process.exit(1); }} catch(e) { console.error('Error checking Qt6 installation:', e.message); process.exit(1); }\"";
    packageJson.scripts["verify:qt"] = "cd src && mkdir -p build && cd build && cmake -L .. | grep -q 'WebEngineWidgets_FOUND:BOOL=TRUE' && echo 'Qt WebEngine is properly configured!' || echo 'ERROR: Qt WebEngine is not properly configured. Make sure Qt is installed with WebEngine support.'";

    // Write package.json to project root
    fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify(packageJson, null, 2)
    );

    // Create a simple README with instructions
    const readmeMd = `# ${projectName}\n\nA desktop application created with Taqyon.\n\n`;
    let readmeContent = readmeMd;
    
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
                console.error("Warning: Failed to read .taqyonrc file:", err.message);
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
            readmeContent += `- Windows: \`C:\\Qt\\6.x.y\\msvc2019_64\`\n`;
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
    
    fs.writeFileSync(path.join(projectRoot, "README.md"), readmeContent);

    console.log("\nProject scaffolded successfully!");
    console.log(`Navigate to your project with: cd ${projectName}`);
    console.log("Run 'npm install' to install dependencies if needed");
    
    if (scaffoldBackend && !detectedQt6Path) {
        console.log("\nIMPORTANT: Qt6 was not detected during scaffolding!");
        console.log("You have three options to resolve this:");
        console.log("1. Install Qt6 from https://www.qt.io/download-qt-installer");
        console.log("2. When running 'npm run backend:build', you'll be prompted for the Qt6 path");
        console.log("3. Edit .taqyonrc and set the 'qt6Path' value to your Qt6 installation directory");
    }
    
    console.log("\nRun 'npm start' to start development");
    
    console.log("Done.");
}

if (require.main === module) {
    main();
}
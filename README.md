# Taqyon CLI – Scaffold Qt/C++ + JS/TS Desktop Apps (Tauri-style)

Taqyon is a CLI tool for rapidly scaffolding cross-platform desktop applications with a modern JavaScript/TypeScript frontend (React, Vue, or Svelte) and a native Qt/C++ backend. Inspired by Tauri, Taqyon orchestrates both parts for seamless development, build, and packaging.

---

## ⚡ Quick Start

Follow these steps to create a new desktop application with Taqyon:

1. **Clone the Taqyon repository** (this is the tool, not your app):
   ```sh
   git clone https://github.com/your-org/taqyon.git
   cd taqyon
   npm install
   ```

2. **Create a new application** in a different directory:
   ```sh
   node taqyon-cli.js
   
   # You'll be prompted for:
   # - Project name (will create a NEW directory with this name)
   # - Scaffold frontend? (Y/n)
   # - Scaffold backend? (Y/n)
   # - Frontend framework (selected from a list: React, Vue, Svelte)
   # - Qt6 installation path (if not detected automatically)
   ```

3. **Navigate to your newly created project directory**:
   ```sh
   cd your-project-name
   ```

4. **Install dependencies**:
   ```sh
   npm install
   cd frontend && npm install && cd ..
   ```

5. **Run the application**:
   ```sh
   npm start
   ```

### ⚠️ Common Issues:

- **"No such file or directory" error**: Make sure you're running npm commands from within your generated project directory, not the Taqyon tool directory.
- **"Qt6 not found" error**: The CLI now attempts to detect Qt6 automatically. If not found, you'll be prompted to provide the path.
- **"WebEngineWidgets not found"**: The backend will automatically fall back to a basic Qt UI if WebEngine modules aren't available in your Qt installation.
- **Missing frontend**: If you chose to skip frontend scaffolding, you shouldn't run frontend-related scripts like `npm run frontend:dev`.

---

## 🖥️ About Qt WebEngine Fallback

Taqyon is designed to work with Qt6's WebEngine module for rendering web content, but not all Qt installations include this component. To ensure maximum compatibility:

1. **Automatic Detection**: During project creation, Taqyon attempts to find Qt6 on your system.
2. **Fallback Mechanism**: The generated CMakeLists.txt first tries to find WebEngine components, but falls back to basic Qt widgets if not available.
3. **Two Entry Points**: 
   - `main.cpp`: Used when WebEngine is available (loads web content)
   - `main_basic.cpp`: Used when WebEngine is not available (displays native Qt UI)

This approach ensures your app will build with any Qt6 installation, even without WebEngine support.

---

## 🚀 Purpose

- **Rapidly bootstrap** a new desktop app with a minimal Qt/C++ backend and a modern JS/TS frontend.
- **Unified workflow:** One CLI, one project structure, cross-platform scripts.
- **Customizable:** Choose your frontend framework, skip frontend/backend, and extend as needed.

---

## 📦 Prerequisites

- **Node.js** (v16+ recommended)
- **npm** (v8+)
- **CMake** (v3.16+)
- **Qt 6** (Core and Widgets modules required; WebEngineWidgets and WebChannel are optional but recommended)
- **Git** (recommended for version control)

> **Platform notes:**  
> - On Windows, ensure `cmake` and `Qt` are in your PATH.  
> - On macOS/Linux, install Qt via [qt.io](https://www.qt.io/download) or your package manager.

---

## 🛠️ Installation

Clone this repository and install dependencies:

```sh
git clone https://github.com/your-org/taqyon.git
cd taqyon
npm install
```

## ⚖️ License

Taqyon is dual-licensed under your choice of the [MIT License](./LICENSE_MIT) or the [Apache License 2.0](./LICENSE_APACHE-2.0).

This means you can choose the license that best suits your needs.

SPDX-License-Identifier: MIT OR Apache-2.0

---

## 🏗️ Creating a New Project

Run the CLI to scaffold a new project:

```sh
node taqyon-cli.js
```

You'll be prompted for:
- **Project name** (required)
- **Scaffold frontend?** (Y/n)
- **Scaffold backend?** (Y/n)
- **Frontend framework** (selected from a list: React, Vue, Svelte; defaults to React)
- **Qt6 installation path** (if not detected automatically)

### Example Interactive Session

```
$ node taqyon-cli.js
Taqyon CLI - Project Scaffolding
Project name: my-app
Scaffold frontend? (Y/n): y
Scaffold backend? (Y/n): y
? Select a frontend framework: (Use arrow keys)
❯ React
  Vue
  Svelte
# (User selects Vue, for example)
# Selected frontend framework: vue # This line might or might not be present depending on your console.log
Scaffolding vue app in /path/to/my-app/frontend...
Frontend scaffolding complete: frontend/ (vue)

Qt6 found at: /path/to/qt6
Created build helper script: backend/build.sh
Backend scaffolding complete:
  backend/CMakeLists.txt
  backend/main.cpp
  backend/main_basic.cpp
  backend/backendobject.h
  backend/backendobject.cpp

Project scaffolded successfully!
Navigate to your project with: cd my-app
Run 'npm install' to install dependencies if needed
Run 'npm start' to start development
Done.
```

### Expected Directory Structure

```
my-app/
  frontend/           # Chosen framework (React, Vue, Svelte)
    ...               # Standard frontend files
  backend/            # Qt/C++ backend
    CMakeLists.txt    # Build configuration
    main.cpp          # Main file (with WebEngine)
    main_basic.cpp    # Alternative main file (without WebEngine)
    backendobject.h
    backendobject.cpp
    build.sh/bat      # Build script with correct Qt path
  .taqyonrc           # Stores detected Qt path
  package.json        # Scripts for both parts
  README.md
```

---

## ⚙️ CLI Options

- **Default:** Prompts for all options interactively.
- **Advanced (planned):**  
  - `--skip-frontend` – Scaffold only backend  
  - `--skip-backend` – Scaffold only frontend  
  - (See [docs/cli_workflow_and_structure.md](docs/cli_workflow_and_structure.md) for details and future CLI flags)

---

## 📜 npm Scripts

| Script              | Description                                                                                 | Cross-Platform? |
|---------------------|---------------------------------------------------------------------------------------------|-----------------|
| `npm start`         | Runs frontend dev server and backend build/run concurrently                                 | ✅              |
| `npm run build`     | Builds frontend and backend                                                                | ✅              |
| `frontend:dev`      | Starts frontend dev server                                                                 | ✅              |
| `frontend:build`    | Builds frontend                                                                            | ✅              |
| `backend:build`     | Builds backend using CMake with correct Qt path                                            | ✅              |
| `backend:run`       | Runs backend binary                                                                        | ✅              |

- Scripts use `concurrently`, `cross-env`, and `wait-on` for platform compatibility.
- `npm start` waits for the frontend to be ready before launching the backend.

> **Note:**
> If you chose to skip frontend scaffolding when creating your project, only use backend-related scripts.
> If you chose to skip backend scaffolding, only use frontend-related scripts.

---

## 🧑‍💻 Example Workflow

```sh
# Scaffold a new project
node taqyon-cli.js

# Enter your project directory
cd my-app

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build and run both parts
npm start
```

---

## 🛠️ Troubleshooting & Platform Notes

- **Qt not found:**  
  If Qt6 wasn't detected during project creation:
  - Edit `.taqyonrc` to update the Qt6 path
  - Edit `backend/build.sh` or `backend/build.bat` with the correct path

- **CMake errors:**  
  Check that CMake is installed and up to date. Use `cmake --version` to verify.

- **Missing Qt WebEngine modules:**  
  The backend will automatically fall back to a basic Qt UI if WebEngine modules aren't available. No action needed.

- **"Could not read package.json" error when running `npm start`:**
  This occurs if you run `npm start` or other frontend-related scripts but the `frontend/` directory doesn't exist.
  **Solution:**
    - Only run backend-related scripts if you skipped frontend scaffolding
    - Only run frontend-related scripts if you skipped backend scaffolding

- **Port conflicts:**  
  The backend expects the frontend dev server at `localhost:3000`. Change the port in frontend config if needed and update `main.cpp` accordingly.

- **Windows-specific:**  
  Use Git Bash or WSL for a Unix-like shell, or ensure all tools are in your system PATH.

---

## 📚 Further Documentation

For detailed guides, API references, and advanced topics, please see the [Taqyon Documentation Hub](./docs/README.md).

Key topics include:
- CLI Workflow and Structure
- Frontend-Backend Communication (QWebChannel, Counter Example for React/Vue/Svelte)
- Backend C++ Implementation (Counter Example)
- Qt Setup and Build Processes

(Previously listed individual files can be found linked within the [Documentation Hub](./docs/README.md))

---

## 🗨️ Feedback & Contributions

Contributions, bug reports, and feature requests are welcome!  
Open an issue or PR on GitHub.

---
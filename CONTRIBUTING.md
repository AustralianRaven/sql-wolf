# Contributing to SqlWolf

## Prerequisites

### 1. Install Node.js and Yarn

You will need Node.js 20 and Yarn.

```powershell
npm install -g yarn
```

### 2. Install Visual Studio Build Tools 2022 (C++ compiler)

The project has native modules that require compilation. Install VS 2022 Build Tools via winget:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

Then add the C++ workload (required — without this, `yarn install` will fail):

```powershell
Start-Process "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe" -ArgumentList "modify --installPath ""C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive" -Verb RunAs -Wait
```

> **Note:** If you have VS 2025 Build Tools (`\18\BuildTools`) already installed, node-gyp won't recognise it — you still need the 2022 Build Tools alongside it.

## Install Dependencies

From the repo root:

```powershell
yarn install
```

## Running the App

`yarn bks:dev` from the root may not launch the Electron window reliably on Windows. Instead, run from `apps/studio`:

```powershell
cd apps/studio
node ./esbuild.mjs watch
```

For hot reload on the frontend, open a second terminal and run:

```powershell
cd apps/studio
yarn dev:vite
```

> SqlWolf is an **Electron desktop app** — it opens as a desktop window, not in a browser.

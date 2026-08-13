# Code Writer — Phase 3 Project Writer

Phase 3 adds whole-project writing to the local practice IDE.

## What it does

1. Click the extension.
2. Choose a project folder.
3. The extension reads the files in that folder.
4. It filters common generated folders such as `node_modules`, `.git`, `dist`, and `build`.
5. It sends the project to the local Monaco IDE.
6. The IDE creates missing files and writes their exact contents.
7. The first project file is opened automatically.

## Run

From the Phase 3 folder:

```powershell
python -m http.server 8000 --directory demo
```

Open:

```text
http://localhost:8000/
```

Then go to `chrome://extensions`, reload/remove the previous Code Writer extension, and load the new `extension` folder.

## Test

Create a folder such as:

```text
my-project/
├── index.html
├── script.js
├── style.css
└── README.md
```

Open the extension, choose the folder, and click **Write Project**.

The Explorer should populate with the project files.

## Important

This phase is intentionally restricted to the local practice IDE (`localhost` / `127.0.0.1`). It is not designed to automate live assessment systems.

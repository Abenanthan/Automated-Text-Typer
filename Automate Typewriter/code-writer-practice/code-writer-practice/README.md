# Code Writer Practice

A safe starter project for experimenting with automated code entry in a local practice IDE.

## Project structure

- `demo/` — local practice coding page
- `extension/` — Chrome/Edge Manifest V3 extension

## Run the practice IDE

From this directory:

```bash
python -m http.server 8000 --directory demo
```

Open:

`http://localhost:8000`

## Install the extension

1. Open Chrome/Edge extensions.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the `extension` folder.
5. Open the local practice IDE.
6. Click the extension.
7. Enter code.
8. Click **Write to Practice Editor**.

This starter intentionally targets localhost only.

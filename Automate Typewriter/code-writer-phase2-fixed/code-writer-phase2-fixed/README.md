# Code Writer Phase 2.1 — Monaco bridge fix

This fixes the Monaco insertion issue in Phase 2.

The previous version could report success after interacting with Monaco's
hidden textarea without actually changing Monaco's model. This version uses
a DOM event bridge so the page itself updates the Monaco model.

## Run

From this folder:

```powershell
python -m http.server 8000 --directory demo
```

Open:

http://localhost:8000/

## Reload extension

Go to `chrome://extensions`, find Code Writer Practice, click Reload.

Then refresh the local IDE page.

## Test

Select `index.html`, enter:

```html
<!DOCTYPE html>
<html>
<body>
<h1>Hello from Code Writer</h1>
</body>
</html>
```

Click Write Code. The Monaco editor should visibly contain the code.

Then test `script.js` and `style.css`.

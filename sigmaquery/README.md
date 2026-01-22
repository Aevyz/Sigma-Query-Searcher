# Sigma Query Local

Static, offline Sigma rule search that supports full YAML matching.

## Build the index

```bash
python3 build_index.py --source /path/to/sigma
```

The script writes `data/rules.json`.

Optional: exclude directories by name (repeatable).

```bash
python3 build_index.py --source /path/to/sigma --exclude regression_data --exclude tests
```

## Run locally

Use a simple static server so the browser can fetch `data/rules.json`.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` and search across full YAML content.

## Flowchart view (offline)

Flowchart rendering uses Mermaid locally. Download `mermaid.min.js` and place it
at `assets/vendor/mermaid.min.js`. The flowchart view will warn if Mermaid is
missing.

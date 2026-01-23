# Sigma Query Searcher

A local, offline web interface for searching and exploring [Sigma](https://github.com/SigmaHQ/sigma) detection rules. Search across full YAML content, view rule summaries, and visualize detection logic as interactive flowcharts.

## Features

- **Full-text search** - Search across complete YAML content or titles only
- **Space-separated tokens** - Search for multiple terms (e.g., `curl useragent`) with AND logic
- **Summary view** - Nicely formatted rule details including description, author, references, MITRE tags, logsource, and false positives
- **Flowchart visualization** - Interactive flowcharts showing detection logic with clickable nodes that link to YAML definitions
- **YAML view** - Full YAML with search term highlighting
- **Offline-first** - Works entirely locally with no external dependencies after setup


## Getting Started

### 1. Build the index

Generate the search index from your local Sigma rules repository:

```bash
cd sigmaquery
python3 build_index.py --source /path/to/sigma/rules
```

This creates `data/rules.json` containing all indexed rules.

**Optional:** Exclude specific directories:

```bash
python3 build_index.py --source /path/to/sigma --exclude deprecated --exclude tests
```

### 2. Set up Mermaid (for flowcharts)

Download [mermaid.min.js](https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js) and place it at:

```
sigmaquery/assets/vendor/mermaid.min.js
```

The flowchart view will display a warning if Mermaid is not available.

### 3. Run locally

Start a local web server:

```bash
cd sigmaquery
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Deployment

The app can be deployed as a static site. A GitHub Actions workflow is included for GitHub Pages deployment.

## Acknowledgments

- [Sigma](https://github.com/SigmaHQ/sigma) - Generic signature format for SIEM systems
- [SigmaQuery](https://sigmaquery.com/) for the inspiration to make a flowchart.
- Claude, for writing the code that I'm too lazy to do.

## License

MIT

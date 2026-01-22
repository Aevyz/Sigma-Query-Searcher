const state = {
  rules: [],
  filtered: [],
  selectedIndex: null,
  limit: 120,
  mode: "yaml",
  detailView: "yaml",
  flowchartSvg: "",
  flowchartZoom: 1,
  highlightLineNumber: null,
};

function setViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

setViewportHeight();
window.addEventListener("resize", setViewportHeight);

const searchInput = document.getElementById("searchInput");
const modeButtons = document.querySelectorAll(".toggle-btn");
const list = document.getElementById("list");
const detail = document.getElementById("detail");
const statusLine = document.getElementById("statusLine");
const ruleCount = document.getElementById("ruleCount");
const datasetPath = document.getElementById("datasetPath");
const clearBtn = document.getElementById("clearBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const flowchartModal = document.getElementById("flowchartModal");
const flowchartModalBody = document.getElementById("flowchartModalBody");
const flowchartZoomIn = document.getElementById("flowchartZoomIn");
const flowchartZoomOut = document.getElementById("flowchartZoomOut");
const flowchartZoomReset = document.getElementById("flowchartZoomReset");
const flowchartClose = document.getElementById("flowchartClose");

function updateMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
  });
  runSearch();
}

function normalizeForSearch(value) {
  return value
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchCache(value) {
  const lower = value.toLowerCase();
  const normalized = normalizeForSearch(value);
  const compact = normalized.replace(/\s+/g, "");
  return { lower, normalized, compact };
}

function getSearchCache(rule) {
  if (state.mode === "title") {
    if (!rule._titleCache) {
      const logsource = rule.logsource || {};
      const base = `${rule.title || ""} ${rule.path || ""} ${logsource.product || ""} ${logsource.category || ""} ${logsource.service || ""}`;
      rule._titleCache = buildSearchCache(base);
    }
    return rule._titleCache;
  }
  if (!rule._yamlCache) {
    const logsource = rule.logsource || {};
    const base = `${rule.yaml || ""} ${rule.path || ""} ${logsource.product || ""} ${logsource.category || ""} ${logsource.service || ""}`;
    rule._yamlCache = buildSearchCache(base);
  }
  return rule._yamlCache;
}

function runSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    state.filtered = [...state.rules];
  } else {
    // Split query into tokens (space-separated terms)
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);

    state.filtered = state.rules.filter((rule) => {
      const cache = getSearchCache(rule);

      // All tokens must be present in the content (AND logic)
      return tokens.every((token) => {
        // Normalize the token for symbol-tolerant matching
        const normalizedToken = normalizeForSearch(token);

        // Check if token exists in any of the cached forms
        if (cache.lower.includes(token)) {
          return true;
        }
        if (normalizedToken && cache.normalized.includes(normalizedToken)) {
          return true;
        }
        return false;
      });
    });
  }
  state.selectedIndex = null;
  renderResults();
}

function setStatus() {
  const total = state.filtered.length;
  const showing = Math.min(total, state.limit);
  const query = searchInput.value.trim();
  const modeLabel = state.mode === "yaml" ? "full YAML" : "titles";
  statusLine.textContent = query
    ? `Found ${total} matching rules. Showing ${showing}. (${modeLabel})`
    : `Showing ${showing} of ${total} rules. (${modeLabel})`;
  loadMoreBtn.disabled = showing >= total;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function sortRules(rules) {
  return [...rules].sort((a, b) => {
    const aDate = parseDate(a.modified) || parseDate(a.date) || 0;
    const bDate = parseDate(b.modified) || parseDate(b.date) || 0;
    if (aDate !== bDate) {
      return bDate - aDate;
    }
    return (a.title || "").localeCompare(b.title || "");
  });
}

function renderResults() {
  setStatus();
  list.innerHTML = "";
  const visible = state.filtered.slice(0, state.limit);
  visible.forEach((rule, index) => {
    const card = document.createElement("div");
    card.className = "card";
    if (index === state.selectedIndex) {
      card.classList.add("active");
    }

    const title = document.createElement("h3");
    const titleValue = rule.title || rule.path;
    title.textContent = titleValue;
    title.title = titleValue;

    const path = document.createElement("p");
    path.className = "card-path card-meta";
    path.textContent = rule.path;
    path.title = rule.path;

    const dateLine = document.createElement("p");
    dateLine.className = "card-meta";
    dateLine.textContent = rule.modified || rule.date || "date: unknown";

    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    if (rule.status) {
      const statusTag = document.createElement("span");
      statusTag.className = "tag";
      statusTag.textContent = rule.status;
      tagRow.appendChild(statusTag);
    }
    if (rule.level) {
      const levelTag = document.createElement("span");
      levelTag.className = "tag";
      levelTag.textContent = rule.level;
      tagRow.appendChild(levelTag);
    }
    const logsource = rule.logsource || {};
    if (logsource.product) {
      const productTag = document.createElement("span");
      productTag.className = "tag";
      productTag.textContent = `product:${logsource.product}`;
      tagRow.appendChild(productTag);
    }
    if (logsource.category) {
      const categoryTag = document.createElement("span");
      categoryTag.className = "tag";
      categoryTag.textContent = `category:${logsource.category}`;
      tagRow.appendChild(categoryTag);
    }
    if (logsource.service) {
      const serviceTag = document.createElement("span");
      serviceTag.className = "tag";
      serviceTag.textContent = `service:${logsource.service}`;
      tagRow.appendChild(serviceTag);
    }

    card.appendChild(title);
    card.appendChild(path);
    card.appendChild(dateLine);
    if (tagRow.childNodes.length > 0) {
      card.appendChild(tagRow);
    }

    card.addEventListener("click", () => {
      state.selectedIndex = index;
      renderDetail(rule);
      renderResults();
    });

    list.appendChild(card);
  });
}

function renderDetail(rule) {
  detail.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = rule.title || "Untitled rule";

  const meta = document.createElement("p");
  meta.textContent = rule.path;

  const toolbar = document.createElement("div");
  toolbar.className = "detail-toolbar";

  const yamlBtn = document.createElement("button");
  yamlBtn.type = "button";
  yamlBtn.textContent = "YAML View";
  yamlBtn.className = state.detailView === "yaml" ? "active" : "";
  yamlBtn.addEventListener("click", () => {
    state.detailView = "yaml";
    state.highlightLineNumber = null; // Clear highlight when switching views
    renderDetail(rule);
  });

  const flowBtn = document.createElement("button");
  flowBtn.type = "button";
  flowBtn.textContent = "Flowchart View";
  flowBtn.className = state.detailView === "flowchart" ? "active" : "";
  flowBtn.addEventListener("click", () => {
    state.detailView = "flowchart";
    renderDetail(rule);
  });

  toolbar.appendChild(yamlBtn);
  toolbar.appendChild(flowBtn);

  const body = document.createElement("div");
  body.className = "detail-body";

  if (state.detailView === "flowchart") {
    const flowchart = document.createElement("div");
    flowchart.className = "flowchart";
    flowchart.innerHTML = '<p class="flowchart-loading">Rendering flowchart…</p>';
    body.appendChild(flowchart);
    renderDetectionFlowchart(rule.yaml || "", flowchart);

    const popBtn = document.createElement("button");
    popBtn.type = "button";
    popBtn.textContent = "Open Flowchart";
    popBtn.addEventListener("click", () => {
      openFlowchartModal();
    });
    toolbar.appendChild(popBtn);
  } else {
    const pre = document.createElement("pre");
    const query = searchInput.value.trim();
    pre.innerHTML = highlightYaml(rule.yaml || "", query, state.highlightLineNumber);
    body.appendChild(pre);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy YAML";
    copyBtn.addEventListener("click", () => {
      copyYamlToClipboard(rule.yaml || "", copyBtn);
    });
    toolbar.appendChild(copyBtn);
  }

  detail.appendChild(heading);
  detail.appendChild(meta);
  detail.appendChild(toolbar);
  detail.appendChild(body);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightYaml(text, query, highlightLineNumber = null) {
  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');

  // Apply line highlighting if specified
  let result = lines.map((line, idx) => {
    const lineNum = idx + 1;
    if (highlightLineNumber && lineNum === highlightLineNumber) {
      return `<span class="highlight-line">${line}</span>`;
    }
    return line;
  }).join('\n');

  if (!query) {
    return result;
  }

  // Split query into space-separated tokens to match search behavior
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return result;
  }

  // Build a single regex pattern that matches any of the tokens
  // This prevents issues with overlapping replacements
  const escapedTokens = tokens.map((token) => escapeRegExp(token));
  const pattern = new RegExp(`(${escapedTokens.join('|')})`, "gi");

  return result.replace(pattern, (match) => `<mark>${match}</mark>`);
}

function copyYamlToClipboard(yaml, button) {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = yaml;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showCopyFeedback(button, true);
    } catch (err) {
      showCopyFeedback(button, false);
    }
    document.body.removeChild(textarea);
    return;
  }

  navigator.clipboard
    .writeText(yaml)
    .then(() => {
      showCopyFeedback(button, true);
    })
    .catch(() => {
      showCopyFeedback(button, false);
    });
}

function showCopyFeedback(button, success) {
  const originalText = button.textContent;
  button.textContent = success ? "Copied!" : "Failed to copy";
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
  }, 2000);
}

function renderDetectionFlowchart(yaml, container) {
  if (!window.mermaid || !window.mermaid.render) {
    container.innerHTML =
      '<p class="flowchart-missing">Mermaid is not available.</p>';
    return;
  }

  const detectionMatch = yaml.match(/detection:\s*\n([\s\S]+?)(?:\n\w+:|$)/);
  if (!detectionMatch) {
    container.innerHTML =
      '<p class="flowchart-missing">No detection logic found in this rule.</p>';
    return;
  }

  const detectionSection = detectionMatch[1];
  const selections = [];
  const lines = detectionSection.split("\n");
  let currentSelection = null;
  let currentFields = [];
  let currentSelectionLineNumber = null;

  // Find the line number where detection: starts in the full YAML
  const yamlLines = yaml.split('\n');
  const detectionLineIndex = yamlLines.findIndex(line => line.match(/^detection:\s*$/));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const selectionMatch = line.match(/^\s{4}(\w+):\s*$/);
    if (
      selectionMatch &&
      selectionMatch[1] !== "condition" &&
      selectionMatch[1] !== "timeframe"
    ) {
      if (currentSelection && currentFields.length > 0) {
        selections.push({
          name: currentSelection,
          fields: currentFields,
          lineNumber: currentSelectionLineNumber,
        });
      }
      currentSelection = selectionMatch[1];
      currentSelectionLineNumber = detectionLineIndex + i + 2; // +1 for 0-based to 1-based, +1 for detection line itself
      currentFields = [];
    } else if (currentSelection) {
      // Match field definitions like "Image|endswith:" or "CommandLine|contains:"
      const fieldMatch = line.match(/^\s{8,}([^#\s-][^:]*?):\s*(.*)$/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1].trim();
        const fieldValue = fieldMatch[2].trim();

        // If the value is on the same line (not a list)
        if (fieldValue && fieldValue !== '') {
          currentFields.push({
            name: fieldName,
            values: [fieldValue],
          });
        } else {
          // Value is on next lines (list format)
          const values = [];
          let j = i + 1;
          while (j < lines.length) {
            const valueLine = lines[j];
            const valueMatch = valueLine.match(/^\s{12,}-\s+['"]?(.+?)['"]?\s*$/);
            if (valueMatch) {
              values.push(valueMatch[1].trim());
              j += 1;
            } else if (valueLine.match(/^\s{8,}[^#\s-]/)) {
              // Next field started
              break;
            } else {
              j += 1;
            }
          }
          if (values.length > 0) {
            currentFields.push({
              name: fieldName,
              values,
            });
          }
        }
      }
    }
  }

  if (currentSelection && currentFields.length > 0) {
    selections.push({
      name: currentSelection,
      fields: currentFields,
      lineNumber: currentSelectionLineNumber,
    });
  }

  const conditionMatch = detectionSection.match(/condition:\s*(.+)/);
  const condition = conditionMatch ? conditionMatch[1].trim() : "unknown";

  // Find condition line number
  const conditionLineIndex = lines.findIndex(line => line.match(/^\s{4}condition:\s*/));
  const conditionLineNumber = conditionLineIndex >= 0 ? detectionLineIndex + conditionLineIndex + 2 : null;

  // Helper function to escape special characters for Mermaid
  function escapeMermaid(text) {
    return text
      .replace(/"/g, '#quot;')
      .replace(/\n/g, '<br/>')
      .replace(/\*/g, '#42;')
      .replace(/_/g, '#95;')
      .replace(/~/g, '#126;');
  }

  let mermaidCode = "flowchart TD\n";
  mermaidCode += "    Start([Detection Start])\n";

  if (selections.length > 0) {
    // Connect start to all selections
    selections.forEach((sel, idx) => {
      const nodeId = `Sel${idx}`;
      // Simplified label - just selection name and field count
      const fieldCount = sel.fields.length;
      const fieldSummary = fieldCount === 1 ? '1 field' : `${fieldCount} fields`;
      let label = `<b>${escapeMermaid(sel.name)}</b><br/>${fieldSummary}`;

      mermaidCode += `    Start --> ${nodeId}["${label}"]\n`;
    });

    // Connect all selections to condition
    selections.forEach((sel, idx) => {
      const nodeId = `Sel${idx}`;
      mermaidCode += `    ${nodeId} --> Condition\n`;
    });

    const conditionLabel =
      condition.length > 50 ? `${escapeMermaid(condition.slice(0, 50))}...` : escapeMermaid(condition);
    mermaidCode += `    Condition{"${conditionLabel}"} -->|Match| Alert[🚨 Alert]\n`;
    mermaidCode += "    Condition -->|No Match| NoMatch[No Match]\n";
  } else {
    mermaidCode += "    Start --> Alert[🚨 Alert]\n";
  }

  mermaidCode += "    style Start fill:#fffdfa,stroke:#d29a61,stroke-width:2px\n";
  mermaidCode += "    style Alert fill:#d29a61,stroke:#a46b33,stroke-width:3px\n";
  mermaidCode += "    style NoMatch fill:#f7efe5,stroke:#c5b7a8,stroke-width:1px\n";
  mermaidCode += "    style Condition fill:#fff2e3,stroke:#a46b33,stroke-width:2px\n";

  selections.forEach((sel, idx) => {
    mermaidCode += `    style Sel${idx} fill:#ffffff,stroke:#d29a61,stroke-width:2px\n`;
  });

  const id = `flowchart_${Math.random().toString(36).slice(2)}`;
  const result = window.mermaid.render(id, mermaidCode);
  if (result && typeof result.then === "function") {
    result.then(({ svg }) => {
      container.innerHTML = svg;
      state.flowchartSvg = svg;
      attachFlowchartClickHandlers(container, selections, conditionLineNumber);
    });
    return;
  }
  container.innerHTML = result.svg;
  state.flowchartSvg = result.svg;
  attachFlowchartClickHandlers(container, selections, conditionLineNumber);
}

function attachFlowchartClickHandlers(container, selections, conditionLineNumber) {
  // Get the current rule's YAML for line counting
  const currentRule = state.filtered[state.selectedIndex];
  if (!currentRule) {
    return;
  }

  // Add click handlers to selection nodes
  selections.forEach((sel, idx) => {
    const nodeId = `Sel${idx}`;
    // Find the SVG element by looking for nodes with this ID
    const nodeElements = container.querySelectorAll(`[id*="${nodeId}"]`);
    nodeElements.forEach((element) => {
      element.style.cursor = 'pointer';
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close modal if open
        if (flowchartModal.classList.contains('open')) {
          closeFlowchartModal();
        }
        // Set highlight line BEFORE rendering
        state.highlightLineNumber = sel.lineNumber;
        state.detailView = 'yaml';
        renderDetail(currentRule);
        scrollToYamlLine(sel.lineNumber);
      });
    });
  });

  // Add click handler to condition node
  if (conditionLineNumber) {
    const conditionElements = container.querySelectorAll('[id*="Condition"]');
    conditionElements.forEach((element) => {
      element.style.cursor = 'pointer';
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close modal if open
        if (flowchartModal.classList.contains('open')) {
          closeFlowchartModal();
        }
        // Set highlight line BEFORE rendering
        state.highlightLineNumber = conditionLineNumber;
        state.detailView = 'yaml';
        renderDetail(currentRule);
        scrollToYamlLine(conditionLineNumber);
      });
    });
  }
}

function scrollToYamlLine(lineNumber) {
  if (!lineNumber) {
    return;
  }

  // Set the line to highlight in state
  state.highlightLineNumber = lineNumber;

  // Wait a bit for the render to complete
  setTimeout(() => {
    const detailBody = document.querySelector('#detail .detail-body');
    const pre = detailBody?.querySelector('pre');
    if (!pre) {
      return;
    }

    // Find the highlighted line element and scroll to it
    const highlightedLine = pre.querySelector('.highlight-line');
    if (highlightedLine) {
      highlightedLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Fallback to approximate positioning
      const lines = pre.textContent.split('\n');
      const lineHeight = pre.scrollHeight / lines.length;
      const scrollPosition = (lineNumber - 1) * lineHeight;
      pre.scrollTop = Math.max(0, scrollPosition - pre.clientHeight / 3);
    }

    // Clear highlight after a few seconds
    setTimeout(() => {
      state.highlightLineNumber = null;
      const currentRule = state.filtered[state.selectedIndex];
      if (currentRule && state.detailView === 'yaml') {
        const query = searchInput.value.trim();
        pre.innerHTML = highlightYaml(currentRule.yaml || "", query, null);
      }
    }, 3000);
  }, 100);
}

function openFlowchartModal() {
  if (!state.flowchartSvg) {
    return;
  }
  flowchartModalBody.innerHTML = state.flowchartSvg;

  // Re-attach click handlers in modal
  const currentRule = state.filtered[state.selectedIndex];
  if (currentRule && currentRule.yaml) {
    // Re-parse to get selections and line numbers
    const detectionMatch = currentRule.yaml.match(/detection:\s*\n([\s\S]+?)(?:\n\w+:|$)/);
    if (detectionMatch) {
      const detectionSection = detectionMatch[1];
      const lines = detectionSection.split("\n");
      const yamlLines = currentRule.yaml.split('\n');
      const detectionLineIndex = yamlLines.findIndex(line => line.match(/^detection:\s*$/));

      const selections = [];
      let currentSelection = null;
      let currentFields = [];
      let currentSelectionLineNumber = null;

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const selectionMatch = line.match(/^\s{4}(\w+):\s*$/);
        if (selectionMatch && selectionMatch[1] !== "condition" && selectionMatch[1] !== "timeframe") {
          if (currentSelection && currentFields.length > 0) {
            selections.push({ name: currentSelection, fields: currentFields, lineNumber: currentSelectionLineNumber });
          }
          currentSelection = selectionMatch[1];
          currentSelectionLineNumber = detectionLineIndex + i + 2;
          currentFields = [];
        } else if (currentSelection) {
          const fieldMatch = line.match(/^\s{8,}([^#\s-][^:]*?):\s*(.*)$/);
          if (fieldMatch) {
            currentFields.push({ name: fieldMatch[1].trim() });
          }
        }
      }

      if (currentSelection && currentFields.length > 0) {
        selections.push({ name: currentSelection, fields: currentFields, lineNumber: currentSelectionLineNumber });
      }

      const conditionLineIndex = lines.findIndex(line => line.match(/^\s{4}condition:\s*/));
      const conditionLineNumber = conditionLineIndex >= 0 ? detectionLineIndex + conditionLineIndex + 2 : null;

      attachFlowchartClickHandlers(flowchartModalBody, selections, conditionLineNumber);
    }
  }

  updateFlowchartZoom();
  flowchartModal.classList.add("open");
}

function closeFlowchartModal() {
  flowchartModal.classList.remove("open");
}

function updateFlowchartZoom() {
  const svg = flowchartModalBody.querySelector("svg");
  if (!svg) {
    return;
  }
  svg.style.transform = `scale(${state.flowchartZoom})`;
}

async function loadIndex() {
  try {
    const response = await fetch("data/rules.json");
    if (!response.ok) {
      throw new Error("rules.json not found");
    }
    const payload = await response.json();
    state.rules = sortRules(payload.rules || []);
    datasetPath.textContent = payload.generated_from || "Local";
    ruleCount.textContent = `${payload.count || state.rules.length}`;
    state.filtered = [...state.rules];
    runSearch();
  } catch (error) {
    statusLine.textContent =
      "Failed to load data/rules.json. Run build_index.py.";
    datasetPath.textContent = "Missing index";
  }
}

searchInput.addEventListener("input", runSearch);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateMode(button.dataset.mode);
  });
});
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  runSearch();
});
loadMoreBtn.addEventListener("click", () => {
  state.limit += 120;
  renderResults();
});

flowchartZoomIn.addEventListener("click", () => {
  state.flowchartZoom = Math.min(3, state.flowchartZoom + 0.2);
  updateFlowchartZoom();
});

flowchartZoomOut.addEventListener("click", () => {
  state.flowchartZoom = Math.max(0.4, state.flowchartZoom - 0.2);
  updateFlowchartZoom();
});

flowchartZoomReset.addEventListener("click", () => {
  state.flowchartZoom = 1;
  updateFlowchartZoom();
});

flowchartClose.addEventListener("click", closeFlowchartModal);
flowchartModal.addEventListener("click", (event) => {
  if (event.target === flowchartModal) {
    closeFlowchartModal();
  }
});

updateMode("yaml");
loadIndex();

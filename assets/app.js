const state = {
  rules: [],
  filtered: [],
  selectedIndex: null,
  limit: 120,
  mode: "yaml",
  detailView: "summary",
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
const buildTime = document.getElementById("buildTime");
const lastCommit = document.getElementById("lastCommit");
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
      statusTag.textContent = `status: ${rule.status}`;
      tagRow.appendChild(statusTag);
    }
    if (rule.level) {
      const levelTag = document.createElement("span");
      levelTag.className = "tag";
      levelTag.textContent = `level: ${rule.level}`;
      tagRow.appendChild(levelTag);
    }
    const logsource = rule.logsource || {};
    if (logsource.product) {
      const productTag = document.createElement("span");
      productTag.className = "tag";
      productTag.textContent = `product: ${logsource.product}`;
      tagRow.appendChild(productTag);
    }
    if (logsource.category) {
      const categoryTag = document.createElement("span");
      categoryTag.className = "tag";
      categoryTag.textContent = `category: ${logsource.category}`;
      tagRow.appendChild(categoryTag);
    }
    if (logsource.service) {
      const serviceTag = document.createElement("span");
      serviceTag.className = "tag";
      serviceTag.textContent = `service: ${logsource.service}`;
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

  // Summary button (first)
  const summaryBtn = document.createElement("button");
  summaryBtn.type = "button";
  summaryBtn.textContent = "Summary";
  summaryBtn.className = state.detailView === "summary" ? "active" : "";
  summaryBtn.addEventListener("click", () => {
    state.detailView = "summary";
    renderDetail(rule);
  });

  // Flowchart button (second)
  const flowBtn = document.createElement("button");
  flowBtn.type = "button";
  flowBtn.textContent = "Flowchart";
  flowBtn.className = state.detailView === "flowchart" ? "active" : "";
  flowBtn.addEventListener("click", () => {
    state.detailView = "flowchart";
    renderDetail(rule);
  });

  // YAML button (third)
  const yamlBtn = document.createElement("button");
  yamlBtn.type = "button";
  yamlBtn.textContent = "YAML";
  yamlBtn.className = state.detailView === "yaml" ? "active" : "";
  yamlBtn.addEventListener("click", () => {
    state.detailView = "yaml";
    state.highlightLineNumber = null;
    renderDetail(rule);
  });

  toolbar.appendChild(summaryBtn);
  toolbar.appendChild(flowBtn);
  toolbar.appendChild(yamlBtn);

  const body = document.createElement("div");
  body.className = "detail-body";

  if (state.detailView === "summary") {
    renderSummaryView(rule, body);
  } else if (state.detailView === "flowchart") {
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

function parseYamlFields(yaml) {
  const fields = {
    description: '',
    author: '',
    references: [],
    tags: [],
    falsepositives: [],
  };

  if (!yaml) return fields;

  const lines = yaml.split('\n');

  // Parse single-line fields
  for (const line of lines) {
    const descMatch = line.match(/^description:\s*['"]?(.+?)['"]?\s*$/i);
    if (descMatch) {
      fields.description = descMatch[1].trim();
    }
    const authorMatch = line.match(/^author:\s*['"]?(.+?)['"]?\s*$/i);
    if (authorMatch) {
      fields.author = authorMatch[1].trim();
    }
  }

  // Parse multi-line fields (references, tags, falsepositives)
  let currentField = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^references:\s*$/i)) {
      currentField = 'references';
      continue;
    }
    if (line.match(/^tags:\s*$/i)) {
      currentField = 'tags';
      continue;
    }
    if (line.match(/^falsepositives:\s*$/i)) {
      currentField = 'falsepositives';
      continue;
    }

    // Check if we hit a new top-level field
    if (line.match(/^[a-z]+:/i) && !line.startsWith(' ')) {
      currentField = null;
      continue;
    }

    // Parse list items
    if (currentField) {
      const listMatch = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
      if (listMatch) {
        fields[currentField].push(listMatch[1].trim());
      }
    }
  }

  return fields;
}

function renderSummaryView(rule, body) {
  const summary = document.createElement("div");
  summary.className = "summary-view";

  // Parse additional fields from YAML
  const parsed = parseYamlFields(rule.yaml);

  // Description
  if (parsed.description) {
    const descSection = document.createElement("div");
    descSection.className = "summary-section";
    descSection.innerHTML = `<h4>Description</h4><p>${escapeHtml(parsed.description)}</p>`;
    summary.appendChild(descSection);
  }

  // Author
  if (parsed.author) {
    const authorSection = document.createElement("div");
    authorSection.className = "summary-section";
    authorSection.innerHTML = `<h4>Author</h4><p>${escapeHtml(parsed.author)}</p>`;
    summary.appendChild(authorSection);
  }

  // References
  if (parsed.references.length > 0) {
    const refSection = document.createElement("div");
    refSection.className = "summary-section";
    const refTitle = document.createElement("h4");
    refTitle.textContent = "References";
    refSection.appendChild(refTitle);
    const refList = document.createElement("ul");
    refList.className = "summary-list";
    parsed.references.forEach((ref) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = ref;
      link.textContent = ref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      li.appendChild(link);
      refList.appendChild(li);
    });
    refSection.appendChild(refList);
    summary.appendChild(refSection);
  }

  // MITRE Tags
  if (parsed.tags.length > 0) {
    const tagsSection = document.createElement("div");
    tagsSection.className = "summary-section";
    const tagsTitle = document.createElement("h4");
    tagsTitle.textContent = "Tags";
    tagsSection.appendChild(tagsTitle);
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "summary-tags";
    parsed.tags.forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = tag;
      tagsContainer.appendChild(tagEl);
    });
    tagsSection.appendChild(tagsContainer);
    summary.appendChild(tagsSection);
  }

  // Logsource
  const logsource = rule.logsource || {};
  if (logsource.product || logsource.category || logsource.service) {
    const logSection = document.createElement("div");
    logSection.className = "summary-section";
    const logTitle = document.createElement("h4");
    logTitle.textContent = "Logsource";
    logSection.appendChild(logTitle);
    const logDetails = document.createElement("div");
    logDetails.className = "summary-logsource";
    if (logsource.product) {
      logDetails.innerHTML += `<p><strong>Product:</strong> ${escapeHtml(logsource.product)}</p>`;
    }
    if (logsource.category) {
      logDetails.innerHTML += `<p><strong>Category:</strong> ${escapeHtml(logsource.category)}</p>`;
    }
    if (logsource.service) {
      logDetails.innerHTML += `<p><strong>Service:</strong> ${escapeHtml(logsource.service)}</p>`;
    }
    logSection.appendChild(logDetails);
    summary.appendChild(logSection);
  }

  // False Positives
  if (parsed.falsepositives.length > 0) {
    const fpSection = document.createElement("div");
    fpSection.className = "summary-section";
    const fpTitle = document.createElement("h4");
    fpTitle.textContent = "False Positives";
    fpSection.appendChild(fpTitle);
    const fpList = document.createElement("ul");
    fpList.className = "summary-list";
    parsed.falsepositives.forEach((fp) => {
      const li = document.createElement("li");
      li.textContent = fp;
      fpList.appendChild(li);
    });
    fpSection.appendChild(fpList);
    summary.appendChild(fpSection);
  }

  // View Detection button
  const detectionBtn = document.createElement("button");
  detectionBtn.type = "button";
  detectionBtn.className = "detection-btn";
  detectionBtn.textContent = "View Detection Logic";
  detectionBtn.addEventListener("click", () => {
    state.detailView = "flowchart";
    renderDetail(rule);
  });
  summary.appendChild(detectionBtn);

  body.appendChild(summary);
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

  // Helper function to format field info for display
  function formatFieldInfo(field) {
    const maxValues = 3;
    const fieldLabel = escapeMermaid(field.name);

    if (field.values.length === 1) {
      const value = escapeMermaid(field.values[0]);
      return `${fieldLabel}: ${value}`;
    }

    const displayValues = field.values.slice(0, maxValues).map(v => escapeMermaid(v));
    if (field.values.length > maxValues) {
      const remaining = field.values.length - maxValues;
      return `${fieldLabel}:<br/> - ${displayValues.join('<br/> - ')}<br/> - (and ${remaining} more)`;
    }
    return `${fieldLabel}:<br/> - ${displayValues.join('<br/> - ')}`;
  }

  let mermaidCode = "flowchart TD\n";
  mermaidCode += "    Start([Detection Start])\n";

  if (selections.length > 0) {
    // Connect start to all selections
    selections.forEach((sel, idx) => {
      const nodeId = `Sel${idx}`;

      // Build label with field details
      let label = `<b>${escapeMermaid(sel.name)}</b>`;

      // Show detailed field information
      sel.fields.forEach((field) => {
        label += `<br/>${formatFieldInfo(field)}`;
      });

      mermaidCode += `    Start --> ${nodeId}["${label}"]\n`;
    });

    // Connect all selections to condition
    selections.forEach((sel, idx) => {
      const nodeId = `Sel${idx}`;
      mermaidCode += `    ${nodeId} --> Condition\n`;
    });

    // Format condition with line breaks for readability
    let conditionLabel = escapeMermaid(condition)
      // Add line breaks after logical operators for better wrapping
      .replace(/\s+(and)\s+/gi, '<br/>$1 ')
      .replace(/\s+(or)\s+/gi, '<br/>$1 ')
      .replace(/\s+(of)\s+/gi, ' $1<br/>');
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

function formatDateTime(isoString) {
  if (!isoString) return "Unknown";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins === 1 ? "1 min ago" : `${diffMins} mins ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  } catch (e) {
    return "Unknown";
  }
}

async function checkForSigmaUpdates(localCommit, localCommitDate) {
  try {
    // Fetch latest commit from Sigma repository via GitHub API
    const response = await fetch('https://api.github.com/repos/SigmaHQ/sigma/commits/master', {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      return; // Silently fail if API is unavailable
    }

    const data = await response.json();
    const remoteCommit = data.sha;
    const remoteCommitDate = data.commit.committer.date;

    // Compare commits
    if (localCommit === remoteCommit) {
      // Up to date
      const currentText = lastCommit.textContent;
      lastCommit.textContent = `${currentText} ✓`;
      lastCommit.title = `${lastCommit.title}\n✓ Up to date with Sigma repository`;
    } else {
      // Check if local is behind remote by comparing dates
      const localDate = new Date(localCommitDate);
      const remoteDate = new Date(remoteCommitDate);

      if (remoteDate > localDate) {
        // Behind remote
        const currentText = lastCommit.textContent;
        lastCommit.textContent = `${currentText} ⚠`;
        lastCommit.title = `${lastCommit.title}\n⚠ Newer commits available in Sigma repository\nLatest: ${remoteCommit.substring(0, 8)} (${formatDateTime(remoteCommitDate)})`;
      } else {
        // Ahead or different branch - show neutral indicator
        const currentText = lastCommit.textContent;
        lastCommit.textContent = `${currentText} ✓`;
        lastCommit.title = `${lastCommit.title}\n✓ Using specific commit`;
      }
    }
  } catch (error) {
    // Silently fail - network issues or API rate limits
    console.debug('Could not check for Sigma updates:', error);
  }
}

async function loadIndex() {
  try {
    const response = await fetch("data/rules.json");
    if (!response.ok) {
      throw new Error("rules.json not found");
    }
    const payload = await response.json();
    state.rules = sortRules(payload.rules || []);
    ruleCount.textContent = `${payload.count || state.rules.length}`;

    // Display build time
    buildTime.textContent = formatDateTime(payload.build_time);
    buildTime.title = payload.build_time || "Unknown";

    // Display last commit info
    if (payload.git_last_commit) {
      const commitHash = payload.git_last_commit.substring(0, 8);
      const commitDate = formatDateTime(payload.git_last_commit_date);

      lastCommit.textContent = `${commitHash} (${commitDate})`;
      lastCommit.title = `${payload.git_last_commit}\n${payload.git_last_commit_date || ''}`;

      // Check for updates from GitHub API (client-side)
      checkForSigmaUpdates(payload.git_last_commit, payload.git_last_commit_date);
    } else {
      lastCommit.textContent = "N/A";
      lastCommit.title = "Git information not available";
    }

    state.filtered = [...state.rules];
    runSearch();
  } catch (error) {
    statusLine.textContent =
      "Failed to load data/rules.json. Run build_index.py.";
    buildTime.textContent = "Missing index";
    lastCommit.textContent = "Missing index";
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

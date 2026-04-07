/**
 * Diagramma – Google Apps Script backend
 *
 * Provides:
 *  - onOpen menu
 *  - Diagram block detection (supports multiple syntaxes via SUPPORTED_SYNTAXES)
 *  - Opening the editor dialog (served from the hosted React app)
 *  - updateDiagramBlock  – update a code block in the doc
 *  - replaceDiagramWithImage – replace a code block with an inline PNG
 *
 * Deployment:
 *  1. Run `npm run build` in the repo root
 *  2. Deploy dist/ to a static host (e.g. GitHub Pages)
 *  3. Set DIAGRAMMA_APP_URL in Script Properties to that URL
 *  4. Push this folder with `clasp push`
 */

const DIALOG_WIDTH = 980;
const DIALOG_HEIGHT = 660;

/**
 * Register supported diagram fence languages here.
 * Each key is the fence language (lowercase), value is the display label.
 * To add a new syntax, just add an entry — detection and round-tripping
 * will work automatically.
 */
const SUPPORTED_SYNTAXES = {
  mermaid: 'Mermaid',
};

function getConfiguredAppUrl() {
  var url = PropertiesService.getScriptProperties().getProperty('DIAGRAMMA_APP_URL');
  if (!url) {
    throw new Error('Set DIAGRAMMA_APP_URL in Script Properties before opening Diagramma.');
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error('DIAGRAMMA_APP_URL must be an absolute http(s) URL.');
  }
  return url.replace(/\/+$/, '');
}

function getAppOrigin(url) {
  var match = String(url).match(/^https?:\/\/[^/]+/);
  if (!match) {
    throw new Error('Could not determine the app origin from DIAGRAMMA_APP_URL.');
  }
  return match[0];
}

// ── Menu ──────────────────────────────────────────────────────────────────────

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Diagramma')
    .addItem('Open Editor', 'openSidebar')
    .addItem('Find Diagram Blocks', 'highlightDiagramBlocks')
    .addItem('Debug: Dump Paragraphs', 'debugDumpParagraphs')
    .addToUi();
}

// ── Sidebar: list of diagram blocks in the document ───────────────────────────

function openSidebar() {
  var blocks = findDiagramBlocks();

  var html = HtmlService.createHtmlOutput(buildSidebarHtml(blocks))
    .setTitle('Diagramma')
    .setWidth(320);

  DocumentApp.getUi().showSidebar(html);
}

// ── Dialog: full editor for a specific block ──────────────────────────────────

function openEditorForBlock(blockIndex) {
  var appUrl = getConfiguredAppUrl();
  var appOrigin = getAppOrigin(appUrl);
  var blocks = findDiagramBlocks();
  if (blockIndex < 0 || blockIndex >= blocks.length) {
    throw new Error('Block index ' + blockIndex + ' not found');
  }

  var block = blocks[blockIndex];

  // For image blocks, try to extract saved style from the metadata
  var savedStyle = null;
  if (block.kind === 'image' && block.meta) {
    try {
      var meta = typeof block.meta === 'string' ? JSON.parse(block.meta) : block.meta;
      if (meta.style) savedStyle = meta.style;
    } catch(_) {}
  }

  var gasContext = JSON.stringify({
    isGas: true,
    blockIndex: blockIndex,
    code: block.source,
    syntax: block.syntax,
    style: savedStyle,
  });

  var html = HtmlService.createHtmlOutput(
    '<!doctype html><html><head><style>' +
    '* { margin: 0; padding: 0; box-sizing: border-box; }' +
    'html, body, iframe { width: 100%; height: 100%; border: none; display: block; }' +
    '</style></head><body>' +
    '<iframe id="editor" src="' + appUrl + '?ngrok-skip-browser-warning=1"' +
    '        allow="clipboard-write" sandbox="allow-scripts allow-same-origin" referrerpolicy="origin"></iframe>' +
    '<script>' +
    'var ctx = ' + gasContext + ';' +
    'var appOrigin = ' + JSON.stringify(appOrigin) + ';' +
    'var iframe = document.getElementById("editor");' +
    'var interval = setInterval(function() {' +
    '  iframe.contentWindow.postMessage({ type: "diagramma-gas-context", payload: ctx }, appOrigin);' +
    '}, 300);' +
    '' +
    'window.addEventListener("message", function(e) {' +
    '  if (e.origin !== appOrigin || e.source !== iframe.contentWindow) return;' +
    '  if (!e.data || !e.data.type) return;' +
    '' +
    '  if (e.data.type === "diagramma-gas-context-ack") {' +
    '    clearInterval(interval);' +
    '  }' +
    '' +
    '  if (e.data.type === "diagramma-update-code") {' +
    '    google.script.run' +
    '      .withSuccessHandler(function() {' +
    '        iframe.contentWindow.postMessage({ type: "diagramma-action-success", action: "update" }, appOrigin);' +
    '        google.script.host.close();' +
    '      })' +
    '      .withFailureHandler(function(err) {' +
    '        iframe.contentWindow.postMessage({ type: "diagramma-action-error", action: "update", message: err.message }, appOrigin);' +
    '      })' +
    '      .updateDiagramBlock(e.data.code, e.data.syntax || "mermaid", e.data.blockIndex);' +
    '  }' +
    '' +
    '  if (e.data.type === "diagramma-replace-png") {' +
    '    google.script.run' +
    '      .withSuccessHandler(function() {' +
    '        iframe.contentWindow.postMessage({ type: "diagramma-action-success", action: "replace" }, appOrigin);' +
    '        setTimeout(function() { google.script.host.close(); }, 800);' +
    '      })' +
    '      .withFailureHandler(function(err) {' +
    '        iframe.contentWindow.postMessage({ type: "diagramma-action-error", action: "replace", message: err.message }, appOrigin);' +
    '      })' +
    '      .replaceDiagramWithImage(e.data.base64, e.data.meta, e.data.blockIndex);' +
    '  }' +
    '' +
    '  if (e.data.type === "diagramma-close") {' +
    '    google.script.host.close();' +
    '  }' +
    '});' +
    '<\/script>' +
    '</body></html>'
  )
    .setWidth(DIALOG_WIDTH)
    .setHeight(DIALOG_HEIGHT);

  DocumentApp.getUi().showModalDialog(html, 'Diagramma Editor');
}

// ── Server-side functions callable from the client ────────────────────────────

/**
 * Update the diagram code for a given block (preserves code-block format).
 */
function updateDiagramBlock(newCode, syntax, blockIndex) {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var blocks = findDiagramBlocks();

  if (blockIndex < 0 || blockIndex >= blocks.length) {
    throw new Error('Block not found');
  }

  var block = blocks[blockIndex];
  var fenceLang = syntax || block.syntax;
  var insertIndex = block.childIndex;

  if (block.kind === 'fence') {
    var newLines = ['```' + fenceLang].concat(newCode.split('\n')).concat(['```']);
    var oldCount = block.endIndex - block.childIndex + 1;

    var refIdx = Math.min(insertIndex + 1, insertIndex + oldCount - 1);
    var refPara = body.getChild(refIdx).asParagraph();

    var reuse = Math.min(oldCount, newLines.length);
    for (var i = 0; i < reuse; i++) {
      body.getChild(insertIndex + i).asParagraph().editAsText().setText(newLines[i]);
    }

    if (newLines.length > oldCount) {
      for (var i = oldCount; i < newLines.length; i++) {
        var para = body.insertParagraph(insertIndex + i, newLines[i]);
        para.setAttributes(refPara.getAttributes());
        para.editAsText().setAttributes(refPara.editAsText().getAttributes(0));
      }
    } else if (oldCount > newLines.length) {
      for (var i = 0; i < oldCount - newLines.length; i++) {
        body.removeChild(body.getChild(insertIndex + newLines.length));
      }
    }
  } else {
    body.removeChild(body.getChild(insertIndex));
    var lines = ['```' + fenceLang].concat(newCode.split('\n')).concat(['```']);
    for (var i = lines.length - 1; i >= 0; i--) {
      body.insertParagraph(insertIndex, lines[i]);
    }
  }

  doc.saveAndClose();
}

/**
 * Replace a diagram code block with an inline PNG image.
 * The diagram source is stored as alt text on the image for later re-editing.
 */
function replaceDiagramWithImage(base64Png, metaJson, blockIndex) {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var blocks = findDiagramBlocks();

  if (blockIndex < 0 || blockIndex >= blocks.length) {
    throw new Error('Block not found');
  }

  var block = blocks[blockIndex];

  var imageData = base64Png.replace(/^data:image\/png;base64,/, '');
  var bytes = Utilities.base64Decode(imageData);
  var blob = Utilities.newBlob(bytes, 'image/png', 'diagram.png');

  var insertIndex = block.childIndex;

  // Remove old block paragraphs first, before inserting the image
  if (block.kind === 'fence') {
    var fenceLength = block.endIndex - block.childIndex + 1;
    for (var i = 0; i < fenceLength; i++) {
      body.removeChild(body.getChild(insertIndex));
    }
  } else {
    body.removeChild(body.getChild(insertIndex));
  }

  // Insert image paragraph at the same position
  var imgPara = body.insertParagraph(insertIndex, '');
  var inlineImage = imgPara.appendInlineImage(blob);

  // The PNG is rendered at 2x pixel density for retina sharpness.
  // getWidth() returns the PNG's native pixel count; getPageWidth() returns
  // points, but setWidth() accepts the same coordinate space as getPageWidth().
  // Divide by the scale factor to get the intended display size, then clamp to
  // the available content width.
  var DPI_SCALE = 2;
  var contentWidth = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  var pxW = inlineImage.getWidth();
  var pxH = inlineImage.getHeight();
  var logicalW = pxW / DPI_SCALE;
  var logicalH = pxH / DPI_SCALE;

  var TARGET_FILL = 0.75;
  var targetW = Math.min(logicalW, contentWidth * TARGET_FILL);
  var ratio = targetW / logicalW;
  inlineImage.setWidth(Math.round(targetW));
  inlineImage.setHeight(Math.round(logicalH * ratio));

  inlineImage.setAltDescription(metaJson);
  inlineImage.setAltTitle('Diagramma');

  // Remove excess spacing on the image paragraph
  imgPara.setSpacingBefore(0);
  imgPara.setSpacingAfter(4);
  imgPara.setLineSpacing(1);

  doc.saveAndClose();
}

/**
 * Close the sidebar (called from sidebar JS).
 */
function closeSidebar() {
  DocumentApp.getUi().alert('Sidebar closed');
}

// ── Diagram detection ─────────────────────────────────────────────────────────

/**
 * Build regex for matching a fence-open line.
 */
function getFenceOpenRegex() {
  var langs = Object.keys(SUPPORTED_SYNTAXES);
  return new RegExp('^`{3}(' + langs.join('|') + ')$');
}

/**
 * Find all diagram blocks in the document.
 *
 * Google Docs can split a pasted code block across paragraphs in
 * unpredictable ways: each line might be its own paragraph, the entire
 * block might be one paragraph, or (most commonly) several lines get
 * merged into one paragraph separated by \r.  This detector works on
 * "logical lines" — it splits every paragraph on normalized line breaks
 * first, then runs a simple state machine over all logical lines while
 * tracking which paragraphs they came from.
 *
 * Returns an array of block objects with:
 *   - kind: 'fence' | 'image'
 *   - syntax: the fence language (e.g. 'mermaid')
 *   - childIndex: body child index of the first paragraph
 *   - endIndex: body child index of the last paragraph
 *   - source: the diagram source code
 */
function findDiagramBlocks() {
  var body = DocumentApp.getActiveDocument().getBody();
  var numChildren = body.getNumChildren();
  var blocks = [];
  var fenceOpenPattern = getFenceOpenRegex();

  // Phase 1: flatten all paragraphs into logical lines, each tagged with
  // its paragraph index.
  var logicalLines = []; // { text: string, paraIdx: number }
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var para = child.asParagraph();

      // Check for Diagramma images before splitting into lines
      var numParaChildren = para.getNumChildren();
      for (var j = 0; j < numParaChildren; j++) {
        var el = para.getChild(j);
        if (el.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
          var img = el.asInlineImage();
          if (img.getAltTitle() === 'Diagramma') {
            var imgSource = '';
            var imgSyntax = 'mermaid';
            try {
              var meta = JSON.parse(img.getAltDescription());
              imgSource = meta.source || '';
              imgSyntax = meta.syntax || 'mermaid';
            } catch (_) {
              imgSource = img.getAltDescription() || '';
            }
            if (imgSource) {
              blocks.push({
                kind: 'image',
                syntax: imgSyntax,
                childIndex: i,
                endIndex: i,
                source: imgSource,
                meta: img.getAltDescription(),
              });
            }
          }
        }
      }

      var rawParaText = para.getText();
      var normalized = rawParaText
        .replace(/[\u2018\u2019\u201A\u0060\u00B4\u2032\u02B9\u02BB\u02BC]/g, '`')
        .replace(/\v/g, '\n')
        .replace(/\r\n?/g, '\n');
      var lines = normalized.split('\n');
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].trim() === '' && k === 0 && lines.length === 1) continue;
        logicalLines.push({ text: lines[k], paraIdx: i });
      }
    }
  }

  // Phase 2: state machine over logical lines to find fenced blocks.
  var insideFence = false;
  var fenceStartPara = -1;
  var fenceSyntax = '';
  var accumulated = [];

  for (var li = 0; li < logicalLines.length; li++) {
    var line = logicalLines[li];
    var trimmed = line.text.trim();

    if (!insideFence) {
      var match = trimmed.match(fenceOpenPattern);
      if (match) {
        insideFence = true;
        fenceStartPara = line.paraIdx;
        fenceSyntax = match[1];
        accumulated = [];
      }
    } else if (/^`{3}$/.test(trimmed)) {
      blocks.push({
        kind: 'fence',
        syntax: fenceSyntax,
        childIndex: fenceStartPara,
        endIndex: line.paraIdx,
        source: accumulated.join('\n'),
      });
      insideFence = false;
      accumulated = [];
      fenceStartPara = -1;
      fenceSyntax = '';
    } else {
      accumulated.push(line.text);
    }
  }

  return blocks;
}

/**
 * Diagnostic: dump the raw text and char codes of each paragraph.
 * Run this from the Script Editor to see exactly what Google Docs stores.
 */
function debugDumpParagraphs() {
  var body = DocumentApp.getActiveDocument().getBody();
  var numChildren = body.getNumChildren();
  var lines = [];

  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    var type = child.getType().toString();
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var raw = child.asParagraph().getText();
      var codes = [];
      for (var c = 0; c < Math.min(raw.length, 60); c++) {
        codes.push('U+' + ('0000' + raw.charCodeAt(c).toString(16)).slice(-4));
      }
      lines.push('[' + i + '] ' + type + ': "' + raw.substring(0, 80) + '"');
      lines.push('    chars: ' + codes.join(' '));
    } else {
      lines.push('[' + i + '] ' + type);
    }
  }

  DocumentApp.getUi().alert(lines.join('\n'));
}

/**
 * Alert user about found diagram blocks.
 */
function highlightDiagramBlocks() {
  var ui = DocumentApp.getUi();
  var blocks = findDiagramBlocks();

  if (blocks.length === 0) {
    ui.alert('No diagram blocks found in the document.');
    return;
  }

  ui.alert('Found ' + blocks.length + ' diagram block(s). Open the Diagramma sidebar to edit them.');
}

// ── Sidebar HTML (served inline – no external resources needed) ───────────────

function buildSidebarHtml(blocks) {
  var blockDataJson = JSON.stringify(blocks.map(function(b) {
    var meta = {};
    if (b.meta) {
      try { meta = JSON.parse(b.meta); } catch(e) {}
    }
    return { source: b.source, syntax: b.syntax, style: meta.style || null };
  }));

  var syntaxLabels = JSON.stringify(SUPPORTED_SYNTAXES);

  var blockItems = blocks.length === 0
    ? '<p class="empty">No diagram blocks found in this document.</p>'
    : blocks
        .map(function(b, i) {
          var isImage = b.kind === 'image';
          var label = SUPPORTED_SYNTAXES[b.syntax] || b.syntax;
          var badge = isImage
            ? '<span class="badge badge-img">PNG</span>'
            : '<span class="badge badge-code">' + escapeHtml(label) + '</span>';

          var saved = {};
          if (b.meta) { try { saved = JSON.parse(b.meta).style || {}; } catch(e) {} }
          var pc  = saved.primaryColor       || '#4d8ef8';
          var ptc = saved.primaryTextColor    || '#ffffff';
          var pbc = saved.primaryBorderColor  || '#3679e8';
          var lc  = saved.lineColor           || '#8495aa';
          var bg  = saved.background          || '#ffffff';

          return '<div class="block">' +
            '<div class="block-header">' + badge +
            '<button class="gear-btn" onclick="toggleStyle(' + i + ')" title="Export style">' +
            '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/>' +
            '<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/>' +
            '</svg>' +
            '</button></div>' +
            '<pre class="preview">' + escapeHtml(b.source.slice(0, 120)) + (b.source.length > 120 ? '…' : '') + '</pre>' +
            '<div class="style-panel" id="style-' + i + '" style="display:none;">' +
            '<div class="style-panel-header">' +
            '<span class="style-panel-label">Export style <span class="style-hint">PNG only</span></span>' +
            '<button class="style-close-btn" onclick="toggleStyle(' + i + ')" title="Close">' +
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
            '</button></div>' +
            '<div class="style-row"><label>Node fill</label><input type="color" data-idx="' + i + '" data-key="primaryColor" value="' + pc + '" onchange="updateStyle(this)"></div>' +
            '<div class="style-row"><label>Node text</label><input type="color" data-idx="' + i + '" data-key="primaryTextColor" value="' + ptc + '" onchange="updateStyle(this)"></div>' +
            '<div class="style-row"><label>Node border</label><input type="color" data-idx="' + i + '" data-key="primaryBorderColor" value="' + pbc + '" onchange="updateStyle(this)"></div>' +
            '<div class="style-row"><label>Lines</label><input type="color" data-idx="' + i + '" data-key="lineColor" value="' + lc + '" onchange="updateStyle(this)"></div>' +
            '<div class="style-row"><label>Background</label><input type="color" data-idx="' + i + '" data-key="background" value="' + bg + '" onchange="updateStyle(this)"></div>' +
            '</div>' +
            '<div class="btn-row">' +
            '<button onclick="openEditor(' + i + ')">Edit</button>' +
            '<button class="btn-replace" onclick="replaceWithPng(' + i + ')">' + (isImage ? 'Update PNG' : 'Replace with PNG') + '</button>' +
            '</div>' +
            '<div class="status" id="status-' + i + '"></div>' +
            '</div>';
        })
        .join('');

  return '<!doctype html>' +
'<html>' +
'<head>' +
'  <style>' +
'    * { box-sizing: border-box; margin: 0; padding: 0; }' +
'    body {' +
'      font-family: "Google Sans", Arial, sans-serif;' +
'      font-size: 13px;' +
'      background: #0d1117;' +
'      color: #e6edf3;' +
'      padding: 16px;' +
'    }' +
'    h2 {' +
'      font-size: 14px;' +
'      font-weight: 600;' +
'      margin-bottom: 14px;' +
'      color: #e6edf3;' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 8px;' +
'    }' +
'    h2::before {' +
'      content: "";' +
'      display: inline-block;' +
'      width: 8px;' +
'      height: 8px;' +
'      border-radius: 2px;' +
'      background: #388bfd;' +
'    }' +
'    .block-header {' +
'      margin-bottom: 6px;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'    }' +
'    .badge {' +
'      display: inline-block;' +
'      font-size: 10px;' +
'      font-weight: 600;' +
'      text-transform: uppercase;' +
'      letter-spacing: 0.05em;' +
'      padding: 2px 7px;' +
'      border-radius: 4px;' +
'    }' +
'    .badge-code {' +
'      background: rgba(56,139,253,0.15);' +
'      color: #388bfd;' +
'      border: 1px solid rgba(56,139,253,0.25);' +
'    }' +
'    .badge-img {' +
'      background: rgba(63,185,80,0.15);' +
'      color: #3fb950;' +
'      border: 1px solid rgba(63,185,80,0.25);' +
'    }' +
'    .block {' +
'      border: 1px solid #21262d;' +
'      border-radius: 8px;' +
'      padding: 12px;' +
'      margin-bottom: 10px;' +
'      background: #161b22;' +
'      transition: border-color 0.15s, box-shadow 0.15s;' +
'    }' +
'    .block:hover {' +
'      border-color: #30363d;' +
'      box-shadow: 0 2px 8px rgba(0,0,0,0.2);' +
'    }' +
'    pre.preview {' +
'      font-family: "JetBrains Mono", monospace;' +
'      font-size: 11px;' +
'      color: #8b949e;' +
'      white-space: pre-wrap;' +
'      word-break: break-word;' +
'      margin-bottom: 10px;' +
'      max-height: 80px;' +
'      overflow: hidden;' +
'    }' +
'    .btn-row {' +
'      display: flex;' +
'      gap: 6px;' +
'    }' +
'    button {' +
'      flex: 1;' +
'      height: 32px;' +
'      border-radius: 6px;' +
'      background: #388bfd;' +
'      color: #fff;' +
'      font-size: 12px;' +
'      font-weight: 500;' +
'      border: none;' +
'      cursor: pointer;' +
'      font-family: inherit;' +
'    }' +
'    button:hover { background: #1f6feb; }' +
'    button:disabled { opacity: 0.5; cursor: not-allowed; }' +
'    .btn-replace {' +
'      background: #21262d;' +
'      color: #8b949e;' +
'      border: 1px solid #30363d;' +
'    }' +
'    .btn-replace:hover { background: #161b22; color: #e6edf3; border-color: #388bfd; }' +
'    .status {' +
'      font-size: 11px;' +
'      color: #8b949e;' +
'    }' +
'    .status:not(:empty) {' +
'      margin-top: 6px;' +
'    }' +
'    .status.done { color: #3fb950; }' +
'    .status.error { color: #f85149; }' +
'    .empty {' +
'      color: #8b949e;' +
'      font-size: 12px;' +
'      text-align: center;' +
'      padding: 24px 0;' +
'    }' +
'    .refresh-btn {' +
'      width: 100%;' +
'      height: 30px;' +
'      border-radius: 6px;' +
'      background: #161b22;' +
'      color: #8b949e;' +
'      font-size: 12px;' +
'      border: 1px solid #21262d;' +
'      cursor: pointer;' +
'      margin-top: 8px;' +
'      font-family: inherit;' +
'      flex: none;' +
'    }' +
'    .gear-btn {' +
'      flex: none;' +
'      width: 24px;' +
'      height: 24px;' +
'      background: none;' +
'      border: none;' +
'      color: #8b949e;' +
'      cursor: pointer;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: center;' +
'      border-radius: 4px;' +
'    }' +
'    .gear-btn:hover { color: #e6edf3; background: #21262d; }' +
'    .style-panel {' +
'      margin-bottom: 10px;' +
'      padding: 8px 0;' +
'      border-top: 1px solid #21262d;' +
'      border-bottom: 1px solid #21262d;' +
'      animation: slideDown 0.15s ease-out;' +
'    }' +
'    @keyframes slideDown {' +
'      from { opacity: 0; max-height: 0; }' +
'      to { opacity: 1; max-height: 200px; }' +
'    }' +
'    .style-row {' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'      height: 26px;' +
'      margin-bottom: 2px;' +
'    }' +
'    .style-panel-header {' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'      margin-bottom: 6px;' +
'    }' +
'    .style-panel-label {' +
'      font-size: 10px;' +
'      font-weight: 600;' +
'      text-transform: uppercase;' +
'      letter-spacing: 0.04em;' +
'      color: #8b949e;' +
'    }' +
'    .style-close-btn {' +
'      flex: none;' +
'      width: 20px;' +
'      height: 20px;' +
'      background: none;' +
'      border: none;' +
'      color: #8b949e;' +
'      cursor: pointer;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: center;' +
'      border-radius: 4px;' +
'    }' +
'    .style-close-btn:hover { color: #e6edf3; background: #21262d; }' +
'    .style-hint {' +
'      font-size: 8.5px;' +
'      font-weight: 600;' +
'      color: #388bfd;' +
'      background: rgba(56,139,253,0.1);' +
'      border: 1px solid rgba(56,139,253,0.18);' +
'      border-radius: 99px;' +
'      padding: 1px 4px;' +
'      margin-left: 4px;' +
'      vertical-align: middle;' +
'      line-height: 1.4;' +
'    }' +
'    .style-row label {' +
'      font-size: 11px;' +
'      color: #8b949e;' +
'    }' +
'    .style-row input[type="color"] {' +
'      width: 28px;' +
'      height: 22px;' +
'      border: 1px solid #30363d;' +
'      border-radius: 4px;' +
'      padding: 1px;' +
'      cursor: pointer;' +
'      background: none;' +
'    }' +
'    .refresh-btn:hover { color: #e6edf3; border-color: #388bfd; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <h2>Diagramma</h2>' +
'  ' + blockItems +
'  <button class="refresh-btn" onclick="google.script.run.withSuccessHandler(function() { location.reload(); }).openSidebar()">' +
'    ↻ Refresh' +
'  </button>' +
'  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>' +
'  <script>' +
'    var BLOCK_DATA = ' + blockDataJson + ';' +
'    var SYNTAX_LABELS = ' + syntaxLabels + ';' +
'' +
'    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "sandbox",' +
'      flowchart: { useMaxWidth: false }, sequence: { useMaxWidth: false },' +
'      gantt: { useMaxWidth: false }, journey: { useMaxWidth: false },' +
'      class: { useMaxWidth: false }, state: { useMaxWidth: false },' +
'      er: { useMaxWidth: false }, pie: { useMaxWidth: false },' +
'      mindmap: { useMaxWidth: false }, gitGraph: { useMaxWidth: false },' +
'      c4: { useMaxWidth: false }, sankey: { useMaxWidth: false },' +
'      block: { useMaxWidth: false }, timeline: { useMaxWidth: false }' +
'    });' +
'' +
'    var blockStyles = {};' +
'    BLOCK_DATA.forEach(function(b, i) {' +
'      if (b.style) blockStyles[i] = b.style;' +
'    });' +
'' +
'    function toggleStyle(index) {' +
'      var panel = document.getElementById("style-" + index);' +
'      panel.style.display = panel.style.display === "none" ? "block" : "none";' +
'    }' +
'' +
'    function updateStyle(input) {' +
'      var idx = input.getAttribute("data-idx");' +
'      var key = input.getAttribute("data-key");' +
'      if (!blockStyles[idx]) blockStyles[idx] = {};' +
'      blockStyles[idx][key] = input.value;' +
'    }' +
'' +
'    function getBlockStyle(index) {' +
'      var s = blockStyles[index] || {};' +
'      return {' +
'        primaryColor: s.primaryColor || "#4d8ef8",' +
'        primaryTextColor: s.primaryTextColor || "#ffffff",' +
'        primaryBorderColor: s.primaryBorderColor || "#3679e8",' +
'        lineColor: s.lineColor || "#8495aa",' +
'        background: s.background || "#ffffff"' +
'      };' +
'    }' +
'' +
'    function openEditor(index) {' +
'      google.script.run' +
'        .withFailureHandler(function(e) { alert("Error: " + e.message); })' +
'        .openEditorForBlock(index);' +
'    }' +
'' +
'    async function replaceWithPng(index) {' +
'      var block = BLOCK_DATA[index];' +
'      var style = getBlockStyle(index);' +
'      var statusEl = document.getElementById("status-" + index);' +
'      statusEl.className = "status";' +
'      statusEl.textContent = "Rendering diagram…";' +
'' +
'      try {' +
'        var svg;' +
'        if (block.syntax === "mermaid") {' +
'          mermaid.initialize({' +
'            startOnLoad: false,' +
'            theme: "base",' +
'            themeVariables: style,' +
'            securityLevel: "sandbox",' +
'            flowchart: { useMaxWidth: false },' +
'            sequence: { useMaxWidth: false }' +
'          });' +
'          var id = "mermaid-render-" + index + "-" + Date.now();' +
'          var result = await mermaid.render(id, block.source);' +
'          svg = result.svg;' +
'        } else {' +
'          throw new Error("Sidebar rendering not yet supported for " + (SYNTAX_LABELS[block.syntax] || block.syntax));' +
'        }' +
'' +
'        statusEl.textContent = "Converting to PNG…";' +
'        var base64 = await svgToPngBase64(svg, style.background);' +
'        var meta = JSON.stringify({ type: "diagramma", source: block.source, syntax: block.syntax, theme: "base", version: "0.1.0", createdAt: new Date().toISOString(), style: style });' +
'' +
'        statusEl.textContent = "Inserting into document…";' +
'        google.script.run' +
'          .withSuccessHandler(function() {' +
'            statusEl.className = "status done";' +
'            statusEl.textContent = "✓ Replaced with PNG";' +
'            setTimeout(function() { statusEl.className = "status"; statusEl.textContent = ""; }, 3000);' +
'          })' +
'          .withFailureHandler(function(e) {' +
'            statusEl.className = "status error";' +
'            statusEl.textContent = "✗ " + e.message;' +
'          })' +
'          .replaceDiagramWithImage(base64, meta, index);' +
'      } catch(e) {' +
'        statusEl.className = "status error";' +
'        statusEl.textContent = "✗ " + (e.message || "Render failed");' +
'      }' +
'    }' +
'' +
'    function svgToPngBase64(svgText, bgColor) {' +
'      bgColor = bgColor || "#ffffff";' +
'      return new Promise(function(resolve, reject) {' +
'        var parser = new DOMParser();' +
'        var doc = parser.parseFromString(svgText, "image/svg+xml");' +
'        var svgEl = doc.querySelector("svg");' +
'' +
'        var w = 0, h = 0;' +
'        var styleAttr = svgEl.getAttribute("style") || "";' +
'        var maxWMatch = styleAttr.match(/max-width:\\s*([\\d.]+)\\s*px/);' +
'        if (maxWMatch) w = parseFloat(maxWMatch[1]);' +
'        var attrW = svgEl.getAttribute("width") || "";' +
'        var attrH = svgEl.getAttribute("height") || "";' +
'        if (!w && attrW && attrW.indexOf("%") === -1) w = parseFloat(attrW);' +
'        if (!h && attrH && attrH.indexOf("%") === -1) h = parseFloat(attrH);' +
'        if ((!w || !h) && svgEl.hasAttribute("viewBox")) {' +
'          var vb = svgEl.getAttribute("viewBox").split(/[\\s,]+/).map(Number);' +
'          if (vb.length === 4) { w = w || vb[2]; h = h || vb[3]; }' +
'        }' +
'        if (w && !h && svgEl.hasAttribute("viewBox")) {' +
'          var vb2 = svgEl.getAttribute("viewBox").split(/[\\s,]+/).map(Number);' +
'          if (vb2.length === 4 && vb2[2] > 0) h = w * (vb2[3] / vb2[2]);' +
'        }' +
'        w = w || 800; h = h || 600;' +
'        svgEl.setAttribute("width", String(w));' +
'        svgEl.setAttribute("height", String(h));' +
'        svgEl.removeAttribute("style");' +
'        var scale = Math.min(2, 2400 / Math.max(w, h));' +
'        var cw = Math.round(w * scale);' +
'        var ch = Math.round(h * scale);' +
'' +
'        var serialized = new XMLSerializer().serializeToString(svgEl);' +
'        var dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);' +
'' +
'        var img = new Image();' +
'        img.onload = function() {' +
'          var canvas = document.createElement("canvas");' +
'          canvas.width = cw;' +
'          canvas.height = ch;' +
'          var ctx = canvas.getContext("2d");' +
'          ctx.fillStyle = bgColor;' +
'          ctx.fillRect(0, 0, cw, ch);' +
'          ctx.drawImage(img, 0, 0, cw, ch);' +
'          resolve(canvas.toDataURL("image/png"));' +
'        };' +
'        img.onerror = function() { reject(new Error("Image load failed")); };' +
'        img.src = dataUrl;' +
'      });' +
'    }' +
'  <\/script>' +
'</body>' +
'</html>';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// dom.js — DOM helper utilities

function tcEl(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of Array.isArray(children) ? children : [children]) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
  }
  return el;
}

function tcOn(el, event, fn) {
  el.addEventListener(event, fn);
  return el;
}

// Split task text into plain strings and [[target|alias]] wikilinks
function tcParseWikilinks(text) {
  var parts = [];
  var re = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;
  var last = 0;
  var m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ target: m[1].trim(), label: (m[2] || m[1]).trim() });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Task text span; wikilinks render as Obsidian internal links (alias shown)
function tcTaskTextEl(task) {
  var span = tcEl('span', { class: 'tc-task-text' });
  for (var part of tcParseWikilinks(task.text)) {
    if (typeof part === 'string') {
      span.appendChild(document.createTextNode(part));
      continue;
    }
    var link = tcEl('a', { class: 'internal-link', 'data-href': part.target, text: part.label });
    tcOn(link, 'click', (function(target) {
      return function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (app && app.workspace) app.workspace.openLinkText(target, task.path);
      };
    })(part.target));
    span.appendChild(link);
  }
  return span;
}

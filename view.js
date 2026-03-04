;(function() {
'use strict';

// config.js — Parameter parsing and defaults

const TC_DEFAULTS = {
  pages: '',
  dailyNoteFolder: '',
  dailyNoteFormat: 'YYYY-MM-DD',
  firstDayOfWeek: 0, // 0=Sun, 1=Mon
  view: 'month',
};

function tcParseConfig(input) {
  const cfg = Object.assign({}, TC_DEFAULTS);

  if (input && typeof input === 'object') {
    if (input.pages != null) cfg.pages = String(input.pages);
    if (input.dailyNoteFolder != null) cfg.dailyNoteFolder = String(input.dailyNoteFolder).replace(/\/+$/, '');
    if (input.dailyNoteFormat != null) cfg.dailyNoteFormat = String(input.dailyNoteFormat);
    if (input.firstDayOfWeek != null) cfg.firstDayOfWeek = Number(input.firstDayOfWeek) === 1 ? 1 : 0;
    if (input.view != null) cfg.view = String(input.view);
  }

  return cfg;
}

// store.js — Task collection with dual parsing (Dataview props + emoji fallback)

var TC_DATE_RE = /(\d{4}-\d{2}-\d{2})/;

// Format Luxon DateTime or Dataview date to YYYY-MM-DD string
function tcFormatDvDate(d) {
  if (!d) return null;
  // Luxon DateTime (from Dataview)
  if (d.toFormat) return d.toFormat('yyyy-MM-dd');
  // Fallback: Date object
  if (d instanceof Date) return tcFormatDate(d);
  // String passthrough
  if (typeof d === 'string') {
    var m = d.match(TC_DATE_RE);
    return m ? m[1] : null;
  }
  return null;
}

// Manual emoji parsing fallback (for when Dataview doesn't recognize the emoji)
function tcExtractEmojiDate(text, emoji) {
  var idx = text.indexOf(emoji);
  if (idx === -1) return null;
  var after = text.substring(idx + emoji.length).trim();
  var m = after.match(TC_DATE_RE);
  return m ? m[1] : null;
}

function tcDailyNoteDate(path, folder) {
  if (!folder) return null;
  var norm = folder.replace(/^\/+|\/+$/g, '');
  if (!path.startsWith(norm + '/')) return null;
  var parts = path.split('/');
  var filename = parts[parts.length - 1].replace(/\.md$/, '');
  var m = filename.match(TC_DATE_RE);
  return m ? m[1] : null;
}

// Strip emoji date annotations from task text for clean display
// Uses alternation (not character class) to handle multi-byte emojis correctly
function tcStripEmojis(text) {
  return text
    .replace(/(?:📅|🗓️|⏳|✅|🛫|➕|❌)\s*\d{4}-\d{2}-\d{2}/gu, '')
    .replace(/🔁\s*[^\s]*/gu, '')
    .replace(/(?:⏫|🔼|🔽|🔺|🔻)/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Shared filter: 'active' (hide done), 'all', 'overdue' (only overdue), 'done' (only done)
function tcFilterTasks(tasks, filter, dateStr, todayStr) {
  if (!tasks) return [];
  var isOverdue = dateStr < todayStr;
  return tasks.filter(function(t) {
    if (filter === 'active') return !t.completed;
    if (filter === 'overdue') return !t.completed && isOverdue && t.type === 'due';
    if (filter === 'done') return t.completed;
    return true; // 'all'
  });
}

function tcBuildStore(dv, cfg) {
  var tasksByDate = new Map();

  function addTask(dateStr, task) {
    if (!tasksByDate.has(dateStr)) tasksByDate.set(dateStr, []);
    tasksByDate.get(dateStr).push(task);
  }

  // Query pages
  var source = cfg.pages || '""';
  var pages;
  try {
    pages = dv.pages(source);
  } catch (e) {
    pages = dv.pages();
  }

  for (var page of pages) {
    if (!page.file || !page.file.tasks) continue;
    var pagePath = page.file.path;
    var dailyDate = tcDailyNoteDate(pagePath, cfg.dailyNoteFolder);

    for (var t of page.file.tasks) {
      var rawText = t.text || '';

      // 1) Try Dataview's parsed properties first (Luxon DateTime)
      var dueDate = tcFormatDvDate(t.due);
      var scheduledDate = tcFormatDvDate(t.scheduled);
      var doneDate = tcFormatDvDate(t.completion);
      var startDate = tcFormatDvDate(t.start);

      // 2) Fallback: manual emoji parsing from task text
      //    Covers cases where Dataview doesn't recognize the emoji variant
      if (!dueDate) dueDate = tcExtractEmojiDate(rawText, '📅') || tcExtractEmojiDate(rawText, '🗓️');
      if (!scheduledDate) scheduledDate = tcExtractEmojiDate(rawText, '⏳');
      if (!doneDate) doneDate = tcExtractEmojiDate(rawText, '✅');
      if (!startDate) startDate = tcExtractEmojiDate(rawText, '🛫');

      // Determine display date: due > scheduled > start > daily note date
      var displayDate = dueDate || scheduledDate || startDate || dailyDate;
      if (!displayDate) continue;

      var completed = t.completed || false;
      var displayText = tcStripEmojis(rawText);
      if (!displayText) continue;

      var taskEntry = {
        text: displayText,
        completed: completed,
        path: pagePath,
        line: t.line,
        dueDate: dueDate,
        scheduledDate: scheduledDate,
        doneDate: doneDate,
        type: dueDate ? 'due' : scheduledDate ? 'scheduled' : 'daily',
      };

      addTask(displayDate, taskEntry);

      // If completed with a done date different from display date, also show on done date
      if (completed && doneDate && doneDate !== displayDate) {
        addTask(doneDate, Object.assign({}, taskEntry, { type: 'done' }));
      }
    }
  }

  return { tasksByDate };
}

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

// nav.js — Navigation bar with month selector, filters, and view tabs

function tcCreateNav(state, views, onNavigate, onViewChange, onFilterChange) {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var nav = tcEl('div', { class: 'tc-nav' });

  // Left: prev/today/next
  var left = tcEl('div', { class: 'tc-nav-left' });
  var btnPrev = tcOn(tcEl('button', { class: 'tc-nav-btn', text: '\u25C0' }), 'click', function() { onNavigate(-1); });
  var btnToday = tcOn(tcEl('button', { class: 'tc-nav-btn tc-nav-today', text: 'Today' }), 'click', function() { onNavigate(0); });
  var btnNext = tcOn(tcEl('button', { class: 'tc-nav-btn', text: '\u25B6' }), 'click', function() { onNavigate(1); });
  left.appendChild(btnPrev);
  left.appendChild(btnToday);
  left.appendChild(btnNext);

  // Center: month/year label
  var label = tcEl('span', { class: 'tc-nav-label' });

  // Right: filter dropdown + view tabs
  var right = tcEl('div', { class: 'tc-nav-right' });

  // Filter dropdown
  var filterSelect = tcEl('select', { class: 'tc-nav-filter' });
  var filterOptions = [
    { value: 'active', text: 'Active' },
    { value: 'all', text: 'All' },
    { value: 'overdue', text: 'Overdue' },
    { value: 'done', text: 'Done' },
  ];
  for (var opt of filterOptions) {
    var option = tcEl('option', { value: opt.value, text: opt.text });
    if (opt.value === state.filter) option.selected = true;
    filterSelect.appendChild(option);
  }
  tcOn(filterSelect, 'change', function() { onFilterChange(filterSelect.value); });
  right.appendChild(filterSelect);

  // View tabs
  var tabBtns = {};
  for (var v of views) {
    var btn = tcEl('button', {
      class: 'tc-nav-tab' + (v === state.view ? ' tc-active' : ''),
      text: v.charAt(0).toUpperCase() + v.slice(1),
    });
    (function(view) {
      tcOn(btn, 'click', function() { onViewChange(view); });
    })(v);
    tabBtns[v] = btn;
    right.appendChild(btn);
  }

  nav.appendChild(left);
  nav.appendChild(label);
  nav.appendChild(right);

  function update() {
    // Label: week range for week view, month/year for month view
    if (state.view === 'week' && state.weekStart) {
      var ws = new Date(state.weekStart + 'T00:00:00');
      var we = new Date(ws);
      we.setDate(we.getDate() + 6);
      var startStr = MONTHS[ws.getMonth()] + ' ' + ws.getDate();
      var endStr = ws.getMonth() === we.getMonth()
        ? String(we.getDate())
        : MONTHS[we.getMonth()] + ' ' + we.getDate();
      label.textContent = startStr + ' \u2013 ' + endStr + ', ' + we.getFullYear();
    } else {
      label.textContent = MONTHS[state.month] + ' ' + state.year;
    }

    // Tab active states
    for (var key of Object.keys(tabBtns)) {
      tabBtns[key].className = 'tc-nav-tab' + (key === state.view ? ' tc-active' : '');
    }

    // Sync filter dropdown
    filterSelect.value = state.filter;
  }

  update();
  return { el: nav, update };
}

// month-view.js — Monthly calendar grid

function tcMonthView(state, store, cfg) {
  const DAY_NAMES_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = cfg.firstDayOfWeek === 1 ? DAY_NAMES_MON : DAY_NAMES_SUN;

  const today = new Date();
  const todayStr = tcFormatDate(today);

  const container = tcEl('div', { class: 'tc-month' });

  // Weekday headers
  const header = tcEl('div', { class: 'tc-month-header' });
  for (const name of dayNames) {
    header.appendChild(tcEl('div', { class: 'tc-weekday', text: name }));
  }
  container.appendChild(header);

  // Calculate grid start
  const firstOfMonth = new Date(state.year, state.month, 1);
  const lastOfMonth = new Date(state.year, state.month + 1, 0);
  let startDay = firstOfMonth.getDay() - cfg.firstDayOfWeek;
  if (startDay < 0) startDay += 7;

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startDay - 7);

  // 7 weeks grid (1 week before + 6 weeks)
  const grid = tcEl('div', { class: 'tc-month-grid' });
  const cursor = new Date(gridStart);

  // Detail panel for showing tasks on date click
  var detailPanel = tcEl('div', { class: 'tc-detail-panel tc-hidden' });
  var selectedCell = null;

  for (let i = 0; i < 49; i++) {
    const dateStr = tcFormatDate(cursor);
    const isCurrentMonth = cursor.getMonth() === state.month;
    const isToday = dateStr === todayStr;
    const isOverdue = !isToday && dateStr < todayStr;

    const classes = ['tc-day'];
    if (!isCurrentMonth) classes.push('tc-other-month');
    if (isToday) classes.push('tc-today');

    const cell = tcEl('div', { class: classes.join(' ') });

    // Click on day cell to show detail panel
    (function(ds, cellEl) {
      tcOn(cellEl, 'click', function(e) {
        if (e.target.classList.contains('tc-task-text') || e.target.classList.contains('tc-day-num')) return;
        tcShowDetailPanel(detailPanel, ds, store, state, cfg, todayStr, MONTHS, FULL_DAY_NAMES);
        if (selectedCell) selectedCell.classList.remove('tc-selected');
        cellEl.classList.add('tc-selected');
        selectedCell = cellEl;
      });
      cellEl.classList.add('tc-clickable');
    })(dateStr, cell);

    // Date number — clickable to open daily note
    const dateNum = tcEl('span', { class: 'tc-day-num', text: String(cursor.getDate()) });
    if (cfg.dailyNoteFolder) {
      tcOn(dateNum, 'click', tcMakeDailyNoteHandler(dateStr, cfg));
      dateNum.classList.add('tc-clickable');
    }
    cell.appendChild(dateNum);

    // Tasks for this date (filtered)
    var tasks = tcFilterTasks(store.tasksByDate.get(dateStr), state.filter, dateStr, todayStr);
    if (tasks.length > 0) {
      const list = tcEl('div', { class: 'tc-task-list' });
      for (const task of tasks) {
        const itemClasses = ['tc-task-item'];
        if (task.completed) itemClasses.push('tc-done');
        else if (isOverdue && task.type === 'due') itemClasses.push('tc-overdue');

        const item = tcEl('div', { class: itemClasses.join(' ') });

        var emoji = task.completed ? '✅'
          : task.type === 'due' ? '📅'
          : task.type === 'scheduled' ? '⏳'
          : '·';
        var indicator = tcEl('span', { class: 'tc-task-emoji', text: emoji });
        item.appendChild(indicator);

        const text = tcEl('span', { class: 'tc-task-text', text: task.text });
        tcOn(text, 'click', tcMakeOpenNoteHandler(task.path));
        item.appendChild(text);

        list.appendChild(item);
      }
      cell.appendChild(list);
    }

    grid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  container.appendChild(grid);
  container.appendChild(detailPanel);
  return container;
}

// Show detail panel below the calendar grid with tasks for a specific date
function tcShowDetailPanel(panel, dateStr, store, state, cfg, todayStr, MONTHS, DAY_NAMES) {
  while (panel.firstChild) panel.removeChild(panel.firstChild);
  panel.classList.remove('tc-hidden');

  var d = new Date(dateStr + 'T00:00:00');
  var headerText = DAY_NAMES[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();

  var headerRow = tcEl('div', { class: 'tc-detail-header' });
  headerRow.appendChild(tcEl('span', { class: 'tc-detail-title', text: headerText }));

  if (cfg.dailyNoteFolder) {
    var openBtn = tcEl('span', { class: 'tc-detail-open tc-clickable', text: 'Open Note' });
    tcOn(openBtn, 'click', tcMakeDailyNoteHandler(dateStr, cfg));
    headerRow.appendChild(openBtn);
  }

  var closeBtn = tcEl('span', { class: 'tc-detail-close tc-clickable', text: '\u2715' });
  tcOn(closeBtn, 'click', function() {
    panel.classList.add('tc-hidden');
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var sel = panel.parentElement.querySelector('.tc-selected');
    if (sel) sel.classList.remove('tc-selected');
  });
  headerRow.appendChild(closeBtn);
  panel.appendChild(headerRow);

  var isOverdue = dateStr < todayStr && dateStr !== todayStr;
  var tasks = tcFilterTasks(store.tasksByDate.get(dateStr), state.filter, dateStr, todayStr);

  if (tasks.length === 0) {
    panel.appendChild(tcEl('div', { class: 'tc-detail-empty', text: 'No tasks' }));
    return;
  }

  var list = tcEl('div', { class: 'tc-detail-list' });
  for (var task of tasks) {
    var itemClasses = ['tc-detail-item'];
    if (task.completed) itemClasses.push('tc-done');
    else if (isOverdue && task.type === 'due') itemClasses.push('tc-overdue');

    var item = tcEl('div', { class: itemClasses.join(' ') });

    var emoji = task.completed ? '✅'
      : task.type === 'due' ? '📅'
      : task.type === 'scheduled' ? '⏳'
      : '·';
    item.appendChild(tcEl('span', { class: 'tc-task-emoji', text: emoji }));

    var text = tcEl('span', { class: 'tc-task-text', text: task.text });
    tcOn(text, 'click', tcMakeOpenNoteHandler(task.path));
    item.appendChild(text);

    var source = task.path.split('/').pop().replace(/\.md$/, '');
    item.appendChild(tcEl('span', { class: 'tc-detail-source', text: source }));

    list.appendChild(item);
  }
  panel.appendChild(list);
}

function tcFormatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function tcMakeDailyNoteHandler(dateStr, cfg) {
  return function(e) {
    e.preventDefault();
    e.stopPropagation();
    // Build daily note path based on folder structure
    // Support YYYY/MM subdirectories
    const parts = dateStr.split('-');
    const year = parts[0];
    const month = parts[1];
    const notePath = cfg.dailyNoteFolder + '/' + year + '/' + month + '/' + dateStr;
    // Use Obsidian's internal link opening
    if (app && app.workspace) {
      app.workspace.openLinkText(notePath, '');
    }
  };
}

function tcMakeOpenNoteHandler(path) {
  return function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (app && app.workspace) {
      app.workspace.openLinkText(path.replace(/\.md$/, ''), '');
    }
  };
}

// week-view.js — Weekly list view (7 day rows)

function tcWeekView(state, store, cfg) {
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var today = new Date();
  var todayStr = tcFormatDate(today);

  var container = tcEl('div', { class: 'tc-week' });

  // Week start from state
  var cursor = new Date(state.weekStart + 'T00:00:00');

  for (var i = 0; i < 7; i++) {
    var dateStr = tcFormatDate(cursor);
    var isToday = dateStr === todayStr;
    var isOverdue = !isToday && dateStr < todayStr;

    var rowClasses = ['tc-week-day'];
    if (isToday) rowClasses.push('tc-today');

    var row = tcEl('div', { class: rowClasses.join(' ') });

    // Date label: "Mon, Mar 2"
    var dayName = DAY_NAMES[cursor.getDay()];
    var monthName = MONTHS[cursor.getMonth()];
    var dateLabel = dayName + ', ' + monthName + ' ' + cursor.getDate();
    var dateLabelEl = tcEl('div', { class: 'tc-week-date', text: dateLabel });
    if (cfg.dailyNoteFolder) {
      tcOn(dateLabelEl, 'click', tcMakeDailyNoteHandler(dateStr, cfg));
      dateLabelEl.classList.add('tc-clickable');
    }
    row.appendChild(dateLabelEl);

    // Tasks (filtered)
    var tasks = tcFilterTasks(store.tasksByDate.get(dateStr), state.filter, dateStr, todayStr);
    var taskContainer = tcEl('div', { class: 'tc-week-tasks' });

    for (var task of tasks) {
      var itemClasses = ['tc-task-item'];
      if (task.completed) itemClasses.push('tc-done');
      else if (isOverdue && task.type === 'due') itemClasses.push('tc-overdue');

      var item = tcEl('div', { class: itemClasses.join(' ') });

      var emoji = task.completed ? '✅'
        : task.type === 'due' ? '📅'
        : task.type === 'scheduled' ? '⏳'
        : '·';
      item.appendChild(tcEl('span', { class: 'tc-task-emoji', text: emoji }));

      var text = tcEl('span', { class: 'tc-task-text', text: task.text });
      tcOn(text, 'click', tcMakeOpenNoteHandler(task.path));
      item.appendChild(text);

      taskContainer.appendChild(item);
    }

    row.appendChild(taskContainer);
    container.appendChild(row);
    cursor.setDate(cursor.getDate() + 1);
  }

  return container;
}

// list-view.js — Monthly list view (all days with tasks)

function tcListView(state, store, cfg) {
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var today = new Date();
  var todayStr = tcFormatDate(today);

  var container = tcEl('div', { class: 'tc-list' });

  // Iterate through all days in the month
  var firstDay = new Date(state.year, state.month, 1);
  var lastDay = new Date(state.year, state.month + 1, 0);
  var cursor = new Date(firstDay);

  while (cursor <= lastDay) {
    var dateStr = tcFormatDate(cursor);
    var isToday = dateStr === todayStr;
    var isOverdue = !isToday && dateStr < todayStr;

    var tasks = tcFilterTasks(store.tasksByDate.get(dateStr), state.filter, dateStr, todayStr);

    // Only show days that have tasks
    if (tasks.length > 0) {
      var rowClasses = ['tc-list-day'];
      if (isToday) rowClasses.push('tc-today');

      var row = tcEl('div', { class: rowClasses.join(' ') });

      // Date label: "Mon, Mar 2"
      var dayName = DAY_NAMES[cursor.getDay()];
      var monthName = MONTHS[cursor.getMonth()];
      var dateLabel = dayName + ', ' + monthName + ' ' + cursor.getDate();
      var dateLabelEl = tcEl('div', { class: 'tc-list-date', text: dateLabel });
      if (cfg.dailyNoteFolder) {
        tcOn(dateLabelEl, 'click', tcMakeDailyNoteHandler(dateStr, cfg));
        dateLabelEl.classList.add('tc-clickable');
      }
      row.appendChild(dateLabelEl);

      // Task list
      var taskContainer = tcEl('div', { class: 'tc-list-tasks' });

      for (var task of tasks) {
        var itemClasses = ['tc-task-item'];
        if (task.completed) itemClasses.push('tc-done');
        else if (isOverdue && task.type === 'due') itemClasses.push('tc-overdue');

        var item = tcEl('div', { class: itemClasses.join(' ') });

        var emoji = task.completed ? '\u2705'
          : task.type === 'due' ? '\uD83D\uDCC5'
          : task.type === 'scheduled' ? '\u23F3'
          : '\u00B7';
        item.appendChild(tcEl('span', { class: 'tc-task-emoji', text: emoji }));

        var text = tcEl('span', { class: 'tc-task-text', text: task.text });
        tcOn(text, 'click', tcMakeOpenNoteHandler(task.path));
        item.appendChild(text);

        var source = task.path.split('/').pop().replace(/\.md$/, '');
        item.appendChild(tcEl('span', { class: 'tc-list-source', text: source }));

        taskContainer.appendChild(item);
      }

      row.appendChild(taskContainer);
      container.appendChild(row);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Empty state
  if (container.children.length === 0) {
    container.appendChild(tcEl('div', { class: 'tc-list-empty', text: 'No tasks this month' }));
  }

  return container;
}

// app.js — Entry point, view registry, initialization

var TC_VIEWS = {
  month: tcMonthView,
  week: tcWeekView,
  list: tcListView,
};

function tcGetWeekStart(date, firstDay) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = day - firstDay;
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() - diff);
  return tcFormatDate(d);
}

function tcInit(dv, input) {
  try {
    var cfg = tcParseConfig(input);
    var store = tcBuildStore(dv, cfg);

    var now = new Date();
    var state = {
      year: now.getFullYear(),
      month: now.getMonth(),
      view: cfg.view,
      filter: 'active',
      weekStart: tcGetWeekStart(now, cfg.firstDayOfWeek),
    };

    var root = tcEl('div', { class: 'tc-root' });
    var viewContainer = tcEl('div', { class: 'tc-view-container' });

    function renderView() {
      var newContainer = tcEl('div', { class: 'tc-view-container' });
      var viewFn = TC_VIEWS[state.view] || TC_VIEWS.month;
      newContainer.appendChild(viewFn(state, store, cfg));
      root.replaceChild(newContainer, viewContainer);
      viewContainer = newContainer;
    }

    function handleNavigate(dir) {
      if (dir === 0) {
        // Today
        state.year = now.getFullYear();
        state.month = now.getMonth();
        state.weekStart = tcGetWeekStart(now, cfg.firstDayOfWeek);
      } else if (state.view === 'week') {
        var ws = new Date(state.weekStart + 'T00:00:00');
        ws.setDate(ws.getDate() + dir * 7);
        state.weekStart = tcFormatDate(ws);
        state.year = ws.getFullYear();
        state.month = ws.getMonth();
      } else { // month and list share monthly navigation
        state.month += dir;
        if (state.month > 11) { state.month = 0; state.year++; }
        if (state.month < 0) { state.month = 11; state.year--; }
      }
      nav.update();
      renderView();
    }

    function handleViewChange(v) {
      if (TC_VIEWS[v]) {
        state.view = v;
        if (v === 'week') {
          // If current month has today, use today's week; otherwise first of displayed month
          var anchor = (state.year === now.getFullYear() && state.month === now.getMonth())
            ? now
            : new Date(state.year, state.month, 1);
          state.weekStart = tcGetWeekStart(anchor, cfg.firstDayOfWeek);
        }
        nav.update();
        renderView();
      }
    }

    function handleFilterChange(f) {
      state.filter = f;
      nav.update();
      renderView();
    }

    var nav = tcCreateNav(state, Object.keys(TC_VIEWS), handleNavigate, handleViewChange, handleFilterChange);
    root.appendChild(nav.el);
    root.appendChild(viewContainer);

    renderView();
    dv.container.appendChild(root);

  } catch (err) {
    var errEl = document.createElement('div');
    errEl.style.cssText = 'color:red;padding:12px;border:1px solid red;border-radius:6px;margin:8px 0;font-family:monospace;white-space:pre-wrap;';
    errEl.textContent = 'Tasks Calendar Error:\n' + err.message + '\n\n' + err.stack;
    dv.container.appendChild(errEl);
  }
}

// Auto-run: dv and input are available in dv.view() scope
tcInit(dv, input);

})();

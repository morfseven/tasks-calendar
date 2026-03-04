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

// month-view.js — Monthly calendar grid

function tcMonthView(state, store, cfg) {
  const DAY_NAMES_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

  for (let i = 0; i < 49; i++) {
    const dateStr = tcFormatDate(cursor);
    const isCurrentMonth = cursor.getMonth() === state.month;
    const isToday = dateStr === todayStr;
    const isOverdue = !isToday && dateStr < todayStr;

    const classes = ['tc-day'];
    if (!isCurrentMonth) classes.push('tc-other-month');
    if (isToday) classes.push('tc-today');

    const cell = tcEl('div', { class: classes.join(' ') });

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
  return container;
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

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

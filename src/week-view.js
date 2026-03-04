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

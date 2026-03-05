// overdue-view.js — Flat list of all overdue tasks across all dates

function tcOverdueView(state, store, cfg) {
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var today = new Date();
  var todayStr = tcFormatDate(today);

  var container = tcEl('div', { class: 'tc-list' });

  // Collect all overdue dates from the store, sorted ascending (oldest first)
  var overdueDates = [];
  for (var [dateStr, tasks] of store.tasksByDate) {
    if (dateStr >= todayStr) continue;
    var hasOverdue = tasks.some(function(t) {
      return !t.completed && t.type === 'due';
    });
    if (hasOverdue) overdueDates.push(dateStr);
  }
  overdueDates.sort();

  for (var i = 0; i < overdueDates.length; i++) {
    var dateStr = overdueDates[i];
    var allTasks = store.tasksByDate.get(dateStr) || [];
    var tasks = allTasks.filter(function(t) {
      return !t.completed && t.type === 'due';
    });
    if (tasks.length === 0) continue;

    var d = new Date(dateStr + 'T00:00:00');
    var row = tcEl('div', { class: 'tc-list-day' });

    // Date label
    var dayName = DAY_NAMES[d.getDay()];
    var monthName = MONTHS[d.getMonth()];
    var dateLabel = dayName + ', ' + monthName + ' ' + d.getDate();
    var dateLabelEl = tcEl('div', { class: 'tc-list-date', text: dateLabel });
    if (cfg.dailyNoteFolder) {
      tcOn(dateLabelEl, 'click', tcMakeDailyNoteHandler(dateStr, cfg));
      dateLabelEl.classList.add('tc-clickable');
    }
    row.appendChild(dateLabelEl);

    // Task list
    var taskContainer = tcEl('div', { class: 'tc-list-tasks' });

    for (var task of tasks) {
      var item = tcEl('div', { class: 'tc-task-item tc-overdue' });

      item.appendChild(tcEl('span', { class: 'tc-task-emoji', text: '\uD83D\uDCC5' }));

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

  // Empty state
  if (container.children.length === 0) {
    container.appendChild(tcEl('div', { class: 'tc-list-empty', text: 'No overdue tasks' }));
  }

  return container;
}

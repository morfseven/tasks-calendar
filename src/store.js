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

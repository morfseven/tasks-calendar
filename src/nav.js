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

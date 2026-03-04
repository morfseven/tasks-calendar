// app.js — Entry point, view registry, initialization

var TC_VIEWS = {
  month: tcMonthView,
  week: tcWeekView,
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
      } else {
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

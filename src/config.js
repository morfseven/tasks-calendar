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

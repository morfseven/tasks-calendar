# Tasks Calendar

A minimal, dependency-free calendar view for [Obsidian](https://obsidian.md/) that displays tasks from the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin on a monthly or weekly grid. Built as a [DataviewJS](https://blacksmithgu.github.io/obsidian-dataview/) snippet using `dv.view()`.

![Month View](https://img.shields.io/badge/view-month-blue) ![Week View](https://img.shields.io/badge/view-week-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

- **Month view** — 7-week grid with task text displayed directly in cells
- **Week view** — Day-by-day list with full task details
- **Task type indicators** — 📅 due, ⏳ scheduled, ✅ completed
- **Filter dropdown** — Active (default), All, Overdue, Done
- **Daily note linking** — Click any date to open its daily note
- **Task note linking** — Click any task to jump to its source note
- **Theme compatible** — Uses Obsidian CSS variables for dark/light mode
- **Zero dependencies** — No npm, no build tools required (just a concat script)

## Requirements

- [Obsidian](https://obsidian.md/)
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin (with DataviewJS enabled)
- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin (optional, for emoji-based task dates)

## Installation

1. Clone and build:

```bash
git clone https://github.com/morfseven/tasks-calendar.git
cd tasks-calendar
bash build.sh
```

2. Copy `view.js` and `view.css` into a folder inside your vault. The folder name and location are up to you — just remember the path for step 3.

```bash
# Example: place it at the vault root
mkdir -p /path/to/your-vault/tasks-calendar
cp view.js view.css /path/to/your-vault/tasks-calendar/
```

3. Create a note anywhere in your vault and add the following DataviewJS block. The first argument to `dv.view()` must match the folder path from step 2, relative to your vault root.

````markdown
```dataviewjs
await dv.view("tasks-calendar", {
  pages: "",
  view: "month",
  firstDayOfWeek: 0,
  dailyNoteFolder: "daily",
  dailyNoteFormat: "YYYY-MM-DD",
})
```
````

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `pages` | `""` | Dataview source query to filter pages |
| `view` | `"month"` | Initial view: `"month"` or `"week"` |
| `firstDayOfWeek` | `0` | `0` = Sunday, `1` = Monday |
| `dailyNoteFolder` | `""` | Path to daily notes folder (enables date click) |
| `dailyNoteFormat` | `"YYYY-MM-DD"` | Daily note filename format |

### Examples

Show only tasks from a specific folder:

```dataviewjs
await dv.view("tasks-calendar", {
  pages: '"projects/active"',
})
```

Start week on Monday with daily notes in a nested structure:

```dataviewjs
await dv.view("tasks-calendar", {
  firstDayOfWeek: 1,
  dailyNoteFolder: "journal/daily",
})
```

## Task Parsing

Tasks are parsed using two methods (in priority order):

1. **Dataview properties** — `t.due`, `t.scheduled`, `t.completion`, `t.start`
2. **Emoji fallback** — Manual parsing of Tasks plugin emojis from task text

Supported emojis:

| Emoji | Meaning |
|-------|---------|
| 📅 / 🗓️ | Due date |
| ⏳ | Scheduled date |
| ✅ | Completion date |
| 🛫 | Start date |

## Development

Source files are organized in `src/` and `styles/`, then concatenated into `view.js` and `view.css` via `build.sh`:

```
src/
├── config.js       # Parameter parsing
├── store.js        # Task collection and indexing
├── dom.js          # DOM helpers
├── nav.js          # Navigation bar
├── month-view.js   # Monthly grid
├── week-view.js    # Weekly list
└── app.js          # Entry point

styles/
├── base.css        # Variables and reset
├── nav.css         # Navigation bar
├── month.css       # Month grid
└── week.css        # Week list
```

To rebuild after editing source files:

```bash
bash build.sh
```

Then copy the updated `view.js` and `view.css` to your vault.

## License

[MIT](LICENSE)

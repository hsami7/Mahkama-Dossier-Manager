# Architecture Research

**Domain:** Court Dossier Management System
**Researched:** 2026-07-06
**Confidence:** HIGH

## Standard Architecture

### System Overview

The application is structured as a local desktop utility running an offline Python Flask server and rendering a HTML5 browser interface.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser UI)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌─────────────────────────┐  │
│  │   Dashboard     │ ◄───────► │    Settings panel       │  │
│  │  (RTL, Arabic)  │           │   (Deadline config)     │  │
│  └────────┬────────┘           └────────────┬────────────┘  │
└───────────┼─────────────────────────────────┼───────────────┘
            │ Request (Fetch API)             │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server (Python Backend)                │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────────────┐       ┌──────────────────────┐  │
│  │      Flask App         │ ◄───► │  Config Controller   │  │
│  │    (APIs / Routes)     │       │    (read/write JSON) │  │
│  └───────────┬────────────┘       └───────────┬──────────┘  │
│              │                                │             │
│              ▼                                ▼             │
│   ┌──────────────────────┐         ┌─────────────────────┐  │
│   │    Excel Engine      │         │     File System     │  │
│   │  (zipfile/xml parser)│         │   (xlsx renaming)   │  │
│   └──────────────────────┘         └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Frontend Web UI | Renders main table, status cards, and settings form. RTL styling | HTML5, Vanilla JS, CSS (with mahakim.ma CSS variables) |
| Backend Server | Orchestrates APIs for directory scanning, renaming files, and reading/writing settings | Flask (Python) |
| Excel Parser | Reads and extracts folder metadata from Column B and C of `.xlsx` files without external pip packages | Built-in `zipfile` + `xml.etree.ElementTree` parsing |
| Config Manager | Persists settings for codes 7201-7215 | Local JSON file config |

## Recommended Project Structure

```
mahkama/
├── app.py                  # Main flask server entrypoint
├── templates/
│   └── index.html          # RTL Arabic main interface
├── static/
│   ├── css/
│   │   └── style.css       # Custom styles based on mahakim.ma (Colors & fonts)
│   ├── js/
│   │   └── main.js         # Frontend controller and APIs integration
│   └── fonts/
│       ├── droid_arabic_kufi.ttf # Offline Arabic font
│       └── roboto_regular.ttf    # Offline numbers/latin font
├── data/
│   └── settings.json       # Persisted category deadlines
└── .planning/              # GSD project plans
```

### Structure Rationale

- **app.py:** Keeps the local desktop webserver logic simple and in one file.
- **data/settings.json:** Isolates the customizable deadline settings so they don't get overwritten when the app restarts.
- **static/fonts/:** Ensures the page loads correctly and looks identical to the official website even without an active internet connection.

## Data Flow

### Request Flow

1. **Scan Request:** User inputs directory path -> Web UI sends POST to `/api/scan` -> Flask calls Excel Parser on all `.xlsx` files in the directory.
2. **Rename Action:** Backend renames the files on disk and returns the status.
3. **Data Return:** Parser extracts dossier items, calculates remaining days using `settings.json`, sorts by urgency, and returns them.
4. **Display:** UI renders the sorted list with corresponding warning color indicators.

---
*Architecture research for: Mahkama Dossier Manager*
*Researched: 2026-07-06*

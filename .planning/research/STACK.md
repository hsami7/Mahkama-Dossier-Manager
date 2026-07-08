# Stack Research

**Domain:** Court Dossier Management System
**Researched:** 2026-07-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.10+ | Backend Runtime | Required for filesystem interactions (renaming) and fast Excel parsing. |
| Flask | 3.0+ | Micro web framework | Light-weight, easy to configure locally, perfect for a single-user offline desktop utility. |
| HTML5 / CSS3 / Vanilla JS | Modern | Frontend UI | Clean RTL interface styled with custom colors and typography mimicking Mahakim.ma without third-party framework overhead. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zipfile / xml | Standard Lib | Excel Parsing | Used to read xlsx files natively without needing external libraries like `openpyxl` or `pandas` which might not be installed on user's system. |
| openpyxl | 3.1.2 | Robust Excel write | If write operations are needed, openpyxl is the python standard. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Python venv | Virtual environment isolation | Keeps project dependencies isolated from system-wide Python packages. |

## Installation

```bash
# Python Standard library is used for ZipFile parsing (zero npm/pip dependencies needed for core run)
# Optional openpyxl if needed for writing back to files:
python3 -m pip install openpyxl
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Python + Flask | Node + Express | If user preferred JS ecosystem, but python standard libraries are better for direct OS/Excel operations. |
| Vanilla JS (No Framework) | React / Vue | Overkill for a local single-user single-page tool. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Emojis as icons | Looks unprofessional on official Moroccan administrative style | SVG Icons styled with Mahakim colors |
| External CDNs for fonts | The app should run offline | Local font files (e.g. `droid_arabic_kufi.ttf`) |

## Sources

- Mahakim.ma live stylesheets — inspected typography and color choices
- Python Standard Library documentation on `zipfile` and `xml.etree.ElementTree`

---
*Stack research for: Mahkama Dossier Manager*
*Researched: 2026-07-06*

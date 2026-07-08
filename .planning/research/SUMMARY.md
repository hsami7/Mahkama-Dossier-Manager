# Project Research Summary

**Project:** مدير ملفات المحاكم (Mahkama Dossier Manager)
**Domain:** Local Court Dossier Tracking Tool
**Researched:** 2026-07-06
**Confidence:** HIGH

## Executive Summary

The project consists of developing an offline local web utility styled after the official Mahakim.ma portal to manage and sort court files. Key requirements include parsing dossier details (like Year, Code, and Registration Date) from Excel files, auto-renaming files dynamically on the filesystem, calculating urgency deadlines, and providing a clean, customizable Arabic RTL dashboard.

The recommended stack is a Python Flask backend serving a vanilla HTML5/JS/CSS client. This avoids external database servers and allows the tool to run offline. Key risks include file system lockups on renaming (when files are open in Excel) and date format variations, both of which will be handled through defensive coding.

## Key Findings

### Recommended Stack

A Python Flask backend with Vanilla HTML/CSS/JS frontend ensures lightweight execution, native filesystem control, and complete offline capability.

**Core technologies:**
- Python 3.10+: Executing environment
- Flask 3.0+: Micro web server API
- Zipfile / xml (Python stdlib): Dependency-free Excel parsing

### Expected Features

**Must have (table stakes):**
- Dynamic local folder directory scanning
- Row parsing of Column B and C to extract court registration data
- Remaining days calculation and color-coded table listing (closest deadlines first)
- Arabic RTL interface layout matching Mahakim.ma styling

**Should have (differentiators):**
- Automatic file renaming on disk to `Year_Category.xlsx`
- Web settings page to edit and save category deadlines for codes 7201-7215

### Architecture Approach

Local Python service that interacts directly with user's folders and serves static pages to the user's browser.

**Major components:**
1. UI Dashboard: RTL Arabic client for visual tracking
2. Flask Webserver: Coordinates local API endpoints
3. File Processor: Inspects directory, parses Excel spreadsheets, and renames files on disk

### Critical Pitfalls

1. **Excel File Access Lock** — Handle OS access/lock issues defensively when file is open.
2. **Date Format Variations** — Implement a robust date parser for multiple format fallbacks.

## Implications for Roadmap

### Phase 1: Core Engine & Excel Processing
**Rationale:** Standardizing the file scanning, date parsing, and renaming on disk is the highest risk component and must be resolved before coding the UI.
**Delivers:** A functional CLI/backend script that parses files, calculates deadlines, and renames them.

### Phase 2: Web Interface & Settings Page
**Rationale:** With a reliable backend engine, we can build the RTL UI and settings panel matching Mahakim.ma's theme.

---
*Research completed: 2026-07-06*
*Ready for roadmap: yes*

# Pitfalls Research

**Domain:** Court Dossier Management System
**Researched:** 2026-07-06
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: File Lock on Excel Files

**What goes wrong:**
When attempting to rename an Excel file, the OS throws an permission/access error (`PermissionError` on Windows/Linux) if the file is currently open in Excel or another program.

**Why it happens:**
Users will frequently have the dossier spreadsheets open in MS Excel while running our tool.

**How to avoid:**
Use `try-except` blocks around filesystem rename operations, detect access errors, and present a clear, localized message in Arabic to the user (e.g. "يرجى إغلاق الملف في برنامج Excel قبل المتابعة").

**Warning signs:**
Scanner backend prints access/permission exceptions when clicking the run/rename action.

---

### Pitfall 2: Formatting of Registration Dates

**What goes wrong:**
Excel stores dates in different formats (either raw serial numbers like `45231` or text like `12/01/2026` or `2026-01-12`). Reading it dynamically might result in parsing crashes or incorrect date math.

**Why it happens:**
Excel sheets are entered manually by different court typists using different date conventions.

**How to avoid:**
Implement a robust date parsing utility that tries standard formats (`DD/MM/YYYY`, `YYYY-MM-DD`) and handles Excel serial dates (relative to 1899-12-30). If parsing fails, default to a fallback state and notify the user with a warning sign.

**Warning signs:**
The "days remaining" calculations display extremely large or negative values.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Parsing only column indexes | Quick parser code | If columns are reordered or inserted, parsing breaks | In MVP if index is documented, but scanning header labels (e.g. searching for "تاريخ التسجيل") is preferred |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| LTR Alignment on Arabic Text | Text wraps awkwardly, table columns display in reverse reading order | Explicitly set `dir="rtl"` in HTML and use Arabic native layouts |

---
*Pitfalls research for: Mahkama Dossier Manager*
*Researched: 2026-07-06*

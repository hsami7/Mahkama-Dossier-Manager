# Phase 1: Core Parsing & Logic Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 1-Core Parsing & Logic Engine
**Areas discussed:** تسمية الملفات وتجنب التعارض (File Renaming & Naming Conflicts)

---

## تسمية الملفات وتجنب التعارض (File Renaming & Naming Conflicts)

| Option | Description | Selected |
|--------|-------------|----------|
| Append a sequence suffix | e.g., 2026_7205_1.xlsx, 2026_7205_2.xlsx | |
| Append the original filename to the code | e.g., 2026_7205_السجل العام.xlsx | |
| Skip renaming subsequent files and print a warning | Skip renaming subsequent files and print a warning in the UI | ✓ |
| You decide | Append sequence suffix | |

**User's choice:** Skip renaming subsequent files and print a warning in the UI.
**Notes:** User also decided that renaming files should happen automatically as soon as the folder is scanned.

---

## the agent's Discretion

- معالجة وتجاوز أخطاء قفل الملفات (Locked Files).
- نمط وهيكل الفئات ومكتبة تحليل الـ XML للـ Excel.
- معالجة التواريخ التالفة أو المفقودة.

## Deferred Ideas

None.

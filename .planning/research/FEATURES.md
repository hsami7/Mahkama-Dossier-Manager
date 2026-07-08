# Feature Research

**Domain:** Court Dossier Management System
**Researched:** 2026-07-06
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Folder selection | Need to load the excel files to read dossier data | LOW | Native OS file explorer / directory picker |
| Excel file parsing | Read B (الرقم الكامل للملف) and C (تاريخ التسجيل) | MEDIUM | Standard zipfile XML parsing |
| Remaining days calculation | Compute dates relative to current local time | LOW | Python datetime logic |
| Sorting by urgency | View closest deadlines first | LOW | Array sorting in Python/JS |
| Arabic RTL design | Standard Moroccan administrative look | LOW | Custom vanilla CSS variables styled after Mahakim.ma |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-rename Excel files | Rename files on disk to match `Year_Category.xlsx` automatically | MEDIUM | OS file rename with clash avoidance |
| Live Settings editor | Directly update deadline mappings for codes 7201-7215 and save | LOW | Edit JSON configuration through UI |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-user cloud sync | Multiple people viewing court data | Privacy/security concerns for sensitive court data; requires internet | Keep local, run offline for maximum privacy |
| Complex database storage | Store dossier history | Adds DB installation overhead (SQLite/PostgreSQL) | Dynamic memory read directly from Excel files |

## Feature Dependencies

```
[UI Dashboard]
    └──requires──> [Folder Scan API]
                       └──requires──> [Excel Parser (ZipFile)]
```

## MVP Definition

### Launch With (v1)

- [ ] Folder Directory Scanner — Select local folders and read all `.xlsx` files
- [ ] Excel Parser — Extract Column B (الرقم الكامل للملف) and Column C (تاريخ التسجيل)
- [ ] Renaming Engine — Rename the scanned files to `Year_Category.xlsx`
- [ ] Urgency Calculator & Sorter — Calculate deadline days remaining and display sorted RTL lists
- [ ] Custom Settings Page — Save and modify the 7201-7215 deadline limits to `config.json`

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Directory scanning | HIGH | MEDIUM | P1 |
| Excel parsing | HIGH | HIGH | P1 |
| Renaming files | MEDIUM | MEDIUM | P1 |
| Urgency calculations | HIGH | LOW | P1 |
| RTL theme UI | HIGH | MEDIUM | P1 |
| Settings Editor | HIGH | LOW | P1 |

---
*Feature research for: Mahkama Dossier Manager*
*Researched: 2026-07-06*

# Phase 1: Core Parsing & Logic Engine - Research

**Researched:** 2026-07-06
**Domain:** Python Excel Parsing, Date Calculations, and Local Filesystem Renaming
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** في حال وجود ملفات Excel متعددة تؤدي لنفس الاسم (نفس رمز الفئة والسنة)، يتم تخطي إعادة التسمية للملفات اللاحقة وعرض تحذير في الواجهة لتجنب الكتابة فوق الملفات (Overwrite).
- **D-02:** تتم إعادة تسمية الملفات تلقائياً على القرص بمجرد اختيار المستخدم للمجلد وبدء عملية المسح.

### the agent's Discretion
- طريقة معالجة وتجاوز الأخطاء الناتجة عن ملفات Excel المفتوحة (Locked).
- نمط وهيكل الفئات الداخلية ومكتبة تحليل الـ XML للـ Excel.
- معالجة التواريخ التالفة أو المفقودة.

### Deferred Ideas (OUT OF SCOPE)
- لا يوجد أفكار مؤجلة لهذه المرحلة.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

Single-tier application — all backend capabilities reside in Python Backend tier.

</architectural_responsibility_map>

<research_summary>
## Summary

تتطلب هذه المرحلة تطوير محرك Python خفيف وسريع لقراءة وتحليل ملفات Excel دون الاعتماد على مكتبات خارجية ضخمة مثل `pandas` أو `openpyxl` (لتفادي مشاكل التثبيت على أجهزة المستخدمين). سنستخدم مكتبة `zipfile` و `xml.etree.ElementTree` المدمجة لقراءة الملفات وتوفير سرعة فائقة.

سيتعامل المحرك مع حالتين حرجتين: قفل الملفات (عندما تكون مفتوحة في Excel) وتنوع تنسيق التواريخ في Excel (التواريخ النصية مقابل الأرقام التسلسلية).

**Primary recommendation:** استخدام تحليل XML مدمج لـ xlsx لمعالجة سريعة وخالية من التبعيات، مع تغليف عمليات التسمية بكتل `try-except PermissionError` لتأمين سلامة التشغيل.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zipfile | Standard Lib | Unzipping xlsx container | Standard method for inspecting OpenXML spreadsheet structures |
| xml.etree.ElementTree | Standard Lib | XML parsing | Fast, built-in XML scanner with low memory overhead |
| os / shutil | Standard Lib | Filesystem scanning & renaming | Direct OS interaction without dependencies |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
سنضع الكود البرمجي في الجذر لتبسيط تشغيله محلياً:
```
mahkama/
├── app.py                  # خادم Flask والمسارات
├── engine.py               # محرك مسح الملفات والتحليل وإعادة التسمية
└── data/
    └── settings.json       # إعدادات المدد الافتراضية
```

### Anti-Patterns to Avoid
- **إعادة تسمية الملف مباشرة دون فحص تعارض الاسم:** قد يؤدي لكتابة ملف فوق الآخر وضياع البيانات. يجب التحقق من وجود اسم الملف المستهدف مسبقاً.
- **الاعتماد الكلي على نمط تاريخ واحد:** قد يكتب المستخدم تاريخ التسجيل بصيغ مثل `12/01/2026` أو كقيمة رقمية تسلسلية لـ Excel. يجب تغطية الحالتين.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel structure reading | Direct zip parser | `zipfile.ZipFile` | Handles zip container compression formats |
| XML parsing | Regex parsing | `xml.etree.ElementTree` | Prevents errors with XML namespaces and nested tags |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: MS Excel File Lock
**What goes wrong:** `PermissionError` when renaming or reading open files.
**Why it happens:** MS Excel opens files in exclusive-write mode.
**How to avoid:** Catch `PermissionError`, log it, skip rename, and warn the user.

### Pitfall 2: Excel Serial Date Numbers
**What goes wrong:** Reading `46022` instead of `12/01/2026`.
**Why it happens:** Excel stores some dates internally as floats offset from 1899-12-30.
**How to avoid:** Check if the parsed value is numeric. If so, convert it using Python's `datetime` logic.
</common_pitfalls>

<code_examples>
## Code Examples

### تحويل رقم Excel التسلسلي إلى تاريخ Python
```python
from datetime import datetime, timedelta

def parse_excel_date(value):
    if not value:
        return None
    # If it is a string representing a date
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            pass
    # If it is numeric (Excel serial date)
    try:
        serial = float(value)
        # Excel's leap year bug means 1900 is treated as a leap year, so offset is 1899-12-30
        base_date = datetime(1899, 12, 30)
        return base_date + timedelta(days=serial)
    except ValueError:
        return None
```
</code_examples>

<sources>
## Sources

### Primary (HIGH confidence)
- Python Standard Library `zipfile` and `xml.etree.ElementTree` documentation.
- OpenXML Spreadsheet standards for sharedStrings and sheet XML structure.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Python 3.10
- Patterns: Excel XML reading, local file locks, date serial conversions
- Research date: 2026-07-06
- Valid until: 2026-08-06
</metadata>

---
*Phase: 01-core-parsing-logic-engine*
*Research completed: 2026-07-06*
*Ready for planning: yes*

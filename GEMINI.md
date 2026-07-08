<!-- GSD:project-start source:PROJECT.md -->
## Project

**مدير ملفات المحاكم (Mahkama Dossier Manager)**

تطبيق ويب مخصص لإدارة وتتبع ملفات المحاكم المغربية، مصمم بالكامل باللغة العربية ومستوحى من الهوية البصرية لبوابة محاكم (Mahakim.ma). يقوم التطبيق بقراءة ملفات Excel من مجلد محدد، واستخراج تفاصيل الملفات وتواريخ تسجيلها، وإعادة تسمية الملفات تلقائياً حسب رمز الفئة والسنة، وحساب الآجال المتبقية وترتيب الملفات حسب درجة الاستعجال.

**Core Value:** ترتيب وتتبع آجال ملفات المحاكم بدقة لتفادي فوات المواعيد القانونية، مع تسهيل تنظيم الملفات على القرص الصلب.

### Constraints

- **لغة الواجهة**: يجب أن تكون الواجهة بالكامل باللغة العربية وباتجاه من اليمين إلى اليسار (RTL).
- **التقنيات المستخدمة**: Python للتحكم في الملفات وقراءتها، متصفح الويب للواجهة.
- **تعديل الملفات**: تعديل أسماء الملفات مباشرة على القرص الصلب للمستخدم بناءً على المجلد المختار.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
# Python Standard library is used for ZipFile parsing (zero npm/pip dependencies needed for core run)
# Optional openpyxl if needed for writing back to files:
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

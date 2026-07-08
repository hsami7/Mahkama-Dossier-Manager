# Phase 1: Core Parsing & Logic Engine - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

تطوير محرك الباك اند (Python) لقراءة ملفات Excel وحساب الآجال المتبقية لكل ملف بناءً على تاريخ التسجيل وقواعد الفئات، وإعادة تسمية الملفات تلقائياً على القرص الصلب لتطابق صيغة `السنة_الرمز.xlsx`.

</domain>

<decisions>
## Implementation Decisions

### تسمية الملفات وتجنب التعارض (File Renaming & Naming Conflicts)
- **D-01:** في حال وجود ملفات Excel متعددة تؤدي لنفس الاسم (نفس رمز الفئة والسنة)، يتم تخطي إعادة التسمية للملفات اللاحقة وعرض تحذير في الواجهة لتجنب الكتابة فوق الملفات (Overwrite).
- **D-02:** تتم إعادة تسمية الملفات تلقائياً على القرص بمجرد اختيار المستخدم للمجلد وبدء عملية المسح.

### discretionary (صلاحيات المطور)
- طريقة معالجة وتجاوز الأخطاء الناتجة عن ملفات Excel المفتوحة (Locked).
- نمط وهيكل الفئات الداخلية ومكتبة تحليل الـ XML للـ Excel.
- معالجة التواريخ التالفة أو المفقودة (الافتراض لليوم الحالي أو تخطي السطر).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Config
- `data/settings.json` — ملف حفظ مدد الآجال لكل فئة (7201 إلى 7215).

### Sample Data
- `السجل العام.xlsx` — ملف إكسل نموذجي لاختبار بنية الأعمدة والبيانات المستخرجة.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- لا يوجد (مشروع جديد).

### Established Patterns
- لا يوجد.

### Integration Points
- لا يوجد.

</code_context>

<specifics>
## Specific Ideas

- يجب تحميل قيم الآجال الافتراضية للفئات (مثال: 7201 -> 40 يوماً، 7202 -> 60 يوماً...) مسبقاً في ملف الإعدادات ليعمل التطبيق مباشرة عند أول تشغيل.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Core Parsing & Logic Engine*
*Context gathered: 2026-07-06*

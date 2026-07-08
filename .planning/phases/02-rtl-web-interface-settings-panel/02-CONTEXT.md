# Phase 2: RTL Web Interface & Settings Panel - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

تطوير واجهة المستخدم الرسومية التفاعلية (HTML/CSS/JS) المستوحاة من الهوية البصرية لبوابة محاكم (Mahakim.ma)، وتدعم اتجاه الكتابة من اليمين إلى اليسار (RTL) بشكل كامل، لعرض لوحة تحكم بالملفات ونسب الاستعجال وقيم الإعدادات مع إمكانية تعديلها.

</domain>

<decisions>
## Implementation Decisions

### تصميم لوحة التحكم (Layout & Styling)
- **D-01:** تصميم هيكل الصفحة ليعتمد على التنسيق الكلاسيكي العلوي (Top Navigation) ليكون متطابقاً مع بوابة محاكم، مع شريط علوي يعرض الاسم والشعار، يليه حقل اختيار المجلد، ويعرض جدول الملفات بكامل عرض الصفحة. نافذة الإعدادات ستكون نافذة منبثقة (Modal) تظهر فوق الصفحة بدلاً من صفحة مستقلة.
- **D-02:** سيتم تلوين صفوف الجدول بالكامل بناءً على مستوى الاستعجال (تظليل خفيف بالأحمر للقضايا العاجلة جداً، تظليل برتقالي للمتوسطة، وتظليل أخضر للقضايا الآمنة) لضمان القراءة الفورية للأولويات.
- **D-03:** سيتم دعم حقل إدخال مسار المجلد بقائمة منسدلة بالمسارات التي قام المستخدم بمسحها مؤخراً (Recent Paths History) لتسهيل إعادة الاستخدام بدلاً من إعادة كتابة المسار يدوياً في كل مرة.
- **D-04:** عند تشغيل التطبيق لأول مرة وقبل إدخال أي مسار، ستعرض الصفحة هيكل الجدول الفارغ (Skeleton Table Placeholder) مع إشارة نصية واضحة في المنتصف: "يرجى إدخال مسار المجلد لبدء المعالجة".

### the agent's Discretion
- تحديد طريقة تخزين وعرض قائمة المسارات الممسوحة مؤخراً (مثال: حفظها في ملف إعدادات settings.json أو عبر LocalStorage في المتصفح).
- اختيار التموجات اللونية الدقيقة وتأثيرات المرور (Hover Effects) المناسبة لصفوف الجدول الملونة لضمان جاذبية المظهر الرسمي.
- تفاصيل طريقة تفعيل وحفظ الإعدادات الفورية من داخل النافذة المنبثقة.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI & Styling Guidelines
- `mahakim_theme.md` — Custom styling parameters, CSS structure and colors extracted from portal mahakim.ma.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app.py`: خادم Flask الذي تم تطويره في المرحلة الأولى والذي يوفر مسارات API للمسح وجلب الإعدادات.
- `engine.py`: الدوال الخاصة بمعالجة الملفات وحساب الآجال الجاهزة للاستدعاء.

### Integration Points
- سيتم استدعاء مسار `POST /api/scan` عند إدخال مسار المجلد لعرض البيانات بالجدول وتغيير حالة الهيكل الفارغ.
- سيتم ربط النافذة المنبثقة (Modal) للإعدادات بمساري `GET /api/settings` و `POST /api/settings` لقراءة وتحديث المدد الزمنية.

</code_context>

<specifics>
## Specific Ideas

- يجب مطابقة الألوان بدقة مع الهوية الرسمية (Navy `#003566` والذهبي `#FFBC2B`) واستخدام خطوط عربية جميلة مدعومة محلياً (مثل Droid Arabic Kufi).

</specifics>

<deferred>
## Deferred Ideas

- لا يوجد أفكار مؤجلة حالياً لهذه المرحلة.

</deferred>

---

*Phase: 02-rtl-web-interface-settings-panel*
*Context gathered: 2026-07-06*

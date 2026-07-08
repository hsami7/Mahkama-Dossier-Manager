# مدير ملفات المحاكم (Mahkama Dossier Manager)

## What This Is

تطبيق ويب مخصص لإدارة وتتبع ملفات المحاكم المغربية، مصمم بالكامل باللغة العربية ومستوحى من الهوية البصرية لبوابة محاكم (Mahakim.ma). يقوم التطبيق بقراءة ملفات Excel من مجلد محدد، واستخراج تفاصيل الملفات وتواريخ تسجيلها، وإعادة تسمية الملفات تلقائياً حسب رمز الفئة والسنة، وحساب الآجال المتبقية وترتيب الملفات حسب درجة الاستعجال.

## Core Value

ترتيب وتتبع آجال ملفات المحاكم بدقة لتفادي فوات المواعيد القانونية، مع تسهيل تنظيم الملفات على القرص الصلب.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] واجهة مستخدم ويب باللغة العربية متوافقة مع الهوية البصرية لبوابة محاكم (RTL، أزرق `#003566` وذهبي `#ffbc2b`).
- [ ] اختيار مجلد يحتوي على ملفات Excel لقراءتها ومعالجتها.
- [ ] استخراج رمز الفئة (7201 إلى 7215) والسنة ورقم الملف من العمود B (الرقم الكامل للملف).
- [ ] إعادة تسمية ملفات Excel تلقائياً على القرص لتصبح بصيغة `السنة_الرمز.xlsx` (مثل `2026_7205.xlsx`).
- [ ] قراءة تاريخ التسجيل من العمود C (تاريخ التسجيل) وحساب الأيام المتبقية بناءً على مدة الفئة.
- [ ] عرض الملفات مرتبة تصاعدياً من الأقرب أجلاً (الأكثر استعجالاً) إلى الأبعد أجلاً.
- [ ] صفحة إعدادات لتعديل مدد الفئات (7201-7215) وحفظها للعمل بها مستقبلاً.

### Out of Scope

- معالجة صيغ ملفات غير Excel (مثل PDF أو Word) — لأن مصدر البيانات حصرى وجاهز بصيغة Excel.
- رفع الملفات إلى خادم سحابي خارجي — التطبيق محلي بالكامل لضمان سرية البيانات.

## Context

- **البيئة التقنية**: خادم محلي بلغة Python (الخيار A) مع واجهة مستخدم ويب (HTML/CSS/JS).
- **مصدر البيانات**: ملفات Excel تحتوي على أعمدة محددة: العمود B (`الرقم الكامل للملف` بصيغة `2026/7205/11`) والعمود C (`تاريخ التسجيل` بصيغة `DD/MM/YYYY`).
- تم استخراج الألوان والخطوط (`DroidArabicKufi` و `Roboto`) والأنماط البصرية من موقع `mahakim.ma` لاعتمادها في الواجهة.

## Constraints

- **لغة الواجهة**: يجب أن تكون الواجهة بالكامل باللغة العربية وباتجاه من اليمين إلى اليسار (RTL).
- **التقنيات المستخدمة**: Python للتحكم في الملفات وقراءتها، متصفح الويب للواجهة.
- **تعديل الملفات**: تعديل أسماء الملفات مباشرة على القرص الصلب للمستخدم بناءً على المجلد المختار.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| استخدام Python للباك اند | لتسهيل معالجة وقراءة ملفات Excel وإعادة تسميتها محلياً على جهاز المستخدم | — Pending |
| حفظ مدد الآجال في ملف إعدادات محلي | للسماح للمستخدم بتعديل المدد وتطبيقها دون الحاجة لتغيير الكود | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after initialization*

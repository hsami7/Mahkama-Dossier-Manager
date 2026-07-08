# Requirements: مدير ملفات المحاكم (Mahkama Dossier Manager)

**Defined:** 2026-07-06
**Core Value:** ترتيب وتتبع آجال ملفات المحاكم بدقة لتفادي فوات المواعيد القانونية، مع تسهيل تنظيم الملفات على القرص الصلب.

## v1 Requirements

### File Scanning & Parsing

- [x] **FILE-01**: يمكن للمستخدم اختيار مسار مجلد محلي يحتوي على ملفات Excel لقراءتها.
- [x] **FILE-02**: يقوم النظام باستخراج السنة ورمز الفئة ورقم الملف من العمود B (الرقم الكامل للملف) والذي يكون بصيغة `Year/Code/Number` (مثل `2026/7205/11`).
- [x] **FILE-03**: يقوم النظام بقراءة تاريخ التسجيل من العمود C (تاريخ التسجيل) بدعم صيغ التواريخ المختلفة وصيغ الأرقام التسلسلية لـ Excel.

### Filesystem Modification

- [x] **RENAME-01**: يقوم النظام تلقائياً بإعادة تسمية كل ملف Excel مقروء على القرص الصلب ليطابق الصيغة الجديدة `السنة_الرمز.xlsx` (مثال: `2026_7205.xlsx`).
- [x] **RENAME-02**: يتعامل النظام بشكل آمن مع الأخطاء الناتجة عن إغلاق الملفات (ملف مفتوح في Excel) ويعرض تنبيهاً للمستخدم باللغة العربية.

### Business Logic & Calculation

- [x] **CALC-01**: يحسب النظام الأيام المتبقية أو المنقضية بطرح (تاريخ اليوم - تاريخ التسجيل) ومقارنتها بمدة الفئة المحددة.
- [x] **CALC-02**: يصنف النظام درجة استعجال الملفات ويعرضها بألوان تمييز واضحة (أحمر للأقرب أجلاً، برتقالي للمتوسط، أخضر للآمن).

### Web Interface & Styling

- [x] **DASH-01**: يعرض النظام واجهة ويب باللغة العربية متكاملة تدعم القراءة من اليمين إلى اليسار (RTL) ومبنية بالهوية البصرية لبوابة محاكم (الأزرق والذهبي).
- [x] **DASH-02**: يعرض جدولاً رئيسياً يحتوي على أرقام الملفات وتواريخ التسجيل وتصنيف الفئة وعدد الأيام المتبقية، ويكون مرتباً تصاعدياً حسب الأيام المتبقية (الأكثر استعجالاً في الأعلى).
- [x] **SETT-01**: واجهة ويب مخصصة للإعدادات تتيح تعديل مدد الآجال الافتراضية للفئات (7201 إلى 7215).
- [x] **SETT-02**: يمكن للمستخدم حفظ التعديلات في ملف إعدادات محلي (`data/settings.json`) لتطبيقها فوراً في العمليات القادمة.

## v2 Requirements

### Analytics & Reports

- **ANL-01**: عرض إحصائيات بيانية لنسب الملفات المقتربة من انتهاء أجلها.
- **ANL-02**: تصدير تقرير التتبع والآجال بصيغة PDF.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user cloud sync | High complexity, not core to community value, offline local privacy is priority |
| PDF/Word file processing | Source folders contain exclusively Excel files |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FILE-01 | Phase 1 | Complete |
| FILE-02 | Phase 1 | Complete |
| FILE-03 | Phase 1 | Complete |
| RENAME-01 | Phase 1 | Complete |
| RENAME-02 | Phase 1 | Complete |
| CALC-01 | Phase 1 | Complete |
| CALC-02 | Phase 1 | Complete |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| SETT-01 | Phase 2 | Complete |
| SETT-02 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-06*
*Last updated: 2026-07-06 after initial definition*

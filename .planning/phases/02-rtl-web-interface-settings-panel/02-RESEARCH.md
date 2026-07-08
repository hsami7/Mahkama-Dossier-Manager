# Phase 2: RTL Web Interface & Settings Panel - Research

**Researched:** 2026-07-06
**Domain:** RTL Web Frontend (HTML5, Vanilla CSS, Vanilla JS) & Flask API Integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** تصميم كلاسيكي علوي (Top Navigation) يطابق بوابة محاكم، ونافذة منبثقة (Modal) للإعدادات.
- **D-02:** تلوين صفوف الجدول بالكامل بناءً على مستوى الاستعجال (تظليل خفيف بالأحمر، البرتقالي، والأخضر).
- **D-03:** دعم قائمة منسدلة بالمسارات التي قام المستخدم بمسحها مؤخراً (Recent Paths History).
- **D-04:** عرض هيكل الجدول الفارغ (Skeleton Placeholder) عند فتح التطبيق وقبل المسح.

### the agent's Discretion
- طريقة تخزين المسارات السابقة محلياً (سنستخدم LocalStorage في المتصفح).
- قيم درجات التباين والشفافية لألوان الصفوف.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| UI Layout & RTL CSS | Browser/Client | — | Renders the HTML page in the browser |
| Scan Trigger & Table Rendering | Browser/Client | API/Backend | JS fetches scan API and constructs DOM rows |
| Settings Edit & Save | Browser/Client | API/Backend | JS posts form data to settings API |
| Recent Paths Storage | Browser/Client | — | LocalStorage preserves user directory history |

</architectural_responsibility_map>

<research_summary>
## Summary

تتطلب هذه المرحلة بناء واجهة مستخدم ويب سريعة وجذابة تدعم اللغة العربية والاتجاه من اليمين إلى اليسار (RTL) بشكل كامل. الألوان والخطوط مستوحاة من بوابة محاكم المغربية الرسمية (Mahakim.ma)، وتحديداً اللون الأزرق الداكن والأصفر الذهبي.

سنستخدم تقنيات الويب الأساسية (HTML5, CSS3, Vanilla JS) لضمان البساطة والسرعة القصوى محلياً. سيتم تخزين تاريخ المجلدات الممسوحة في LocalStorage للسرعة، كما سنقوم ببناء Skeleton Table باستخدام تأثيرات نبضية (Pulse CSS animations) لمحاكاة حالة الانتظار بشكل احترافي.

**Primary recommendation:** استخدام خصائص CSS المنطقية (Logical Properties) لدعم RTL، وتجنب تعقيد الأكواد عبر Vanilla JS الصافي للتلاعب بالـ DOM.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 / CSS3 / Vanilla JS | Modern | Frontend UI | Pure web tech, no build tools needed, fast local execution |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Font Droid Arabic Kufi | Google Fonts | Typography | Matches official administrative Moroccan style |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
سنقوم بتخزين ملفات الواجهة في المجلدات القياسية لـ Flask:
```
mahkama/
├── templates/
│   └── index.html          # الهيكل الأساسي للواجهة
├── static/
│   ├── css/
│   │   └── style.css       # تنسيقات RTL والألوان والهوية البصرية
│   └── js/
│       └── main.js         # منطق التفاعل وطلبات API
```

### Pattern 1: Skeleton Table Animation
استخدام تظليل باهت ينبض للإشارة إلى جدول فارغ في انتظار البيانات:
```css
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.skeleton-row td {
  animation: pulse 1.5s infinite ease-in-out;
  background-color: #f0f0f0;
  height: 20px;
}
```

### Pattern 2: LocalStorage Recent Paths
حفظ واسترجاع المسارات السابقة في المتصفح:
```javascript
function saveRecentPath(path) {
    let paths = JSON.parse(localStorage.getItem('recent_paths') || '[]');
    if (!paths.includes(path)) {
        paths.unshift(path);
        if (paths.length > 5) paths.pop(); // keep last 5
        localStorage.setItem('recent_paths', JSON.stringify(paths));
    }
}
```
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal state logic | Complex JS state machine | Simple CSS toggle class | Prevents layout bugs and simplifies backdrop clicks |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Hardcoded Left/Right Alignments
**What goes wrong:** Buttons or texts look reversed or out of place on RTL.
**Why it happens:** Using `text-align: right` or `margin-left` explicitly without checking directionality.
**How to avoid:** Use logical properties like `margin-inline-start`, or explicitly set `direction: rtl` in the body/parent.

### Pitfall 2: Table Overflow on Mobile/Small Screens
**What goes wrong:** Columns get squeezed and unreadable.
**Why it happens:** Large tables display too many columns at once.
**How to avoid:** Wrap the table in a container with `overflow-x: auto`.
</common_pitfalls>

<sources>
## Sources

### Primary (HIGH confidence)
- MDN Web Docs on logical CSS properties and CSS Grid/Flexbox.
- `mahakim_theme.md` compiled theme characteristics.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: HTML, CSS, JavaScript (RTL)
- Ecosystem: Vanilla Web
- Research date: 2026-07-06
- Valid until: 2026-08-06
</metadata>

---
*Phase: 02-rtl-web-interface-settings-panel*
*Research completed: 2026-07-06*
*Ready for planning: yes*

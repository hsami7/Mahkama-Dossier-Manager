document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const folderPathInput = document.getElementById('folderPath');
    const recentPathsList = document.getElementById('recentPathsList');
    const btnScan = document.getElementById('btnScan');
    const warningsContainer = document.getElementById('warningsContainer');
    const dossierCount = document.getElementById('dossierCount');
    const tableSearch = document.getElementById('tableSearch');
    const dossiersTableBody = document.getElementById('dossiersTableBody');
    const tabsWrapper = document.getElementById('tabsWrapper');
    const tabPending = document.getElementById('tabPending');
    const tabCompleted = document.getElementById('tabCompleted');
    const countPending = document.getElementById('countPending');
    const countCompleted = document.getElementById('countCompleted');
    const selectAll = document.getElementById('selectAll');
    const bulkActionsWrapper = document.getElementById('bulkActionsWrapper');
    
    // Landing & Auto Sync Elements
    const landingSection = document.getElementById('landingSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const btnAutoSync = document.getElementById('btnAutoSync');
    const btnAddYear = document.getElementById('btnAddYear');
    const syncYearsContainer = document.getElementById('syncYearsContainer');
    const btnReturnHome = document.getElementById('btnReturnHome');
    // Modal Elements
    const settingsModal = document.getElementById('settingsModal');
    const btnSettingsOpen = document.getElementById('btnSettingsOpen');
    const btnSettingsClose = document.getElementById('btnSettingsClose');
    const btnSettingsCancel = document.getElementById('btnSettingsCancel');
    
    // Logs Modal & Live Logs Elements
    const logsModal = document.getElementById('logsModal');
    const btnShowLogs = document.getElementById('btnShowLogs');
    const btnLogsClose = document.getElementById('btnLogsClose');
    const btnLogsModalClose = document.getElementById('btnLogsModalClose');
    const btnLogsClear = document.getElementById('btnLogsClear');
    const logsConsole = document.getElementById('logsConsole');
    const liveSyncLogsWrapper = document.getElementById('liveSyncLogsWrapper');
    const liveSyncLogs = document.getElementById('liveSyncLogs');
    const btnMinimizeLiveLogs = document.getElementById('btnMinimizeLiveLogs');
    const loadingOverlayText = document.getElementById('loadingOverlayText');
    
    // Alert Modal Elements
    const alertModal = document.getElementById('alertModal');
    const alertModalMessage = document.getElementById('alertModalMessage');
    const btnAlertOk = document.getElementById('btnAlertOk');
    const btnAlertClose = document.getElementById('btnAlertClose');
    
    const btnSettingsSave = document.getElementById('btnSettingsSave');
    const settingsForm = document.getElementById('settingsForm');

    // Folder Browser Elements
    const browseModal = document.getElementById('browseModal');
    const btnBrowse = document.getElementById('btnBrowse');
    const btnBrowseClose = document.getElementById('btnBrowseClose');
    const btnBrowseCancel = document.getElementById('btnBrowseCancel');
    const btnBrowseSelect = document.getElementById('btnBrowseSelect');
    const browseCurrentPath = document.getElementById('browseCurrentPath');
    const browseList = document.getElementById('browseList');

    let allDossiers = [];
    let currentBrowsePath = '';
    let currentTab = 'pending'; // 'pending' or 'completed'

    let operationRunning = false;
    const btnAbortOperation = document.getElementById('btnAbortOperation');
    if (btnAbortOperation) {
        btnAbortOperation.addEventListener('click', async () => {
            btnAbortOperation.disabled = true;
            btnAbortOperation.innerText = 'جاري الإلغاء...';
            if (loadingOverlayText) {
                loadingOverlayText.innerText = 'جاري إلغاء وإيقاف العملية، يرجى الانتظار...';
            }
            try {
                await fetch('/api/abort', { method: 'POST' });
            } catch (err) {
                console.error("Error aborting operation:", err);
            }
        });
    }

    // --- LocalStorage Recent Paths ---
    function loadRecentPaths() {
        const paths = JSON.parse(localStorage.getItem('recent_paths') || '[]');
        recentPathsList.innerHTML = '';
        paths.forEach(path => {
            const option = document.createElement('option');
            option.value = path;
            recentPathsList.appendChild(option);
        });
    }

    function saveRecentPath(path) {
        if (!path || !path.trim()) return;
        let paths = JSON.parse(localStorage.getItem('recent_paths') || '[]');
        paths = paths.filter(p => p !== path);
        paths.unshift(path);
        if (paths.length > 10) paths.pop(); // Keep last 10
        localStorage.setItem('recent_paths', JSON.stringify(paths));
        loadRecentPaths();
    }

    // --- DOM Variables for new features ---
    const filtersBar = document.getElementById('filtersBar');
    const filterCategory = document.getElementById('filterCategory');
    const filterUrgency = document.getElementById('filterUrgency');
    const filterDaysMin = document.getElementById('filterDaysMin');
    const filterDaysMax = document.getElementById('filterDaysMax');
    const btnApplyFilters = document.getElementById('btnApplyFilters');
    const btnClearFilters = document.getElementById('btnClearFilters');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    // --- Scroll to Top Logic ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            scrollToTopBtn.style.display = 'block';
        } else {
            scrollToTopBtn.style.display = 'none';
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Table Rendering Helpers ---
    function showSkeleton(rowsCount = 5) {
        dossiersTableBody.innerHTML = '';
        for (let i = 0; i < rowsCount; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            const td = document.createElement('td');
            td.colSpan = 12;
            if (i === 0) {
                td.className = 'skeleton-placeholder';
                td.textContent = 'جاري مسح ومعالجة الملفات... يرجى الانتظار...';
            }
            tr.appendChild(td);
            dossiersTableBody.appendChild(tr);
        }
    }

    function renderDossiers(dossiers) {
        dossiersTableBody.innerHTML = '';
        if (dossiers.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 12;
            td.style.textAlign = 'center';
            td.style.padding = '30px';
            td.style.color = '#6c757d';
            if (currentTab === 'pending') {
                td.textContent = 'لا توجد قضايا جارية معلقة حالياً 🎉';
            } else {
                td.textContent = 'لا توجد قضايا منجزة بعد.';
            }
            tr.appendChild(td);
            dossiersTableBody.appendChild(tr);
            return;
        }

        dossiers.forEach(dos => {
            const tr = document.createElement('tr');
            // Color row based on urgency status or completion
            if (dos.completed) {
                tr.classList.add('row-completed');
            } else {
                if (dos.color === 'red') tr.classList.add('row-red');
                else if (dos.color === 'orange') tr.classList.add('row-orange');
                else if (dos.color === 'green') tr.classList.add('row-green');
            }

            // Map urgency color to Arabic status badges
            let badgeClass = 'badge-green';
            if (dos.color === 'red') badgeClass = 'badge-red';
            else if (dos.color === 'orange') badgeClass = 'badge-orange';

            tr.innerHTML = `
                <td><strong>${dos.number}</strong></td>
                <td><span class="badge ${badgeClass}">${dos.full_code}</span></td>
                <td>${dos.category}</td>
                <td>
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; margin: 0;">
                        <input type="checkbox" class="toggle-complete-checkbox" data-filepath="${dos.file_path}" data-fullcode="${dos.full_code}" ${dos.completed ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;">
                        <span style="font-weight: bold; color: ${dos.completed ? 'var(--mahakim-text-secondary)' : 'var(--mahakim-primary)'};">${dos.completed ? '✔️ مكتمل' : '⏳ معلق'}</span>
                    </label>
                </td>
                <td>${dos.reg_date}</td>
                <td>${dos.expiry_date}</td>
                <td><span dir="ltr" style="display: inline-block;">${dos.days_remaining === 9999 ? 'غير محدد' : dos.days_remaining}</span></td>
                <td>${dos.urgency_text}</td>
                <td>${dos.judge || 'غير معين'}</td>
                <td style="max-width: 200px;" title="${dos.appellant || ''}"><div class="truncate-text">${dos.appellant || '-'}</div></td>
                <td style="max-width: 200px;" title="${dos.appellee || ''}"><div class="truncate-text">${dos.appellee || '-'}</div></td>
                <td>${dos.case_type || '-'}</td>
            `;
            dossiersTableBody.appendChild(tr);
        });

        // Bind toggle completion checkboxes
        const checkboxes = dossiersTableBody.querySelectorAll('.toggle-complete-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const filePath = e.target.getAttribute('data-filepath');
                const fullCode = e.target.getAttribute('data-fullcode');
                const completed = e.target.checked;
                
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) overlay.style.display = 'flex';
                cb.disabled = true;

                try {
                    const res = await fetch('/api/toggle-complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file_path: filePath, full_code: fullCode, completed: completed })
                    });
                    if (res.ok) {
                        // Update local status for JUST this dossier
                        allDossiers.forEach(d => {
                            if (d.file_path === filePath && d.full_code === fullCode) {
                                d.completed = completed;
                            }
                        });
                        filterAndRenderDossiers();
                    } else {
                        showAlert('تعذر تحديث حالة إنجاز الملف.');
                        e.target.checked = !completed; // Revert
                    }
                } catch (error) {
                    showAlert('خطأ في الاتصال بالخادم.');
                    e.target.checked = !completed; // Revert
                } finally {
                    if (overlay) overlay.style.display = 'none';
                    cb.disabled = false;
                }
            });
        });
    }

    function renderWarnings(warnings) {
        if (!warnings || warnings.length === 0) {
            warningsContainer.style.display = 'none';
            warningsContainer.innerHTML = '';
            return;
        }

        warningsContainer.innerHTML = '';
        warningsContainer.style.display = 'flex';
        
        warnings.forEach(warn => {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'warning-alert';
            alertDiv.innerHTML = `⚠️ <span>${warn}</span>`;
            warningsContainer.appendChild(alertDiv);
        });
    }

    // --- API Interactions ---
    async function performScan(targetYears = null) {
        const path = folderPathInput.value.trim();
        if (!path) {
            showAlert('يرجى كتابة أو اختيار مسار مجلد أولاً.');
            return;
        }

        showSkeleton();
        btnScan.disabled = true;

        try {
            const bodyData = { directory: path };
            if (targetYears && targetYears.length > 0) {
                bodyData.target_years = targetYears;
            }
            
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'فشلت عملية مسح المجلد.');
            }

            const result = await response.json();
            allDossiers = result.dossiers;
            
            if (allDossiers.length === 0) {
                // Determine if we searched manually or synced
                const contextMsg = targetYears ? `السنوات (${targetYears.join(', ')})` : 'هذا المجلد';
                showAlert(`لم يتم العثور على أية قضايا في ${contextMsg}. قد يكون المسار فارغاً أو لا توجد ملفات متوافقة.`);
                hideSkeleton();
                if (landingSection && dashboardSection) {
                    landingSection.style.display = 'block';
                    dashboardSection.style.display = 'none';
                }
                btnScan.disabled = false;
                return;
            }
            
            // Populate category filter dropdown
            const categories = new Set(allDossiers.map(d => d.category));
            filterCategory.innerHTML = '<option value="all">الكل</option>';
            [...categories].filter(Boolean).sort().forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = `الفئة ${cat}`;
                filterCategory.appendChild(opt);
            });
            
            saveRecentPath(path);
            filterAndRenderDossiers();
            renderWarnings(result.warnings);
            
            dossierCount.textContent = `إجمالي الملفات: ${allDossiers.length}`;
            
            // Show search bar and filters if there are records
            tableSearch.style.display = allDossiers.length > 0 ? 'block' : 'none';
            tabsWrapper.style.display = allDossiers.length > 0 ? 'flex' : 'none';
            if(filtersBar) filtersBar.style.display = allDossiers.length > 0 ? 'flex' : 'none';
            
            // Show Dashboard, Hide Landing
            if (landingSection && dashboardSection) {
                landingSection.style.display = 'none';
                dashboardSection.style.display = 'block';
            }
            
        } catch (error) {
            dossiersTableBody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: #dc3545; padding: 30px;">
                        ❌ خطأ في المعالجة: ${error.message}
                    </td>
                </tr>
            `;
        } finally {
            btnScan.disabled = false;
        }
    }

    // --- Filter & Search Logic ---
    function hideSkeleton() {
        dossiersTableBody.innerHTML = '';
    }

    function filterAndRenderDossiers() {
        const query = tableSearch.value.toLowerCase().trim();
        const catFilter = filterCategory.value;
        const urgFilter = filterUrgency.value;
        const minDays = filterDaysMin.value !== '' ? parseInt(filterDaysMin.value, 10) : null;
        const maxDays = filterDaysMax.value !== '' ? parseInt(filterDaysMax.value, 10) : null;
        
        // Update tab badges with count metrics
        const pendingCount = allDossiers.filter(d => !d.completed).length;
        const completedCount = allDossiers.filter(d => d.completed).length;
        
        countPending.textContent = pendingCount;
        countCompleted.textContent = completedCount;
        
        let filtered = allDossiers;
        
        // Tab router
        if (currentTab === 'pending') {
            filtered = filtered.filter(dos => !dos.completed);
        } else {
            filtered = filtered.filter(dos => dos.completed);
        }
        
        // Text Query search (forward and reverse sequence parsing)
        if (query) {
            filtered = filtered.filter(dos => {
                if (!dos.full_code) return false;
                
                // 1. Standard forward match
                const normalizedQuery = query.replace(/-/g, '/');
                const normalizedDos = dos.full_code.toLowerCase().replace(/-/g, '/');
                if (normalizedDos.includes(normalizedQuery)) return true;
                
                // 2. Reverse typing match (Seq/Category/Year)
                // Extract pure Year, Category, Sequence from dos.full_code using Regex
                const match = dos.full_code.match(/(\d{4})[/\-](\d{3,4})[/\-](\d+)/);
                const qParts = normalizedQuery.split('/'); // User types Seq/Cat/Year
                
                if (match) {
                    const dYear = match[1];
                    const dCat = match[2];
                    const dSeq = match[3];
                    
                    let revMatch = true;
                    // Check Seq
                    if (qParts.length > 0 && qParts[0]) {
                        revMatch = revMatch && dSeq.includes(qParts[0]);
                    }
                    // Check Cat
                    if (qParts.length > 1 && qParts[1]) {
                        revMatch = revMatch && dCat.includes(qParts[1]);
                    }
                    // Check Year
                    if (qParts.length > 2 && qParts[2]) {
                        revMatch = revMatch && dYear.includes(qParts[2]);
                    }
                    
                    if (revMatch) return true;
                }
                
                return false;
            });
        }

        // Apply UI Filters
        if (catFilter !== 'all') {
            filtered = filtered.filter(dos => dos.category === catFilter);
        }
        
        if (urgFilter !== 'all') {
            filtered = filtered.filter(dos => dos.color === urgFilter);
        }
        
        if (minDays !== null) {
            filtered = filtered.filter(dos => dos.days_remaining !== 9999 && dos.days_remaining >= minDays);
        }
        
        if (maxDays !== null) {
            filtered = filtered.filter(dos => dos.days_remaining !== 9999 && dos.days_remaining <= maxDays);
        }
        
        // Show bulk actions bar if there are scanned dossiers
        if (allDossiers.length > 0) {
            bulkActionsWrapper.style.display = 'block';
        } else {
            bulkActionsWrapper.style.display = 'none';
        }

        // Set selectAll check state dynamically based on if all visible files are completed
        selectAll.checked = filtered.length > 0 && filtered.every(dos => dos.completed);
        renderDossiers(filtered);
    }

    // Debounce helper to prevent hanging when typing quickly
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    tableSearch.addEventListener('input', debounce(filterAndRenderDossiers, 250));
    if(btnApplyFilters) btnApplyFilters.addEventListener('click', filterAndRenderDossiers);
    
    if(btnClearFilters) {
        btnClearFilters.addEventListener('click', () => {
            tableSearch.value = '';
            filterCategory.value = 'all';
            filterUrgency.value = 'all';
            filterDaysMin.value = '';
            filterDaysMax.value = '';
            filterAndRenderDossiers();
        });
    }
    
    // Tab event switchers
    tabPending.addEventListener('click', () => {
        currentTab = 'pending';
        tabPending.classList.add('active');
        tabCompleted.classList.remove('active');
        // Clear filters on tab switch
        tableSearch.value = '';
        filterCategory.value = 'all';
        filterUrgency.value = 'all';
        filterDaysMin.value = '';
        filterDaysMax.value = '';
        filterAndRenderDossiers();
    });

    tabCompleted.addEventListener('click', () => {
        currentTab = 'completed';
        tabCompleted.classList.add('active');
        tabPending.classList.remove('active');
        // Clear filters on tab switch
        tableSearch.value = '';
        filterCategory.value = 'all';
        filterUrgency.value = 'all';
        filterDaysMin.value = '';
        filterDaysMax.value = '';
        filterAndRenderDossiers();
    });

    // --- Custom Alert Logic ---
    function showAlert(message) {
        if (!alertModal) {
            alert(message);
            return;
        }
        alertModalMessage.innerHTML = message.replace(/\n/g, '<br>');
        alertModal.style.display = 'flex';
        
        return new Promise((resolve) => {
            const cleanup = () => {
                alertModal.style.display = 'none';
                if (btnAlertOk) btnAlertOk.removeEventListener('click', okHandler);
                if (btnAlertClose) btnAlertClose.removeEventListener('click', okHandler);
                resolve();
            };
            
            const okHandler = () => { cleanup(); };
            
            if (btnAlertOk) btnAlertOk.addEventListener('click', okHandler);
            if (btnAlertClose) btnAlertClose.addEventListener('click', okHandler);
        });
    }

    // --- Custom Confirm Logic ---
    // Helper returning a Promise
    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const messageEl = document.getElementById('confirmModalMessage');
            const btnYes = document.getElementById('btnConfirmYes');
            const btnNo = document.getElementById('btnConfirmNo');
            const btnClose = document.getElementById('btnConfirmClose');
            
            messageEl.textContent = message;
            modal.style.display = 'flex';
            
            function cleanup(result) {
                modal.style.display = 'none';
                btnYes.removeEventListener('click', onYes);
                btnNo.removeEventListener('click', onNo);
                btnClose.removeEventListener('click', onNo);
                resolve(result);
            }
            
            function onYes() { cleanup(true); }
            function onNo() { cleanup(false); }
            
            btnYes.addEventListener('click', onYes);
            btnNo.addEventListener('click', onNo);
            btnClose.addEventListener('click', onNo);
        });
    }

    // Select/Unselect All visible dossiers (bulk version with confirmation)
    selectAll.addEventListener('change', async (e) => {
        const completed = e.target.checked;
        const checkboxes = dossiersTableBody.querySelectorAll('.toggle-complete-checkbox');
        if (checkboxes.length === 0) {
            e.target.checked = !completed;
            return;
        }

        // Show custom confirmation popup
        const confirmMsg = completed 
            ? "هل أنت متأكد من رغبتك في تحديد جميع القضايا المعروضة كمنجزة؟"
            : "هل أنت متأكد من رغبتك في إلغاء تحديد جميع القضايا المعروضة وإعادتها كقضايا جارية؟";

        const confirmed = await showCustomConfirm(confirmMsg);
        if (!confirmed) {
            e.target.checked = !completed; // Revert
            return;
        }

        selectAll.disabled = true;
        checkboxes.forEach(cb => cb.disabled = true);

        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'flex';

        const items = Array.from(checkboxes).map(cb => ({
            file_path: cb.getAttribute('data-filepath'),
            full_code: cb.getAttribute('data-fullcode')
        }));

        try {
            const res = await fetch('/api/toggle-complete-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items, completed: completed })
            });
            if (res.ok) {
                // Update local list
                const itemKeys = new Set(items.map(i => i.file_path + '|' + i.full_code));
                allDossiers.forEach(d => {
                    if (itemKeys.has(d.file_path + '|' + d.full_code)) {
                        d.completed = completed;
                    }
                });
            }
        } catch (err) {
            console.error("Error bulk toggling files:", err);
            showAlert("حدث خطأ أثناء معالجة الملفات. يرجى المحاولة مرة أخرى.");
        } finally {
            if (overlay) overlay.style.display = 'none';
            selectAll.disabled = false;
            filterAndRenderDossiers();
        }
    });

    // --- Settings Modal Logic ---
    const tabLimits = document.getElementById('tabLimits');
    const tabThresholds = document.getElementById('tabThresholds');
    const contentLimits = document.getElementById('settingsContentLimits');
    const contentThresholds = document.getElementById('settingsContentThresholds');
    const formLimits = document.getElementById('settingsFormLimits');
    const formThresholds = document.getElementById('settingsFormThresholds');

    if(tabLimits && tabThresholds) {
        tabLimits.addEventListener('click', () => {
            tabLimits.classList.add('active');
            tabLimits.style.background = 'var(--mahakim-primary)';
            tabLimits.style.color = 'white';
            tabLimits.style.border = 'none';
            
            tabThresholds.classList.remove('active');
            tabThresholds.style.background = '#f8fafc';
            tabThresholds.style.color = 'var(--mahakim-text)';
            tabThresholds.style.border = '1px solid #cbd5e1';
            
            contentLimits.style.display = 'block';
            contentThresholds.style.display = 'none';
        });

        tabThresholds.addEventListener('click', () => {
            tabThresholds.classList.add('active');
            tabThresholds.style.background = 'var(--mahakim-primary)';
            tabThresholds.style.color = 'white';
            tabThresholds.style.border = 'none';
            
            tabLimits.classList.remove('active');
            tabLimits.style.background = '#f8fafc';
            tabLimits.style.color = 'var(--mahakim-text)';
            tabLimits.style.border = '1px solid #cbd5e1';
            
            contentThresholds.style.display = 'block';
            contentLimits.style.display = 'none';
        });
    }

    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            
            const formLimits = document.getElementById('settingsFormLimits');
            const formThresholds = document.getElementById('settingsFormThresholds');
            
            if (!formLimits || !formThresholds) return;
            
            formLimits.innerHTML = '';
            formThresholds.innerHTML = '';
            
            for (let i = 7201; i <= 7215; i++) {
                const code = i.toString();
                const codeSet = settings[code] || {limit: 30, red: 5, orange: 15};
                
                const groupLim = document.createElement('div');
                groupLim.className = 'input-group';
                groupLim.innerHTML = `
                    <label for="limit_${code}">الفئة ${code} (الأقصى):</label>
                    <input type="number" id="limit_${code}" data-code="${code}" data-type="limit" value="${codeSet.limit}" min="1" required style="width:100%; padding:8px; border:1px solid #dfe7ef; border-radius:4px;">
                `;
                formLimits.appendChild(groupLim);

                const groupThresh = document.createElement('div');
                groupThresh.className = 'input-group';
                groupThresh.style.border = '1px solid #e2e8f0';
                groupThresh.style.padding = '10px';
                groupThresh.style.borderRadius = '6px';
                groupThresh.style.background = 'white';
                groupThresh.innerHTML = `
                    <div style="font-weight:bold; margin-bottom:8px;">الفئة ${code}</div>
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; color:#dc3545;">أحمر (أيام):</label>
                            <input type="number" data-code="${code}" data-type="red" value="${codeSet.red}" min="1" required style="width:100%; padding:6px; border:1px solid #dfe7ef; border-radius:4px;">
                        </div>
                    </div>
                `;
                formThresholds.appendChild(groupThresh);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showAlert("تعذر تحميل الإعدادات: " + error.message);
        }
    }

    async function saveSettings(e) {
        e.preventDefault();
        const updated = {};
        for (let i = 7201; i <= 7215; i++) {
            updated[i.toString()] = {limit: 30, red: 5, orange: 15};
        }

        const formLimits = document.getElementById('settingsFormLimits');
        const formThresholds = document.getElementById('settingsFormThresholds');
        
        if (!formLimits || !formThresholds) return;

        const inputsLimits = formLimits.querySelectorAll('input[type="number"]');
        const inputsThresh = formThresholds.querySelectorAll('input[type="number"]');
        
        inputsLimits.forEach(input => {
            updated[input.getAttribute('data-code')].limit = parseInt(input.value, 10);
        });
        inputsThresh.forEach(input => {
            updated[input.getAttribute('data-code')][input.getAttribute('data-type')] = parseInt(input.value, 10);
        });

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });

            if (response.ok) {
                const settingsModal = document.getElementById('settingsModal');
                if (settingsModal) settingsModal.style.display = 'none';
                
                const folderPathInput = document.getElementById('folderPath');
                if (folderPathInput && folderPathInput.value.trim()) {
                    const btnScan = document.getElementById('btnScan');
                    if (btnScan) btnScan.click();
                } else {
                    showAlert('تم حفظ الإعدادات بنجاح!');
                }
            } else {
                showAlert('حدث خطأ أثناء حفظ الإعدادات.');
            }
        } catch (error) {
            showAlert('تعذر الاتصال بالخادم لحفظ الإعدادات.');
        }
    }

    // Modal Event Bindings
    btnSettingsOpen.addEventListener('click', () => {
        loadSettings();
        settingsModal.style.display = 'flex';
    });

    btnSettingsClose.addEventListener('click', () => settingsModal.style.display = 'none');
    btnSettingsCancel.addEventListener('click', () => settingsModal.style.display = 'none');
    btnSettingsSave.addEventListener('click', saveSettings);
    
    // Close modal on background click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // --- Directory Browser Logic ---
    async function loadDirectory(path) {
        try {
            const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : '/api/browse';
            const response = await fetch(url);
            const data = await response.json();
            
            currentBrowsePath = data.current_path;
            browseCurrentPath.textContent = `المسار الحالي: ${data.current_path}`;
            browseList.innerHTML = '';
            
            // Add parent directory row (Up)
            if (data.parent_path) {
                const parentRow = document.createElement('div');
                parentRow.className = 'browse-folder-row parent-dir';
                parentRow.innerHTML = `<span class="folder-icon">⬅️</span> <span class="folder-name">رجوع</span>`;
                parentRow.addEventListener('click', () => loadDirectory(data.parent_path));
                browseList.appendChild(parentRow);
            }
            
            if (data.directories.length === 0) {
                const empty = document.createElement('div');
                empty.style.padding = '15px';
                empty.style.textAlign = 'center';
                empty.style.color = '#6c757d';
                empty.textContent = 'لا توجد مجلدات فرعية هنا.';
                browseList.appendChild(empty);
                return;
            }
            
            data.directories.forEach(dir => {
                const row = document.createElement('div');
                row.className = 'browse-folder-row';
                row.innerHTML = `<span class="folder-icon">📁</span> <span class="folder-name">${dir.name}</span>`;
                row.addEventListener('click', () => loadDirectory(dir.path));
                browseList.appendChild(row);
            });
        } catch (error) {
            browseList.innerHTML = `<div style="padding: 15px; color: #dc3545; text-align: center;">❌ تعذر تحميل المجلد: ${error.message}</div>`;
        }
    }

    btnBrowse.addEventListener('click', async () => {
        btnBrowse.disabled = true;
        try {
            const response = await fetch('/api/select-folder', { method: 'POST' });
            const data = await response.json();
            if (data.path) {
                folderPathInput.value = data.path;
            } else if (data.error) {
                showAlert(data.error);
            }
        } catch (error) {
            showAlert('تعذر الاتصال بخدمة اختيار المجلد.');
        } finally {
            btnBrowse.disabled = false;
        }
    });

    const btnOpenFolder = document.getElementById('btnOpenFolder');
    if (btnOpenFolder) {
        btnOpenFolder.addEventListener('click', async () => {
            const folderPath = folderPathInput ? folderPathInput.value.trim() : "";
            try {
                const res = await fetch('/api/open-workspace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory: folderPath })
                });
                const data = await res.json();
                if (data.error) {
                    showAlert(data.error);
                }
            } catch (err) {
                showAlert('فشل في فتح المجلد.');
            }
        });
    }

    // Scan Event Binding
    btnScan.addEventListener('click', performScan);
    
    if (btnReturnHome) {
        btnReturnHome.addEventListener('click', () => {
            if (landingSection && dashboardSection) {
                landingSection.style.display = 'block';
                dashboardSection.style.display = 'none';
            }
        });
    }
    
    // Allow scan on Enter key
    folderPathInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performScan();
        }
    });

    // Handle Auto Sync
    if (btnAddYear && syncYearsContainer) {
        const allPossibleYears = ["2026", "2025", "2024"];
        
        const updateYearOptions = () => {
            const selects = Array.from(syncYearsContainer.querySelectorAll('.sync-year-select'));
            const currentSelections = selects.map(s => s.value);
            
            selects.forEach((select, index) => {
                const currentValue = select.value;
                const otherSelections = currentSelections.filter((_, i) => i !== index);
                const availableYears = allPossibleYears.filter(y => !otherSelections.includes(y));
                
                select.innerHTML = '';
                availableYears.forEach(year => {
                    const opt = document.createElement('option');
                    opt.value = year;
                    opt.textContent = year;
                    if (year === currentValue) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });
                
                if (!availableYears.includes(currentValue) && availableYears.length > 0) {
                    select.value = availableYears[0];
                }
            });
            
            if (selects.length >= allPossibleYears.length) {
                btnAddYear.disabled = true;
                btnAddYear.style.opacity = '0.5';
                btnAddYear.style.cursor = 'not-allowed';
            } else {
                btnAddYear.disabled = false;
                btnAddYear.style.opacity = '1';
                btnAddYear.style.cursor = 'pointer';
            }
        };

        const bindSelectChange = (select) => {
            select.addEventListener('change', updateYearOptions);
        };

        // Bind initially existing select(s)
        syncYearsContainer.querySelectorAll('.sync-year-select').forEach(bindSelectChange);

        btnAddYear.addEventListener('click', () => {
            const firstRow = syncYearsContainer.querySelector('.sync-year-row');
            if (firstRow) {
                const newRow = firstRow.cloneNode(true);
                const select = newRow.querySelector('.sync-year-select');
                
                // Add delete button if it doesn't exist
                let delBtn = newRow.querySelector('.remove-year-btn');
                if (!delBtn) {
                    delBtn = document.createElement('button');
                    delBtn.className = 'remove-year-btn';
                    delBtn.style.cssText = 'background: #ef4444; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;';
                    delBtn.innerText = 'X';
                    newRow.appendChild(delBtn);
                }
                
                delBtn.onclick = () => {
                    newRow.remove();
                    updateYearOptions();
                };
                
                syncYearsContainer.appendChild(newRow);
                bindSelectChange(select);
                
                // Assign first available year to the new select
                const currentSelects = Array.from(syncYearsContainer.querySelectorAll('.sync-year-select'));
                const selectedYears = currentSelects.slice(0, -1).map(s => s.value);
                const firstAvailable = allPossibleYears.find(y => !selectedYears.includes(y));
                if (firstAvailable) {
                    select.value = firstAvailable;
                }
                
                updateYearOptions();
            }
        });

        // Run initially to set the button state
        updateYearOptions();
    }

    let pollInterval = null;
    let lastLogCount = 0;

    function startSyncPolling(uniqueYears, originalText) {
        lastLogCount = 0;
        if (liveSyncLogs) {
            liveSyncLogs.innerHTML = '';
            liveSyncLogs.style.display = 'block';
        }
        if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'block';
        if (btnMinimizeLiveLogs) btnMinimizeLiveLogs.innerText = '⬇️ إخفاء التفاصيل';
        
        pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/sync/status');
                const data = await res.json();
                
                // Append new logs
                if (data.logs && data.logs.length > lastLogCount) {
                    const newLogs = data.logs.slice(lastLogCount);
                    newLogs.forEach(logLine => {
                        const div = document.createElement('div');
                        div.textContent = logLine;
                        if (logLine.includes('[-]')) {
                            div.style.color = '#f87171';
                        } else if (logLine.includes('[+]')) {
                            div.style.color = '#4ade80';
                        }
                        if (liveSyncLogs) liveSyncLogs.appendChild(div);
                        
                        // Also append to global history console
                        const historyDiv = document.createElement('div');
                        historyDiv.textContent = logLine;
                        if (logLine.includes('[-]')) historyDiv.style.color = '#f87171';
                        else if (logLine.includes('[+]')) historyDiv.style.color = '#4ade80';
                        if (logsConsole) logsConsole.appendChild(historyDiv);
                    });
                    lastLogCount = data.logs.length;
                    if (liveSyncLogs) liveSyncLogs.scrollTop = liveSyncLogs.scrollHeight;
                    if (logsConsole) logsConsole.scrollTop = logsConsole.scrollHeight;
                }
                
                if (!data.active) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    operationRunning = false;
                    
                    const overlay = document.getElementById('loadingOverlay');
                    
                    if (data.directory) {
                        folderPathInput.value = data.directory;
                        if (loadingOverlayText) loadingOverlayText.innerText = 'جاري قراءة ومعالجة الملفات...';
                        
                        await performScan(data.years);
                    } else {
                        showAlert('فشلت عملية المزامنة أو لم يتم تحميل أي ملفات.');
                    }
                    
                    if (overlay) overlay.style.display = 'none';
                    if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'none';
                    btnAutoSync.disabled = false;
                    btnAutoSync.innerText = originalText;
                }
            } catch (err) {
                console.error("Error polling sync status:", err);
            }
        }, 1000);
    }

    if (btnAutoSync) {
        btnAutoSync.addEventListener('click', async () => {
            if (operationRunning) return;
            
            const selects = document.querySelectorAll('.sync-year-select');
            const years = Array.from(selects).map(s => s.value.trim()).filter(y => y);
            const uniqueYears = [...new Set(years)];
            
            if (uniqueYears.length === 0) {
                showAlert('الرجاء إدخال سنة واحدة على الأقل.');
                return;
            }
            
            operationRunning = true;
            if (btnAbortOperation) {
                btnAbortOperation.disabled = false;
                btnAbortOperation.innerText = '🛑 إلغاء وإيقاف العملية جارية';
            }
            
            btnAutoSync.disabled = true;
            const originalText = btnAutoSync.innerText;
            btnAutoSync.innerText = 'جاري المزامنة...';

            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                if (loadingOverlayText) {
                    loadingOverlayText.innerText = 'جاري المزامنة مع بوابة المحاكم تلقائياً...';
                }
            }
            
            try {
                const folderPath = folderPathInput ? folderPathInput.value.trim() : "";
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ years: uniqueYears, directory: folderPath })
                });
                const data = await res.json();
                
                if (data.error) {
                    showAlert(data.error);
                    if (overlay) overlay.style.display = 'none';
                    btnAutoSync.disabled = false;
                    btnAutoSync.innerText = originalText;
                    operationRunning = false;
                } else if (data.success) {
                    startSyncPolling(uniqueYears, originalText);
                }
            } catch (error) {
                showAlert('حدث خطأ أثناء الاتصال بالخادم لمزامنة السجلات.');
                if (overlay) overlay.style.display = 'none';
                btnAutoSync.disabled = false;
                btnAutoSync.innerText = originalText;
                operationRunning = false;
            }
        });
    }

    // Modal Event Bindings for Logs
    if (btnShowLogs) {
        btnShowLogs.addEventListener('click', async () => {
            if (logsModal) logsModal.style.display = 'flex';
            if (logsConsole) {
                logsConsole.innerHTML = 'جاري تحميل سجل العمليات...';
                try {
                    const res = await fetch('/api/logs');
                    const data = await res.json();
                    if (data.logs) {
                        logsConsole.innerHTML = '';
                        data.logs.forEach(logLine => {
                            const div = document.createElement('div');
                            div.textContent = logLine;
                            if (logLine.includes('[-]')) {
                                div.style.color = '#f87171';
                            } else if (logLine.includes('[+]')) {
                                div.style.color = '#4ade80';
                            }
                            logsConsole.appendChild(div);
                        });
                        logsConsole.scrollTop = logsConsole.scrollHeight;
                    }
                } catch (err) {
                    logsConsole.innerHTML = '❌ خطأ في تحميل السجل من الخادم.';
                }
            }
        });
    }

    const closeLogsModal = () => {
        if (logsModal) logsModal.style.display = 'none';
    };
    if (btnLogsClose) btnLogsClose.addEventListener('click', closeLogsModal);
    if (btnLogsModalClose) btnLogsModalClose.addEventListener('click', closeLogsModal);
    
    if (btnLogsClear) {
        btnLogsClear.addEventListener('click', async () => {
            if (logsConsole) logsConsole.innerHTML = 'جاري مسح سجل العمليات...';
            try {
                await fetch('/api/logs/clear', { method: 'POST' });
                if (logsConsole) logsConsole.innerHTML = '';
            } catch (err) {
                showAlert('فشل في مسح سجل العمليات على الخادم.');
            }
        });
    }
    
    const btnLogsCopy = document.getElementById('btnLogsCopy');
    if (btnLogsCopy) {
        btnLogsCopy.addEventListener('click', () => {
            if (logsConsole) {
                const text = logsConsole.innerText;
                navigator.clipboard.writeText(text).then(() => {
                    showAlert('تم نسخ سجل العمليات إلى الحافظة بنجاح! 📋');
                }).catch(err => {
                    // Fallback
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        showAlert('تم نسخ سجل العمليات إلى الحافظة بنجاح! 📋');
                    } catch (e) {
                        showAlert('فشل في نسخ السجل.');
                    }
                    document.body.removeChild(textArea);
                });
            }
        });
    }
    
    if (logsModal) {
        logsModal.addEventListener('click', (e) => {
            if (e.target === logsModal) {
                logsModal.style.display = 'none';
            }
        });
    }

    if (btnMinimizeLiveLogs && liveSyncLogs) {
        btnMinimizeLiveLogs.addEventListener('click', () => {
            if (liveSyncLogs.style.display === 'none') {
                liveSyncLogs.style.display = 'block';
                btnMinimizeLiveLogs.innerText = '⬇️ إخفاء التفاصيل';
            } else {
                liveSyncLogs.style.display = 'none';
                btnMinimizeLiveLogs.innerText = '⬆️ عرض التفاصيل';
            }
        });
    }

    // --- Statistics Calculations Handler ---
    const btnCalculateStats = document.getElementById('btnCalculateStats');
    const statsResultModal = document.getElementById('statsResultModal');
    const btnStatsResultClose = document.getElementById('btnStatsResultClose');
    const btnStatsResultCloseOk = document.getElementById('btnStatsResultCloseOk');
    const btnStatsCopyReport = document.getElementById('btnStatsCopyReport');

    let statsPollInterval = null;
    let lastStatsLogCount = 0;

    function startStatsPolling(year, originalText) {
        lastStatsLogCount = 0;
        if (liveSyncLogs) {
            liveSyncLogs.innerHTML = '';
            liveSyncLogs.style.display = 'block';
        }
        if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'block';
        if (btnMinimizeLiveLogs) btnMinimizeLiveLogs.innerText = '⬇️ إخفاء التفاصيل';
        
        statsPollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/calculate-stats/status');
                const data = await res.json();
                
                // Append new logs
                if (data.logs && data.logs.length > lastStatsLogCount) {
                    const newLogs = data.logs.slice(lastStatsLogCount);
                    newLogs.forEach(logLine => {
                        const div = document.createElement('div');
                        div.textContent = logLine;
                        if (logLine.includes('[-]')) {
                            div.style.color = '#f87171';
                        } else if (logLine.includes('[+]')) {
                            div.style.color = '#4ade80';
                        }
                        if (liveSyncLogs) liveSyncLogs.appendChild(div);
                        
                        // Also append to global history console
                        const historyDiv = document.createElement('div');
                        historyDiv.textContent = logLine;
                        if (logLine.includes('[-]')) historyDiv.style.color = '#f87171';
                        else if (logLine.includes('[+]')) historyDiv.style.color = '#4ade80';
                        if (logsConsole) logsConsole.appendChild(historyDiv);
                    });
                    lastStatsLogCount = data.logs.length;
                    if (liveSyncLogs) liveSyncLogs.scrollTop = liveSyncLogs.scrollHeight;
                    if (logsConsole) logsConsole.scrollTop = logsConsole.scrollHeight;
                }
                
                if (!data.active) {
                    clearInterval(statsPollInterval);
                    statsPollInterval = null;
                    operationRunning = false;
                    
                    const overlay = document.getElementById('loadingOverlay');
                    if (overlay) overlay.style.display = 'none';
                    if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'none';
                    
                    btnCalculateStats.disabled = false;
                    btnCalculateStats.innerText = originalText;
                    
                    if (data.result) {
                        // Populate modal values
                        document.getElementById('statsYearTitle').textContent = year;
                        document.querySelectorAll('.statsYearLabel').forEach(el => el.textContent = year);
                        
                        document.getElementById('statRegistered').textContent = data.result.registered;
                        document.getElementById('statActive').textContent = data.result.active;
                        document.getElementById('statCompleted').textContent = data.result.completed;
                        document.getElementById('statClosed').textContent = data.result.closed;
                        document.getElementById('statRemaining').textContent = data.result.remaining;
                        
                        document.getElementById('statsStartDate').textContent = data.result.start_date || '--';
                        document.getElementById('statsEndDate').textContent = data.result.end_date || '--';
                        
                        if (statsResultModal) statsResultModal.style.display = 'flex';
                    } else {
                        showAlert('حدث خطأ أثناء احتساب الإحصائيات. يرجى مراجعة سجل العمليات.');
                    }
                }
            } catch (err) {
                console.error("Error polling stats status:", err);
            }
        }, 1000);
    }

    if (btnCalculateStats) {
        btnCalculateStats.addEventListener('click', async () => {
            if (operationRunning) return;
            
            const yearSelect = document.getElementById('statsYearSelect');
            const optionSelect = document.getElementById('statsOptionSelect');
            const folderPath = folderPathInput ? folderPathInput.value.trim() : "";
            
            const year = yearSelect ? yearSelect.value : "2026";
            const option = optionSelect ? optionSelect.value : "مكتب الخبرة";
            
            operationRunning = true;
            if (btnAbortOperation) {
                btnAbortOperation.disabled = false;
                btnAbortOperation.innerText = '🛑 إلغاء وإيقاف العملية جارية';
            }
            
            btnCalculateStats.disabled = true;
            const originalText = btnCalculateStats.innerText;
            btnCalculateStats.innerText = 'جاري الاحتساب...';
            
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                if (loadingOverlayText) {
                    loadingOverlayText.innerText = 'جاري الاتصال وسحب الملفات واحتساب إحصائيات الخبرة...';
                }
            }
            
            try {
                const res = await fetch('/api/calculate-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ year: year, option: option, directory: folderPath })
                });
                const data = await res.json();
                
                if (data.error) {
                    showAlert(data.error);
                    if (overlay) overlay.style.display = 'none';
                    btnCalculateStats.disabled = false;
                    btnCalculateStats.innerText = originalText;
                    operationRunning = false;
                } else if (data.success) {
                    startStatsPolling(year, originalText);
                }
            } catch (error) {
                showAlert('حدث خطأ أثناء الاتصال بالخادم لاحتساب الإحصائيات.');
                if (overlay) overlay.style.display = 'none';
                btnCalculateStats.disabled = false;
                btnCalculateStats.innerText = originalText;
                operationRunning = false;
            }
        });
    }

    const closeStatsModal = () => {
        if (statsResultModal) statsResultModal.style.display = 'none';
    };
    if (btnStatsResultClose) btnStatsResultClose.addEventListener('click', closeStatsModal);
    if (btnStatsResultCloseOk) btnStatsResultCloseOk.addEventListener('click', closeStatsModal);
    
    if (statsResultModal) {
        statsResultModal.addEventListener('click', (e) => {
            if (e.target === statsResultModal) {
                statsResultModal.style.display = 'none';
            }
        });
    }

    if (btnStatsCopyReport) {
        btnStatsCopyReport.addEventListener('click', () => {
            const year = document.getElementById('statsYearTitle').textContent;
            const reg = document.getElementById('statRegistered').textContent;
            const act = document.getElementById('statActive').textContent;
            const comp = document.getElementById('statCompleted').textContent;
            const cls = document.getElementById('statClosed').textContent;
            const rem = document.getElementById('statRemaining').textContent;
            
            const reportText = `تقرير إحصائيات مكتب الخبرة لسنة ${year}:\n` +
                               `- المسجل: ${reg}\n` +
                               `- الرائج: ${act}\n` +
                               `- المنجز: ${comp}\n` +
                               `- المغلق: ${cls}\n` +
                               `- الباقي دون إنجاز: ${rem}`;
                               
            navigator.clipboard.writeText(reportText).then(() => {
                showAlert('تم نسخ التقرير الإحصائي إلى الحافظة بنجاح! 📋');
            }).catch(err => {
                const textArea = document.createElement("textarea");
                textArea.value = reportText;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showAlert('تم نسخ التقرير الإحصائي إلى الحافظة بنجاح! 📋');
                } catch (e) {
                    showAlert('فشل في نسخ التقرير.');
                }
                document.body.removeChild(textArea);
            });
        });
    }

    const btnStatsPrintReport = document.getElementById('btnStatsPrintReport');
    if (btnStatsPrintReport) {
        btnStatsPrintReport.addEventListener('click', () => {
            const startDate = document.getElementById('statsStartDate').textContent;
            const endDate = document.getElementById('statsEndDate').textContent;
            const reg = document.getElementById('statRegistered').textContent;
            const act = document.getElementById('statActive').textContent;
            const comp = document.getElementById('statCompleted').textContent;
            const cls = document.getElementById('statClosed').textContent;
            const rem = document.getElementById('statRemaining').textContent;

            const printContainer = document.getElementById('printContainer');
            if (printContainer) {
                const optionSelect = document.getElementById('statsOptionSelect');
                const selectedOption = optionSelect ? optionSelect.value : '';
                const yearSelect = document.getElementById('statsYearSelect');
                const selectedYear = yearSelect ? yearSelect.value : '';

                let pdfTitle = 'إدارة ملفات المحاكم _';
                if (selectedOption) {
                    pdfTitle += ` ${selectedOption}`;
                }
                if (selectedYear) {
                    pdfTitle += ` ${selectedYear}`;
                }

                const originalTitle = document.title;
                document.title = pdfTitle.trim();

                const logoCircleImg = document.querySelector('.logo-circle img');
                printContainer.innerHTML = `
    <div class="header" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px;">
        <div class="right-header" style="text-align: right; font-size: 1.1rem; font-weight: bold; line-height: 1.6;">
            المملكة المغربية<br>
            وزارة العدل<br>
            محكمة الاستئناف الادارية فاس
        </div>
        <div class="middle-header" style="text-align: center; padding: 0 20px;">
            <img src="/static/img/Picture1.png" style="height: 80px; width: auto; object-fit: contain;">
        </div>
        <div class="left-header" style="text-align: left; font-size: 0.95rem; font-weight: bold; line-height: 1.5; font-family: 'Ebrima', sans-serif;">
            ⵜⴰⴳⵍⴷⵉⵜ ⵏ ⵍⵎⵖⵔⵉⴱ<br>
            ⵜⴰⵎⴰⵡⵙⵜ ⵏ ⵜⵥⵔⴼⵜ<br>
            ⵜⴰⵙⵏⴱⴹⴰⵢⵜ ⵏ ⵡⴰⵍⴰⵙ ⵜⴰⵎⵙⵙⵓⴳⵓⵔⵜ ⴷⵉ ⴼⴰⵙ
        </div>
    </div>
    <div class="report-title" style="text-align: center; font-size: 1.5rem; font-weight: bold; margin-top: 40px; margin-bottom: 40px; color: #000; text-decoration: underline;">
        نشاط شعبة الخبرة من ${startDate} إلى غاية ${endDate}
    </div>
    <table style="width: 80%; margin: 0 auto; border-collapse: collapse; font-size: 1.25rem;">
        <thead>
            <tr>
                <th style="border: 1px solid #000; padding: 14px 20px; text-align: center; background-color: #f3f4f6; font-weight: bold; width: 25%;">الحالة</th>
                <th style="border: 1px solid #000; padding: 14px 20px; text-align: center; background-color: #f3f4f6; font-weight: bold; width: 75%;">العدد</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;"><strong>المسجل</strong></td>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;">${reg}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;"><strong>الرائج</strong></td>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;">${act}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;"><strong>المنجز</strong></td>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;">${comp}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;"><strong>المغلق (تم صرف النظر عنه)</strong></td>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;">${cls}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;"><strong>الباقي دون إنجاز</strong></td>
                <td style="border: 1px solid #000; padding: 14px 20px; text-align: center;">${rem}</td>
            </tr>
        </tbody>
    </table>
    <div class="footer" style="margin-top: 60px; text-align: left; font-size: 1.1rem; padding-left: 50px;">
        حرر في: ${new Date().toLocaleDateString('ar-MA')}
    </div>
                `;
                window.print();
                printContainer.innerHTML = '';
                document.title = originalTitle;
            }
        });
    }

    // --- Update Checker ---
    async function checkUpdate() {
        const banner = document.getElementById('updateBanner');
        const bannerText = document.getElementById('updateBannerText');
        const progressText = document.getElementById('updateProgressText');
        const btnTrigger = document.getElementById('btnTriggerUpdate');
        const btnClose = document.getElementById('btnUpdateClose');

        if (btnClose && banner) {
            btnClose.addEventListener('click', () => {
                banner.style.display = 'none';
            });
        }

        try {
            const response = await fetch('/api/check-update');
            const data = await response.json();
            
            if (data.has_update && data.latest_version) {
                if (banner && bannerText) {
                    banner.style.display = 'block';
                    
                    // Poll update status every 2 seconds
                    const updatePollInterval = setInterval(async () => {
                        try {
                            const res = await fetch('/api/update-status');
                            const statusData = await res.json();
                            
                            if (statusData.status === 'downloading') {
                                bannerText.textContent = `جاري تحميل التحديث الجديد (${data.latest_version}) تلقائياً في الخلفية...`;
                                if (progressText) progressText.textContent = `${statusData.progress}%`;
                                if (btnTrigger) btnTrigger.style.display = 'none';
                            } else if (statusData.status === 'ready') {
                                bannerText.textContent = `تحديث جديد متاح (${data.latest_version}) جاهز للتثبيت!`;
                                if (progressText) progressText.textContent = '';
                                if (btnTrigger) {
                                    btnTrigger.style.display = 'inline-block';
                                    btnTrigger.onclick = async () => {
                                        btnTrigger.disabled = true;
                                        btnTrigger.innerText = 'جاري التثبيت...';
                                        try {
                                            const triggerRes = await fetch('/api/trigger-update', { method: 'POST' });
                                            const triggerData = await triggerRes.json();
                                            if (triggerData.error) {
                                                showAlert(triggerData.error);
                                                btnTrigger.disabled = false;
                                                btnTrigger.innerText = '🚀 تثبيت وإعادة التشغيل';
                                            } else {
                                                showAlert('جاري إعادة تشغيل التطبيق لتثبيت التحديث... ⏳');
                                            }
                                        } catch (err) {
                                            showAlert('حدث خطأ أثناء محاولة تثبيت التحديث.');
                                            btnTrigger.disabled = false;
                                            btnTrigger.innerText = '🚀 تثبيت وإعادة التشغيل';
                                        }
                                    };
                                }
                                clearInterval(updatePollInterval);
                            } else if (statusData.status === 'failed') {
                                bannerText.textContent = `فشل تحميل التحديث الجديد (${data.latest_version}).`;
                                if (progressText) progressText.textContent = '';
                                if (btnTrigger) btnTrigger.style.display = 'none';
                                clearInterval(updatePollInterval);
                            }
                        } catch (err) {
                            console.error('Error polling update status:', err);
                        }
                    }, 2000);
                }
            }
        } catch (e) {
            console.log('Error checking for updates:', e);
        }
    }

    async function loadDefaultWorkspace() {
        try {
            const res = await fetch('/api/default-workspace');
            const data = await res.json();
            if (data.directory && folderPathInput && !folderPathInput.value.trim()) {
                folderPathInput.value = data.directory;
            }
        } catch (err) {
            console.error('Error loading default workspace:', err);
        }
    }

    // Initialize
    loadRecentPaths();
    loadDefaultWorkspace();
    checkUpdate();
});

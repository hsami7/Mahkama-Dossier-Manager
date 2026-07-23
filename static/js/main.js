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

            // Instantly cancel any active polling loops
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            if (statsPollInterval) {
                clearInterval(statsPollInterval);
                statsPollInterval = null;
            }

            // Reset frontend state & hide overlays immediately
            operationRunning = false;
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.style.display = 'none';
            if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'none';

            // Reset triggers to original text & enabled status
            const btnAutoSync = document.getElementById('btnAutoSync');
            if (btnAutoSync) {
                btnAutoSync.disabled = false;
                btnAutoSync.innerText = 'سحب السجلات الآن';
            }
            const btnCalculateStats = document.getElementById('btnCalculateStats');
            if (btnCalculateStats) {
                btnCalculateStats.disabled = false;
                btnCalculateStats.innerText = 'بدء العمل';
            }
            const btnCalcStatsLocal = document.getElementById('btnCalculateStatsLocal');
            if (btnCalcStatsLocal) {
                btnCalcStatsLocal.disabled = false;
                btnCalcStatsLocal.innerText = 'آخر حفظ';
            }

            try {
                await fetch('/api/abort', { method: 'POST' });
            } catch (err) {
                console.error("Error aborting operation:", err);
            }
        });
    }

    // Helper: reset operation UI before starting a new run
    function resetOperationUI(overlayText) {
        operationRunning = true;
        if (liveSyncLogs) {
            liveSyncLogs.innerHTML = '';
            liveSyncLogs.style.display = 'none';
        }
        if (liveSyncLogsWrapper) {
            liveSyncLogsWrapper.style.display = 'none';
        }
        lastLogCount = 0;
        if (btnAbortOperation) {
            btnAbortOperation.disabled = false;
            btnAbortOperation.innerText = 'إلغاء وإيقاف العملية الجارية';
        }
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            if (loadingOverlayText) loadingOverlayText.innerText = overlayText;
        }
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
                        <span style="font-weight: bold; color: ${dos.completed ? 'var(--mahakim-text-secondary)' : 'var(--mahakim-primary)'}">${dos.completed ? '✔️ مكتمل' : '⏳ معلق'}</span>
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
        window.scrollTo(0, 0);

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
                    window.scrollTo(0, 0);
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
            if (filtersBar) filtersBar.style.display = allDossiers.length > 0 ? 'flex' : 'none';

            // Show Dashboard, Hide Landing
            if (landingSection && dashboardSection) {
                landingSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                window.scrollTo(0, 0);
            }

        } catch (error) {
            dossiersTableBody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: #dc3545; padding: 30px;">
                        ❌ خطأ في المعالجة: ${error.message}
                    </td>
                </tr>
            `;
            showAlert('حدث خطأ أثناء قراءة الملفات. يرجى مراجعة المسار أو الملفات المحملة.');
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

        // Sort dynamically by days_remaining ascending (most urgent first)
        filtered.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.days_remaining - b.days_remaining;
        });

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
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    tableSearch.addEventListener('input', debounce(filterAndRenderDossiers, 250));
    if (btnApplyFilters) btnApplyFilters.addEventListener('click', filterAndRenderDossiers);

    if (btnClearFilters) {
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
    function showAlert(message, filePath = null) {
        if (!alertModal) {
            alert(message);
            return;
        }
        alertModalMessage.innerHTML = message.replace(/\n/g, '<br>');

        const btnAlertOpenLink = document.getElementById('btnAlertOpenLink');
        if (btnAlertOpenLink) {
            if (filePath) {
                btnAlertOpenLink.style.display = 'inline-block';
            } else {
                btnAlertOpenLink.style.display = 'none';
            }
        }

        alertModal.style.display = 'flex';

        return new Promise((resolve) => {
            const cleanup = () => {
                alertModal.style.display = 'none';
                if (btnAlertOk) btnAlertOk.removeEventListener('click', okHandler);
                if (btnAlertClose) btnAlertClose.removeEventListener('click', okHandler);
                if (btnAlertOpenLink) btnAlertOpenLink.removeEventListener('click', openHandler);
                resolve();
            };

            const okHandler = () => { cleanup(); };
            const openHandler = () => {
                if (filePath) {
                    fetch('/api/open-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filePath })
                    }).catch(err => console.error("Error opening file:", err));
                }
                cleanup();
            };

            if (btnAlertOk) btnAlertOk.addEventListener('click', okHandler);
            if (btnAlertClose) btnAlertClose.addEventListener('click', okHandler);
            if (btnAlertOpenLink && filePath) btnAlertOpenLink.addEventListener('click', openHandler);
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
    const tabAccount = document.getElementById('tabAccount');
    const tabAbout = document.getElementById('tabAbout');
    const contentLimits = document.getElementById('settingsContentLimits');
    const contentThresholds = document.getElementById('settingsContentThresholds');
    const contentAccount = document.getElementById('settingsContentAccount');
    const contentAbout = document.getElementById('settingsContentAbout');
    const formLimits = document.getElementById('settingsFormLimits');
    const formThresholds = document.getElementById('settingsFormThresholds');
    
    // Account settings elements
    const savedUsernameDossier = document.getElementById('savedUsernameDossier');
    const savedPasswordDossier = document.getElementById('savedPasswordDossier');
    const savedUsernameStats = document.getElementById('savedUsernameStats');
    const savedPasswordStats = document.getElementById('savedPasswordStats');
    const btnSaveAccount = document.getElementById('btnSaveAccount');
    
    // Global var to store credentials
    let savedCredentials = { 
        dossier_username: '', dossier_password: '',
        stats_username: '', stats_password: ''
    };

    if (tabLimits && tabThresholds && tabAccount && tabAbout) {
        function activateTab(activeTab, showContent, inactiveTabs, hideContents) {
            activeTab.classList.add('active');
            activeTab.style.background = 'var(--mahakim-primary)';
            activeTab.style.color = 'white';
            activeTab.style.border = 'none';

            inactiveTabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = '#f8fafc';
                t.style.color = 'var(--mahakim-text)';
                t.style.border = '1px solid #cbd5e1';
            });

            showContent.style.display = 'block';
            hideContents.forEach(c => c.style.display = 'none');

            // Hide the 'Save changes' button when we are on the 'About' tab
            if (activeTab === tabAbout) {
                if (btnSettingsSave) btnSettingsSave.style.display = 'none';
            } else {
                if (btnSettingsSave) btnSettingsSave.style.display = 'inline-flex';
            }
        }

        tabLimits.addEventListener('click', () => {
            activateTab(tabLimits, contentLimits, [tabThresholds, tabAccount, tabAbout], [contentThresholds, contentAccount, contentAbout]);
        });

        tabThresholds.addEventListener('click', () => {
            activateTab(tabThresholds, contentThresholds, [tabLimits, tabAccount, tabAbout], [contentLimits, contentAccount, contentAbout]);
        });

        tabAccount.addEventListener('click', () => {
            activateTab(tabAccount, contentAccount, [tabLimits, tabThresholds, tabAbout], [contentLimits, contentThresholds, contentAbout]);
        });

        tabAbout.addEventListener('click', () => {
            activateTab(tabAbout, contentAbout, [tabLimits, tabThresholds, tabAccount], [contentLimits, contentThresholds, contentAccount]);
        });
    }

    async function loadCredentials() {
        try {
            const res = await fetch('/api/credentials');
            const data = await res.json();
            savedCredentials.dossier_username = data.dossier_username || '';
            savedCredentials.dossier_password = data.dossier_password || '';
            savedCredentials.stats_username = data.stats_username || '';
            savedCredentials.stats_password = data.stats_password || '';
            
            if (savedUsernameDossier) savedUsernameDossier.value = savedCredentials.dossier_username;
            if (savedPasswordDossier) savedPasswordDossier.value = savedCredentials.dossier_password;
            if (savedUsernameStats) savedUsernameStats.value = savedCredentials.stats_username;
            if (savedPasswordStats) savedPasswordStats.value = savedCredentials.stats_password;
        } catch (e) {
            console.error("Error loading credentials", e);
        }
    }

    if (btnSaveAccount) {
        btnSaveAccount.addEventListener('click', async () => {
            const payload = {
                dossier_username: savedUsernameDossier.value.trim(),
                dossier_password: savedPasswordDossier.value,
                stats_username: savedUsernameStats.value.trim(),
                stats_password: savedPasswordStats.value
            };
            try {
                const res = await fetch('/api/credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    savedCredentials = { ...savedCredentials, ...payload };
                    showAlert('✅ تم حفظ بيانات تسجيل الدخول بنجاح!');
                } else {
                    showAlert('❌ ' + data.error);
                }
            } catch (e) {
                showAlert('❌ حدث خطأ أثناء الحفظ.');
            }
        });
    }

    async function loadSettings() {
        loadCredentials();
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
                const codeSet = settings[code] || { limit: 30, red: 5, orange: 15 };

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
                </td>
            </tr>
        </tbody>
        <tfoot><tr><td style="border: none; height: 15px;"></td></tr></tfoot>
    </table>
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
            updated[i.toString()] = { limit: 30, red: 5, orange: 15 };
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
        if (tabLimits) tabLimits.click();
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
                window.scrollTo(0, 0);
            }
        });
    }

    const btnStatsReturnHome = document.getElementById('btnStatsReturnHome');
    if (btnStatsReturnHome) {
        btnStatsReturnHome.addEventListener('click', () => {
            const statsSection = document.getElementById('statsResultsSection');
            if (landingSection && statsSection) {
                landingSection.style.display = 'block';
                statsSection.style.display = 'none';
                window.scrollTo(0, 0);
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
            liveSyncLogs.style.display = 'none';
        }
        if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'block';
        if (btnMinimizeLiveLogs) {
            btnMinimizeLiveLogs.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;"><path d="m7 10 5 5 5-5"/></svg> عرض التفاصيل`;
        }

        pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/sync/status');
                const data = await res.json();

                // Append new logs
                if (data.logs && data.logs.length > lastLogCount) {
                    const isLiveSyncAtBottom = liveSyncLogs && (liveSyncLogs.scrollHeight - liveSyncLogs.clientHeight - liveSyncLogs.scrollTop < 50);
                    const isConsoleAtBottom = logsConsole && (logsConsole.scrollHeight - logsConsole.clientHeight - logsConsole.scrollTop < 50);

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
                    
                    if (liveSyncLogs && isLiveSyncAtBottom) liveSyncLogs.scrollTop = liveSyncLogs.scrollHeight;
                    if (logsConsole && isConsoleAtBottom) logsConsole.scrollTop = logsConsole.scrollHeight;
                }

                if (!data.active) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    operationRunning = false;

                    const overlay = document.getElementById('loadingOverlay');

                    if (data.error) {
                        let errorMsg = 'حدث خطأ أثناء مزامنة السجلات. يرجى التحقق من السجل لمعرفة التفاصيل.';
                        if (data.logs && data.logs.length > 0) {
                            const recentLogs = data.logs.slice(-10);
                            const errorLines = recentLogs.filter(l => l.includes('[-]')).map(l => l.replace('[-]', '').trim());
                            if (errorLines.length > 0) {
                                const specificErrors = errorLines.filter(l => !l.includes('فشل مزامنة السنة') && !l.includes('خطأ في المزامنة. الرمز') && !l.includes('فشلت: خطأ'));
                                if (specificErrors.length > 0) {
                                    errorMsg = [...new Set(specificErrors)].join('\n');
                                } else {
                                    errorMsg = [...new Set(errorLines)].join('\n');
                                }
                            }
                        }
                        showAlert(`حدث خطأ أثناء مزامنة السجلات:\n\n${errorMsg}`);
                    } else if (data.directory) {
                        folderPathInput.value = data.directory;
                        if (loadingOverlayText) loadingOverlayText.innerText = 'جاري قراءة ومعالجة الملفات...';

                        await performScan(data.years);
                    } else {
                        showAlert('فشلت عملية المزامنة أو لم يتم تحميل أي ملفات.');
                    }

                    if (overlay) overlay.style.display = 'none';
                    if (!data.error && liveSyncLogsWrapper) {
                        liveSyncLogsWrapper.style.display = 'none';
                    }
                    btnAutoSync.disabled = false;
                    btnAutoSync.innerText = originalText;
                }
            } catch (err) {
                console.error("Error polling sync status:", err);
            }
        }, 1000);
    }

    // Helper function to prompt for login credentials before performing sensitive operations
    function promptLogin(type = 'dossier') {
        return new Promise((resolve) => {
            const modal = document.getElementById('loginModal');
            if (!modal) return resolve(null);
            
            const usernameInput = document.getElementById('loginUsername');
            const passwordInput = document.getElementById('loginPassword');
            
            usernameInput.value = '';
            passwordInput.value = '';
            
            const saveCheckbox = document.getElementById('loginSaveCredentials');
            if (saveCheckbox) saveCheckbox.checked = false;
            
            // Pre-fill if we have saved credentials
            if (type === 'dossier') {
                if (savedCredentials && savedCredentials.dossier_username && savedCredentials.dossier_password) {
                    const hint = document.getElementById('loginHintText');
                    if (hint) hint.style.display = 'block';
                    return resolve({ username: savedCredentials.dossier_username, password: savedCredentials.dossier_password });
                }
                if (savedCredentials && savedCredentials.dossier_username) {
                    usernameInput.value = savedCredentials.dossier_username;
                }
                if (savedCredentials && savedCredentials.dossier_password) {
                    passwordInput.value = savedCredentials.dossier_password;
                }
            } else if (type === 'stats') {
                if (savedCredentials && savedCredentials.stats_username && savedCredentials.stats_password) {
                    const hint = document.getElementById('loginHintText');
                    if (hint) hint.style.display = 'block';
                    return resolve({ username: savedCredentials.stats_username, password: savedCredentials.stats_password });
                }
                if (savedCredentials && savedCredentials.stats_username) {
                    usernameInput.value = savedCredentials.stats_username;
                }
                if (savedCredentials && savedCredentials.stats_password) {
                    passwordInput.value = savedCredentials.stats_password;
                }
            }
            
            modal.style.display = 'flex';
            
            const closeBtn = document.getElementById('btnLoginClose');
            const cancelBtn = document.getElementById('btnLoginCancel');
            const startBtn = document.getElementById('btnLoginStart');
            
            const cleanup = () => {
                modal.style.display = 'none';
                closeBtn.removeEventListener('click', onCancel);
                cancelBtn.removeEventListener('click', onCancel);
                startBtn.removeEventListener('click', onStart);
            };
            
            const onCancel = () => {
                cleanup();
                resolve(null);
            };
            
            const onStart = async () => {
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                if (!username || !password) {
                    showAlert('الرجاء إدخال اسم المستخدم وكلمة المرور.');
                    return;
                }
                
                if (saveCheckbox && saveCheckbox.checked) {
                    let payload = { ...savedCredentials };
                    if (type === 'dossier') {
                        payload.dossier_username = username;
                        payload.dossier_password = password;
                    } else if (type === 'stats') {
                        payload.stats_username = username;
                        payload.stats_password = password;
                    }
                    
                    try {
                        const res = await fetch('/api/credentials', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const data = await res.json();
                        if (data.success) {
                            savedCredentials = payload;
                            // Reflect in settings form
                            const usd = document.getElementById('savedUsernameDossier');
                            const psd = document.getElementById('savedPasswordDossier');
                            const uss = document.getElementById('savedUsernameStats');
                            const pss = document.getElementById('savedPasswordStats');
                            if (usd) usd.value = savedCredentials.dossier_username;
                            if (psd) psd.value = savedCredentials.dossier_password;
                            if (uss) uss.value = savedCredentials.stats_username;
                            if (pss) pss.value = savedCredentials.stats_password;
                        }
                    } catch (e) {
                        console.error('Failed to save credentials from modal:', e);
                    }
                }
                
                cleanup();
                resolve({ username, password });
            };
            
            closeBtn.addEventListener('click', onCancel);
            cancelBtn.addEventListener('click', onCancel);
            startBtn.addEventListener('click', onStart);
        });
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

            const credentials = await promptLogin('dossier');
            if (!credentials) return; // User cancelled

            btnAutoSync.disabled = true;
            const originalText = btnAutoSync.innerText;
            btnAutoSync.innerText = 'جاري المزامنة...';

            resetOperationUI('جاري المزامنة مع بوابة المحاكم تلقائياً...');

            try {
                const folderPath = folderPathInput ? folderPathInput.value.trim() : "";
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        years: uniqueYears, 
                        directory: folderPath,
                        username: credentials.username,
                        password: credentials.password 
                    })
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
                        setTimeout(() => {
                            logsConsole.scrollTop = logsConsole.scrollHeight;
                        }, 150);
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
                btnMinimizeLiveLogs.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;"><path d="m17 14-5-5-5 5"/></svg> إخفاء التفاصيل`;
            } else {
                liveSyncLogs.style.display = 'none';
                btnMinimizeLiveLogs.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;"><path d="m7 10 5 5 5-5"/></svg> عرض التفاصيل`;
            }
        });
    }

    // --- Statistics Calculations Handler ---
    const btnCalculateStats = document.getElementById('btnCalculateStats');
    const statsResultModal = document.getElementById('statsResultModal');
    const btnStatsResultClose = document.getElementById('btnStatsResultClose');
    const btnStatsResultCloseOk = document.getElementById('btnStatsResultCloseOk');
    const btnStatsCopyReport = document.getElementById('btnStatsCopyReport');

    // Toggle range selection UI
    const statsRangeRadios = document.querySelectorAll('input[name="statsRange"]');
    const statsYearWrapper = document.getElementById('statsYearWrapper');
    const statsCustomDateWrapper = document.getElementById('statsCustomDateWrapper');

    if (statsRangeRadios) {
        statsRangeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'year') {
                    if (statsYearWrapper) statsYearWrapper.style.display = 'block';
                    if (statsCustomDateWrapper) statsCustomDateWrapper.style.display = 'none';
                } else {
                    if (statsYearWrapper) statsYearWrapper.style.display = 'none';
                    if (statsCustomDateWrapper) statsCustomDateWrapper.style.display = 'flex';
                }
            });
        });
    }

    // Initialize flatpickr date pickers with dd/mm/yyyy formatting
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#statsStartDateInput", {
            dateFormat: "d/m/Y",
            allowInput: true
        });
        flatpickr("#statsEndDateInput", {
            dateFormat: "d/m/Y",
            allowInput: true
        });
    }

    // Auto-insert slashes for dd/mm/yyyy mask
    const applyDateMask = (input) => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            if (e.inputType === 'deleteContentBackward') return;
            let value = input.value.replace(/\D/g, '');
            if (value.length > 8) value = value.substring(0, 8);

            let formattedValue = '';
            if (value.length > 0) {
                formattedValue += value.substring(0, 2);
            }
            if (value.length > 2) {
                formattedValue += '/' + value.substring(2, 4);
            }
            if (value.length > 4) {
                formattedValue += '/' + value.substring(4, 8);
            }
            input.value = formattedValue;
        });
    };

    applyDateMask(document.getElementById('statsStartDateInput'));
    applyDateMask(document.getElementById('statsEndDateInput'));

    let statsPollInterval = null;
    let lastStatsLogCount = 0;

    function startStatsPolling(yearOrRangeText, originalText) {
        lastStatsLogCount = 0;
        if (liveSyncLogs) {
            liveSyncLogs.innerHTML = '';
            liveSyncLogs.style.display = 'none';
        }
        if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'block';
        if (btnMinimizeLiveLogs) {
            btnMinimizeLiveLogs.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 4px;"><path d="m7 10 5 5 5-5"/></svg> عرض التفاصيل`;
        }

        statsPollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/calculate-stats/status');
                const data = await res.json();

                // Append new logs
                if (data.logs && data.logs.length > lastStatsLogCount) {
                    const isLiveSyncAtBottom = liveSyncLogs && (liveSyncLogs.scrollHeight - liveSyncLogs.clientHeight - liveSyncLogs.scrollTop < 50);
                    const isConsoleAtBottom = logsConsole && (logsConsole.scrollHeight - logsConsole.clientHeight - logsConsole.scrollTop < 50);

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
                    
                    if (liveSyncLogs && isLiveSyncAtBottom) liveSyncLogs.scrollTop = liveSyncLogs.scrollHeight;
                    if (logsConsole && isConsoleAtBottom) logsConsole.scrollTop = logsConsole.scrollHeight;
                }

                if (!data.active) {
                    clearInterval(statsPollInterval);
                    statsPollInterval = null;
                    operationRunning = false;

                    const overlay = document.getElementById('loadingOverlay');
                    if (overlay) overlay.style.display = 'none';

                    btnCalculateStats.disabled = false;
                    btnCalculateStats.innerText = originalText;
                    const btnCalcStatsLocal = document.getElementById('btnCalculateStatsLocal');
                    if (btnCalcStatsLocal) {
                        btnCalcStatsLocal.disabled = false;
                        btnCalcStatsLocal.innerText = 'آخر حفظ';
                    }

                    if (data.error || !data.result) {
                        const errMsg = typeof data.error === 'string' ? data.error : (data.error || 'حدث خطأ غير معروف');
                        showAlert('❌ ' + errMsg + '\n\nيرجى مراجعة سجل العمليات لمزيد من التفاصيل.');
                    } else {
                        if (liveSyncLogsWrapper) liveSyncLogsWrapper.style.display = 'none';
                        // Populate modal values
                        document.getElementById('statsYearTitle').textContent = yearOrRangeText;
                        document.querySelectorAll('.statsYearLabel').forEach(el => el.textContent = yearOrRangeText);

                        document.getElementById('statRegistered').textContent = data.result.registered;
                        document.getElementById('statActive').textContent = data.result.active;
                        document.getElementById('statCompleted').textContent = data.result.completed;
                        document.getElementById('statClosed').textContent = data.result.closed;
                        document.getElementById('statRemaining').textContent = data.result.remaining;
                        const avgDays = data.result.avg_duration !== undefined ? data.result.avg_duration : 0;
                        const avgTimeEl = document.getElementById('statAverageTime');
                        if (avgTimeEl) {
                            avgTimeEl.textContent = avgDays + ' يوم';
                        }

                        document.getElementById('statsStartDate').textContent = data.result.start_date || '--';
                        document.getElementById('statsEndDate').textContent = data.result.end_date || '--';

                        // Populate section values
                        document.getElementById('statsYearTitleSection').textContent = yearOrRangeText;
                        document.querySelectorAll('.statsYearLabelSection').forEach(el => el.textContent = yearOrRangeText);
                        document.getElementById('statRegisteredSection').textContent = data.result.registered;
                        document.getElementById('statActiveSection').textContent = data.result.active;
                        document.getElementById('statCompletedSection').textContent = data.result.completed;
                        document.getElementById('statClosedSection').textContent = data.result.closed;
                        document.getElementById('statRemainingSection').textContent = data.result.remaining;
                        const avgTimeSectionEl = document.getElementById('statAverageTimeSection');
                        if (avgTimeSectionEl) {
                            avgTimeSectionEl.textContent = avgDays + ' يوم';
                        }
                        document.getElementById('statsStartDateSection').textContent = data.result.start_date || '--';
                        document.getElementById('statsEndDateSection').textContent = data.result.end_date || '--';
                        
                        window.lastStatsResult = data.result;

                        const statsSection = document.getElementById('statsResultsSection');
                        if (statsSection) {
                            if (landingSection) landingSection.style.display = 'none';
                            statsSection.style.display = 'block';
                        }
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

            const statsRangeRadio = document.querySelector('input[name="statsRange"]:checked');
            const rangeMode = statsRangeRadio ? statsRangeRadio.value : 'year';

            const yearSelect = document.getElementById('statsYearSelect');
            const optionSelect = document.getElementById('statsOptionSelect');
            const folderPath = folderPathInput ? folderPathInput.value.trim() : "";

            let year = yearSelect ? yearSelect.value : "2026";
            const option = optionSelect ? optionSelect.value : "مكتب الخبرة";

            let start_date = null;
            let end_date = null;
            let displayTitle = year;

            if (rangeMode === 'custom') {
                const startDateInput = document.getElementById('statsStartDateInput');
                const endDateInput = document.getElementById('statsEndDateInput');
                const rawStart = startDateInput ? startDateInput.value.trim() : '';
                const rawEnd = endDateInput ? endDateInput.value.trim() : '';

                const parseDMY = (str) => {
                    if (!str) return null;
                    const parts = str.split('/');
                    if (parts.length !== 3) return null;
                    const day = parts[0].trim().padStart(2, '0');
                    const month = parts[1].trim().padStart(2, '0');
                    const year = parts[2].trim();
                    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
                    return `${year}-${month}-${day}`;
                };

                start_date = parseDMY(rawStart);
                end_date = parseDMY(rawEnd);

                if (!start_date || !end_date) {
                    showAlert('يرجى إدخال التاريخ بالصيغة الصحيحة (يوم/شهر/سنة) مثال: 01/01/2026');
                    return;
                }

                try {
                    year = end_date.split('-')[0];
                } catch (e) { }

                displayTitle = 'فترة مخصصة';
            }

            const credentials = await promptLogin('stats');
            if (!credentials) return; // User cancelled

            btnCalculateStats.disabled = true;
            const originalText = btnCalculateStats.innerText;
            btnCalculateStats.innerText = 'جاري الاحتساب...';

            resetOperationUI('جاري الاتصال وسحب الملفات واحتساب إحصائيات الخبرة...');

            try {
                const res = await fetch('/api/calculate-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        year: year,
                        option: option,
                        directory: folderPath,
                        start_date: start_date,
                        end_date: end_date,
                        username: credentials.username,
                        password: credentials.password
                    })
                });
                const data = await res.json();

                if (data.error) {
                    showAlert(data.error);
                    if (overlay) overlay.style.display = 'none';
                    btnCalculateStats.disabled = false;
                    btnCalculateStats.innerText = originalText;
                    const btnCalcStatsLocal = document.getElementById('btnCalculateStatsLocal');
                    if (btnCalcStatsLocal) {
                        btnCalcStatsLocal.disabled = false;
                        btnCalcStatsLocal.innerText = 'آخر حفظ';
                    }
                    operationRunning = false;
                } else if (data.success) {
                    startStatsPolling(displayTitle, originalText);
                }
            } catch (error) {
                showAlert('حدث خطأ أثناء الاتصال بالخادم لاحتساب الإحصائيات.');
                if (overlay) overlay.style.display = 'none';
                btnCalculateStats.disabled = false;
                btnCalculateStats.innerText = originalText;
                const btnCalcStatsLocal = document.getElementById('btnCalculateStatsLocal');
                if (btnCalcStatsLocal) {
                    btnCalcStatsLocal.disabled = false;
                    btnCalcStatsLocal.innerText = 'آخر حفظ';
                }
                operationRunning = false;
            }
        });
    }

    const btnCalculateStatsLocal = document.getElementById('btnCalculateStatsLocal');
    if (btnCalculateStatsLocal) {
        btnCalculateStatsLocal.addEventListener('click', async () => {
            if (operationRunning) return;

            const statsRangeRadio = document.querySelector('input[name="statsRange"]:checked');
            const rangeMode = statsRangeRadio ? statsRangeRadio.value : 'year';
            const yearSelect = document.getElementById('statsYearSelect');
            const optionSelect = document.getElementById('statsOptionSelect');
            const folderPath = folderPathInput ? folderPathInput.value.trim() : "";

            let year = yearSelect ? yearSelect.value : "2026";
            const option = optionSelect ? optionSelect.value : "مكتب الخبرة";
            let start_date = null;
            let end_date = null;

            if (rangeMode === 'custom') {
                const startDateInput = document.getElementById('statsStartDateInput');
                const endDateInput = document.getElementById('statsEndDateInput');
                const rawStart = startDateInput ? startDateInput.value.trim() : '';
                const rawEnd = endDateInput ? endDateInput.value.trim() : '';
                const parseDMY = (str) => {
                    if (!str) return null;
                    const parts = str.split('/');
                    if (parts.length !== 3) return null;
                    const day = parts[0].trim().padStart(2, '0');
                    const month = parts[1].trim().padStart(2, '0');
                    const yr = parts[2].trim();
                    if (day.length !== 2 || month.length !== 2 || yr.length !== 4) return null;
                    return `${yr}-${month}-${day}`;
                };
                start_date = parseDMY(rawStart);
                end_date = parseDMY(rawEnd);
                if (!start_date || !end_date) {
                    showAlert('يرجى إدخال التاريخ بالصيغة الصحيحة (يوم/شهر/سنة) مثال: 01/01/2026');
                    return;
                }
                try { year = end_date.split('-')[0]; } catch (e) { }
            }

            btnCalculateStatsLocal.disabled = true;
            const originalText = btnCalculateStatsLocal.innerText;
            btnCalculateStatsLocal.innerText = 'جاري القراءة من المحلي...';

            resetOperationUI('جاري قراءة الملفات المحلية واحتساب الإحصائيات...');

            try {
                const res = await fetch('/api/calculate-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        year: year,
                        option: option,
                        directory: folderPath,
                        start_date: start_date,
                        end_date: end_date,
                        local_only: true
                    })
                });
                const data = await res.json();

                if (data.error) {
                    showAlert(data.error);
                    if (overlay) overlay.style.display = 'none';
                    btnCalculateStatsLocal.disabled = false;
                    btnCalculateStatsLocal.innerText = originalText;
                    operationRunning = false;
                } else if (data.success) {
                    startStatsPolling(rangeMode === 'custom' && start_date ? 'فترة مخصصة' : year, originalText);
                }
            } catch (error) {
                showAlert('حدث خطأ أثناء الاتصال بالخادم.');
                if (overlay) overlay.style.display = 'none';
                btnCalculateStatsLocal.disabled = false;
                btnCalculateStatsLocal.innerText = originalText;
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

    const dossierListModal = document.getElementById('dossierListModal');
    const btnCloseDossierListModal = document.getElementById('btnCloseDossierListModal');
    
    if (btnCloseDossierListModal) {
        btnCloseDossierListModal.addEventListener('click', () => {
            if (dossierListModal) dossierListModal.style.display = 'none';
        });
    }
    if (dossierListModal) {
        dossierListModal.addEventListener('click', (e) => {
            if (e.target === dossierListModal) {
                dossierListModal.style.display = 'none';
            }
        });
    }

    window.showStatDossiers = function(type) {
        if (!window.lastStatsResult) return;
        
        let list = [];
        let title = "قائمة الملفات";
        const isRemaining = type === 'remaining';
        
        switch(type) {
            case 'registered':
                list = window.lastStatsResult.registered_list || [];
                title = "قائمة الملفات المسجلة";
                break;
            case 'active':
                list = window.lastStatsResult.active_list || [];
                title = "قائمة الملفات الرائجة";
                break;
            case 'completed':
                list = window.lastStatsResult.completed_list || [];
                title = "قائمة الملفات المنجزة";
                break;
            case 'closed':
                list = window.lastStatsResult.closed_list || [];
                title = "قائمة الملفات المغلقة";
                break;
            case 'remaining':
                list = window.lastStatsResult.remaining_list || [];
                title = "قائمة الملفات المتبقية";
                break;
        }
        
        document.getElementById('dossierListModalTitle').textContent = title;
        
        // Show/hide the next_session column header & adjust col widths
        const headerCells = document.querySelectorAll('#dossierListModal .dossiers-table th');
        if (headerCells.length >= 6) {
            headerCells[5].style.display = isRemaining ? '' : 'none';
        }
        const colgroup = document.querySelector('#dossierListModal .dossiers-table colgroup');
        if (colgroup) {
            const cols = colgroup.querySelectorAll('col');
            if (isRemaining && cols.length >= 6) {
                cols[0].style.width = '15%';
                cols[1].style.width = '18%';
                cols[2].style.width = '12%';
                cols[3].style.width = '20%';
                cols[4].style.width = '18%';
                cols[5].style.width = '17%';
            } else if (cols.length >= 6) {
                cols[0].style.width = '18%';
                cols[1].style.width = '22%';
                cols[2].style.width = '15%';
                cols[3].style.width = '23%';
                cols[4].style.width = '22%';
                cols[5].style.width = '0%';
            }
        }
        
        const tbody = document.getElementById('dossierListTbody');
        tbody.innerHTML = '';
        const colspan = isRemaining ? 6 : 5;
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + colspan + '" style="text-align: center; padding: 15px;">لا توجد ملفات</td></tr>';
        } else {
            list.forEach(item => {
                const tr = document.createElement('tr');
                const ph = (v) => (v && v.trim()) ? v : '<span class="dossier-empty-placeholder">&mdash;</span>';
                const td = (content, raw, dir) => {
                    const d = dir || 'right';
                    const display = raw && raw.trim() ? raw : (content === '&mdash;' ? '' : content);
                    const title = raw && raw.trim() ? raw.replace(/<[^>]+>/g, '') : (content === '&mdash;' ? '' : content.replace(/<[^>]+>/g, ''));
                    return '<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: ' + d + '; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 0;" title="' + title.replace(/"/g, '&quot;') + '">' + content + '</td>';
                };
                const cells = [
                    td(item.expert_code || '', item.expert_code, 'ltr'),
                    td(item.code || '', item.code, 'ltr'),
                    td(item.date || '', item.date),
                    td(ph(item.judge), item.judge),
                    td(ph(item.expert), item.expert)
                ];
                if (isRemaining) {
                    cells.push(td(ph(item.next_session), item.next_session));
                }
                tr.innerHTML = cells.join('');
                tbody.appendChild(tr);
            });
        }
        
        if (dossierListModal) {
            dossierListModal.style.display = 'flex';
        }
    };

    window.showStatDossiersSection = function(type) {
        if (!window.lastStatsResult) return;
        
        let list = [];
        let label = "";
        let count = 0;
        const isRemaining = type === 'remaining';
        
        switch(type) {
            case 'registered':
                list = window.lastStatsResult.registered_list || [];
                label = "المسجلة";
                count = window.lastStatsResult.registered || 0;
                break;
            case 'active':
                list = window.lastStatsResult.active_list || [];
                label = "الرائجة";
                count = window.lastStatsResult.active || 0;
                break;
            case 'completed':
                list = window.lastStatsResult.completed_list || [];
                label = "المنجرة";
                count = window.lastStatsResult.completed || 0;
                break;
            case 'closed':
                list = window.lastStatsResult.closed_list || [];
                label = "المغلقة";
                count = window.lastStatsResult.closed || 0;
                break;
            case 'remaining':
                list = window.lastStatsResult.remaining_list || [];
                label = "المتبقية";
                count = window.lastStatsResult.remaining || 0;
                break;
        }

        const year = document.getElementById('statsYearTitleSection').textContent;
        const titleEl = document.getElementById('statsDossierListTitle');
        if (titleEl) {
            titleEl.textContent = `قائمة الملفات ${label} - مكتب الخبرة - سنة ${year} (${count})`;
        }
        
        // Show/hide the next_session column header in inline table & adjust col widths
        const headerCells = document.querySelectorAll('#statsDossierListContainer .dossiers-table th');
        if (headerCells.length >= 6) {
            headerCells[5].style.display = isRemaining ? '' : 'none';
        }
        const colgroup = document.querySelector('#statsDossierListContainer .dossiers-table colgroup');
        if (colgroup) {
            const cols = colgroup.querySelectorAll('col');
            if (isRemaining && cols.length >= 6) {
                cols[0].style.width = '15%';
                cols[1].style.width = '18%';
                cols[2].style.width = '12%';
                cols[3].style.width = '20%';
                cols[4].style.width = '18%';
                cols[5].style.width = '17%';
            } else if (cols.length >= 6) {
                cols[0].style.width = '18%';
                cols[1].style.width = '22%';
                cols[2].style.width = '15%';
                cols[3].style.width = '23%';
                cols[4].style.width = '22%';
                cols[5].style.width = '0%';
            }
        }
        
        const tbody = document.getElementById('statsDossierListTbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const colspan = isRemaining ? 6 : 5;
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + colspan + '" style="text-align: center; padding: 30px; color: #94a3b8; font-size: 1.05rem;">لا توجد ملفات</td></tr>';
        } else {
            list.forEach(item => {
                const tr = document.createElement('tr');
                const ph = (v) => (v && v.trim()) ? v : '<span class="dossier-empty-placeholder">&mdash;</span>';
                const td = (content, raw, dir) => {
                    const d = dir || 'right';
                    const title = raw && raw.trim() ? raw.replace(/<[^>]+>/g, '') : (content === '&mdash;' ? '' : content.replace(/<[^>]+>/g, ''));
                    return '<td style="padding: 12px; border-bottom: 1px solid var(--mahakim-border); text-align: ' + d + '; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 0;" title="' + title.replace(/"/g, '&quot;') + '">' + content + '</td>';
                };
                const cells = [
                    td(item.expert_code || '', item.expert_code, 'ltr'),
                    td(item.code || '', item.code, 'ltr'),
                    td(item.date || '', item.date),
                    td(ph(item.judge), item.judge),
                    td(ph(item.expert), item.expert)
                ];
                if (isRemaining) {
                    cells.push(td(ph(item.next_session), item.next_session));
                }
                tr.innerHTML = cells.join('');
                tbody.appendChild(tr);
            });
        }
        
        const container = document.getElementById('statsDossierListContainer');
        if (container) {
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const btnCloseStatsDossierList = document.getElementById('btnCloseStatsDossierList');
    if (btnCloseStatsDossierList) {
        btnCloseStatsDossierList.addEventListener('click', () => {
            const container = document.getElementById('statsDossierListContainer');
            if (container) container.style.display = 'none';
        });
    }

    function getActiveDossierListTable() {
        const modal = document.getElementById('dossierListModal');
        if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
            const tbody = document.getElementById('dossierListTbody');
            const titleEl = document.getElementById('dossierListModalTitle');
            const isRemaining = modal.querySelector('.dossiers-table th:nth-child(6)')?.style.display !== 'none';
            return { tbody, title: titleEl ? titleEl.textContent.trim() : 'قائمة الملفات', isRemaining };
        }
        const container = document.getElementById('statsDossierListContainer');
        if (container && container.style.display !== 'none' && container.style.display !== '') {
            const tbody = document.getElementById('statsDossierListTbody');
            const titleEl = document.getElementById('statsDossierListTitle');
            const isRemaining = container.querySelector('.dossiers-table th:nth-child(6)')?.style.display !== 'none';
            return { tbody, title: titleEl ? titleEl.textContent.trim() : 'قائمة الملفات', isRemaining };
        }
        return null;
    }

    function triggerStatsDossierListPrint() {
        const table = getActiveDossierListTable();
        if (!table || !table.tbody) return;
        const rows = Array.from(table.tbody.querySelectorAll('tr'));
        if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan]'))) {
            showAlert('لا توجد بيانات لطباعتها.');
            return;
        }

        const { isRemaining, title: listTitle } = table;
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const totalPrinted = rows.length;

        let tableRowsHtml = '';
        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (!cells || cells.length < 5) return;
            let rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            const expertCode = cells[0] ? cells[0].innerText.trim() : '-';
            const fullCode = cells[1] ? cells[1].innerText.trim() : '-';
            const regDate = cells[2] ? cells[2].innerText.trim() : '-';
            const judge = cells[3] ? cells[3].innerText.trim() : '-';
            const expert = cells[4] ? cells[4].innerText.trim() : '-';
            const nextSession = (isRemaining && cells[5]) ? cells[5].innerText.trim() : '';

            tableRowsHtml += `
                <tr style="background:${rowBg};">
                    <td style="border:1px solid #d1d5db;padding:6px 10px;font-weight:700;text-align:center;">${expertCode}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;direction:ltr;">${fullCode}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${regDate}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${judge}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${expert}</td>
                    ${isRemaining ? `<td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${nextSession}</td>` : ''}
                </tr>`;
        });

        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        const originalTitle = document.title;
        document.title = `إدارة ملفات المحاكم - ${listTitle} - ${dateStr}`;

        printContainer.innerHTML = `
            <table style="width: 100%; border: none; border-collapse: collapse; direction: rtl; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff;">
                <thead><tr><td style="border: none; height: 35px;"></td></tr></thead>
                <tbody>
                    <tr>
                        <td style="border: none; padding: 15px 36px;">
                            <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:2.5px solid #1e3a8a;padding-bottom:10px;margin-bottom:16px;">
                                <div style="text-align:right;font-size:0.88rem;font-weight:700;line-height:1.9;">
                                    المملكة المغربية<br>وزارة العدل<br>محكمة الاستئناف الادارية فاس
                                </div>
                                <div style="text-align:center;padding:0 16px;">
                                    <img src="/static/img/Picture1.png" style="height:62px;width:auto;object-fit:contain;">
                                </div>
                                <div style="text-align:left;font-size:0.75rem;font-weight:700;line-height:1.9;font-family:'Ebrima',sans-serif;direction:ltr;">
                                    ⵜⴰⴳⵍⴷⵉⵜ ⵏ ⵍⵎⵖⵔⵉⴱ<br>ⵜⴰⵎⴰⵡⵙⵜ ⵏ ⵜⵥⵔⴼⵜ<br>ⵜⴰⵙⵏⴱⴹⴰⵢⵜ ⵏ ⵡⴰⵍⴰⵙ ⵜⴰⵎⵙⵙⵓⴳⵓⵔⵜ ⴷⵉ ⴼⴰⵙ
                                </div>
                            </div>
                            <div style="text-align:center;margin-bottom:14px;">
                                <h2 style="font-size:1.1rem;font-weight:700;color:#1e3a8a;margin:0 0 3px 0;text-decoration:underline;">${listTitle}</h2>
                                <div style="font-size:0.82rem;color:#64748b;">حرر في: ${dateStr}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:700;color:#1e3a8a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;margin-bottom:16px;">
                                إجمالي الملفات: <span style="font-size:1.2rem;color:#0f172a;border:1.5px solid #1e3a8a;border-radius:6px;padding:0 10px;">${totalPrinted}</span>
                            </div>
                            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                                <thead>
                                    <tr style="background:#1e3a8a;">
                                        <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">رقم ملف الخبرة</th>
                                        <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">الرقم الكامل للملف</th>
                                        <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">تاريخ التسجيل</th>
                                        <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">القاضي أو المستشار المقرّر</th>
                                        <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">الخبير المعين</th>
                                        ${isRemaining ? '<th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">تاريخ الجلسة المقبلة</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                            <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:0.82rem;color:#475569;border-top:1px dashed #e2e8f0;padding-top:10px;">
                                <span>تم التحرير بواسطة نظام إدارة ملفات المحاكم</span>
                                <span>${dateStr}</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
                <tfoot><tr><td style="border: none; height: 15px;"></td></tr></tfoot>
            </table>
        `;

        const printImg = printContainer.querySelector('img');
        const doPrint = () => {
            window.print();
            setTimeout(() => {
                printContainer.innerHTML = '';
                document.title = originalTitle;
            }, 600);
        };
        if (printImg && !printImg.complete) {
            printImg.onload = doPrint;
            printImg.onerror = doPrint;
        } else {
            setTimeout(doPrint, 200);
        }
    }

    const btnPrintStatsDossierList = document.getElementById('btnPrintStatsDossierList');
    if (btnPrintStatsDossierList) {
        btnPrintStatsDossierList.addEventListener('click', triggerStatsDossierListPrint);
    }

    function exportActiveDossierList() {
        const table = getActiveDossierListTable();
        if (!table || !table.tbody) return;
        const rows = Array.from(table.tbody.querySelectorAll('tr'));
        if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan]'))) {
            showAlert('لا توجد بيانات لتصديرها.');
            return;
        }

        const { isRemaining, title: listTitle } = table;
            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const totalPrinted = rows.length;

            const headers = [
                'رقم ملف الخبرة',
                'الرقم الكامل للملف',
                'تاريخ التسجيل',
                'القاضي أو المستشار المقرّر',
                'الخبير المعين'
            ];
            if (isRemaining) headers.push('تاريخ الجلسة المقبلة');

            let rowsHtml = '';
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (!cells || cells.length < 5) return;
                rowsHtml += '<tr>';
                const indices = isRemaining ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
                indices.forEach(idx => {
                    const txt = cells[idx] ? cells[idx].innerText.trim() : '-';
                    rowsHtml += `<td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${txt}</td>`;
                });
                rowsHtml += '</tr>';
            });

            const colspan = isRemaining ? 6 : 5;
            const excelTemplate = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                <!--[if gte mso 9]>
                <xml>
                <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                <x:Name>القائمة</x:Name>
                <x:WorksheetOptions>
                <x:DisplayGridlines/>
                </x:WorksheetOptions>
                </x:ExcelWorksheet>
                </x:ExcelWorksheets>
                </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
                    table { border-collapse: collapse; width: 100%; }
                    th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: center; }
                </style>
                </head>
                <body>
                    <table dir="rtl">
                        <tr>
                            <td colspan="${colspan}" style="font-weight:bold; font-size:14pt; text-align:right; border:none; padding-bottom:5px;">
                                المملكة المغربية
                            </td>
                        </tr>
                        <tr>
                            <td colspan="${colspan}" style="font-weight:bold; font-size:12pt; text-align:right; border:none; padding-bottom:5px;">
                                وزارة العدل
                            </td>
                        </tr>
                        <tr>
                            <td colspan="${colspan}" style="font-weight:bold; font-size:12pt; text-align:right; border:none; padding-bottom:15px;">
                                محكمة الاستئناف الادارية فاس
                            </td>
                        </tr>
                        <tr>
                            <td colspan="${colspan}" style="font-weight:bold; font-size:16pt; color:#1e3a8a; text-align:center; border:none; padding-bottom:5px;">
                                ${listTitle}
                            </td>
                        </tr>
                        <tr>
                            <td colspan="${colspan}" style="font-size:10pt; color:#64748b; text-align:center; border:none; padding-bottom:15px;">
                                حرر في: ${dateStr}
                            </td>
                        </tr>
                        <tr>
                            <td colspan="${colspan}" style="background-color:#f8fafc; border:1px solid #e2e8f0; font-weight:bold; padding:10px; text-align:right;">
                                إجمالي الملفات: ${totalPrinted}
                            </td>
                        </tr>
                        <tr><td colspan="${colspan}" style="border:none; height:15px;"></td></tr>
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const filename = `قائمة_الملفات_${stamp}.xls`;

            fetch('/api/export-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: excelTemplate, filename })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showAlert(`✅ تم تصدير الملف بنجاح إلى:\n${data.path}`, data.path);
                    } else if (data.cancelled) {
                        console.log('Export cancelled by user.');
                    } else {
                        showAlert('❌ فشل تصدير الملف: ' + (data.error || 'خطأ غير معروف'));
                    }
                })
                .catch(err => showAlert('❌ فشل تصدير الملف: ' + err.message));
    }

    const btnPrintDossierListModal = document.getElementById('btnPrintDossierListModal');
    if (btnPrintDossierListModal) {
        btnPrintDossierListModal.addEventListener('click', triggerStatsDossierListPrint);
    }

    const btnExportDossierListModal = document.getElementById('btnExportDossierListModal');
    if (btnExportDossierListModal) {
        btnExportDossierListModal.addEventListener('click', exportActiveDossierList);
    }

    if (btnStatsCopyReport) {
        btnStatsCopyReport.addEventListener('click', () => {
            const year = document.getElementById('statsYearTitle').textContent;
            const reg = document.getElementById('statRegistered').textContent;
            const act = document.getElementById('statActive').textContent;
            const comp = document.getElementById('statCompleted').textContent;
            const cls = document.getElementById('statClosed').textContent;
            const rem = document.getElementById('statRemaining').textContent;
            const avgTime = document.getElementById('statAverageTime') ? document.getElementById('statAverageTime').textContent : '0 يوم';

            const reportText = `تقرير إحصائيات مكتب الخبرة لسنة ${year}:\n` +
                `- المسجل: ${reg}\n` +
                `- الرائج: ${act}\n` +
                `- المنجز: ${comp}\n` +
                `- المغلق: ${cls}\n` +
                `- الباقي (في طور الإنجاز): ${rem}\n` +
                `- متوسط مدة الإنجاز: ${avgTime}`;

            // Log the copy event
            fetch('/api/log-client-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `نسخ التقرير الإحصائي للحافظة: ${year.trim()}` })
            }).catch(() => { });

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

    const triggerPrint = () => {
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
            const statsYearTitle = document.getElementById('statsYearTitle');
            const selectedYear = statsYearTitle ? statsYearTitle.textContent.trim() : '';

            let pdfTitle = 'إدارة ملفات المحاكم _';
            if (selectedOption) {
                pdfTitle += ` ${selectedOption}`;
            }
            if (selectedYear === 'فترة مخصصة' || selectedYear === 'فترة') {
                const startFormatted = startDate.replace(/\//g, '-');
                const endFormatted = endDate.replace(/\//g, '-');
                pdfTitle += ` من ${startFormatted} إلى ${endFormatted}`;
            } else if (selectedYear) {
                pdfTitle += ` ${selectedYear}`;
            }

            const originalTitle = document.title;
            document.title = pdfTitle.trim();

            const logoCircleImg = document.querySelector('.logo-circle img');
            printContainer.innerHTML = `
    <table style="width: 100%; border: none; border-collapse: collapse; direction: rtl; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
        <thead><tr><td style="border: none; height: 35px;"></td></tr></thead>
        <tbody>
            <tr>
                <td style="border: none; padding: 0;">
                    <div class="header" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding-top: 10px; padding-bottom: 10px; margin-bottom: 15px;">
                        <div class="right-header" style="text-align: right; font-size: 1.1rem; font-weight: bold; line-height: 2.2;">
                            المملكة المغربية<br>وزارة العدل<br>محكمة الاستئناف الادارية فاس
                        </div>
                        <div class="middle-header" style="text-align: center; padding: 0 20px;">
                            <img src="/static/img/Picture1.png" style="height: 80px; width: auto; object-fit: contain;">
                        </div>
                        <div class="left-header" style="text-align: left; font-size: 0.95rem; font-weight: bold; line-height: 2.1; font-family: 'Ebrima', sans-serif;">
                            ⵜⴰⴳⵍⴷⵉⵜ ⵏ ⵍⵎⵖⵔⵉⴱ<br>ⵜⴰⵎⴰⵡⵙⵜ ⵏ ⵜⵥⵔⴼⵜ<br>ⵜⴰⵙⵏⴱⴹⴰⵢⵜ ⵏ ⵡⴰⵍⴰⵙ ⵜⴰⵎⵙⵙⵓⴳⵓⵔⵜ ⴷⵉ ⴼⴰⵙ
                        </div>
                    </div>
                    <div class="report-title" style="text-align: center; font-size: 1.5rem; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #000; text-decoration: underline;">
                        نشاط شعبة الخبرة من ${startDate} إلى غاية ${endDate}
                    </div>
                    <table style="width: 80%; margin: 30px auto 0 auto; border-collapse: collapse; font-size: 1.25rem;">
        <thead>
            <tr>
                <th style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff; font-weight: bold; width: 50%;">الحالة</th>
                <th style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #f3f4f6; font-weight: bold; width: 50%;">العدد</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المسجل</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${reg}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>الرائج</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${act}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المنجز</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${comp}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المغلق (تم صرف النظر عنه)</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${cls}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>الباقي (في طور الإنجاز)</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${rem}</td>
            </tr>
        </tbody>
    </table>
    <div class="footer" style="margin-top: 25px; text-align: left; font-size: 1.1rem; padding-left: 50px;">
        حرر في: ${(() => {
                    const d = new Date();
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                })()}
    </div>
                `;

            // Log the print event
            fetch('/api/log-client-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `طباعة تقرير إحصائي: ${pdfTitle.trim()}` })
            }).catch(() => { });

            // Wait for the logo image to finish loading so it appears in the print view
            const printImg = printContainer.querySelector('img');
            const doPrint = () => {
                window.print();
                printContainer.innerHTML = '';
                document.title = originalTitle;
            };

            if (printImg && !printImg.complete) {
                printImg.onload = doPrint;
                printImg.onerror = doPrint;
            } else {
                setTimeout(doPrint, 250);
            }
        }
    };

    if (btnStatsPrintReport) {
        btnStatsPrintReport.addEventListener('click', () => triggerPrint());
    }

    const btnStatsCopyReportSection = document.getElementById('btnStatsCopyReportSection');
    if (btnStatsCopyReportSection) {
        btnStatsCopyReportSection.addEventListener('click', () => {
            const year = document.getElementById('statsYearTitleSection').textContent;
            const reg = document.getElementById('statRegisteredSection').textContent;
            const act = document.getElementById('statActiveSection').textContent;
            const comp = document.getElementById('statCompletedSection').textContent;
            const cls = document.getElementById('statClosedSection').textContent;
            const rem = document.getElementById('statRemainingSection').textContent;
            const avgTime = document.getElementById('statAverageTimeSection') ? document.getElementById('statAverageTimeSection').textContent : '0 يوم';

            const reportText = `تقرير إحصائيات مكتب الخبرة لسنة ${year}:\n` +
                `- المسجل: ${reg}\n` +
                `- الرائج: ${act}\n` +
                `- المنجز: ${comp}\n` +
                `- المغلق: ${cls}\n` +
                `- الباقي (في طور الإنجاز): ${rem}\n` +
                `- متوسط مدة الإنجاز: ${avgTime}`;

            fetch('/api/log-client-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `نسخ التقرير الإحصائي للحافظة (القسم): ${year.trim()}` })
            }).catch(() => { });

            navigator.clipboard.writeText(reportText).then(() => {
                showAlert('تم نسخ التقرير الإحصائي إلى الحافظة بنجاح!');
            }).catch(err => {
                const textArea = document.createElement("textarea");
                textArea.value = reportText;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showAlert('تم نسخ التقرير الإحصائي إلى الحافظة بنجاح!');
                } catch (e) {
                    showAlert('فشل في نسخ التقرير.');
                }
                document.body.removeChild(textArea);
            });
        });
    }

    const btnStatsPrintReportSection = document.getElementById('btnStatsPrintReportSection');
    if (btnStatsPrintReportSection) {
        btnStatsPrintReportSection.addEventListener('click', () => {
            const startDate = document.getElementById('statsStartDateSection').textContent;
            const endDate = document.getElementById('statsEndDateSection').textContent;
            const reg = document.getElementById('statRegisteredSection').textContent;
            const act = document.getElementById('statActiveSection').textContent;
            const comp = document.getElementById('statCompletedSection').textContent;
            const cls = document.getElementById('statClosedSection').textContent;
            const rem = document.getElementById('statRemainingSection').textContent;

            const printContainer = document.getElementById('printContainer');
            if (printContainer) {
                const statsYearTitle = document.getElementById('statsYearTitleSection');
                const selectedYear = statsYearTitle ? statsYearTitle.textContent.trim() : '';

                let pdfTitle = 'إدارة ملفات المحاكم _ إحصائيات';
                if (selectedYear) {
                    pdfTitle += ` ${selectedYear}`;
                }

                const originalTitle = document.title;
                document.title = pdfTitle.trim();

                printContainer.innerHTML = `
    <table style="width: 100%; border: none; border-collapse: collapse; direction: rtl; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
        <thead><tr><td style="border: none; height: 35px;"></td></tr></thead>
        <tbody>
            <tr>
                <td style="border: none; padding: 0;">
                    <div class="header" style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding-top: 10px; padding-bottom: 10px; margin-bottom: 15px;">
                        <div class="right-header" style="text-align: right; font-size: 1.1rem; font-weight: bold; line-height: 2.2;">
                            المملكة المغربية<br>وزارة العدل<br>محكمة الاستئناف الادارية فاس
                        </div>
                        <div class="middle-header" style="text-align: center; padding: 0 20px;">
                            <img src="/static/img/Picture1.png" style="height: 80px; width: auto; object-fit: contain;">
                        </div>
                        <div class="left-header" style="text-align: left; font-size: 0.95rem; font-weight: bold; line-height: 2.1; font-family: 'Ebrima', sans-serif;">
                            ⵜⴰⴳⵍⴷⵉⵜ ⵏ ⵍⵎⵖⵔⵉⴱ<br>ⵜⴰⵎⴰⵡⵙⵜ ⵏ ⵜⵥⵔⴼⵜ<br>ⵜⴰⵙⵏⴱⴹⴰⵢⵜ ⵏ ⵡⴰⵍⴰⵙ ⵜⴰⵎⵙⵙⵓⴳⵓⵔⵜ ⴷⵉ ⴼⴰⵙ
                        </div>
                    </div>
                    <div class="report-title" style="text-align: center; font-size: 1.5rem; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #000; text-decoration: underline;">
                        نشاط شعبة الخبرة من ${startDate} إلى غاية ${endDate}
                    </div>
                    <table style="width: 80%; margin: 30px auto 0 auto; border-collapse: collapse; font-size: 1.25rem;">
        <thead>
            <tr>
                <th style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff; font-weight: bold; width: 50%;">الحالة</th>
                <th style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #f3f4f6; font-weight: bold; width: 50%;">العدد</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المسجل</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${reg}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>الرائج</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${act}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المنجز</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${comp}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>المغلق (تم صرف النظر عنه)</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${cls}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center; background-color: #92D050; color: #ffffff;"><strong>الباقي (في طور الإنجاز)</strong></td>
                <td style="border: 1px solid #000; padding: 10px 15px; text-align: center;">${rem}</td>
            </tr>
        </tbody>
    </table>
    <div class="footer" style="margin-top: 25px; text-align: left; font-size: 1.1rem; padding-left: 50px;">
        حرر في: ${(() => {
                    const d = new Date();
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                })()}
    </div>
                `;

            fetch('/api/log-client-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `طباعة تقرير إحصائي (القسم): ${pdfTitle.trim()}` })
            }).catch(() => { });

            const printImg = printContainer.querySelector('img');
            const doPrint = () => {
                window.print();
                printContainer.innerHTML = '';
                document.title = originalTitle;
            };

            if (printImg && !printImg.complete) {
                printImg.onload = doPrint;
                printImg.onerror = doPrint;
            } else {
                setTimeout(doPrint, 250);
            }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Smart Table Print — prints only the currently filtered rows
    // (respects active tab + all search/filter state)
    // ui-ux-pro-max placement: summary stats block BETWEEN letterhead
    // and table — gives reader instant context before scanning rows.
    // ─────────────────────────────────────────────────────────────
    function triggerTablePrint(printLabel) {
        const rows = Array.from(dossiersTableBody.querySelectorAll('tr:not(.skeleton-row)'));
        if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan]'))) {
            showAlert('\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0637\u0628\u0627\u0639\u062a\u0647\u0627. \u0642\u0645 \u0628\u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0623\u0648 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u0623\u0648\u0644\u0627\u064b.');
            return;
        }

        // Count rows per urgency colour (from row class)
        let redCount = 0, orangeCount = 0, greenCount = 0, completedCount = 0;
        rows.forEach(row => {
            if (row.classList.contains('row-red')) redCount++;
            else if (row.classList.contains('row-orange')) orangeCount++;
            else if (row.classList.contains('row-green')) greenCount++;
            else if (row.classList.contains('row-completed')) completedCount++;
        });
        const totalPrinted = rows.length;

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const tabLabel = currentTab === 'pending' ? '\u0627\u0644\u0642\u0636\u0627\u064a\u0627 \u0627\u0644\u062c\u0627\u0631\u064a\u0629' : '\u0627\u0644\u0642\u0636\u0627\u064a\u0627 \u0627\u0644\u0645\u0646\u062c\u0632\u0629';

        // Build table rows for print using currently rendered cell text content
        // ORIGINAL table cell indices (screen order, unchanged):
        //   [0]=رقم الملف  [1]=الرمز الكامل  [2]=الفئة  [3]=حالة الملف
        //   [4]=تاريخ التسجيل  [5]=تاريخ انتهاء الأجل  [6]=الأيام المتبقية
        //   [7]=درجة الاستعجال  [8]=المقرر  [9]=المستأنف  [10]=المستأنف عليه  [11]=نوع القضية
        // Print column order requested:
        //   الرمز الكامل[1] | المستشار المقرر[8] | تاريخ التسجيل[4] | تاريخ انتهاء الأجل[5] | درجة الاستعجال[7] | الأيام المتبقية[6]
        let tableRowsHtml = '';
        rows.forEach((row, idx) => {
            const cells = row.querySelectorAll('td');
            if (!cells || cells.length < 9) return;

            const fullCode = cells[1] ? cells[1].innerText.trim() : '-';
            const judge = cells[8] ? cells[8].innerText.trim() : '-';
            const urgency = cells[7] ? cells[7].innerText.trim() : '-';
            const days = cells[6] ? cells[6].innerText.trim() : '-';
            const regDate = cells[4] ? cells[4].innerText.trim() : '-';
            const expDate = cells[5] ? cells[5].innerText.trim() : '-';


            let urgColor = '#16a34a';
            if (row.classList.contains('row-red')) urgColor = '#dc2626';
            if (row.classList.contains('row-orange')) urgColor = '#d97706';

            let rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            if (row.classList.contains('row-red')) rowBg = '#fff1f2';
            if (row.classList.contains('row-orange')) rowBg = '#fffbeb';
            if (row.classList.contains('row-green')) rowBg = '#f0fdf4';
            if (row.classList.contains('row-completed')) rowBg = '#f1f5f9';

            let breakStyle = (idx === 11 && rows.length > 12) ? 'page-break-after: always; break-after: page;' : '';
            tableRowsHtml += `
                <tr style="background:${rowBg}; ${breakStyle}">
                    <td style="border:1px solid #d1d5db;padding:6px 10px;font-weight:700;text-align:center;">${fullCode}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${judge}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${regDate}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;">${expDate}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;direction:ltr;">${days}</td>
                    <td style="border:1px solid #d1d5db;padding:6px 10px;text-align:center;color:${urgColor};font-weight:700;">${urgency}</td>
                </tr>`;
        });

        // Build urgency summary badges for the stats block (ui-ux-pro-max: between header & table)
        let urgencySummary = '';
        if (currentTab === 'pending') {
            urgencySummary = `
                <span style="display:inline-flex;align-items:center;gap:5px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:4px 12px;font-weight:700;color:#dc2626;">
                    \u2022 \u0639\u0627\u062c\u0644 \u062c\u062f\u0627\u064b: ${redCount}
                </span>
                <span style="display:inline-flex;align-items:center;gap:5px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:4px 12px;font-weight:700;color:#d97706;">
                    \u2022 \u0645\u062a\u0648\u0633\u0637: ${orangeCount}
                </span>
                <span style="display:inline-flex;align-items:center;gap:5px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:4px 12px;font-weight:700;color:#16a34a;">
                    \u2022 \u0622\u0645\u0646: ${greenCount}
                </span>`;
        } else {
            urgencySummary = `<span style="display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 12px;font-weight:700;color:#475569;">\u2022 \u0645\u0646\u062c\u0632: ${completedCount}</span>`;
        }

        const printContainer = document.getElementById('printContainer');
        if (!printContainer) return;

        const originalTitle = document.title;
        document.title = `\u0625\u062f\u0627\u0631\u0629 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062d\u0627\u0643\u0645 - ${printLabel} - ${tabLabel} - ${dateStr}`;

        printContainer.innerHTML = `
            <table style="width: 100%; border: none; border-collapse: collapse; direction: rtl; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff;">
                <thead><tr><td style="border: none; height: 35px;"></td></tr></thead>
                <tbody>
                    <tr>
                        <td style="border: none; padding: 15px 36px;">
                            <!-- Letterhead -->
                            <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:2.5px solid #1e3a8a;padding-bottom:10px;margin-bottom:16px;">
                    <div style="text-align:right;font-size:0.88rem;font-weight:700;line-height:1.9;">
                        \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u063a\u0631\u0628\u064a\u0629<br>
                        \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0639\u062f\u0644<br>
                        \u0645\u062d\u0643\u0645\u0629 \u0627\u0644\u0627\u0633\u062a\u0626\u0646\u0627\u0641 \u0627\u0644\u0627\u062f\u0627\u0631\u064a\u0629 \u0641\u0627\u0633
                    </div>
                    <div style="text-align:center;padding:0 16px;">
                        <img src="/static/img/Picture1.png" style="height:62px;width:auto;object-fit:contain;">
                    </div>
                    <div style="text-align:left;font-size:0.75rem;font-weight:700;line-height:1.9;font-family:'Ebrima',sans-serif;direction:ltr;">
                        ⵜⴰⴳⵍⴷⵉⵜ ⵏ ⵍⵎⵖⵔⵉⴱ<br>
                        ⵜⴰⵎⴰⵡⵙⵜ ⵏ ⵜⵥⵔⴼⵜ<br>
                        ⵜⴰⵙⵏⴱⴹⴰⵢⵜ ⵏ ⵡⴰⵍⴰⵙ ⵜⴰⵎⵙⵙⵓⴳⵓⵔⵜ ⴷⵉ ⴼⴰⵙ
                    </div>
                </div>

                <!-- Report title -->
                <div style="text-align:center;margin-bottom:14px;">
                    <h2 style="font-size:1.1rem;font-weight:700;color:#1e3a8a;margin:0 0 3px 0;text-decoration:underline;">${printLabel} &mdash; ${tabLabel}</h2>
                    <div style="font-size:0.82rem;color:#64748b;">\u062d\u0631\u0631 \u0641\u064a: ${dateStr}</div>
                </div>

                <!-- ── Summary stats block (ui-ux-pro-max: between header & table) ── -->
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px;margin-bottom:16px;">
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.9rem;font-weight:700;color:#1e3a8a;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0629:
                        <span style="font-size:1.2rem;color:#0f172a;border:1.5px solid #1e3a8a;border-radius:6px;padding:0 10px;">${totalPrinted}</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:0.82rem;">
                        ${urgencySummary}
                    </div>
                </div>

                <!-- Data table -->
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                    <thead>
                        <tr style="background:#1e3a8a;">
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">الرمز الكامل للملف</th>
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">المستشار المقرر</th>
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">تاريخ التسجيل</th>
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">تاريخ انتهاء الأجل</th>
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">الأيام المتبقية</th>
                            <th style="border:1px solid #93c5fd;padding:8px 10px;color:#fff;text-align:center;font-weight:700;">درجة الاستعجال</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>

                <!-- Footer signature line -->
                <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:0.82rem;color:#475569;border-top:1px dashed #e2e8f0;padding-top:10px;">
                    <span>\u062a\u0645 \u0627\u0644\u062a\u062d\u0631\u064a\u0631 \u0628\u0648\u0627\u0633\u0637\u0629 \u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062d\u0627\u0643\u0645</span>
                    <span>${dateStr}</span>
                </div>
                        </td>
                    </tr>
                </tbody>
                <tfoot><tr><td style="border: none; height: 15px;"></td></tr></tfoot>
            </table>
        `;

        fetch('/api/log-client-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `\u0637\u0628\u0627\u0639\u0629 \u062c\u062f\u0648\u0644: ${printLabel} - ${tabLabel} (${totalPrinted} \u0645\u0644\u0641)` })
        }).catch(() => { });

        const printImg = printContainer.querySelector('img');
        const doPrint = () => {
            window.print();
            setTimeout(() => {
                printContainer.innerHTML = '';
                document.title = originalTitle;
            }, 600);
        };
        if (printImg && !printImg.complete) {
            printImg.onload = doPrint;
            printImg.onerror = doPrint;
        } else {
            setTimeout(doPrint, 200);
        }
    }

    // Single print button
    const btnPrintTable = document.getElementById('btnPrintTable');
    if (btnPrintTable) btnPrintTable.addEventListener('click', () => triggerTablePrint('\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0642\u0636\u0627\u064a\u0627'));    // Excel export button — exports currently visible filtered rows as a real styled Excel file (.xls)
    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            const rows = Array.from(dossiersTableBody.querySelectorAll('tr:not(.skeleton-row)'));
            if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan]'))) {
                showAlert('\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u062a\u0635\u062f\u064a\u0631\u0647\u0627.');
                return;
            }

            // Count statistics
            let redCount = 0, orangeCount = 0, greenCount = 0, completedCount = 0;
            rows.forEach(row => {
                if (row.classList.contains('row-red')) redCount++;
                else if (row.classList.contains('row-orange')) orangeCount++;
                else if (row.classList.contains('row-green')) greenCount++;
                else if (row.classList.contains('row-completed')) completedCount++;
            });
            const totalPrinted = rows.length;

            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const tabLabel = currentTab === 'pending' ? '\u0627\u0644\u0642\u0636\u0627\u064a\u0627 \u0627\u0644\u062c\u0627\u0631\u064a\u0629' : '\u0627\u0644\u0642\u0636\u0627\u064a\u0627 \u0627\u0644\u0645\u0646\u062c\u0632\u0629';

            // Generate statistical display
            let statsHtml = '';
            if (currentTab === 'pending') {
                statsHtml = `\u0639\u0627\u062c\u0644 \u062c\u062f\u0627\u064b: ${redCount} | \u0645\u062a\u0648\u0633\u0637: ${orangeCount} | \u0622\u0645\u0646: ${greenCount}`;
            } else {
                statsHtml = `\u0645\u0646\u062c\u0632: ${completedCount}`;
            }

            // Table headers (excluding status checkbox)
            const headers = [
                '\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641',
                '\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0644\u0645\u0644\u0641',
                '\u0627\u0644\u0641\u0626\u0629',
                '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644',
                '\u062a\u0627\u0631\u064a\u062e \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0623\u062c\u0644',
                '\u0627\u0644\u0623\u064a\u0627\u0645 \u0627\u0644\u0645\u062a\u0628\u0642\u064a\u0629',
                '\u062f\u0631\u062c\u0629 \u0627\u0633\u062a\u0639\u062c\u0627\u0644',
                '\u0627\u0644\u0645\u0642\u0631\u0631 (\u0627\u0644\u0642\u0627\u0636\u064a)',
                '\u0627\u0644\u0645\u0633\u062a\u0623\u0646\u0641',
                '\u0627\u0644\u0645\u0633\u062a\u0623\u0646\u0641 \u0639\u0644\u064a\u0647',
                '\u0646\u0648\u0639 \u0627\u0644\u0642\u0636\u0627\u064a\u0629'
            ];

            // Build rows
            let rowsHtml = '';
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (!cells || cells.length < 12) return;

                // Urgency/Completion background colors for cells
                let cellBg = '#ffffff';
                if (row.classList.contains('row-red')) cellBg = '#fff1f2';
                else if (row.classList.contains('row-orange')) cellBg = '#fffbeb';
                else if (row.classList.contains('row-green')) cellBg = '#f0fdf4';
                else if (row.classList.contains('row-completed')) cellBg = '#f1f5f9';

                rowsHtml += '<tr>';
                // Output indices: 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11 (Skip 3 which is status checkbox)
                [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11].forEach(idx => {
                    const txt = cells[idx] ? cells[idx].innerText.trim() : '-';
                    rowsHtml += `<td style="background:${cellBg};border:1px solid #cbd5e1;padding:6px;text-align:center;">${txt}</td>`;
                });
                rowsHtml += '</tr>';
            });

            // XML/HTML template for Excel (.xls) compatibility with RTL
            const excelTemplate = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
                <!--[if gte mso 9]>
                <xml>
                <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                <x:Name>${tabLabel}</x:Name>
                <x:WorksheetOptions>
                <x:DisplayGridlines/>
                </x:WorksheetOptions>
                </x:ExcelWorksheet>
                </x:ExcelWorksheets>
                </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
                    table { border-collapse: collapse; width: 100%; }
                    th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: center; }
                </style>
                </head>
                <body>
                    <table dir="rtl">
                        <!-- Letterhead in Excel -->
                        <tr>
                            <td colspan="11" style="font-weight:bold; font-size:14pt; text-align:right; border:none; padding-bottom:5px;">
                                \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u063a\u0631\u0628\u064a\u0629
                            </td>
                        </tr>
                        <tr>
                            <td colspan="11" style="font-weight:bold; font-size:12pt; text-align:right; border:none; padding-bottom:5px;">
                                \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0639\u062f\u0644
                            </td>
                        </tr>
                        <tr>
                            <td colspan="11" style="font-weight:bold; font-size:12pt; text-align:right; border:none; padding-bottom:15px;">
                                \u0645\u062d\u0643\u0645\u0629 \u0627\u0644\u0627\u0633\u062a\u0626\u0646\u0627\u0641 \u0627\u0644\u0627\u062f\u0627\u0631\u064a\u0629 \u0641\u0627\u0633
                            </td>
                        </tr>
                        <tr>
                            <td colspan="11" style="font-weight:bold; font-size:16pt; color:#1e3a8a; text-align:center; border:none; padding-bottom:5px;">
                                \u062a\u0642\u0631\u064a\u0631 \u0625\u062f\u0627\u0631\u0629 \u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u062d\u0627\u0643\u0645 &mdash; ${tabLabel}
                            </td>
                        </tr>
                        <tr>
                            <td colspan="11" style="font-size:10pt; color:#64748b; text-align:center; border:none; padding-bottom:15px;">
                                \u062d\u0631\u0631 \u0641\u064a: ${dateStr}
                            </td>
                        </tr>
                        <!-- Summary stats block -->
                        <tr>
                            <td colspan="11" style="background-color:#f8fafc; border:1px solid #e2e8f0; font-weight:bold; padding:10px; text-align:right;">
                                \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0645\u0635\u062f\u0631\u0629: ${totalPrinted} &nbsp;|&nbsp; ${statsHtml}
                            </td>
                        </tr>
                        <tr><td colspan="11" style="border:none; height:15px;"></td></tr>
                        <!-- Header Row -->
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const filename = `تقرير_القضايا_${tabLabel.replace(/\s+/g, '_')}_${stamp}.xls`;

            // In pywebview/WebView2 neither blob URLs nor HTTP file responses trigger downloads.
            // Flask writes the file directly to the user's Downloads folder and returns the path.
            fetch('/api/export-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: excelTemplate, filename })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        showAlert(`✅ تم تصدير الملف بنجاح إلى:\n${data.path}`, data.path);
                    } else if (data.cancelled) {
                        console.log('Export cancelled by user.');
                    } else {
                        showAlert('❌ فشل تصدير الملف: ' + (data.error || 'خطأ غير معروف'));
                    }
                })
                .catch(err => showAlert('❌ فشل تصدير الملف: ' + err.message));
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
                            } else if (statusData.status === 'idle') {
                                bannerText.textContent = `تم العثور على تحديث جديد (${data.latest_version})، جاري بدء التحميل...`;
                                if (progressText) progressText.textContent = '';
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
    loadCredentials();
    checkUpdate();

    // Fix for Ctrl+C text copying in PyWebView
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            try {
                const selection = window.getSelection();
                if (selection && selection.toString()) {
                    document.execCommand('copy');
                }
            } catch (err) {
                console.error('Copy failed:', err);
            }
        }
    });
});


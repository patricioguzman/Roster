
            document.addEventListener('DOMContentLoaded', () => {
                lucide.createIcons();
                let currentLang = 'en-AU';
                let appData = { stores: [], members: [], shifts: [], settings: {} };
                let memberMgmtFilterStoreId = 'all';
                let memberMgmtSearchQuery = '';
                let hoursChart = null, budgetChart = null, currentView = 'fortnight', isAdmin = false, isDragging = false, dragStartCell = null;
                const getLocalYMD = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const getMonday = (d) => {
                    const date = new Date(d);
                    date.setHours(0, 0, 0, 0);
                    const day = date.getDay();
                    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                    return new Date(date.setDate(diff));
                };
                const dom = {
                    loginBtn: document.getElementById('loginBtn'), logoutBtn: document.getElementById('logoutBtn'), loginModal: document.getElementById('loginModal'), closeLoginModalBtn: document.getElementById('closeLoginModalBtn'), loginForm: document.getElementById('loginForm'), loginError: document.getElementById('loginError'),
                    openEngineRulesBtn: document.getElementById('openEngineRulesBtn'), engineRulesModal: document.getElementById('engineRulesModal'), closeEngineRulesModalBtn: document.getElementById('closeEngineRulesModalBtn'), engineRulesForm: document.getElementById('engineRulesForm'), ruleBaseRate: document.getElementById('ruleBaseRate'), ruleSatMult: document.getElementById('ruleSatMult'), ruleSunMult: document.getElementById('ruleSunMult'), rulePhMult: document.getElementById('rulePhMult'),
                    openStoresBtn: document.getElementById('openStoresBtn'), storesModal: document.getElementById('storesModal'), closeStoresModalBtn: document.getElementById('closeStoresModalBtn'), addStoreForm: document.getElementById('addStoreForm'), storesList: document.getElementById('storesList'),
                    openMembersBtn: document.getElementById('openMembersBtn'), membersModal: document.getElementById('membersModal'), closeMembersModalBtn: document.getElementById('closeMembersModalBtn'), addMemberForm: document.getElementById('addMemberForm'), membersList: document.getElementById('membersList'), memberStoresCheckboxes: document.getElementById('memberStoresCheckboxes'),
                    memberSearchInput: document.getElementById('memberSearchInput'), memberMgmtStoreFilter: document.getElementById('memberMgmtStoreFilter'), memberMgmtQuickPills: document.getElementById('memberMgmtQuickPills'),
                    exportPdfBtn: document.getElementById('exportPdfBtn'), mainExportBtn: document.getElementById('mainExportBtn'), exportModal: document.getElementById('exportModal'), closeExportModalBtn: document.getElementById('closeExportModalBtn'), employeeSelectForDownload: document.getElementById('employeeSelectForDownload'), downloadPersonalBtn: document.getElementById('downloadPersonalBtn'), addToGoogleCalBtn: document.getElementById('addToGoogleCalBtn'),
                    storeSelector: document.getElementById('storeSelector'), editorStoreSelector: document.getElementById('editorStoreSelector'), weekStartDateInput: document.getElementById('weekStartDate'), viewSelectorButtons: document.querySelectorAll('.view-btn'),
                    scheduleContainer: document.getElementById('schedule-container'),
                    staffNameSelect: document.getElementById('staffNameSelect'), weeklyEditorContainer: document.getElementById('weekly-editor-container'), weeklyTotalHours: document.getElementById('weekly-total-hours'),
                    quickEditPopup: document.getElementById('quickEditPopup'), quickEditStart: document.getElementById('quickEditStart'), quickEditEnd: document.getElementById('quickEditEnd'), quickEditApplyBtn: document.getElementById('quickEditApplyBtn'), quickEditClearBtn: document.getElementById('quickEditClearBtn'), quickEditCancelBtn: document.getElementById('quickEditCancelBtn'),
                    toast: document.getElementById('toast'), toastMessage: document.getElementById('toast-message'),
                    adminControls: document.querySelectorAll('.admin-only'), employeeHeaderControls: document.querySelectorAll('.employee-only'), shiftEditor: document.getElementById('shift-editor'),
                    liveClock: document.getElementById('liveClock'),

                    openSidebarBtn: document.getElementById('openSidebarBtn'), closeSidebarBtn: document.getElementById('closeSidebarBtn'), saasSidebar: document.getElementById('saasSidebar'), sidebarOverlay: document.getElementById('sidebarOverlay'),
                    sidebarExportBtn: document.getElementById('sidebarExportBtn'), sidebarPdfBtn: document.getElementById('sidebarPdfBtn'), sidebarSyncBtn: document.getElementById('sidebarSyncBtn')
                };

                function updateLiveClock() {
                    if (!dom.liveClock) return;
                    const now = new Date();
                    const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
                    dom.liveClock.textContent = now.toLocaleDateString(currentLang, opts).replace(',', ' |');
                }
                setInterval(updateLiveClock, 1000);
                updateLiveClock();

                function openSidebar() {
                    dom.sidebarOverlay.classList.remove('hidden');
                    // Quick timeout to allow display:block to apply before opacity transition
                    setTimeout(() => {
                        dom.sidebarOverlay.classList.remove('opacity-0');
                        dom.saasSidebar.classList.remove('-translate-x-full');
                    }, 10);
                }

                function closeSidebar() {
                    dom.sidebarOverlay.classList.add('opacity-0');
                    dom.saasSidebar.classList.add('-translate-x-full');
                    setTimeout(() => {
                        dom.sidebarOverlay.classList.add('hidden');
                    }, 300);
                }

                if (dom.openSidebarBtn) dom.openSidebarBtn.addEventListener('click', openSidebar);
                if (dom.closeSidebarBtn) dom.closeSidebarBtn.addEventListener('click', closeSidebar);
                if (dom.sidebarOverlay) dom.sidebarOverlay.addEventListener('click', closeSidebar);

                function loadData() {
                    const token = localStorage.getItem('token');
                    const headers = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    return fetch(`/api/data?_t=${Date.now()}`, { headers }).then(res => {
                        if (res.status === 401 || res.status === 403) {
                            logoutAdmin();
                        }
                        return res.json();
                    }).then(data => {
                        const existingStoreId = appData.currentStoreId;
                        appData = { ...appData, ...data };
                        // Preserve the user's currently selected store if possible
                        if (existingStoreId && appData.stores.some(s => s.id === existingStoreId)) {
                            appData.currentStoreId = existingStoreId;
                        } else if (!appData.currentStoreId && appData.stores.length > 0) {
                            appData.currentStoreId = appData.stores[0].id;
                        }
                        renderEngineRules(); updateAllViews();
                    }).catch(e => console.error('Data load error:', e));
                }

                const getCurrentStoreMembers = () => appData.members.filter(m => m.storeIds && m.storeIds.includes(appData.currentStoreId));
                const getCurrentStoreShifts = () => appData.shifts.filter(s => s.storeId === appData.currentStoreId);

                function showToast(msg, isErr = false) {
                    dom.toastMessage.textContent = msg; dom.toast.classList.remove('bg-green-500', 'bg-red-500');
                    dom.toast.classList.add(isErr ? 'bg-red-500' : 'bg-green-500');
                    dom.toast.classList.remove('opacity-0', 'invisible'); setTimeout(() => dom.toast.classList.add('opacity-0', 'invisible'), 3000);
                }

                function toggleModal(m) {
                    if (m.classList.contains('hidden')) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); m.querySelector('.modal-content')?.classList.remove('scale-95'); }
                    else { m.classList.add('opacity-0'); m.querySelector('.modal-content')?.classList.add('scale-95'); setTimeout(() => m.classList.add('hidden'), 300); }
                }

                function renderMembers() {
                    // Update dropdown and pills sync if options exist
                    if (dom.memberMgmtStoreFilter.options.length <= 1 && appData.stores.length > 0) {
                        dom.memberMgmtStoreFilter.innerHTML = '<option value="all">All stores</option>' +
                            appData.stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

                        dom.memberMgmtQuickPills.innerHTML = '<button class="store-pill active text-xs px-3 py-1 bg-orange-600 text-white rounded-full transition-colors" data-store-id="all">All</button>' +
                            appData.stores.map(s => `<button class="store-pill text-xs px-3 py-1 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-full transition-colors" data-store-id="${s.id}">${s.name}</button>`).join('');

                        // Attach pill click events
                        dom.memberMgmtQuickPills.querySelectorAll('.store-pill').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                dom.memberMgmtStoreFilter.value = btn.dataset.storeId;
                                dom.memberMgmtStoreFilter.dispatchEvent(new Event('change'));
                            });
                        });
                    }

                    let ms = appData.members;

                    // Keep the store selector logic independent of schedule context
                    if (memberMgmtFilterStoreId !== 'all') {
                        ms = ms.filter(m => m.storeIds && m.storeIds.includes(parseInt(memberMgmtFilterStoreId)));
                    }

                    if (memberMgmtSearchQuery) {
                        const q = memberMgmtSearchQuery.toLowerCase();
                        ms = ms.filter(m => (m.name && m.name.toLowerCase().includes(q)) ||
                            (m.phone && m.phone.toLowerCase().includes(q)) ||
                            (m.email && m.email.toLowerCase().includes(q)));
                    }

                    dom.membersList.innerHTML = ms.length ? '' : '<div class="text-sm text-gray-500 py-4 text-center">No members found</div>';

                    ms.forEach(m => {
                        const li = document.createElement('li'); li.className = 'bg-gray-800 p-3 rounded flex justify-between items-center';

                        let badgesHtml = '';
                        if (memberMgmtFilterStoreId === 'all' && m.storeIds && m.storeIds.length > 0) {
                            badgesHtml = '<div class="flex flex-wrap gap-1 mt-1">';
                            m.storeIds.forEach(sid => {
                                const st = appData.stores.find(s => s.id === sid);
                                if (st) badgesHtml += `<span class="bg-gray-900 border border-gray-700 text-[10px] text-gray-400 px-1.5 py-0.5 rounded">${st.name}</span>`;
                            });
                            badgesHtml += '</div>';
                        }

                        li.innerHTML = `<div class="flex flex-col"><span class="font-medium">${m.name}</span>${badgesHtml}</div><div class="flex gap-2"><button class="edit-m text-blue-400 hover:text-blue-300 p-2" data-id="${m.id}"><i data-lucide="edit-2" class="w-4 h-4"></i></button><button class="del-m text-red-500 hover:text-red-400 p-2" data-id="${m.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>`;
                        dom.membersList.appendChild(li);
                    });
                    lucide.createIcons();
                    dom.membersList.querySelectorAll('.edit-m').forEach(b => b.addEventListener('click', () => editMember(b.dataset.id)));
                    dom.membersList.querySelectorAll('.del-m').forEach(b => b.addEventListener('click', () => {
                        if (!confirm('Are you sure you want to delete this member?')) return;
                        const token = localStorage.getItem('token');
                        fetch(`/api/members/${b.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).then(() => loadData());
                    }));
                    // Only populate checkboxes if not in edit mode
                    if (!dom.addMemberForm.dataset.editId) {
                        const allowedStores = isAdmin ? appData.stores : appData.stores.filter(s => (appData.currentUserManagedStoreIds || []).includes(s.id));
                        dom.memberStoresCheckboxes.innerHTML = allowedStores.map(s => `<label class="flex items-center gap-2"><input type="checkbox" value="${s.id}" ${s.id === appData.currentStoreId ? 'checked' : ''}>${s.name}</label>`).join('');
                    }
                }

                function editMember(id) {
                    const m = appData.members.find(x => x.id === parseInt(id));
                    if (!m) return;
                    dom.addMemberForm.dataset.editId = m.id;
                    document.getElementById('memberFormTitle').textContent = 'Edit Member (Auto-saves)';
                    document.getElementById('memberSubmitBtn').classList.add('hidden');
                    document.getElementById('memberCancelBtn').textContent = 'Close';
                    document.getElementById('memberCancelBtn').classList.remove('hidden');
                    document.getElementById('memberName').value = m.name;
                    document.getElementById('memberPhone').value = m.phone || '';
                    document.getElementById('memberEmail').value = m.email || '';
                    document.getElementById('memberEmploymentType').value = m.employmentType || 'casual';
                    const allowedStores = isAdmin ? appData.stores : appData.stores.filter(s => (appData.currentUserManagedStoreIds || []).includes(s.id));
                    dom.memberStoresCheckboxes.innerHTML = allowedStores.map(s => `<label class="flex items-center gap-2"><input type="checkbox" value="${s.id}" ${(m.storeIds || []).includes(s.id) ? 'checked' : ''}>${s.name}</label>`).join('');
                }

                function resetMemberForm() {
                    delete dom.addMemberForm.dataset.editId;
                    document.getElementById('memberFormTitle').textContent = 'Add Member';
                    document.getElementById('memberSubmitBtn').classList.remove('hidden');
                    document.getElementById('memberSubmitBtn').textContent = 'Add';
                    document.getElementById('memberCancelBtn').classList.add('hidden');
                    document.getElementById('memberCancelBtn').textContent = 'Cancel';
                    dom.addMemberForm.reset();
                    renderMembers();
                }

                function renderStoresList() {
                    dom.storesList.innerHTML = appData.stores.map(s => `<li class="bg-gray-800 p-2 rounded flex justify-between items-center"><span><b>${s.name}</b>: ${s.maxHours}h</span><div class="flex gap-2"><button class="edit-s text-blue-400 hover:text-blue-300" data-id="${s.id}"><i data-lucide="edit-2" class="w-4 h-4"></i></button><button class="del-s text-red-500 hover:text-red-400" data-id="${s.id}"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></li>`).join('');
                    lucide.createIcons();
                    dom.storesList.querySelectorAll('.edit-s').forEach(b => b.addEventListener('click', () => editStore(b.dataset.id)));
                    dom.storesList.querySelectorAll('.del-s').forEach(b => b.addEventListener('click', () => {
                        if (!confirm('Are you sure you want to delete this store? This will also remove any assigned shifts!')) return;
                        const token = localStorage.getItem('token');
                        fetch(`/api/stores/${b.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).then(() => loadData());
                    }));
                }

                function editStore(id) {
                    const s = appData.stores.find(x => x.id === parseInt(id));
                    if (!s) return;
                    dom.addStoreForm.dataset.editId = s.id;
                    document.getElementById('storeFormTitle').textContent = 'Edit Store (Auto-saves)';
                    document.getElementById('storeSubmitBtn').classList.add('hidden');
                    document.getElementById('storeCancelBtn').textContent = 'Close';
                    document.getElementById('storeCancelBtn').classList.remove('hidden');
                    document.getElementById('storeName').value = s.name;
                    document.getElementById('storeMaxHours').value = s.maxHours || '';
                }

                function resetStoreForm() {
                    delete dom.addStoreForm.dataset.editId;
                    document.getElementById('storeFormTitle').textContent = 'Add New Store';
                    document.getElementById('storeSubmitBtn').classList.remove('hidden');
                    document.getElementById('storeSubmitBtn').textContent = 'Add';
                    document.getElementById('storeCancelBtn').classList.add('hidden');
                    document.getElementById('storeCancelBtn').textContent = 'Cancel';
                    dom.addStoreForm.reset();
                }

                function updateAllViews() {
                    const nameSelect = dom.staffNameSelect; const cur = nameSelect.value;
                    const members = getCurrentStoreMembers();
                    if (members.length === 0) {
                        nameSelect.innerHTML = '<option value="">No employees assigned to this store</option>';
                    } else {
                        nameSelect.innerHTML = '<option value="">Select Employee</option>' + members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
                    }
                    nameSelect.value = cur;
                    dom.employeeSelectForDownload.innerHTML = nameSelect.innerHTML;
                    dom.storeSelector.innerHTML = appData.stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                    dom.storeSelector.value = appData.currentStoreId;
                    if (dom.editorStoreSelector) {
                        dom.editorStoreSelector.innerHTML = dom.storeSelector.innerHTML;
                        dom.editorStoreSelector.value = appData.currentStoreId;
                    }

                    // Update Total Hours Label based on view
                    const lbl = document.getElementById('total-hours-label');
                    if (lbl) {
                        const count = currentView === 'day' ? 1 : currentView === '3-day' ? 3 : currentView === 'fortnight' ? 14 : 7;
                        lbl.textContent = `Total Hours (${count} Days)`;
                    }

                    renderMembers(); renderStoresList(); renderWeeklyEditor(); updateCalendarView(); updateDashboard();
                }

                function updateCalendarView() {
                    const sDate = new Date(dom.weekStartDateInput.value + 'T00:00:00');
                    const count = currentView === 'day' ? 1 : currentView === '3-day' ? 3 : currentView === 'fortnight' ? 14 : 7;
                    const members = getCurrentStoreMembers(); const shifts = getCurrentStoreShifts();
                    const membersToRender = !appData.currentStoreId ? [{ name: '' }, { name: '' }, { name: '' }, { name: '' }, { name: '' }] : members;

                    // Get today's string in Melbourne time to highlight "Today" accurately regardless of server UTC time
                    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
                    const y = parts.find(p => p.type === 'year').value;
                    const m = parts.find(p => p.type === 'month').value;
                    const day = parts.find(p => p.type === 'day').value;
                    const todayStr = `${y}-${m}-${day}`;

                    // Conditionally shrink text and padding for the 14-day view to fit more on screen
                    const isFortnight = count === 14;
                    const cellPadding = isFortnight ? 'p-1 md:p-1.5' : 'p-2';
                    const headerTextSizes = isFortnight ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm';
                    const empNameColWidth = isFortnight ? 'min-w-[100px] text-xs' : 'min-w-[140px] text-sm';
                    const shiftTextSize = isFortnight ? 'text-[9px] md:text-[11px]' : 'text-xs';

                    let table = `<table id="schedule-table" class="min-w-full divide-y divide-gray-200" style="table-layout: fixed;"><thead class="bg-gray-50"><tr><th class="sticky left-0 bg-gray-50 z-10 ${cellPadding} border-r ${empNameColWidth}">Employee</th>`;
                    for (let i = 0; i < count; i++) {
                        const d = new Date(sDate); d.setDate(sDate.getDate() + i);
                        const ds = getLocalYMD(d);
                        const isToday = ds === todayStr;
                        table += `<th class="${cellPadding} border-r text-center font-bold overflow-hidden ${headerTextSizes} ${isToday ? 'bg-orange-100 text-orange-600 border-t-4 border-t-orange-500' : 'text-gray-500'}">${d.toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric' })}${isToday ? ' <br><span class="text-[8px] uppercase font-black tracking-widest text-orange-500">Today</span>' : ''}</th>`;
                    }
                    table += '</tr></thead><tbody class="divide-y divide-gray-200">';
                    membersToRender.forEach(m => {
                        const isSelected = dom.staffNameSelect.value === m.name;
                        table += `<tr class="employee-row cursor-pointer transition-colors ${isSelected ? 'bg-orange-100 border-orange-400 border-2' : 'hover:bg-gray-50'}" data-row-name="${m.name}"><td class="sticky left-0 ${isSelected ? 'bg-orange-100' : 'bg-white'} z-10 ${cellPadding} border-r font-bold text-gray-900 cell-name truncate ${empNameColWidth}" data-name="${m.name}" title="${m.name}">${m.name}</td>`;
                        for (let i = 0; i < count; i++) {
                            const d = new Date(sDate); d.setDate(sDate.getDate() + i); const ds = getLocalYMD(d);
                            const s = shifts.find(sh => sh.name === m.name && sh.date === ds);
                            const isToday = ds === todayStr;

                            let cellBg = isToday ? 'bg-orange-50/50' : 'bg-white';
                            if (s) cellBg = isSelected ? 'bg-orange-200 border-orange-500 border' : (isToday ? 'bg-orange-100' : 'bg-orange-50');

                            table += `<td class="${cellPadding} border-r text-center shift-cell overflow-hidden ${cellBg} ${!s ? 'text-gray-300' : ''}" data-member-name="${m.name}" data-date="${ds}">${s ? `<div class="font-bold text-gray-900 ${shiftTextSize}">${s.startTime}-${s.endTime}</div>` : `<span class="text-[8px] md:text-[10px]">No shift</span>`}</td>`;
                        }
                        table += '</tr>';
                    });
                    table += '</tbody></table>';

                    if (!appData.currentStoreId) {
                        table += `
                            <div class="absolute inset-0 z-20 backdrop-blur-md bg-white/50 flex flex-col items-center justify-center rounded-xl shadow-inner pointer-events-auto">
                                <div class="bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-2xl text-center max-w-md mx-auto transform -translate-y-4">
                                    <i data-lucide="store" class="w-16 h-16 text-orange-500 mx-auto mb-4"></i>
                                    <h3 class="text-2xl font-bold text-white mb-2">Select a Store First</h3>
                                    <p class="text-gray-400 text-base">To view the schedule and assignments, please choose a store from the dropdown menu at the top.</p>
                                </div>
                            </div>
                        `;
                    }

                    dom.scheduleContainer.innerHTML = table;
                    if (!appData.currentStoreId) lucide.createIcons({ root: dom.scheduleContainer });
                    dom.scheduleContainer.querySelectorAll('.employee-row').forEach(row => {
                        row.addEventListener('click', (e) => {
                            const cell = e.target.closest('.shift-cell');
                            const dateCellClicked = cell ? cell.dataset.date : null;

                            const name = row.dataset.rowName;
                            if (dom.staffNameSelect.value !== name) {
                                dom.staffNameSelect.value = name;
                                renderWeeklyEditor();
                                updateCalendarView();
                                // Select the clicked cell
                                setTimeout(() => {
                                    const newCell = dom.scheduleContainer.querySelector(`.shift-cell[data-member-name="${name}"][data-date="${dateCellClicked}"]`);
                                    if (newCell) {
                                        newCell.classList.add('selected-cell');
                                        const correspondingRow = dom.weeklyEditorContainer.querySelector(`div[data-date="${dateCellClicked}"]`);
                                        if (correspondingRow) {
                                            const cb = correspondingRow.querySelector('input[type="checkbox"]');
                                            const inputs = correspondingRow.querySelectorAll('input[type="time"]');
                                            if (!cb.checked) {
                                                cb.checked = true;
                                                inputs.forEach(inp => inp.disabled = false);
                                                if (!inputs[0].value) inputs[0].value = "09:00";
                                                if (!inputs[1].value) inputs[1].value = "17:00";
                                            }
                                        }
                                    }
                                }, 50);
                            } else if (dateCellClicked) {
                                // If same employee, toggle selection visual and checkbox
                                if (cell) cell.classList.toggle('selected-cell');

                                const correspondingRow = dom.weeklyEditorContainer.querySelector(`div[data-date="${dateCellClicked}"]`);
                                if (correspondingRow) {
                                    const cb = correspondingRow.querySelector('input[type="checkbox"]');
                                    const inputs = correspondingRow.querySelectorAll('input[type="time"]');
                                    cb.checked = !cb.checked;
                                    inputs.forEach(inp => inp.disabled = !cb.checked);
                                    if (cb.checked) {
                                        if (!inputs[0].value) inputs[0].value = "09:00";
                                        if (!inputs[1].value) inputs[1].value = "17:00";
                                    }
                                }
                            }

                            dom.shiftEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                    });
                }

                function updateDashboard() {
                    // Dashboard was removed in the SaaS UI update
                }

                function calculateShiftPay(h, ds) {
                    const s = appData.settings; const base = parseFloat(s.base_rate) || 35.0; const d = new Date(ds + 'T00:00:00').getDay();
                    if (d === 6) return h * base * (parseFloat(s.sat_mult) || 1.2);
                    if (d === 0) return h * base * (parseFloat(s.sun_mult) || 1.4);
                    return h * base;
                }

                function renderEngineRules() {
                    const s = appData.settings; dom.ruleBaseRate.value = s.base_rate || 35.0; dom.ruleSatMult.value = s.sat_mult || 1.2; dom.ruleSunMult.value = s.sun_mult || 1.4; dom.rulePhMult.value = s.ph_mult || 2.0;
                }

                function renderWeeklyEditor() {
                    const name = dom.staffNameSelect.value; dom.weeklyEditorContainer.innerHTML = '';
                    if (!name) {
                        dom.weeklyEditorContainer.innerHTML = '<div class="text-gray-400 text-center py-8 italic border border-dashed border-gray-700 rounded-lg bg-black/50">Select an employee or click on cells to start</div>';
                        document.getElementById('quick-fill-container').classList.add('hidden');
                        return;
                    }
                    document.getElementById('quick-fill-container').classList.remove('hidden');

                    const start = new Date(dom.weekStartDateInput.value + 'T00:00:00'); const shifts = getCurrentStoreShifts();
                    const count = currentView === 'day' ? 1 : currentView === '3-day' ? 3 : currentView === 'fortnight' ? 14 : 7;

                    for (let i = 0; i < count; i++) {
                        const d = new Date(start); d.setDate(start.getDate() + i); const ds = getLocalYMD(d);
                        const s = shifts.find(sh => sh.name === name && sh.date === ds);
                        const row = document.createElement('div'); row.className = 'flex items-center gap-2 p-1 bg-gray-800 rounded'; row.dataset.date = ds;
                        row.innerHTML = `
                        <input type="checkbox" ${s ? 'checked' : ''} class="w-4 h-4">
                        <span class="w-12 text-xs">${d.toLocaleDateString(currentLang, { weekday: 'short' })}</span>
                        <div class="relative flex items-center">
                            <i data-lucide="clock" class="absolute left-1.5 w-3 h-3 text-gray-500 pointer-events-none"></i>
                            <input type="time" value="${s ? s.startTime : ''}" class="bg-black pl-6 pr-1 py-1 rounded text-xs w-[100px]" ${!s ? 'disabled' : ''}>
                        </div>
                        <span class="text-xs text-gray-400">-</span>
                        <div class="relative flex items-center">
                            <i data-lucide="clock" class="absolute left-1.5 w-3 h-3 text-gray-500 pointer-events-none"></i>
                            <input type="time" value="${s ? s.endTime : ''}" class="bg-black pl-6 pr-1 py-1 rounded text-xs w-[100px]" ${!s ? 'disabled' : ''}>
                        </div>
                    `;
                        dom.weeklyEditorContainer.appendChild(row);
                        const cb = row.querySelector('input[type="checkbox"]'), inputs = row.querySelectorAll('input[type="time"]');
                        cb.addEventListener('change', () => { inputs.forEach(inp => inp.disabled = !cb.checked); updateWeeklyHours(); });
                        inputs.forEach(inp => inp.addEventListener('input', updateWeeklyHours));
                    }
                    updateWeeklyHours();
                }

                function updateWeeklyHours() {
                    let total = 0;
                    let checkedCount = 0;
                    dom.weeklyEditorContainer.querySelectorAll('div[data-date]').forEach(row => {
                        const cb = row.querySelector('input[type="checkbox"]'), inputs = row.querySelectorAll('input[type="time"]');
                        if (cb.checked) {
                            checkedCount++;
                            if (inputs[0].value && inputs[1].value) {
                                const diffHours = (new Date(`2000-01-01T${inputs[1].value}`) - new Date(`2000-01-01T${inputs[0].value}`)) / 3600000;
                                if (diffHours > 0) {
                                    total += diffHours;
                                }
                            }
                        }
                    });
                    dom.weeklyTotalHours.textContent = total.toFixed(1);

                    clearTimeout(shiftAutoSaveTimeout);
                    shiftAutoSaveTimeout = setTimeout(() => {
                        saveWeekShifts(true);
                    }, 800);
                }

                let shiftAutoSaveTimeout;
                async function saveWeekShifts(isAuto = false) {
                    const name = dom.staffNameSelect.value; if (!name) return;
                    const repeatCount = parseInt(document.getElementById('repeatWeeksSelect')?.value) || 0;

                    const items = [], delIds = [], current = getCurrentStoreShifts().filter(s => s.name === name);
                    dom.weeklyEditorContainer.querySelectorAll('div[data-date]').forEach(row => {
                        const ds = row.dataset.date, cb = row.querySelector('input[type="checkbox"]'), inputs = row.querySelectorAll('input[type="time"]'), existing = current.find(s => s.date === ds);
                        if (cb.checked && inputs[0].value && inputs[1].value) {
                            const dur = (new Date(`2000-01-01T${inputs[1].value}`) - new Date(`2000-01-01T${inputs[0].value}`)) / 3600000;
                            if (dur > 0) {
                                items.push({ id: existing ? existing.id : `new_${Date.now()}_0_${ds}`, name, date: ds, startTime: inputs[0].value, endTime: inputs[1].value, duration: dur.toFixed(2), storeId: appData.currentStoreId });

                                // Generate future repeating shifts
                                for (let w = 1; w <= repeatCount; w++) {
                                    let nextDate = new Date(ds + 'T00:00:00');
                                    nextDate.setDate(nextDate.getDate() + (w * 7));
                                    let nextDs = getLocalYMD(nextDate);
                                    let futureExisting = current.find(s => s.date === nextDs);
                                    items.push({ id: futureExisting ? futureExisting.id : `new_${Date.now()}_${w}_${ds}`, name, date: nextDs, startTime: inputs[0].value, endTime: inputs[1].value, duration: dur.toFixed(2), storeId: appData.currentStoreId });
                                }
                            }
                        } else if (existing) delIds.push(existing.id);
                    });
                    const token = localStorage.getItem('token');
                    fetch('/api/shifts/week', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ saveShifts: items, deleteShifts: delIds }) }).then(() => {
                        if (!isAuto && document.getElementById('repeatWeeksSelect')) document.getElementById('repeatWeeksSelect').value = "0";
                        fetch('/api/data').then(res => res.json()).then(data => {
                            appData = { ...appData, ...data };
                            if (!isAuto) renderWeeklyEditor();
                            updateCalendarView();
                            updateDashboard();
                            if (isAuto && items.length > 0) showToast('Shifts saved auto');
                        });
                    });
                }

                function enterAuthMode(role) {
                    isAdmin = (role === 'admin');
                    isManager = (role === 'manager' || role === 'admin');

                    dom.loginBtn.classList.add('hidden');
                    dom.logoutBtn.classList.remove('hidden');

                    if (isAdmin) {
                        dom.adminControls.forEach(el => el.classList.remove('hidden'));
                    }
                    if (isManager) {
                        document.querySelectorAll('.manager-only').forEach(el => el.classList.remove('hidden'));
                    }
                    dom.employeeHeaderControls.forEach(el => el.classList.add('hidden'));
                    updateAllViews();
                }

                function logoutAdmin() {
                    isAdmin = false; isManager = false;
                    localStorage.removeItem('token'); localStorage.removeItem('userRole');
                    dom.loginBtn.classList.remove('hidden'); dom.logoutBtn.classList.add('hidden');
                    dom.adminControls.forEach(el => el.classList.add('hidden'));
                    document.querySelectorAll('.manager-only').forEach(el => el.classList.add('hidden'));
                    dom.employeeHeaderControls.forEach(el => el.classList.remove('hidden'));
                    updateAllViews();
                }


                function exportDataToPDF() {
                    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
                    const sDate = new Date(dom.weekStartDateInput.value + 'T00:00:00');
                    const count = currentView === 'day' ? 1 : currentView === '3-day' ? 3 : currentView === 'fortnight' ? 14 : 7;
                    const members = getCurrentStoreMembers(); const shifts = getCurrentStoreShifts();

                    let headRow = ['Employee'];
                    for (let i = 0; i < count; i++) { const d = new Date(sDate); d.setDate(sDate.getDate() + i); headRow.push(d.toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric' })); }

                    const body = members.map(m => {
                        const row = [m.name];
                        for (let i = 0; i < count; i++) {
                            const d = new Date(sDate); d.setDate(sDate.getDate() + i); const ds = getLocalYMD(d);
                            const s = shifts.find(sh => sh.name === m.name && sh.date === ds);
                            row.push(s ? `${s.startTime}-${s.endTime}` : '');
                        }
                        return row;
                    });

                    doc.autoTable({ head: [headRow], body, theme: 'grid' });

                    const earn = members.map(m => {
                        let cost = 0;
                        shifts.filter(s => s.name === m.name).forEach(s => {
                            const d = new Date(s.date + 'T00:00:00');
                            if (d >= sDate && d < new Date(sDate).setDate(sDate.getDate() + count)) cost += calculateShiftPay(parseFloat(s.duration), s.date);
                        });
                        return [m.name, m.employmentType === 'full_time' ? 'Salary' : '$' + (appData.settings?.base_rate || 33.19), '$' + cost.toFixed(2)];
                    });
                    doc.autoTable({ startY: doc.lastAutoTable.finalY + 10, head: [['Name', 'Rate', 'Total']], body: earn });
                    doc.save('roster.pdf');
                }

                // Events
                dom.loginBtn.addEventListener('click', () => toggleModal(dom.loginModal)); dom.closeLoginModalBtn.addEventListener('click', () => toggleModal(dom.loginModal));
                dom.loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: dom.loginForm.username.value, password: dom.loginForm.password.value }) });
                    if (res.ok) {
                        const d = await res.json();
                        localStorage.setItem('token', d.token);
                        localStorage.setItem('userRole', d.role);
                        enterAuthMode(d.role);
                        toggleModal(dom.loginModal);
                    } else {
                        dom.loginError.textContent = 'Invalid credentials';
                        dom.loginError.classList.remove('hidden');
                    }
                });
                dom.logoutBtn.addEventListener('click', logoutAdmin);
                dom.openEngineRulesBtn.addEventListener('click', () => toggleModal(dom.engineRulesModal)); dom.closeEngineRulesModalBtn.addEventListener('click', () => toggleModal(dom.engineRulesModal));
                dom.engineRulesForm.addEventListener('submit', async (e) => {
                    e.preventDefault(); const s = { base_rate: dom.ruleBaseRate.value, sat_mult: dom.ruleSatMult.value, sun_mult: dom.ruleSunMult.value, ph_mult: dom.rulePhMult.value };
                    const token = localStorage.getItem('token');
                    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(s) });
                    loadData(); toggleModal(dom.engineRulesModal);
                });
                dom.openStoresBtn.addEventListener('click', () => toggleModal(dom.storesModal)); dom.closeStoresModalBtn.addEventListener('click', () => { resetStoreForm(); toggleModal(dom.storesModal); });
                dom.openMembersBtn.addEventListener('click', () => {
                    memberMgmtFilterStoreId = 'all';
                    memberMgmtSearchQuery = '';
                    if (dom.memberSearchInput) dom.memberSearchInput.value = '';
                    if (dom.memberMgmtStoreFilter) dom.memberMgmtStoreFilter.value = 'all';
                    toggleModal(dom.membersModal);
                    renderMembers();
                });
                dom.closeMembersModalBtn.addEventListener('click', () => { resetMemberForm(); toggleModal(dom.membersModal); });

                if (dom.memberSearchInput) {
                    dom.memberSearchInput.addEventListener('input', (e) => {
                        memberMgmtSearchQuery = e.target.value;
                        renderMembers();
                    });
                }
                if (dom.memberMgmtStoreFilter) {
                    dom.memberMgmtStoreFilter.addEventListener('change', (e) => {
                        memberMgmtFilterStoreId = e.target.value;
                        // Ensure pills sync visual state
                        dom.memberMgmtQuickPills.querySelectorAll('.store-pill').forEach(btn => {
                            if (btn.dataset.storeId === memberMgmtFilterStoreId) {
                                btn.classList.remove('bg-gray-800', 'text-gray-300', 'hover:bg-gray-700');
                                btn.classList.add('bg-orange-600', 'text-white', 'active');
                            } else {
                                btn.classList.add('bg-gray-800', 'text-gray-300', 'hover:bg-gray-700');
                                btn.classList.remove('bg-orange-600', 'text-white', 'active');
                            }
                        });
                        renderMembers();
                    });
                }
                async function generateRosterXLSX() {
                    try {
                        let storeId = dom.storeSelector.value || 'all';
                        const start = dom.weekStartDateInput.value || getLocalYMD(new Date());
                        let end = '';
                        if (currentView === 'fortnight') {
                            end = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 13)));
                        } else {
                            end = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 6)));
                        }

                        const token = localStorage.getItem('token');
                        const res = await fetch(`/api/exports/roster?storeId=${storeId}&startDate=${start}&endDate=${end}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (!res.ok) throw new Error(await res.text());
                        
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        let fileNamePrefix = storeId === 'all' ? 'All_Stores' : 'Store_' + storeId;
                        a.download = `Roster_${fileNamePrefix}_${start}_to_${end}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                        
                    } catch (e) {
                        console.error('Export Error:', e);
                        showToast('Error exporting roster: ' + e.message, true);
                    }
                }

                if (dom.sidebarExportBtn) {
                    dom.sidebarExportBtn.addEventListener('click', () => {
                        closeSidebar();
                        generateRosterXLSX();
                    });
                }

                if (dom.sidebarPdfBtn) {
                    dom.sidebarPdfBtn.addEventListener('click', () => {
                        closeSidebar();
                        exportDataToPDF();
                    });
                }

                if (dom.sidebarSyncBtn) {
                    dom.sidebarSyncBtn.addEventListener('click', () => {
                        closeSidebar();
                        // If they pick sync, show the calendar modal format
                        toggleModal(dom.exportModal);
                    });
                }

                if (dom.closeExportModalBtn) dom.closeExportModalBtn.addEventListener('click', () => toggleModal(dom.exportModal));

                // Route old admin buttons to close sidebar as well
                if (dom.openEngineRulesBtn) dom.openEngineRulesBtn.addEventListener('click', closeSidebar);
                if (dom.openStoresBtn) dom.openStoresBtn.addEventListener('click', closeSidebar);
                if (dom.openMembersBtn) dom.openMembersBtn.addEventListener('click', closeSidebar);

                // Quick Fill logic
                const applyQuickFillBtn = document.getElementById('quickFillBtn');
                const quickFillStart = document.getElementById('quickFillStart');
                const quickFillEnd = document.getElementById('quickFillEnd');

                if (applyQuickFillBtn && quickFillStart && quickFillEnd) {
                    applyQuickFillBtn.addEventListener('click', () => {
                        const startVal = quickFillStart.value;
                        const endVal = quickFillEnd.value;
                        if (!startVal || !endVal) {
                            alert('Please select both a start and end time.');
                            return;
                        }

                        dom.weeklyEditorContainer.querySelectorAll('div[data-date]').forEach(row => {
                            const cb = row.querySelector('input[type="checkbox"]');
                            const inputs = row.querySelectorAll('input[type="time"]');
                            // Apply to ALL days, check them automatically
                            cb.checked = true;
                            inputs.forEach(inp => inp.disabled = false);
                            inputs[0].value = startVal;
                            inputs[1].value = endVal;
                        });

                        updateWeeklyHours();
                        saveWeekShifts(true); // Save automatically for seamless experience
                    });
                }

                // -------------------------------------------------------------
                // Calendar Integration logic for ICS / Google
                // -------------------------------------------------------------
                function generateCalendarEvents(format) {
                    const name = dom.employeeSelectForDownload.value;
                    if (!name) return alert('Select an employee first');

                    const storeObj = appData.stores.find(s => s.id === appData.currentStoreId);
                    const storeName = storeObj ? storeObj.name : 'Store';

                    const memberShifts = appData.shifts.filter(s => s.memberId === parseInt(appData.members.find(m => m.name === name)?.id) && s.storeId === appData.currentStoreId);
                    if (memberShifts.length === 0) return alert('No shifts found for this employee in the current store.');

                    // Filter by visible week logic (basic approximation)
                    const startStr = dom.weekStartDateInput.value;
                    if (!startStr) return;

                    if (format === 'google') {
                        // Google Calendar only takes 1 event via URL params. Let's use the FIRST upcoming shift.
                        // Or compile a single multi-day event - but for retail, it's better to just provide the first shift.
                        // Actually, let's open multiple tabs if there's less than 5 shifts, but popup blockers block this.
                        // Best way: Google cal link for the earliest shift in the view block.
                        memberShifts.sort((a, b) => new Date(a.date) - new Date(b.date));
                        const nextShift = memberShifts[0];
                        const sDate = new Date(`${nextShift.date}T${nextShift.startTime}`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
                        const eDate = new Date(`${nextShift.date}T${nextShift.endTime}`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');

                        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Shift at ${encodeURIComponent(storeName)}&dates=${sDate}/${eDate}&details=Employee: ${encodeURIComponent(name)}%0AStore: ${encodeURIComponent(storeName)}&location=${encodeURIComponent(storeName)}`;
                        window.open(gcalUrl, '_blank');
                        return;
                    }

                    if (format === 'ics') {
                        let ics = "BEGIN:VCALENDAR\\nVERSION:2.0\\nPRODID:-//RosterManager//EN\\n";
                        memberShifts.forEach(s => {
                            const sDate = new Date(`${s.date}T${s.startTime}`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
                            const eDate = new Date(`${s.date}T${s.endTime}`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');
                            ics += "BEGIN:VEVENT\\n";
                            ics += `UID:${s.id}-${Date.now()}@rostermanager\\n`;
                            ics += `DTSTAMP:${sDate}\\n`;
                            ics += `DTSTART:${sDate}\\n`;
                            ics += `DTEND:${eDate}\\n`;
                            ics += `SUMMARY:Shift at ${storeName}\\n`;
                            ics += `DESCRIPTION:Shift for ${name}\\n`;
                            ics += `LOCATION:${storeName}\\n`;
                            ics += "END:VEVENT\\n";
                        });
                        ics += "END:VCALENDAR";

                        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `roster_${name.replace(/\\s+/g, '_')}.ics`;
                        link.click();
                    }
                }

                if (dom.downloadPersonalBtn) dom.downloadPersonalBtn.addEventListener('click', () => generateCalendarEvents('ics'));
                if (dom.addToGoogleCalBtn) dom.addToGoogleCalBtn.addEventListener('click', () => generateCalendarEvents('google'));

                dom.storeSelector.addEventListener('change', () => { appData.currentStoreId = parseInt(dom.storeSelector.value); updateAllViews(); });
                if (dom.editorStoreSelector) dom.editorStoreSelector.addEventListener('change', () => { appData.currentStoreId = parseInt(dom.editorStoreSelector.value); updateAllViews(); });
                dom.staffNameSelect.addEventListener('change', () => { renderWeeklyEditor(); updateCalendarView(); });
                dom.weekStartDateInput.addEventListener('change', updateAllViews);
                dom.viewSelectorButtons = document.querySelectorAll('.view-btn');
                dom.viewSelectorButtons.forEach(b => b.addEventListener('click', () => {
                    currentView = b.dataset.view;
                    dom.viewSelectorButtons.forEach(x => {
                        x.classList.remove('active', 'bg-orange-500', 'text-white', 'font-bold');
                        x.classList.add('text-gray-300', 'hover:bg-gray-800', 'hover:bg-gray-700'); // Add both hovers back safely
                        if (x.dataset.view === currentView) {
                            x.classList.add('active', 'bg-orange-500', 'text-white', 'font-bold');
                            x.classList.remove('text-gray-300', 'hover:bg-gray-800', 'hover:bg-gray-700');
                        }
                    });
                    updateAllViews();
                }));



                let storeAutoSaveTimeout;

                async function autoSaveStore() {
                    const id = dom.addStoreForm.dataset.editId;
                    if (!id) return; // Only auto-save in edit mode

                    const nameEl = document.getElementById('storeName');
                    const maxHoursEl = document.getElementById('storeMaxHours');
                    if (!nameEl.value) return;

                    const body = JSON.stringify({ name: nameEl.value, maxHours: maxHoursEl.value });
                    const token = localStorage.getItem('token');
                    const url = `/api/stores/${id}`;
                    const method = 'PUT';

                    try {
                        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body });
                        if (res.ok) {
                            showToast('Store auto-saved');
                            // Refresh data in background without interrupting user
                            fetch(`/api/data?_t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(data => {
                                const existingStoreId = appData.currentStoreId;
                                appData = { ...appData, ...data };
                                if (existingStoreId && appData.stores.some(s => s.id === existingStoreId)) {
                                    appData.currentStoreId = existingStoreId;
                                }

                                // Manually update the text of this specific store in the list to avoid stealing focus
                                const listItems = dom.storesList.querySelectorAll('li');
                                const editedStore = appData.stores.find(s => s.id === parseInt(id));
                                if (editedStore) {
                                    listItems.forEach(li => {
                                        const editBtn = li.querySelector('.edit-s');
                                        if (editBtn && editBtn.dataset.id === id) {
                                            li.querySelector('span').innerHTML = `<b>${editedStore.name}</b>: ${editedStore.maxHours}h`;
                                        }
                                    });
                                }

                                updateDashboard();
                            });
                        } else {
                            const errTxt = await res.text();
                            showToast(`Server Error ${res.status}: ${errTxt}`, true);
                            console.error('Store AutoSave Error:', res.status, errTxt);
                        }
                    } catch (err) {
                        showToast(`Network Error: ${err.message}`, true);
                        console.error('Store AutoSave Exception:', err);
                    }
                }

                dom.addStoreForm.addEventListener('change', () => {
                    if (dom.addStoreForm.dataset.editId) {
                        clearTimeout(storeAutoSaveTimeout);
                        storeAutoSaveTimeout = setTimeout(autoSaveStore, 400);
                    }
                });

                dom.addStoreForm.addEventListener('input', () => {
                    if (dom.addStoreForm.dataset.editId) {
                        clearTimeout(storeAutoSaveTimeout);
                        storeAutoSaveTimeout = setTimeout(autoSaveStore, 800);
                    }
                });

                dom.addStoreForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = dom.addStoreForm.dataset.editId;
                    if (id) {
                        await autoSaveStore();
                        resetStoreForm();
                        return;
                    }
                    const body = JSON.stringify({ name: document.getElementById('storeName').value, maxHours: document.getElementById('storeMaxHours').value });
                    const token = localStorage.getItem('token');
                    const url = '/api/stores';
                    const method = 'POST';
                    await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body });
                    resetStoreForm();
                    loadData();
                });
                document.getElementById('storeCancelBtn').addEventListener('click', resetStoreForm);

                let memberAutoSaveTimeout;

                async function autoSaveMember() {
                    const id = dom.addMemberForm.dataset.editId;
                    if (!id) return; // Only auto-save in edit mode
                    const cbs = Array.from(dom.memberStoresCheckboxes.querySelectorAll('input:checked'));
                    const storeIds = cbs.map(cb => parseInt(cb.value));
                    if (storeIds.length === 0) {
                        showToast('Member must have at least one store', true);
                        return;
                    }
                    const body = JSON.stringify({
                        name: document.getElementById('memberName').value,
                        phone: document.getElementById('memberPhone').value,
                        email: document.getElementById('memberEmail').value,
                        employmentType: document.getElementById('memberEmploymentType').value,
                        storeIds
                    });
                    const token = localStorage.getItem('token');
                    try {
                        await fetch(`/api/members/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body });
                        showToast('Member auto-saved');
                        // Refresh data in background without interrupting user
                        loadData();
                    } catch (err) {
                        showToast('Error saving member', true);
                    }
                }

                dom.addMemberForm.addEventListener('change', () => {
                    if (dom.addMemberForm.dataset.editId) {
                        clearTimeout(memberAutoSaveTimeout);
                        memberAutoSaveTimeout = setTimeout(autoSaveMember, 400);
                    }
                });

                dom.addMemberForm.addEventListener('input', () => {
                    if (dom.addMemberForm.dataset.editId) {
                        clearTimeout(memberAutoSaveTimeout);
                        memberAutoSaveTimeout = setTimeout(autoSaveMember, 800);
                    }
                });

                dom.addMemberForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const id = dom.addMemberForm.dataset.editId;
                    if (id) {
                        return autoSaveMember();
                    }
                    const cbs = Array.from(dom.memberStoresCheckboxes.querySelectorAll('input:checked'));
                    const storeIds = cbs.map(cb => parseInt(cb.value));
                    if (storeIds.length === 0) return alert('Select at least one store');
                    const body = JSON.stringify({
                        name: document.getElementById('memberName').value,
                        phone: document.getElementById('memberPhone').value,
                        email: document.getElementById('memberEmail').value,
                        employmentType: document.getElementById('memberEmploymentType').value,
                        storeIds
                    });
                    const token = localStorage.getItem('token');
                    await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body });
                    resetMemberForm();
                    loadData();
                });
                document.getElementById('memberCancelBtn').addEventListener('click', resetMemberForm);

                if (!dom.weekStartDateInput.value) {
                    const today = new Date();
                    dom.weekStartDateInput.value = getLocalYMD(today);
                }

                // --- PayPal Integration Logic ---
                async function initPayPal() {
                    try {
                        const res = await fetch('/api/config/public');
                        if (!res.ok) return;
                        const config = await res.json();
                        // Setup standard Donate button to alert if SDK fails
                        if (dom.supportDonateBtn) {
                            dom.supportDonateBtn.addEventListener('click', () => {
                                alert(`Thanks for considering a donation! Please PayPal to: ${config.paypalBusinessEmail}`);
                            });
                        }

                        // We will just use standard simple checkout for donations as subscriptions need a pre-made Plan ID on the developer dashboard
                        const script = document.createElement('script');
                        script.src = `https://www.paypal.com/sdk/js?client-id=ARcSKHeuTjuze8ykv6zU_RXhms_cneCxaLQuwlWznw_AtGF7RSDSBLAhPCfGGrqTw-Hn8xalzt7e0O5n&currency=${config.supportCurrency}`;
                        script.addEventListener('load', () => {
                            const supportContainer = document.getElementById('standard-support-buttons');
                            if (supportContainer) supportContainer.classList.add('hidden');
                            paypal.Buttons({
                                style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
                                createOrder: function (data, actions) {
                                    return actions.order.create({
                                        purchase_units: [{
                                            amount: { value: '5.00' },
                                            description: 'Donation to Roster Manager ($5)'
                                        }]
                                    });
                                },
                                onApprove: function (data, actions) {
                                    return actions.order.capture().then(function (details) {
                                        alert('Thank you for your generous donation, ' + details.payer.name.given_name + '!');
                                    });
                                }
                            }).render('#paypal-button-container');
                        });
                        document.body.appendChild(script);
                    } catch (e) {
                        console.error("PayPal Init Error", e);
                    }
                }
                initPayPal();

                // --- Guided Tour Logic ---
                const startTourBtn = document.getElementById('startTourBtn');
                if (startTourBtn) {
                    startTourBtn.addEventListener('click', () => {
                        const tour = introJs();

                        // Base steps applicable to both views
                        const steps = [
                            {
                                title: 'Welcome!',
                                intro: 'Welcome to Roster Manager! Let\'s take a quick tour to show you how to navigate the system.'
                            },
                            {
                                element: document.querySelector('#roster-filters'),
                                title: 'Filters',
                                intro: 'Use these filters to select which store to view and pick the starting date for your schedule.',
                                position: 'bottom'
                            },
                            {
                                element: document.querySelector('.view-controls'),
                                title: 'View Options',
                                intro: 'Switch between seeing the whole Week, or a Fortnight (14 days) at a time.',
                                position: 'bottom'
                            },
                            {
                                element: document.querySelector('#schedule-container'),
                                title: 'The Schedule Grid',
                                intro: 'Here you can see everyone\'s shifts. <br><br><b>Tip:</b> Click on a schedule cell or employee name to quickly select them for editing below!',
                                position: 'top'
                            }
                        ];

                        // Added steps only if in Admin or Manager mode
                        if (isAdmin || savedRole === 'manager') {
                            steps.push({
                                element: document.querySelector('#openSidebarBtn'),
                                title: 'Management Tools',
                                intro: isAdmin 
                                    ? 'Open this menu to access Admin options (Rules, Stores, Members) and to use the new Worked Hours and Reports export tools.'
                                    : 'Open this menu to access your Manager options: adding Members to your stores, logging Worked Hours, and exporting Reports.',
                                position: 'right'
                            });
                            steps.push({
                                element: document.querySelector('#shift-editor'),
                                title: 'Shift Editor',
                                intro: 'Use this panel to specify exact times for an employee. Select an employee, check the days they work, enter times, and hit Save Period.',
                                position: 'top'
                            });
                        } else {
                            steps.push({
                                element: document.querySelector('#mainExportBtn'),
                                title: 'Employee Actions',
                                intro: 'Export your personal roster right here to save to your calendar.',
                                position: 'bottom'
                            });
                        }

                        tour.setOptions({
                            steps: steps,
                            showProgress: true,
                            showBullets: true,
                            exitOnOverlayClick: true,
                            disableInteraction: true,
                            keyboardNavigation: true
                        });

                        tour.start();
                    });
                }

                loadData();
                const savedRole = localStorage.getItem('userRole');
                if (savedRole) enterAuthMode(savedRole);

                // --- WORKED HOURS & REPORTS LOGIC ---
                const whDom = {
                    openBtn: document.getElementById('openWorkedHoursBtn'),
                    modal: document.getElementById('workedHoursModal'),
                    closeBtn: document.getElementById('closeWorkedHoursModalBtn'),
                    storeSelect: document.getElementById('whStoreSelect'),
                    weekSelect: document.getElementById('whWeekSelect'),
                    loadBtn: document.getElementById('whLoadBtn'),
                    tableContainer: document.getElementById('whTableContainer'),
                    tableBody: document.getElementById('whTableBody'),
                    actionsBlock: document.getElementById('whActionsBlock'),
                    saveBtn: document.getElementById('whSaveBtn'),
                    alert: document.getElementById('whAlert')
                };

                const repDom = {
                    openBtn: document.getElementById('openReportsBtn'),
                    modal: document.getElementById('reportsModal'),
                    closeBtn: document.getElementById('closeReportsModalBtn'),
                    storeSelect: document.getElementById('reportStoreSelect'),
                    startDate: document.getElementById('reportStartDate'),
                    downloadWeeklyBtn: document.getElementById('downloadWeeklyBtn'),
                    downloadFortnightlyBtn: document.getElementById('downloadFortnightlyBtn'),
                    downloadRosterBtn: document.getElementById('downloadRosterBtn'),
                    closePeriodBtn: document.getElementById('closePeriodBtn')
                };

                // Helper for context store members
                const getStoreMembers = (storeId) => appData.members.filter(m => m.storeIds && m.storeIds.includes(parseInt(storeId)));

                let currentWorkedHoursData = [];

                whDom.openBtn.addEventListener('click', () => {
                    const managedStores = isAdmin ? appData.stores : appData.stores.filter(s => {
                        const m = appData.members.find(x => x.id === (appData.user ? appData.user.id : -1));
                        return m && m.managedStoreIds && m.managedStoreIds.includes(s.id);
                    });
                    whDom.storeSelect.innerHTML = managedStores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                    if (managedStores.length === 0) whDom.storeSelect.innerHTML = '<option value="">No stores managed</option>';

                    whDom.weekSelect.value = getLocalYMD(getMonday(new Date((dom.weekStartDateInput ? dom.weekStartDateInput.value : getLocalYMD(new Date())) + 'T00:00:00')));
                    whDom.tableContainer.style.display = 'none';
                    whDom.actionsBlock.classList.add('hidden');
                    whDom.alert.classList.add('hidden');
                    toggleModal(whDom.modal);
                });
                whDom.closeBtn.addEventListener('click', () => { toggleModal(whDom.modal); });

                whDom.loadBtn.addEventListener('click', async () => {
                    const storeId = whDom.storeSelect.value;
                    const sDateStr = whDom.weekSelect.value;
                    if (!storeId || !sDateStr) return;

                    const d = new Date(sDateStr + 'T00:00:00');
                    const mondayStr = getLocalYMD(getMonday(d));
                    const sundayStr = getLocalYMD(new Date(new Date(mondayStr + 'T00:00:00').setDate(new Date(mondayStr + 'T00:00:00').getDate() + 6)));

                    const token = localStorage.getItem('token');

                    try {
                        whDom.loadBtn.textContent = 'Loading...';
                        const res = await fetch(`/api/worked-hours?storeId=${storeId}&startDate=${mondayStr}&endDate=${sundayStr}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!res.ok) throw new Error(await res.text());

                        const hours = await res.json();
                        const members = getStoreMembers(storeId);

                        whDom.tableBody.innerHTML = '';
                        currentWorkedHoursData = members.map(m => {
                            const h = hours.find(x => x.member_id === m.id) || {};
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td class="p-4 border-b border-gray-800 font-medium">${m.name}</td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="ordinary" value="${h.ordinary_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="sat" value="${h.saturday_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="sun" value="${h.sunday_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="ph" value="${h.ph_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="al" value="${h.al_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800 text-center"><input type="number" step="0.5" class="w-16 bg-gray-800 border border-gray-700 text-center text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="sl" value="${h.sl_hours || ''}"></td>
                                <td class="p-2 border-b border-gray-800"><input type="text" class="w-full bg-gray-800 border border-gray-700 text-white rounded p-1 wh-input focus:ring-1 focus:ring-orange-500 outline-none" data-field="notes" value="${h.notes || ''}"></td>
                            `;
                            tr.querySelectorAll('.wh-input').forEach(inp => {
                                inp.addEventListener('input', (e) => {
                                    const val = e.target.value;
                                    const field = e.target.getAttribute('data-field');
                                    const rowData = currentWorkedHoursData.find(x => x.memberId === m.id);
                                    if (field === 'notes') rowData[field] = val;
                                    else rowData[field] = val ? parseFloat(val) : 0;
                                });
                            });
                            whDom.tableBody.appendChild(tr);
                            return {
                                memberId: m.id,
                                ordinary: h.ordinary_hours || 0,
                                sat: h.saturday_hours || 0,
                                sun: h.sunday_hours || 0,
                                ph: h.ph_hours || 0,
                                al: h.al_hours || 0,
                                sl: h.sl_hours || 0,
                                notes: h.notes || ''
                            };
                        });

                        whDom.tableContainer.style.display = 'block';
                        whDom.actionsBlock.classList.remove('hidden');
                        whDom.alert.classList.add('hidden');
                    } catch (e) {
                        whDom.alert.textContent = String(e);
                        whDom.alert.classList.remove('hidden');
                        whDom.alert.classList.add('bg-red-500/20', 'text-red-400');
                    } finally {
                        whDom.loadBtn.textContent = 'Load Roster';
                    }
                });

                whDom.saveBtn.addEventListener('click', async () => {
                    const storeId = whDom.storeSelect.value;
                    const sDateStr = getLocalYMD(getMonday(new Date(whDom.weekSelect.value + 'T00:00:00')));
                    const token = localStorage.getItem('token');

                    try {
                        whDom.saveBtn.textContent = 'Saving...';
                        const res = await fetch('/api/worked-hours', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ storeId, date: sDateStr, hoursData: currentWorkedHoursData })
                        });
                        const d = await res.json();
                        if (res.ok) {
                            showToast('Worked hours saved successfully!');
                            toggleModal(whDom.modal);
                        } else {
                            throw new Error(d.error || 'Failed to save');
                        }
                    } catch (e) {
                        alert(String(e));
                    } finally {
                        whDom.saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Extracted Hours';
                        lucide.createIcons();
                    }
                });

                repDom.openBtn.addEventListener('click', () => {
                    const managedStores = isAdmin ? appData.stores : appData.stores.filter(s => {
                        const m = appData.members.find(x => x.id === (appData.user ? appData.user.id : -1));
                        return m && m.managedStoreIds && m.managedStoreIds.includes(s.id);
                    });
                    repDom.storeSelect.innerHTML = managedStores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                    if (managedStores.length === 0) repDom.storeSelect.innerHTML = '<option value="">No stores</option>';

                    repDom.startDate.value = getLocalYMD(getMonday(new Date((dom.weekStartDateInput ? dom.weekStartDateInput.value : getLocalYMD(new Date())) + 'T00:00:00')));
                    toggleModal(repDom.modal);
                });
                repDom.closeBtn.addEventListener('click', () => { toggleModal(repDom.modal); });

                const triggerExport = (url, name) => {
                    const token = localStorage.getItem('token');
                    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
                        .then(r => {
                            if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Export failed') });
                            return r.blob();
                        })
                        .then(blob => {
                            const dlUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = dlUrl;
                            a.download = name;
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => window.URL.revokeObjectURL(dlUrl), 100);
                        })
                        .catch(e => alert(e.message));
                };

                repDom.downloadWeeklyBtn.addEventListener('click', () => {
                    const store = repDom.storeSelect.value;
                    const start = repDom.startDate.value;
                    if (!store) return alert('Select a store first');
                    const end = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 6)));
                    triggerExport(`/api/exports/weekly-report?storeId=${store}&startDate=${start}&endDate=${end}`, `Weekly_${start}.xlsx`);
                });
                repDom.downloadFortnightlyBtn.addEventListener('click', () => {
                    const start = repDom.startDate.value;
                    const end = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 13)));
                    triggerExport(`/api/exports/fortnightly-report?startDate=${start}&endDate=${end}`, `Fortnightly_${start}.xlsx`);
                });
                repDom.downloadRosterBtn.addEventListener('click', () => {
                    const store = repDom.storeSelect.value;
                    const start = repDom.startDate.value;
                    if (!store) return alert('Select a store first');
                    const end14 = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 13)));
                    triggerExport(`/api/exports/roster?storeId=${store}&startDate=${start}&endDate=${end14}`, `Roster_${start}.xlsx`);
                });
                repDom.closePeriodBtn.addEventListener('click', async () => {
                    const start = repDom.startDate.value;
                    const end = getLocalYMD(new Date(new Date(start + 'T00:00:00').setDate(new Date(start + 'T00:00:00').getDate() + 13)));
                    if (!confirm(`Are you sure you want to CLOSE the fortnightly period ${start} to ${end}?\nThis cannot be undone from the UI.`)) return;

                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/reports/close-period', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ startDate: start, endDate: end, type: 'fortnightly' })
                    });
                    if (res.ok) alert('Period closed successfully. Hours across all stores are locked for this date range.');
                    else {
                        const d = await res.json();
                        alert('Failed to close period: ' + (d.error || 'Unknown error. Are you an Admin?'));
                    }
                });

            });

            // Register Service Worker
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {
                            console.log('ServiceWorker registration successful');
                        })
                        .catch(err => {
                            console.log('ServiceWorker registration failed: ', err);
                        });
                });
            }
        
/* ═══════════════════════════════════════════════════
   GestionProjet — Application JavaScript
   Vanilla JS, localStorage + Google Apps Script
   Structure: Config → DB → State → Init → UI → Actions
   ═══════════════════════════════════════════════════ */

// ─── 1. CONFIGURATION ────────────────────────────────
const STORAGE_KEY = 'projectflow_data';
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz9D3ju9KTwaZLBmj5TbRJ0XsKSG8h9dQUyx_yGbbY0_pvh0-5FiM0T70KfQEZe0nFFfw/exec';
const USE_GAS = true;
const APP_VERSION = '2.0';
const DAYS_TO_PURGE = 30;

// ─── 2. DATA LAYER ───────────────────────────────────
const DB = {
    _baseUrl: GAS_WEB_APP_URL,
    _useGas: USE_GAS,

    async read() {
        if (!this._useGas) {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (_) { return null; }
        }
        try {
            const resp = await fetch(this._baseUrl + '?action=get&_=' + Date.now());
            if (!resp.ok) throw new Error('Network error ' + resp.status);
            const data = await resp.json();
            if (data && (data.projects || data.tasks)) return data;
            return null;
        } catch (e) {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (_) { return null; }
        }
    },

    async write(data) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
        if (!this._useGas) return true;
        try {
            const resp = await fetch(this._baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'save', data: data })
            });
            return resp.ok;
        } catch (_) { return false; }
    }
};

// ─── 3. SEED DATA ────────────────────────────────────
const SEED_DATA = {
    projects: [
        {
            id: 'p1',
            name: 'Refonte Site Web',
            description: 'Refonte complète du site vitrine avec nouveau design moderne',
            color: '#6366f1',
            deadline: '2026-08-31',
            createdAt: '2026-06-01T10:00:00Z'
        },
        {
            id: 'p2',
            name: 'App Mobile Fitness',
            description: 'Application de suivi d\'entraînement sportif pour iOS et Android',
            color: '#22c55e',
            deadline: '2026-12-15',
            createdAt: '2026-06-10T14:30:00Z'
        }
    ],
    tasks: [
        {
            id: 't1', projectId: 'p1', title: 'Maquette page d\'accueil',
            priority: 'haute', status: 'done', assignedTo: 'Marie',
            createdAt: '2026-06-01T10:30:00Z', completed: true
        },
        {
            id: 't2', projectId: 'p1', title: 'Intégrer le header responsive',
            priority: 'moyenne', status: 'in_progress', assignedTo: 'Thomas',
            createdAt: '2026-06-02T09:00:00Z', completed: false
        },
        {
            id: 't3', projectId: 'p1', title: 'Optimiser les images',
            priority: 'basse', status: 'todo', assignedTo: '',
            createdAt: '2026-06-03T11:00:00Z', completed: false
        },
        {
            id: 't4', projectId: 'p2', title: 'Créer le système d\'authentification',
            priority: 'haute', status: 'in_progress', assignedTo: 'Lucas',
            createdAt: '2026-06-10T15:00:00Z', completed: false
        },
        {
            id: 't5', projectId: 'p2', title: 'Design dashboard utilisateur',
            priority: 'moyenne', status: 'todo', assignedTo: 'Marie',
            createdAt: '2026-06-11T10:00:00Z', completed: false
        }
    ]
};

// ─── 4. GLOBAL STATE ─────────────────────────────────
let appData = { projects: [], tasks: [] };
let currentTab = 'dashboard';
let confirmCallback = null;
let currentAttachments = [];

// ─── 5. INITIALIZATION ───────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
    await initData();
    initNavigation();
    initMobileNav();
    initTheme();
    initModals();
    initForms();
    initDataActions();
    initSearch();
    purgeOldDeletedItems();
    renderAll();
});

async function initData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.projects || parsed.tasks)) {
                appData = { projects: parsed.projects || [], tasks: parsed.tasks || [] };
                if (appData.projects.length === 0) throw new Error('no projects');
                return;
            }
        } catch (_) {}
    }
    appData = JSON.parse(JSON.stringify(SEED_DATA));
    await DB.write(appData);
}

async function saveData() {
    try {
        await DB.write(appData);
    } catch (_) {
        showToast('Erreur de sauvegarde', 'error');
    }
}

// ─── 6. NAVIGATION ───────────────────────────────────
function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    closeAllModals();

    document.querySelectorAll('.nav-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(function(t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    var mobileMenu = document.getElementById('mobileNavMenu');
    var mobileOverlay = document.getElementById('mobileNavOverlay');
    var hamburger = document.getElementById('navHamburger');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');

    document.querySelectorAll('.tab-content').forEach(function(s) {
        s.classList.toggle('active', s.id === tabName);
    });

    window.scrollTo({ top: 0, behavior: 'instant' });
    renderAll();
}

// ─── 7. MOBILE NAV ───────────────────────────────────
function initMobileNav() {
    var hamburger = document.getElementById('navHamburger');
    var menu = document.getElementById('mobileNavMenu');
    var overlay = document.getElementById('mobileNavOverlay');
    var navItems = document.querySelectorAll('.mobile-nav-item');

    if (!hamburger || !menu) return;

    function openMenu() {
        hamburger.classList.add('active');
        menu.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
        hamburger.classList.remove('active');
        menu.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function() {
        menu.classList.contains('open') ? closeMenu() : openMenu();
    });
    overlay.addEventListener('click', closeMenu);

    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var tab = this.getAttribute('data-tab');
            if (tab) switchTab(tab);
            closeMenu();
        });
    });
}

// ─── 8. THEME ────────────────────────────────────────
function initTheme() {
    var saved = localStorage.getItem('projectflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    document.getElementById('themeToggle').addEventListener('click', function() {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('projectflow_theme', next);
        updateThemeIcon(next);
    });
}

function updateThemeIcon(theme) {
    var sun = document.getElementById('sunIcon');
    var moon = document.getElementById('moonIcon');
    if (theme === 'dark') {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
    } else {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
    }
}

// ─── 9. MODALS ───────────────────────────────────────
function initModals() {
    document.querySelectorAll('[data-close]').forEach(function(btn) {
        btn.addEventListener('click', closeAllModals);
    });
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.addEventListener('click', closeAllModals);
    });
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (confirmCallback) { confirmCallback(); confirmCallback = null; }
        closeAllModals();
    });
    document.getElementById('addProjectBtn').addEventListener('click', function() { openProjectModal(); });
    document.getElementById('addTaskBtn').addEventListener('click', function() { openTaskModal(); });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.add('hidden');
    });
}

function openProjectModal(project) {
    var modal = document.getElementById('projectModal');
    var title = document.getElementById('projectModalTitle');
    var form = document.getElementById('projectForm');

    if (project) {
        title.textContent = 'Modifier le projet';
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectName').value = project.name;
        document.getElementById('projectDescription').value = project.description || '';
        document.getElementById('projectColor').value = project.color || '#6366f1';
        document.getElementById('projectDeadline').value = project.deadline || '';
    } else {
        title.textContent = 'Nouveau projet';
        form.reset();
        document.getElementById('projectId').value = '';
        document.getElementById('projectColor').value = '#6366f1';
    }
    modal.classList.remove('hidden');
}

function openTaskModal(task) {
    var modal = document.getElementById('taskModal');
    var title = document.getElementById('taskModalTitle');
    var form = document.getElementById('taskForm');

    var projectSelect = document.getElementById('taskProject');
    projectSelect.innerHTML = '';
    getActiveProjects().forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projectSelect.appendChild(opt);
    });

    currentAttachments = [];
    renderAttachedFilesList();
    document.getElementById('taskAttachments').value = '';

    if (task) {
        title.textContent = 'Modifier la tâche';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskProject').value = task.projectId;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskAssignedTo').value = task.assignedTo || '';
        document.getElementById('taskDeadline').value = task.deadline || '';
        currentAttachments = task.attachments ? task.attachments.map(function(a) { return Object.assign({}, a); }) : [];
        renderAttachedFilesList();
    } else {
        title.textContent = 'Nouvelle tâche';
        form.reset();
        document.getElementById('taskId').value = '';
        document.getElementById('taskPriority').value = 'moyenne';
        document.getElementById('taskStatus').value = 'todo';
    }

    modal.classList.remove('hidden');
}

function openConfirmModal(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

// ─── 10. FORMS ───────────────────────────────────────
function initForms() {
    // Project form
    document.getElementById('projectForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var id = document.getElementById('projectId').value;
        var project = {
            id: id || generateId(),
            name: document.getElementById('projectName').value.trim(),
            description: document.getElementById('projectDescription').value.trim(),
            color: document.getElementById('projectColor').value,
            deadline: document.getElementById('projectDeadline').value || null,
            createdAt: id ? getProjectById(id).createdAt : new Date().toISOString()
        };

        if (id) {
            var idx = appData.projects.findIndex(function(p) { return p.id === id; });
            if (idx !== -1) appData.projects[idx] = project;
            showToast('Projet modifié avec succès', 'success');
        } else {
            appData.projects.push(project);
            showToast('Projet créé avec succès', 'success');
        }
        saveData();
        closeAllModals();
        renderAll();
    });

    // Task form
    document.getElementById('taskForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var id = document.getElementById('taskId').value;
        var status = document.getElementById('taskStatus').value;
        var task = {
            id: id || generateId(),
            projectId: document.getElementById('taskProject').value,
            title: document.getElementById('taskTitle').value.trim(),
            priority: document.getElementById('taskPriority').value,
            status: status,
            assignedTo: document.getElementById('taskAssignedTo').value.trim(),
            deadline: document.getElementById('taskDeadline').value || '',
            createdAt: id ? getTaskById(id).createdAt : new Date().toISOString(),
            completed: status === 'done'
        };

        if (id) {
            var idx = appData.tasks.findIndex(function(t) { return t.id === id; });
            if (idx !== -1) appData.tasks[idx] = task;
            showToast('Tâche modifiée', 'success');
        } else {
            appData.tasks.push(task);
            showToast('Tâche ajoutée', 'success');
        }
        currentAttachments = [];
        saveData();
        closeAllModals();
        renderAll();
    });

    // Task detail form
    document.getElementById('taskDetailForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var id = document.getElementById('taskDetailId').value;
        var task = getTaskById(id);
        if (!task) return;
        task.status = document.getElementById('taskDetailStatus').value;
        task.priority = document.getElementById('taskDetailPriority').value;
        task.assignedTo = document.getElementById('taskDetailAssignedTo').value.trim();
        task.deadline = document.getElementById('taskDetailDeadline').value || '';
        saveData();
        renderAll();
        closeAllModals();
        showToast('Tâche mise à jour', 'success');
    });

    // File attachments
    document.getElementById('taskAttachments').addEventListener('change', function(e) {
        handleFileAttachments(e.target.files);
    });

    // Filter changes
    document.getElementById('filterTaskProject').addEventListener('change', renderTasks);
    document.getElementById('filterTaskStatus').addEventListener('change', renderTasks);
    document.getElementById('filterTaskPriority').addEventListener('change', renderTasks);

    // Sort
    document.getElementById('sortTasksSelect').addEventListener('change', renderTasks);
    var sortDirBtn = document.getElementById('sortDirBtn');
    if (sortDirBtn) {
        sortDirBtn.addEventListener('click', function() {
            this.classList.toggle('inactive');
            renderTasks();
        });
    }

    // Subtask add
    var subtaskInput = document.getElementById('subtaskAddInput');
    if (subtaskInput) {
        subtaskInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var taskId = document.getElementById('taskDetailId').value;
                addSubtask(taskId, this.value.trim());
                this.value = '';
            }
        });
    }
}

// ─── 11. EXPORT / IMPORT ────────────────────────────
function initDataActions() {
    document.getElementById('exportBtn').addEventListener('click', function() {
        var str = JSON.stringify(appData, null, 2);
        var blob = new Blob([str], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'projectflow_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Données exportées', 'success');
    });

    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

    document.getElementById('importFile').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(event) {
            try {
                var imported = JSON.parse(event.target.result);
                if (imported.projects && imported.tasks) {
                    openConfirmModal('Cela remplacera toutes vos données actuelles. Continuer ?', function() {
                        appData = imported;
                        saveData();
                        renderAll();
                        showToast('Données importées avec succès', 'success');
                    });
                } else {
                    showToast('Format de fichier invalide', 'error');
                }
            } catch (_) {
                showToast('Fichier JSON invalide', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

function exportCSV() {
    var csv = '\uFEFF';
    csv += '=== PROJETS ===\n';
    csv += 'ID,Nom,Description,Couleur,Deadline,Date de création\n';
    appData.projects.forEach(function(p) {
        csv += [p.id, p.name, p.description || '', p.color || '', p.deadline || '', p.createdAt || '']
            .map(csvEscape).join(',') + '\n';
    });
    csv += '\n=== TÂCHES ===\n';
    csv += 'ID,Projet ID,Titre,Priorité,Statut,Assigné à,Date de création,Terminée\n';
    appData.tasks.forEach(function(t) {
        csv += [t.id, t.projectId, t.title, t.priority, t.status, t.assignedTo || '', t.createdAt || '', t.completed ? 'Oui' : 'Non']
            .map(csvEscape).join(',') + '\n';
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'projectflow_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV téléchargé', 'success');
}

function csvEscape(value) {
    var s = String(value == null ? '' : value);
    if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

// ─── 12. SEARCH ──────────────────────────────────────
function initSearch() {
    var searchToggle = document.getElementById('searchToggle');
    var searchOverlay = document.getElementById('searchOverlay');
    var searchInput = document.getElementById('searchInput');
    var searchClose = document.getElementById('searchClose');

    if (!searchToggle || !searchOverlay || !searchInput) return;

    searchToggle.addEventListener('click', function() {
        searchOverlay.classList.remove('hidden');
        searchInput.focus();
    });

    searchClose.addEventListener('click', function() {
        searchOverlay.classList.add('hidden');
        searchInput.value = '';
        document.getElementById('searchResults').innerHTML = '';
    });

    searchInput.addEventListener('input', function() {
        var query = this.value.trim().toLowerCase();
        var container = document.getElementById('searchResults');
        if (query.length < 2) {
            container.innerHTML = '';
            return;
        }
        var results = [];
        appData.projects.forEach(function(p) {
            if (p.name.toLowerCase().indexOf(query) !== -1 || (p.description && p.description.toLowerCase().indexOf(query) !== -1)) {
                results.push({ type: 'project', item: p });
            }
        });
        appData.tasks.forEach(function(t) {
            if (t.title.toLowerCase().indexOf(query) !== -1) {
                results.push({ type: 'task', item: t });
            }
        });
        if (results.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Aucun résultat</div>';
        } else {
            container.innerHTML = results.map(function(r) {
                var icon = r.type === 'project' ? '📁' : '📋';
                var label = r.type === 'project' ? escapeHtml(r.item.name) : escapeHtml(r.item.title);
                var subtype = r.type === 'project'
                    ? (r.item.description ? '<div style="font-size:0.7rem;color:var(--text-muted);">' + escapeHtml(r.item.description) + '</div>' : '')
                    : '<div style="font-size:0.7rem;color:var(--text-muted);">Tâche</div>';
                return '<div class="search-result-item" onclick="searchSelect(\'' + r.type + '\',\'' + r.item.id + '\')">' +
                    '<span class="search-result-icon">' + icon + '</span>' +
                    '<div>' + label + subtype + '</div>' +
                '</div>';
            }).join('');
        }
    });
}

window.searchSelect = function(type, id) {
    var searchOverlay = document.getElementById('searchOverlay');
    searchOverlay.classList.add('hidden');
    document.getElementById('searchInput').value = '';
    if (type === 'task') {
        switchTab('tasks');
        setTimeout(function() { openTaskModal(getTaskById(id)); }, 100);
    } else {
        switchTab('projects');
    }
};

// ─── 13. SOFT DELETE / RESTORE ───────────────────────
function getActiveProjects() {
    return appData.projects.filter(function(p) { return !p.deletedAt; });
}

function getActiveTasks() {
    var ids = getActiveProjects().map(function(p) { return p.id; });
    return appData.tasks.filter(function(t) { return !t.deletedAt && ids.indexOf(t.projectId) !== -1; });
}

window.softDeleteProject = function(id) {
    var project = getProjectById(id);
    if (!project) return;
    project.deletedAt = new Date().toISOString();
    appData.tasks.forEach(function(t) {
        if (t.projectId === id) t.deletedAt = new Date().toISOString();
    });
    saveData();
    renderAll();
    showToast('Projet mis à la corbeille', 'success');
};

window.softDeleteTask = function(id) {
    var task = getTaskById(id);
    if (!task) return;
    task.deletedAt = new Date().toISOString();
    saveData();
    renderAll();
    showToast('Tâche mise à la corbeille', 'success');
};

window.restoreItem = function(type, id) {
    if (type === 'project') {
        var p = getProjectById(id);
        if (p) {
            p.deletedAt = null;
            appData.tasks.forEach(function(t) {
                if (t.projectId === id) t.deletedAt = null;
            });
        }
    } else {
        var t = getTaskById(id);
        if (t) t.deletedAt = null;
    }
    saveData();
    renderAll();
    showToast('Élément restauré', 'success');
};

window.permanentDelete = function(type, id) {
    openConfirmModal('Supprimer définitivement ? Cette action est irréversible.', function() {
        if (type === 'project') {
            appData.projects = appData.projects.filter(function(p) { return p.id !== id; });
            appData.tasks = appData.tasks.filter(function(t) { return t.projectId !== id; });
        } else {
            appData.tasks = appData.tasks.filter(function(t) { return t.id !== id; });
        }
        saveData();
        showToast('Supprimé définitivement', 'success');
    });
};

function purgeOldDeletedItems() {
    var now = Date.now();
    var limit = DAYS_TO_PURGE * 86400000;
    appData.projects = appData.projects.filter(function(p) {
        if (!p.deletedAt) return true;
        return (now - new Date(p.deletedAt).getTime()) < limit;
    });
    appData.tasks = appData.tasks.filter(function(t) {
        if (!t.deletedAt) return true;
        return (now - new Date(t.deletedAt).getTime()) < limit;
    });
    saveData();
}

// ─── 14. FILE ATTACHMENTS ────────────────────────────
function handleFileAttachments(files) {
    var MAX = 3, SIZE = 2 * 1024 * 1024;
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (currentAttachments.length >= MAX || f.size > SIZE) continue;
        (function(file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                currentAttachments.push({ name: file.name, size: file.size, data: ev.target.result });
                renderAttachedFilesList();
            };
            reader.readAsDataURL(file);
        })(files[i]);
    }
    document.getElementById('taskAttachments').value = '';
}

function renderAttachedFilesList() {
    var container = document.getElementById('attachedFilesList');
    if (!container || currentAttachments.length === 0) {
        if (container) container.innerHTML = '';
        return;
    }
    container.innerHTML = currentAttachments.map(function(f, i) {
        var sz = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' Mo' : (f.size / 1024).toFixed(0) + ' Ko';
        return '<div class="attached-file-item">' +
            '<span class="file-name">' + escapeHtml(f.name) + '</span>' +
            '<span class="file-size">' + sz + '</span>' +
            '<button type="button" class="file-remove" onclick="removeAttachment(' + i + ')">×</button>' +
        '</div>';
    }).join('');
}

window.removeAttachment = function(i) {
    currentAttachments.splice(i, 1);
    renderAttachedFilesList();
};

// ─── 15. RENDERING ───────────────────────────────────
function renderAll() {
    renderDashboard();
    renderProjects();
    renderTasks();
    populateFilterProjects();
}

// ─── 15a. DASHBOARD ──────────────────────────────────
function renderDashboard() {
    var projects = getActiveProjects();
    var tasks = getActiveTasks();

    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statTasksTotal').textContent = tasks.length;
    document.getElementById('statTasksDone').textContent = tasks.filter(function(t) { return t.status === 'done'; }).length;
    document.getElementById('statTasksProgress').textContent = tasks.filter(function(t) { return t.status === 'in_progress'; }).length;

    var pc = document.getElementById('dashboardProgress');
    if (projects.length === 0) {
        pc.innerHTML = '<div class="empty-state"><p>Aucun projet</p></div>';
    } else {
        pc.innerHTML = projects.map(function(p) {
            var prog = getProjectProgress(p.id);
            return '<div class="dashboard-progress-item">' +
                '<div class="dashboard-progress-info">' +
                    '<span class="dashboard-progress-name" style="color:' + p.color + '">' + escapeHtml(p.name) + '</span>' +
                    '<span class="dashboard-progress-value">' + prog + '%</span>' +
                '</div>' +
                '<div class="progress-bar">' +
                    '<div class="progress-fill" style="width:' + prog + '%;background:' + p.color + '"></div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    var pt = document.getElementById('priorityTasks');
    var hi = tasks.filter(function(t) { return t.priority === 'haute' && t.status !== 'done'; });
    if (hi.length === 0) {
        pt.innerHTML = '<div class="empty-state"><p>Aucune tâche prioritaire 🎉</p></div>';
    } else {
        pt.innerHTML = hi.map(function(t) {
            var pr = getProjectById(t.projectId);
            return '<div class="priority-task-item">' +
                '<div><div class="task-title" style="font-size:0.9rem">' + escapeHtml(t.title) + '</div>' +
                '<div class="task-project">📁 ' + escapeHtml(pr ? pr.name : 'Projet supprimé') + '</div></div>' +
                '<span class="badge badge-priority haute">Haute</span>' +
            '</div>';
        }).join('');
    }
}

// ─── 15b. PROJECTS ───────────────────────────────────
function renderProjects() {
    var container = document.getElementById('projectsList');
    var projects = getActiveProjects();

    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>Aucun projet. Créez-en un !</p></div>';
        return;
    }

    container.innerHTML = projects.map(function(p) {
        var pTasks = appData.tasks.filter(function(t) { return t.projectId === p.id && !t.deletedAt; });
        var done = pTasks.filter(function(t) { return t.status === 'done'; }).length;
        var prog = getProjectProgress(p.id);
        return '<div class="project-card">' +
            '<div class="project-card-header" style="background:' + p.color + '">' +
                '<h3>' + escapeHtml(p.name) + '</h3>' +
                '<p>' + escapeHtml(p.description || 'Pas de description') + '</p>' +
            '</div>' +
            '<div class="project-card-body">' +
                '<div class="project-meta">' +
                    '<span class="badge badge-status ' + (done === pTasks.length && pTasks.length > 0 ? 'done' : 'todo') + '">' +
                        done + '/' + pTasks.length + ' tâches</span>' +
                    (p.deadline ? '<span class="project-deadline">📅 ' + formatDate(p.deadline) + '</span>' : '') +
                '</div>' +
                '<div class="progress-bar"><div class="progress-fill" style="width:' + prog + '%;background:' + p.color + '"></div></div>' +
                '<div class="progress-text">' + prog + '% complété</div>' +
                '<div class="project-card-actions">' +
                    '<button class="btn btn-sm btn-secondary" onclick="editProject(\'' + p.id + '\')">✎ Modifier</button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteProjectConfirm(\'' + p.id + '\')">✕ Supprimer</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ─── 15c. TASKS ──────────────────────────────────────
function renderTasks() {
    var container = document.getElementById('tasksList');
    var filterProject = document.getElementById('filterTaskProject').value;
    var filterStatus = document.getElementById('filterTaskStatus').value;
    var filterPriority = document.getElementById('filterTaskPriority').value;

    var tasks = getActiveTasks();
    if (filterProject) tasks = tasks.filter(function(t) { return t.projectId === filterProject; });
    if (filterStatus) tasks = tasks.filter(function(t) { return t.status === filterStatus; });
    if (filterPriority) tasks = tasks.filter(function(t) { return t.priority === filterPriority; });

    // Sort: incomplete first, then deadline, then priority
    var pOrder = { haute: 0, moyenne: 1, basse: 2 };
    var sortDirBtn = document.getElementById('sortDirBtn');
    var sortDir = sortDirBtn && sortDirBtn.classList.contains('inactive') ? -1 : 1;

    var mode = document.getElementById('sortTasksSelect').value;
    tasks.sort(function(a, b) {
        if (mode === 'deadline_asc') {
            if (a.deadline && !b.deadline) return -1;
            if (!a.deadline && b.deadline) return 1;
            return (a.deadline || '').localeCompare(b.deadline || '');
        }
        if (mode === 'deadline_desc') {
            if (!b.deadline && a.deadline) return -1;
            if (!a.deadline && b.deadline) return 1;
            return (b.deadline || '').localeCompare(a.deadline || '');
        }
        if (mode === 'created_asc') return (a.createdAt || '').localeCompare(b.createdAt || '');
        if (mode === 'created_desc') return (b.createdAt || '').localeCompare(a.createdAt || '');
        if (mode === 'priority_asc') return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
        if (mode === 'name_asc') return a.title.localeCompare(b.title, 'fr');
        if (mode === 'name_desc') return b.title.localeCompare(a.title, 'fr');
        // default
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.deadline && b.deadline) {
            var d = a.deadline.localeCompare(b.deadline);
            if (d !== 0) return d;
        } else if (a.deadline) return -1;
        else if (b.deadline) return 1;
        return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
    if (sortDir === -1) tasks.reverse();

    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Aucune tâche trouvée</p></div>';
        return;
    }

    container.innerHTML = tasks.map(function(t) { return renderTaskItem(t); }).join('');
}

function renderTaskItem(t) {
    var project = getProjectById(t.projectId);
    var pIcon = project ? '📁' : '📁';
    var pColor = project ? project.color : '#6366f1';
    var pName = project ? project.name : 'Projet supprimé';
    var nameParts = t.assignedTo ? t.assignedTo.trim().split(' ') : [];
    var shortName = nameParts[0] || '';
    var hasTags = t.tags && t.tags.length > 0;
    var hasAttach = (t.attachments || []).length > 0;
    var hasSubs = (t.subtasks || []).length > 0;

    var deadlineStr = '';
    if (t.deadline) {
        var dd = new Date(t.deadline);
        var now = new Date();
        var diff = Math.ceil((dd - now) / 86400000);
        if (diff < 0) deadlineStr = '<span style="color:#ef4444;font-weight:500;">En retard (' + Math.abs(diff) + 'j)</span>';
        else if (diff === 0) deadlineStr = '<span style="color:#f59e0b;font-weight:500;">Aujourd\'hui</span>';
        else if (diff <= 3) deadlineStr = '<span style="color:#f59e0b;">' + diff + 'j</span>';
        else deadlineStr = formatDate(t.deadline);
    }

    return '<div class="task-card priority-' + t.priority + (t.completed ? ' completed' : '') + '">' +
        '<div class="task-card-left">' +
            '<div class="task-checkbox' + (t.completed ? ' checked' : '') + '" onclick="event.stopPropagation();toggleTask(\'' + t.id + '\')">' +
                (t.completed ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
            '</div>' +
            '<span class="priority-dot ' + t.priority + '"></span>' +
            '<div class="task-card-title" onclick="openTaskModal(getTaskById(\'' + t.id + '\'))">' + escapeHtml(t.title) + '</div>' +
        '</div>' +
        '<div class="task-card-meta">' +
            '<span class="project-tag" style="background:' + pColor + '15;color:' + pColor + ';">' + pIcon + ' ' + escapeHtml(pName) + '</span>' +
            deadlineStr +
        '</div>' +
        '<div class="task-card-right">' +
            (t.assignedTo ? '<span style="font-size:0.65rem;color:var(--text-secondary);background:var(--bg-card);padding:2px 6px;border-radius:8px;border:1px solid var(--border);">' + escapeHtml(shortName) + '</span>' : '') +
            '<span class="status-badge ' + t.status + '">' + getStatusLabel(t.status) + '</span>' +
            '<button class="edit-btn" onclick="event.stopPropagation();editTask(\'' + t.id + '\')" title="Modifier">✎</button>' +
            '<button class="delete-btn" onclick="event.stopPropagation();deleteTaskConfirm(\'' + t.id + '\')" title="Supprimer">✕</button>' +
        '</div>' +
    '</div>' +
    (hasTags || hasAttach || hasSubs ? '<div style="padding:0 16px 6px;display:flex;gap:4px;flex-wrap:wrap;">' +
        (hasTags ? t.tags.slice(0, 3).map(function(tag) { return '<span class="tag-pill">' + escapeHtml(tag) + '</span>'; }).join('') : '') +
        (hasAttach ? '<span style="font-size:0.7rem;">📎 ' + t.attachments.length + '</span>' : '') +
        (hasSubs ? '<span style="font-size:0.7rem;">☑ ' + t.subtasks.filter(function(s){return s.completed;}).length + '/' + t.subtasks.length + '</span>' : '') +
    '</div>' : '');
}

// ─── 16. TASK ACTIONS ────────────────────────────────
window.toggleTask = function(id) {
    var task = getTaskById(id);
    if (!task) return;
    task.completed = !task.completed;
    task.status = task.completed ? 'done' : 'todo';
    saveData();
    renderAll();
};

window.editProject = function(id) {
    var p = getProjectById(id);
    if (p) openProjectModal(p);
};

window.editTask = function(id) {
    var t = getTaskById(id);
    if (t) openTaskModal(t);
};

deleteProjectConfirm = function(id) {
    var project = getProjectById(id);
    if (!project) return;
    var taskCount = appData.tasks.filter(function(t) { return t.projectId === id && !t.deletedAt; }).length;
    var msg = taskCount > 0
        ? 'Mettre à la corbeille "' + project.name + '" et ses ' + taskCount + ' tâche(s) ?'
        : 'Mettre à la corbeille le projet "' + project.name + '" ?';
    openConfirmModal(msg, function() { softDeleteProject(id); });
};

deleteTaskConfirm = function(id) {
    var task = getTaskById(id);
    if (!task) return;
    openConfirmModal('Mettre à la corbeille la tâche "' + task.title + '" ?', function() { softDeleteTask(id); });
};

// ─── 17. SUBTASKS ────────────────────────────────────
window.addSubtask = function(taskId, title) {
    if (!title) return;
    var task = getTaskById(taskId);
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ id: 's' + Date.now(), title: title, completed: false });
    saveData();
    renderDetailSubtasks(taskId);
    renderAll();
};

window.toggleSubtask = function(taskId, subtaskId) {
    var task = getTaskById(taskId);
    if (!task || !task.subtasks) return;
    var sub = task.subtasks.filter(function(s) { return s.id === subtaskId; })[0];
    if (sub) sub.completed = !sub.completed;
    saveData();
    renderDetailSubtasks(taskId);
    renderAll();
};

window.removeSubtask = function(taskId, subtaskId) {
    var task = getTaskById(taskId);
    if (!task || !task.subtasks) return;
    task.subtasks = task.subtasks.filter(function(s) { return s.id !== subtaskId; });
    saveData();
    renderDetailSubtasks(taskId);
    renderAll();
};

window.removeDetailTag = function(taskId, tagIndex) {
    var task = getTaskById(taskId);
    if (!task || !task.tags) return;
    task.tags.splice(tagIndex, 1);
    saveData();
    openTaskModal(getTaskById(taskId));
    renderAll();
};

function renderDetailSubtasks(taskId) {
    var task = getTaskById(taskId);
    var container = document.getElementById('subtasksList');
    if (!container) return;

    if (!task.subtasks || task.subtasks.length === 0) {
        container.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">Aucune sous-tâche</div>';
        document.getElementById('subtaskProgressText').textContent = '0/0';
        document.getElementById('subtaskProgressBar').style.width = '0%';
        return;
    }

    var done = task.subtasks.filter(function(s) { return s.completed; }).length;
    var total = task.subtasks.length;
    var pct = Math.round((done / total) * 100);

    document.getElementById('subtaskProgressText').textContent = done + '/' + total;
    document.getElementById('subtaskProgressBar').style.width = pct + '%';

    container.innerHTML = task.subtasks.map(function(s) {
        return '<div class="subtask-item' + (s.completed ? ' completed' : '') + '">' +
            '<input type="checkbox" ' + (s.completed ? 'checked' : '') + ' onchange="toggleSubtask(\'' + taskId + '\',\'' + s.id + '\')">' +
            '<span>' + escapeHtml(s.title) + '</span>' +
            '<button class="subtask-remove" onclick="removeSubtask(\'' + taskId + '\',\'' + s.id + '\')">×</button>' +
        '</div>';
    }).join('');
}

// ─── 18. UI HELPERS ──────────────────────────────────
function getProjectProgress(projectId) {
    var tasks = appData.tasks.filter(function(t) { return t.projectId === projectId && !t.deletedAt; });
    if (tasks.length === 0) return 0;
    var done = tasks.filter(function(t) { return t.status === 'done'; }).length;
    return Math.round((done / tasks.length) * 100);
}

function getStatusLabel(status) {
    var labels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
    return labels[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_) { return dateStr; }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    var icons = { success: '✅', error: '❌', info: '', warning: '⚠️' };
    toast.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 3000);
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function getProjectById(id) {
    return appData.projects.filter(function(p) { return p.id === id; })[0];
}

function getTaskById(id) {
    return appData.tasks.filter(function(t) { return t.id === id; })[0];
}

function populateFilterProjects() {
    var sel = document.getElementById('filterTaskProject');
    if (!sel) return;
    var val = sel.value;
    sel.innerHTML = '<option value="">Tous les projets</option>';
    getActiveProjects().forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === val) opt.selected = true;
        sel.appendChild(opt);
    });
}

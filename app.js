/* ═══════════════════════════════════════════════════
   GestionProjet — Application JavaScript
   Vanilla JS, localStorage, Zéro dépendance
   ═══════════════════════════════════════════════════ */

// ─── Configuration ──────────────────────────────────
const STORAGE_KEY = 'projectflow_data';
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz9D3ju9KTwaZLBmj5TbRJ0XsKSG8h9dQUyx_yGbbY0_pvh0-5FiM0T70KfQEZe0nFFfw/exec';
const USE_GAS = true;
const APP_VERSION = '1.0';

// ─── Data Layer (DB Module) ─────────────────────────
const DB = {
    _baseUrl: GAS_WEB_APP_URL,
    _useGas: USE_GAS,

    async read() {
        if (!this._useGas) {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) return JSON.parse(stored);
                return null;
            } catch (e) { return null; }
        }
        try {
            const resp = await fetch(this._baseUrl + '?action=get&_=' + Date.now());
            if (!resp.ok) throw new Error('Network error ' + resp.status);
            const data = await resp.json();
            if (data && (data.projects || data.tasks)) return data;
            return null;
        } catch (e) {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) return JSON.parse(stored);
            } catch (_) {}
            return null;
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
        } catch (e) {
            return false;
        }
    }
};

// Données pré-remplies au premier lancement
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
            id: 't1',
            projectId: 'p1',
            title: 'Maquette page d\'accueil',
            priority: 'haute',
            status: 'done',
            assignedTo: 'Marie',
            createdAt: '2026-06-01T10:30:00Z',
            completed: true
        },
        {
            id: 't2',
            projectId: 'p1',
            title: 'Intégrer le header responsive',
            priority: 'moyenne',
            status: 'in_progress',
            assignedTo: 'Thomas',
            createdAt: '2026-06-02T09:00:00Z',
            completed: false
        },
        {
            id: 't3',
            projectId: 'p1',
            title: 'Optimiser les images',
            priority: 'basse',
            status: 'todo',
            assignedTo: '',
            createdAt: '2026-06-03T11:00:00Z',
            completed: false
        },
        {
            id: 't4',
            projectId: 'p2',
            title: 'Créer le système d\'authentification',
            priority: 'haute',
            status: 'in_progress',
            assignedTo: 'Lucas',
            createdAt: '2026-06-10T15:00:00Z',
            completed: false
        },
        {
            id: 't5',
            projectId: 'p2',
            title: 'Design dashboard utilisateur',
            priority: 'moyenne',
            status: 'todo',
            assignedTo: 'Marie',
            createdAt: '2026-06-11T10:00:00Z',
            completed: false
        }
    ]
};

// ─── État de l'application ─────────────────────────
let appData = { projects: [], tasks: [] };
let currentTab = 'dashboard';
let confirmCallback = null;
let currentAttachments = []; // Temporaire pour le modal d'édition de tâche

// ─── Initialisation ─────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
    await initData();
    initNavigation();
    initMobileNav();
    initTheme();
    initModals();
    initForms();
    initDataActions();
    initSearch();
    initDragAndDrop();
    initNotifications();
    renderAll();
});

/**
 * Initialise les données depuis localStorage.
 * Charge les données seed si c'est le premier lancement.
 */
async function initData() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            appData = JSON.parse(stored);
            if (!appData.projects || appData.projects.length === 0 || !appData.tasks) {
                throw new Error('invalid data');
            }
            return;
        } catch(e) {}
    }
    appData = JSON.parse(JSON.stringify(SEED_DATA));
    await DB.write(appData);
}

/**
 * Sauvegarde les données dans localStorage.
 */
async function saveData() {
    try {
        await DB.write(appData);
    } catch (e) {
        showToast('Erreur de sauvegarde', 'error');
    }
}

// ─── Navigation par onglets ─────────────────────────
function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
}

/**
 * Change l'onglet actif.
 * @param {string} tabName - Nom de l'onglet
 */
function switchTab(tabName) {
    currentTab = tabName;
    
    // Close any open modal
    document.querySelectorAll('.modal:not(.hidden)').forEach(function(m) {
        m.classList.add('hidden');
    });
    
    // Reset body overflow (in case mobile menu was open)
    document.body.style.overflow = '';
    
    // Update desktop nav tabs
    document.querySelectorAll('.nav-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    
    // Update mobile nav items
    document.querySelectorAll('.mobile-nav-item').forEach(function(t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    
    // Close mobile menu if open
    var mobileMenu = document.getElementById('mobileNavMenu');
    var mobileOverlay = document.getElementById('mobileNavOverlay');
    var hamburger = document.getElementById('navHamburger');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(function(s) {
        s.classList.toggle('active', s.id === tabName);
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    renderAll();
}

// ─── Thème clair/sombre ─────────────────────────────
function initTheme() {
    const savedTheme = localStorage.getItem('projectflow_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    document.getElementById('themeToggle').addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('projectflow_theme', next);
        updateThemeIcon(next);
    });
}

/**
 * Met à jour l'icône du thème.
 */
function updateThemeIcon(theme) {
    const sun = document.getElementById('sunIcon');
    const moon = document.getElementById('moonIcon');
    if (theme === 'dark') {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
    } else {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
    }
}

// ─── Modals ─────────────────────────────────────────
function initModals() {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(function(btn) {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Overlay click
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.addEventListener('click', closeAllModals);
    });
    
    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
        closeAllModals();
    });
    
    // Add buttons (wrapper pour éviter que l'event soit passé comme argument)
    document.getElementById('addProjectBtn').addEventListener('click', function() { openProjectModal(); });
    document.getElementById('addTaskBtn').addEventListener('click', function() { openTaskModal(); });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.add('hidden');
    });
}

/**
 * Ouvre le modal d'ajout/édition de projet.
 * @param {Object} [project] - Projet à éditer (optionnel)
 */
function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    const title = document.getElementById('projectModalTitle');
    const form = document.getElementById('projectForm');
    
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

/**
 * Ouvre le modal d'ajout/édition de tâche.
 * @param {Object} [task] - Tâche à éditer (optionnel)
 */
function openTaskModal(task) {
    const modal = document.getElementById('taskModal');
    const title = document.getElementById('taskModalTitle');
    const form = document.getElementById('taskForm');
    
    // Populate project select
    const projectSelect = document.getElementById('taskProject');
    projectSelect.innerHTML = '';
    appData.projects.forEach(function(p) {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        projectSelect.appendChild(option);
    });
    
    // Reset attachments
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
        // Load existing attachments
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

/**
 * Ouvre le modal de confirmation de suppression.
 * @param {string} message - Message à afficher
 * @param {Function} callback - Fonction à exécuter si confirmé
 */
function openConfirmModal(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden');
}

// ─── Formulaires ────────────────────────────────────
function initForms() {
    // Project form
    document.getElementById('projectForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('projectId').value;
        const project = {
            id: id || generateId(),
            name: document.getElementById('projectName').value.trim(),
            description: document.getElementById('projectDescription').value.trim(),
            color: document.getElementById('projectColor').value,
            deadline: document.getElementById('projectDeadline').value || null,
            createdAt: id ? getProjectById(id).createdAt : new Date().toISOString()
        };
        
        if (id) {
            const index = appData.projects.findIndex(function(p) { return p.id === id; });
            if (index !== -1) {
                appData.projects[index] = project;
                showToast('Projet modifié avec succès', 'success');
            }
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
        const id = document.getElementById('taskId').value;
        const status = document.getElementById('taskStatus').value;
        const task = {
            id: id || generateId(),
            projectId: document.getElementById('taskProject').value,
            title: document.getElementById('taskTitle').value.trim(),
            priority: document.getElementById('taskPriority').value,
            status: status,
            assignedTo: document.getElementById('taskAssignedTo').value.trim(),
            deadline: document.getElementById('taskDeadline').value || '',
            createdAt: id ? getTaskById(id).createdAt : new Date().toISOString(),
            completed: status === 'done',
            attachments: currentAttachments
        };
        
        if (id) {
            const index = appData.tasks.findIndex(function(t) { return t.id === id; });
            if (index !== -1) {
                appData.tasks[index] = task;
                showToast('Tâche modifiée', 'success');
            }
        } else {
            appData.tasks.push(task);
            showToast('Tâche ajoutée', 'success');
        }
        
        currentAttachments = [];
        saveData();
        closeAllModals();
        renderAll();
    });
    
    // File input handler for task attachments
    document.getElementById('taskAttachments').addEventListener('change', function(e) {
        handleFileAttachments(e.target.files);
    });
}

/**
 * Gère l'ajout de fichiers joints avec validation (max 3 fichiers, 2 Mo max).
 * @param {FileList} files - Fichiers sélectionnés
 */
function handleFileAttachments(files) {
    var MAX_FILES = 3;
    var MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        
        // Vérifier la limite de fichiers
        if (currentAttachments.length >= MAX_FILES) {
            showToast('Maximum ' + MAX_FILES + ' fichiers par tâche', 'warning');
            break;
        }
        
        // Vérifier la taille
        if (file.size > MAX_SIZE) {
            showToast('Fichier "' + file.name + '" trop volumineux (max 2 Mo)', 'error');
            continue;
        }
        
        // Lire le fichier en base64
        (function(f) {
            var reader = new FileReader();
            reader.onload = function(evt) {
                currentAttachments.push({
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    data: evt.target.result
                });
                renderAttachedFilesList();
            };
            reader.readAsDataURL(f);
        })(file);
    }
    
    // Reset input
    document.getElementById('taskAttachments').value = '';
}

/**
 * Affiche la liste des fichiers attachés dans le modal.
 */
function renderAttachedFilesList() {
    var container = document.getElementById('attachedFilesList');
    if (currentAttachments.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = currentAttachments.map(function(file, index) {
        var sizeStr = file.size > 1024 * 1024
            ? (file.size / (1024 * 1024)).toFixed(1) + ' Mo'
            : (file.size / 1024).toFixed(0) + ' Ko';
        return '' +
            '<div class="attached-file-item">' +
                '<span class="file-name">' + escapeHtml(file.name) + '</span>' +
                '<span class="file-size">' + sizeStr + '</span>' +
                '<button type="button" class="file-remove" onclick="removeAttachment(' + index + ')">&times;</button>' +
            '</div>';
    }).join('');
}

/**
 * Supprime un fichier joint de la liste temporaire.
 * @param {number} index - Index du fichier à supprimer
 */
window.removeAttachment = function(index) {
    currentAttachments.splice(index, 1);
    renderAttachedFilesList();
};

// ─── Export / Import ────────────────────────────────
function initDataActions() {
    // Export JSON
    document.getElementById('exportBtn').addEventListener('click', function() {
        const jsonStr = JSON.stringify(appData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'projectflow_backup_' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Données exportées', 'success');
    });
    
    // Export CSV
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    
    // Import
    document.getElementById('importFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.projects && imported.tasks) {
                    openConfirmModal(
                        'Cela remplacera toutes vos données actuelles. Continuer ?',
                        function() {
                            appData = imported;
                            saveData();
                            renderAll();
                            showToast('Données importées avec succès', 'success');
                        }
                    );
                } else {
                    showToast('Format de fichier invalide', 'error');
                }
            } catch (err) {
                showToast('Fichier JSON invalide', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

/**
 * Export CSV — Génère et télécharge un fichier CSV avec les projets et tâches.
 * Contient deux sections distinctes avec en-têtes.
 */
function exportCSV() {
    var csvContent = '\uFEFF'; // BOM pour Excel
    
    // Section Projets
    csvContent += '=== PROJETS ===\n';
    csvContent += 'ID,Nom,Description,Couleur,Deadline,Date de création\n';
    
    appData.projects.forEach(function(p) {
        csvContent += [
            csvEscape(p.id),
            csvEscape(p.name),
            csvEscape(p.description || ''),
            csvEscape(p.color || ''),
            csvEscape(p.deadline || ''),
            csvEscape(p.createdAt || '')
        ].join(',') + '\n';
    });
    
    csvContent += '\n';
    
    // Section Tâches
    csvContent += '=== TÂCHES ===\n';
    csvContent += 'ID,Projet ID,Titre,Priorité,Statut,Assigné à,Date de création,Terminée,Fichiers joints\n';
    
    appData.tasks.forEach(function(t) {
        var attachCount = (t.attachments || []).length;
        csvContent += [
            csvEscape(t.id),
            csvEscape(t.projectId),
            csvEscape(t.title),
            csvEscape(t.priority),
            csvEscape(t.status),
            csvEscape(t.assignedTo || ''),
            csvEscape(t.createdAt || ''),
            t.completed ? 'Oui' : 'Non',
            attachCount.toString()
        ].join(',') + '\n';
    });
    
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'projectflow_export_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV téléchargé', 'success');
}

/**
 * Échappe une valeur pour CSV (guillemets, virgules, retours à la ligne).
 * @param {string} value - Valeur à échapper
 * @returns {string} Valeur échappée
 */
function csvEscape(value) {
    if (value === null || value === undefined) return '';
    var str = String(value);
    if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// ─── Rendu complet ──────────────────────────────────
function renderAll() {
    renderDashboard();
    renderProjects();
    renderTasks();
    renderGantt();
    renderCalendar();
    renderCorbeille();
}

// ─── Dashboard ──────────────────────────────────────
function renderDashboard() {
    const projects = appData.projects;
    const tasks = appData.tasks;
    
    // Stats
    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statTasksTotal').textContent = tasks.length;
    document.getElementById('statTasksDone').textContent = tasks.filter(function(t) { return t.status === 'done'; }).length;
    document.getElementById('statTasksProgress').textContent = tasks.filter(function(t) { return t.status === 'in_progress'; }).length;
    
    // Progress list per project
    const progressContainer = document.getElementById('dashboardProgress');
    if (projects.length === 0) {
        progressContainer.innerHTML = '<div class="empty-state"><p>Aucun projet</p></div>';
    } else {
        progressContainer.innerHTML = projects.map(function(p) {
            const progress = getProjectProgress(p.id);
            return '' +
                '<div class="dashboard-progress-item">' +
                    '<div class="dashboard-progress-info">' +
                        '<span class="dashboard-progress-name" style="color:' + escapeHtml(p.color) + '">' + escapeHtml(p.name) + '</span>' +
                        '<span class="dashboard-progress-value">' + progress + '%</span>' +
                    '</div>' +
                    '<div class="progress-bar">' +
                        '<div class="progress-fill" style="width:' + progress + '%; background:' + escapeHtml(p.color) + '"></div>' +
                    '</div>' +
                '</div>';
        }).join('');
    }
    
    // Priority tasks (haute, non terminées)
    const priorityTasks = tasks.filter(function(t) {
        return t.priority === 'haute' && t.status !== 'done';
    });
    const priorityContainer = document.getElementById('priorityTasks');
    if (priorityTasks.length === 0) {
        priorityContainer.innerHTML = '<div class="empty-state"><p>Aucune tâche prioritaire 🎉</p></div>';
    } else {
        priorityContainer.innerHTML = priorityTasks.map(function(t) {
            const project = getProjectById(t.projectId);
            return '' +
                '<div class="priority-task-item">' +
                    '<div>' +
                        '<div class="task-title" style="font-size:0.9rem">' + escapeHtml(t.title) + '</div>' +
                        '<div class="task-project">� ' + escapeHtml(project ? project.name : 'Projet supprimé') + '</div>' +
                    '</div>' +
                    '<span class="badge badge-priority haute">Haute</span>' +
                '</div>';
        }).join('');
    }
}

// ─── Projets ────────────────────────────────────────
function renderProjects() {
    const container = document.getElementById('projectsList');
    
    if (appData.projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>Aucun projet. Créez-en un !</p></div>';
        return;
    }
    
    container.innerHTML = appData.projects.map(function(p) {
        const progress = getProjectProgress(p.id);
        const projectTasks = appData.tasks.filter(function(t) { return t.projectId === p.id; });
        const completedCount = projectTasks.filter(function(t) { return t.status === 'done'; }).length;
        
        return '' +
            '<div class="project-card">' +
                '<div class="project-card-header" style="background:' + escapeHtml(p.color) + '">' +
                    '<h3>' + escapeHtml(p.name) + '</h3>' +
                    '<p>' + escapeHtml(p.description || 'Pas de description') + '</p>' +
                '</div>' +
                '<div class="project-card-body">' +
                    '<div class="project-meta">' +
                        '<span class="badge badge-status ' + (completedCount === projectTasks.length && projectTasks.length > 0 ? 'done' : 'todo') + '">' +
                            completedCount + '/' + projectTasks.length + ' tâches' +
                        '</span>' +
                        (p.deadline ? '<span class="project-deadline">📅 ' + formatDate(p.deadline) + '</span>' : '') +
                    '</div>' +
                    '<div class="progress-bar">' +
                        '<div class="progress-fill" style="width:' + progress + '%; background:' + escapeHtml(p.color) + '"></div>' +
                    '</div>' +
                    '<div class="progress-text">' + progress + '% complété</div>' +
                    '<div class="project-card-actions">' +
                        '<button class="btn btn-sm btn-secondary" onclick="editProject(\'' + p.id + '\')">✎ Modifier</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="deleteProjectConfirm(\'' + p.id + '\')">✕ Supprimer</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }).join('');
}

// ─── Tâches ─────────────────────────────────────────
function renderTasks() {
    const container = document.getElementById('tasksList');
    const filterProject = document.getElementById('filterTaskProject').value;
    const filterStatus = document.getElementById('filterTaskStatus').value;
    const filterPriority = document.getElementById('filterTaskPriority').value;

    console.log('[renderTasks] total appData.tasks:', appData.tasks.length, 'filterProject:', filterProject);

    // Filtrage
    var tasks = appData.tasks.slice();
    if (filterProject) tasks = tasks.filter(function(t) { return t.projectId === filterProject; });
    if (filterStatus) tasks = tasks.filter(function(t) { return t.status === filterStatus; });
    if (filterPriority) tasks = tasks.filter(function(t) { return t.priority === filterPriority; });

    // Tri : non-complétées en premier, puis par deadline puis priorité
    var priorityOrder = { haute: 0, moyenne: 1, basse: 2 };
    tasks.sort(function(a, b) {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.deadline && b.deadline) {
            var diff = a.deadline.localeCompare(b.deadline);
            if (diff !== 0) return diff;
        } else if (a.deadline) {
            return -1;
        } else if (b.deadline) {
            return 1;
        }
        return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });

    // Sort direction toggle
    var sortDirBtn = document.getElementById('sortDirBtn');
    if (sortDirBtn && sortDirBtn.classList.contains('inactive')) {
        tasks.reverse();
    }

    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Aucune tâche trouvée</p></div>';
        return;
    }

    container.innerHTML = tasks.map(function(t) { return renderTaskItem(t); }).join('');
}

function renderTaskItem(t) {
    var project = getProjectById(t.projectId);
    var projectIcon = getProjectIcon(project);

    // Format deadline
    var deadlineStr = '';
    if (t.deadline) {
        var d = new Date(t.deadline);
        var now = new Date();
        var diff = Math.ceil((d - now) / 86400000);
        if (diff < 0) {
            deadlineStr = '<span style="color:#ef4444;font-weight:500;"> En retard (' + Math.abs(diff) + 'j)</span>';
        } else if (diff === 0) {
            deadlineStr = '<span style="color:#f59e0b;font-weight:500;"> Aujourd\'hui</span>';
        } else if (diff <= 3) {
            deadlineStr = '<span style="color:#f59e0b;"> ' + diff + 'j</span>';
        } else {
            deadlineStr = ' ' + formatDate(t.deadline);
        }
    }

    // Project tag color
    var projectColor = project ? project.color : '#6366f1';

    // Assignee (first name)
    var assigneeStr = '';
    if (t.assignedTo) {
        var name = t.assignedTo.trim().split(' ')[0];
        assigneeStr = '<span style="font-size:0.65rem;color:var(--text-secondary);background:var(--bg-card);padding:2px 6px;border-radius:8px;border:1px solid var(--border);">' + escapeHtml(name) + '</span>';
    }

    // Tags
    var tagsHtml = '';
    if (t.tags && t.tags.length > 0) {
        tagsHtml = t.tags.slice(0, 3).map(function(tag) { return '<span class="tag-pill">' + escapeHtml(tag) + '</span>'; }).join('');
        if (t.tags.length > 3) tagsHtml += '<span class="tag-pill">+' + (t.tags.length - 3) + '</span>';
    }

    return '' +
        '<div class="task-card priority-' + t.priority + (t.completed ? ' completed' : '') + '" onclick="editTask(\'' + t.id + '\')">' +
            '<div class="task-card-left">' +
                '<div class="task-checkbox' + (t.completed ? ' checked' : '') + '" onclick="event.stopPropagation();toggleTask(\'' + t.id + '\')">' +
                    (t.completed ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
                '</div>' +
                '<span class="priority-dot ' + t.priority + '"></span>' +
                '<div class="task-card-title">' + escapeHtml(t.title) + '</div>' +
            '</div>' +
            '<div class="task-card-meta">' +
                (project ? '<span class="project-tag" style="background:' + projectColor + '15;color:' + projectColor + ';">' + projectIcon + ' ' + escapeHtml(project.name) + '</span>' : '') +
                deadlineStr +
            '</div>' +
            '<div class="task-card-right">' +
                assigneeStr +
                '<span class="status-badge ' + t.status + '">' + getStatusLabel(t.status) + '</span>' +
                '<button class="delete-btn" onclick="event.stopPropagation();deleteTaskConfirm(\'' + t.id + '\')" title="Supprimer">✕</button>' +
            '</div>' +
        '</div>' +
        (tagsHtml ? '<div style="padding:0 16px 6px;display:flex;gap:4px;flex-wrap:wrap;">' + tagsHtml + '</div>' : '');
}

/**
 * Remplit une colonne Kanban avec les tâches correspondant au statut.
 * @param {string} status - Statut des tâches
 * @param {Array} allTasks - Toutes les tâches
 */
function renderKanbanColumn(status, allTasks) {
    var column = document.getElementById('kanban' + status.charAt(0).toUpperCase() + status.slice(1).replace('_', ''));
    var dropzone = document.getElementById('kanban' + (status === 'in_progress' ? 'InProgress' : status.charAt(0).toUpperCase() + status.slice(1)));
    var countEl = document.getElementById('kanbanCount' + (status === 'in_progress' ? 'InProgress' : status.charAt(0).toUpperCase() + status.slice(1)));
    
    var filteredTasks = allTasks.filter(function(t) { return t.status === status; });
    
    if (countEl) countEl.textContent = filteredTasks.length;
    
    if (filteredTasks.length === 0) {
        dropzone.innerHTML = '<div style="text-align:center;padding:20px 10px;color:var(--text-muted);font-size:0.8rem;">Aucune tâche</div>';
    } else {
        dropzone.innerHTML = filteredTasks.map(function(t) { return renderTaskItem(t); }).join('');
    }
}

// ─── Drag & Drop des tâches ─────────────────────────
function initDragAndDrop() {
    // Utiliser la délégation d'événements pour gérer le drag & drop
    document.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('task-item')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    
    document.addEventListener('dragend', function(e) {
        if (e.target.classList.contains('task-item')) {
            e.target.classList.remove('dragging');
        }
        // Retirer la classe drag-over de toutes les dropzones
        document.querySelectorAll('.kanban-dropzone').forEach(function(zone) {
            zone.classList.remove('drag-over');
        });
    });
    
    // Configurer les dropzones
    document.querySelectorAll('.kanban-dropzone').forEach(function(zone) {
        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', function(e) {
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });
        
        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            var taskId = e.dataTransfer.getData('text/plain');
            var newStatus = zone.id.replace('kanban', '').toLowerCase();
            // Normaliser le nom de statut
            if (newStatus === 'inprogress') newStatus = 'in_progress';
            
            // Mettre à jour le statut de la tâche
            var task = getTaskById(taskId);
            if (task && task.status !== newStatus) {
                task.status = newStatus;
                task.completed = (newStatus === 'done');
                saveData();
                renderAll();
                showToast('Tâche déplacée : ' + getStatusLabel(newStatus), 'success');
            }
        });
    });
}

// ─── Timeline / Gantt Chart ─────────────────────────
function renderGantt() {
    var container = document.getElementById('ganttChart');
    var projects = appData.projects;
    
    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucun projet à afficher</p></div>';
        return;
    }
    
    // Calculer les dates min/max
    var allDates = [];
    projects.forEach(function(p) {
        if (p.createdAt) allDates.push(new Date(p.createdAt).getTime());
        if (p.deadline) allDates.push(new Date(p.deadline).getTime());
    });
    
    if (allDates.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Pas de dates disponibles</p></div>';
        return;
    }
    
    var minDate = Math.min.apply(null, allDates);
    var maxDate = Math.max.apply(null, allDates);
    
    // Ajouter une marge
    var range = maxDate - minDate;
    if (range === 0) range = 86400000 * 30; // 1 mois par défaut
    minDate -= range * 0.05;
    maxDate += range * 0.05;
    range = maxDate - minDate;
    
    var today = new Date().getTime();
    var todayPercent = ((today - minDate) / range) * 100;
    
    // Générer les mois pour l'en-tête
    var monthsHtml = '';
    var currentMonth = new Date(minDate);
    currentMonth.setDate(1);
    while (currentMonth.getTime() < maxDate) {
        var monthStart = currentMonth.getTime();
        var nextMonth = new Date(currentMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        var monthEnd = nextMonth.getTime();
        
        var startPercent = Math.max(0, ((monthStart - minDate) / range) * 100);
        var endPercent = Math.min(100, ((monthEnd - minDate) / range) * 100);
        var widthPercent = endPercent - startPercent;
        
        monthsHtml += '<div class="gantt-month" style="width:' + widthPercent + '%;left:' + startPercent + '%">' +
            currentMonth.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) +
        '</div>';
        
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Générer les lignes du Gantt
    var rowsHtml = '';
    projects.forEach(function(p) {
        var startPercent = 0, widthPercent = 5;
        if (p.createdAt && p.deadline) {
            var start = new Date(p.createdAt).getTime();
            var end = new Date(p.deadline).getTime();
            startPercent = Math.max(0, ((start - minDate) / range) * 100);
            widthPercent = Math.max(2, ((end - start) / range) * 100);
        } else if (p.deadline) {
            var dl = new Date(p.deadline).getTime();
            startPercent = Math.max(0, ((dl - 86400000 * 7 - minDate) / range) * 100);
            widthPercent = ((dl - minDate) / range) * 100 - startPercent;
        }
        
        rowsHtml += '<div class="gantt-row">' +
            '<div class="gantt-row-title" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</div>' +
            '<div class="gantt-row-bar-container">' +
                '<div class="gantt-row-bar" style="left:' + startPercent + '%;width:' + widthPercent + '%;background:' + escapeHtml(p.color || '#6366f1') + '">' +
                    '<span style="padding:0 8px;font-size:0.7rem;color:white;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;line-height:24px">' + 
                        getProjectProgress(p.id) + '%' + 
                    '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    });
    
    container.innerHTML = '' +
        '<div class="gantt-chart-wrapper">' +
            '<div class="gantt-header">' +
                '<div class="gantt-header-title">Projet</div>' +
                '<div class="gantt-months">' + monthsHtml + '</div>' +
            '</div>' +
            rowsHtml +
        '</div>';
    
    // Ajouter le marqueur "aujourd'hui"
    if (todayPercent >= 0 && todayPercent <= 100) {
        var todayMarker = document.createElement('div');
        todayMarker.className = 'gantt-today-marker';
        todayMarker.style.left = todayPercent + '%';
        todayMarker.innerHTML = '<span class="gantt-today-label">Aujourd\'hui</span>';
        
        // Insérer dans chaque ligne du Gantt
        document.querySelectorAll('.gantt-row-bar-container').forEach(function(container) {
            var clone = todayMarker.cloneNode(true);
            clone.style.bottom = '0';
            // Position relative au conteneur parent
            container.style.position = 'relative';
            container.appendChild(clone);
        });
    }
}

/**
 * Génère le texte affiché sur une barre Gantt.
 * @param {Object} project - Objet projet
 * @returns {string} Texte de la barre
 */
function progress_barLabel(project) {
    var progress = getProjectProgress(project.id);
    if (project.deadline) {
        return project.name + ' (' + progress + '%) — ' + formatDate(project.deadline);
    }
    return project.name + ' (' + progress + '%)';
}

// ─── Notifications navigateur ───────────────────────
function initNotifications() {
    // Demander la permission de notification au premier visitement
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Vérifier les deadlines toutes les 30 minutes
    checkUpcomingDeadlines();
    setInterval(checkUpcomingDeadlines, 30 * 60 * 1000);
}

/**
 * Vérifie les deadlines des tâches et envoie des notifications pour celles proches (3 jours).
 */
function checkUpcomingDeadlines() {
    var now = new Date();
    var threeDaysLater = new Date(now.getTime() + 3 * 86400000);
    
    appData.tasks.forEach(function(task) {
        if (task.status === 'done' || !task.deadline) return;
        
        var deadline = new Date(task.deadline);
        var diffDays = Math.ceil((deadline - now) / 86400000);
        
        if (diffDays > 0 && diffDays <= 3) {
            var project = getProjectById(task.projectId);
            var msg = 'La tâche "' + task.title + '" (projet "' + (project ? project.name : '') + ') arrive à échéance dans ' + diffDays + ' jour(s)';
            
            // Notification navigateur
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('GestionProjet — Échéance proche', {
                    body: msg,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%236366f1" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>'
                });
            }
            
            // Toast d'avertissement in-app
            if (diffDays <= 1) {
                showToast('⚠️ ' + msg, 'error');
            } else {
                showToast('� ' + msg, 'warning');
            }
        }
    });
}

// ─── Recherche globale ──────────────────────────────
function initSearch() {
    var searchToggle = document.getElementById('searchToggle');
    var searchOverlay = document.getElementById('searchOverlay');
    var searchInput = document.getElementById('searchInput');
    var searchClose = document.getElementById('searchClose');
    var searchResults = document.getElementById('searchResults');
    var backdrop = searchOverlay.querySelector('.search-overlay-backdrop');
    
    // Ouvrir la recherche
    searchToggle.addEventListener('click', function() {
        searchOverlay.classList.remove('hidden');
        setTimeout(function() { searchInput.focus(); }, 100);
    });
    
    // Fermer la recherche
    searchClose.addEventListener('click', function() {
        closeSearch();
    });
    
    backdrop.addEventListener('click', function() {
        closeSearch();
    });
    
    // Fermer avec Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !searchOverlay.classList.contains('hidden')) {
            closeSearch();
        }
    });
    
    // Recherche en temps réel
    searchInput.addEventListener('input', function() {
        var query = searchInput.value.trim().toLowerCase();
        if (query.length === 0) {
            searchResults.innerHTML = '';
            return;
        }
        performSearch(query);
    });
    
    function closeSearch() {
        searchOverlay.classList.add('hidden');
        searchInput.value = '';
        searchResults.innerHTML = '';
    }
    
    /**
     * Effectue la recherche dans les projets et tâches.
     * @param {string} query - Texte de recherche
     */
    function performSearch(query) {
        // Rechercher dans les projets
        var matchingProjects = appData.projects.filter(function(p) {
            return (p.name && p.name.toLowerCase().indexOf(query) !== -1) ||
                   (p.description && p.description.toLowerCase().indexOf(query) !== -1);
        });
        
        // Rechercher dans les tâches
        var matchingTasks = appData.tasks.filter(function(t) {
            return (t.title && t.title.toLowerCase().indexOf(query) !== -1) ||
                   (t.description && t.description.toLowerCase().indexOf(query) !== -1) ||
                   (t.assignedTo && t.assignedTo.toLowerCase().indexOf(query) !== -1);
        });
        
        // Construire les résultats
        var html = '';
        
        if (matchingProjects.length === 0 && matchingTasks.length === 0) {
            html = '<div class="search-no-results">Aucun résultat pour "' + escapeHtml(query) + '"</div>';
        } else {
            if (matchingProjects.length > 0) {
                html += '<div class="search-result-category">Projets (' + matchingProjects.length + ')</div>';
                matchingProjects.forEach(function(p) {
                    html += '' +
                        '<div class="search-result-item" onclick="searchGoToProject(\'' + p.id + '\')">' +
                            '<div class="result-icon project">📁</div>' +
                            '<div class="result-text">' +
                                '<div class="result-title">' + highlightMatch(escapeHtml(p.name), query) + '</div>' +
                                '<div class="result-subtitle">' + highlightMatch(escapeHtml(p.description || 'Pas de description'), query) + '</div>' +
                        '</div>';
                });
            }
            
            if (matchingTasks.length > 0) {
                html += '<div class="search-result-category">Tâches (' + matchingTasks.length + ')</div>';
                matchingTasks.forEach(function(t) {
                    var project = getProjectById(t.projectId);
                    var statusLabel = getStatusLabel(t.status);
                    html += '' +
                        '<div class="search-result-item" onclick="searchGoToTask(\'' + t.id + '\')">' +
                            '<div class="result-icon task">✓</div>' +
                            '<div class="result-text">' +
                                '<div class="result-title">' + highlightMatch(escapeHtml(t.title), query) + '</div>' +
                                '<div class="result-subtitle">' + (project ? escapeHtml(project.name) + ' • ' : '') + statusLabel + (t.assignedTo ? ' • ' + escapeHtml(t.assignedTo) : '') + '</div>' +
                            '</div>' +
                        '</div>';
                });
            }
        }
        
        searchResults.innerHTML = html;
    }
}

/**
 * Met en évidence les correspondances de recherche dans un texte.
 * @param {string} text - Texte original
 * @param {string} query - Texte à mettre en évidence
 * @returns {string} Texte avec balises <mark>
 */
function highlightMatch(text, query) {
    if (!query) return text;
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + escaped + ')', 'gi');
    return text.replace(regex, '<mark style="background:var(--primary-light);color:var(--primary);border-radius:2px;padding:0 2px;">$1</mark>');
}

/**
 * Navigation vers un projet depuis la recherche.
 * @param {string} projectId - ID du projet
 */
window.searchGoToProject = function(projectId) {
    document.getElementById('searchOverlay').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    switchTab('projects');
    // Ouvrir le modal d'édition après un court délai
    setTimeout(function() {
        var project = getProjectById(projectId);
        if (project) openProjectModal(project);
    }, 300);
};

/**
 * Navigation vers une tâche depuis la recherche.
 * @param {string} taskId - ID de la tâche
 */
window.searchGoToTask = function(taskId) {
    document.getElementById('searchOverlay').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    switchTab('tasks');
    setTimeout(function() {
        var task = getTaskById(taskId);
        if (task) openTaskModal(task);
    }, 300);
};

// ─── Filtres tasks ──────────────────────────────────
function populateFilterProjects() {
    const select = document.getElementById('filterTaskProject');
    select.innerHTML = '<option value="">Tous les projets</option>';
    appData.projects.forEach(function(p) {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });
}

// ─── Actions Projets ────────────────────────────────
window.editProject = function(id) {
    const project = getProjectById(id);
    if (project) openProjectModal(project);
};

window.deleteProjectConfirm = function(id) {
    const project = getProjectById(id);
    if (!project) return;
    const taskCount = appData.tasks.filter(function(t) { return t.projectId === id; }).length;
    const msg = taskCount > 0
        ? 'Supprimer "' + project.name + '" et ses ' + taskCount + ' tâche(s) ?'
        : 'Supprimer le projet "' + project.name + '" ?';
    
    openConfirmModal(msg, function() {
        appData.projects = appData.projects.filter(function(p) { return p.id !== id; });
        appData.tasks = appData.tasks.filter(function(t) { return t.projectId !== id; });
        saveData();
        renderAll();
        showToast('Projet supprimé', 'success');
    });
};

// ─── Actions Tâches ─────────────────────────────────
window.editTask = function(id) {
    const task = getTaskById(id);
    if (task) openTaskModal(task);
};

window.deleteTaskConfirm = function(id) {
    const task = getTaskById(id);
    if (!task) return;
    openConfirmModal('Supprimer la tâche "' + task.title + '" ?', function() {
        appData.tasks = appData.tasks.filter(function(t) { return t.id !== id; });
        saveData();
        renderAll();
        showToast('Tâche supprimée', 'success');
    });
};

window.toggleTask = function(id) {
    const task = getTaskById(id);
    if (!task) return;
    task.completed = !task.completed;
    task.status = task.completed ? 'done' : 'todo';
    saveData();
    renderAll();
    if (task.completed) showToast('Tâche terminée 🎉', 'success');
};

// ─── Écouteurs de filtres ───────────────────────────
document.getElementById('filterTaskProject').addEventListener('change', renderTasks);
document.getElementById('filterTaskStatus').addEventListener('change', renderTasks);
document.getElementById('filterTaskPriority').addEventListener('change', renderTasks);

// ─── Fonctions utilitaires ──────────────────────────

/**
 * Génère un ID unique.
 */
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Récupère un projet par son ID.
 */
function getProjectById(id) {
    return appData.projects.find(function(p) { return p.id === id; });
}

/**
 * Récupère une tâche par son ID.
 */
function getTaskById(id) {
    return appData.tasks.find(function(t) { return t.id === id; });
}

/**
 * Calcule la progression d'un projet en pourcentage.
 * @param {string} projectId - ID du projet
 * @returns {number} Pourcentage de complétion
 */
function getProjectProgress(projectId) {
    const tasks = appData.tasks.filter(function(t) { return t.projectId === projectId; });
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(function(t) { return t.status === 'done'; }).length;
    return Math.round((completed / tasks.length) * 100);
}

/**
 * Retourne le label lisible d'un statut.
 */
function getStatusLabel(status) {
    var labels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
    return labels[status] || status;
}

function getProjectIcon(project) {
    if (!project) return '📁';
    return project.icon || '📁';
}

/**
 * Formate une date en français.
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

/**
 * Échappe le HTML pour éviter les injections.
 */
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Affiche une notification toast.
 * @param {string} message - Message à afficher
 * @param {string} [type='info'] - Type: success, error, info, warning
 */
function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icons = {
        success: '✅',
        error: '❌',
        info: '�️',
        warning: '⚠️'
    };
    
    toast.innerHTML = '<span>' + (icons[type] || '�️') + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    
    // Auto-remove after 3s
    setTimeout(function() {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// ─── Rendu initial avec filtres ─────────────────────
var originalRenderTasks = renderTasks;
renderTasks = function() {
    populateFilterProjects();
    originalRenderTasks();
};

// ══════════════════════════════════════════════════════
//  7 NOUVELLES FONCTIONNALITÉS
// ══════════════════════════════════════════════════════

// ─── 1. CORBEILLE / Soft Delete ──────────────────────

/**
 * Retourne uniquement les projets actifs (non supprimés).
 */
function getActiveProjects() {
    return appData.projects.filter(function(p) { return !p.deletedAt; });
}

/**
 * Retourne uniquement les tâches actives (projet actif + non supprimées).
 */
function getActiveTasks() {
    var activeProjectIds = getActiveProjects().map(function(p) { return p.id; });
    return appData.tasks.filter(function(t) { return !t.deletedAt && activeProjectIds.indexOf(t.projectId) !== -1; });
}

/**
 * Soft delete d'un projet (ajoute deletedAt au lieu de supprimer).
 */
window.softDeleteProject = function(id) {
    var project = getProjectById(id);
    if (!project) return;
    project.deletedAt = new Date().toISOString();
    // Soft delete des tâches associées
    appData.tasks.forEach(function(t) {
        if (t.projectId === id) t.deletedAt = new Date().toISOString();
    });
    saveData();
    renderAll();
    showToast('Projet mis à la corbeille', 'success');
};

/**
 * Soft delete d'une tâche.
 */
window.softDeleteTask = function(id) {
    var task = getTaskById(id);
    if (!task) return;
    task.deletedAt = new Date().toISOString();
    saveData();
    renderAll();
    showToast('Tâche mise à la corbeille', 'success');
};

/**
 * Restaurure un projet ou une tâche depuis la corbeille.
 */
window.restoreItem = function(type, id) {
    if (type === 'project') {
        var project = getProjectById(id);
        if (project) {
            project.deletedAt = null;
            // Restaurer aussi les tâches
            appData.tasks.forEach(function(t) {
                if (t.projectId === id) t.deletedAt = null;
            });
        }
    } else if (type === 'task') {
        var task = getTaskById(id);
        if (task) task.deletedAt = null;
    }
    saveData();
    renderCorbeille();
    renderAll();
    showToast('Élément restauré', 'success');
};

/**
 * Suppression définitive (permanente).
 */
window.permanentDelete = function(type, id) {
    openConfirmModal('Supprimer définitivement ? Cette action est irréversible.', function() {
        if (type === 'project') {
            appData.projects = appData.projects.filter(function(p) { return p.id !== id; });
            appData.tasks = appData.tasks.filter(function(t) { return t.projectId !== id; });
        } else if (type === 'task') {
            appData.tasks = appData.tasks.filter(function(t) { return t.id !== id; });
        }
        saveData();
        renderCorbeille();
        showToast('Supprimé définitivement', 'success');
    });
};

/**
 * Purge automatique des éléments supprimés depuis plus de 30 jours.
 */
function purgeOldDeletedItems() {
    var now = new Date().getTime();
    var thirtyDays = 30 * 86400000;
    appData.projects = appData.projects.filter(function(p) {
        if (!p.deletedAt) return true;
        return (now - new Date(p.deletedAt).getTime()) < thirtyDays;
    });
    appData.tasks = appData.tasks.filter(function(t) {
        if (!t.deletedAt) return true;
        return (now - new Date(t.deletedAt).getTime()) < thirtyDays;
    });
    saveData();
}

/**
 * Rendu de la corbeille (projets et tâches supprimés).
 */
function renderCorbeille() {
    var container = document.getElementById('corbeilleContent');
    if (!container) return;
    
    var deletedProjects = appData.projects.filter(function(p) { return !!p.deletedAt; });
    var deletedTasks = appData.tasks.filter(function(t) { return !!t.deletedAt; });
    
    if (deletedProjects.length === 0 && deletedTasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">🗑️</div><p>La corbeille est vide</p></div>';
        return;
    }
    
    var html = '';
    
    if (deletedProjects.length > 0) {
        html += '<h3 style="margin:20px 0 10px;">Projets supprimés (' + deletedProjects.length + ')</h3>';
        html += '<div class="corbeille-list">';
        deletedProjects.forEach(function(p) {
            var deletedDate = formatDate(p.deletedAt);
            html += '' +
                '<div class="corbeille-item">' +
                    '<div class="corbeille-item-info">' +
                        '<span class="corbeille-item-type">📁 Projet</span>' +
                        '<span class="corbeille-item-name">' + escapeHtml(p.name) + '</span>' +
                        '<span class="corbeille-item-date">Supprimé le ' + deletedDate + '</span>' +
                    '</div>' +
                    '<div class="corbeille-item-actions">' +
                        '<button class="btn btn-sm btn-secondary" onclick="restoreItem(\'project\',\'' + p.id + '\')">♺ Restaurer</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="permanentDelete(\'project\',\'' + p.id + '\')">✕ Supprimer</button>' +
                    '</div>' +
                '</div>';
        });
        html += '</div>';
    }
    
    if (deletedTasks.length > 0) {
        html += '<h3 style="margin:20px 0 10px;">Tâches supprimées (' + deletedTasks.length + ')</h3>';
        html += '<div class="corbeille-list">';
        deletedTasks.forEach(function(t) {
            var project = getProjectById(t.projectId);
            var deletedDate = formatDate(t.deletedAt);
            html += '' +
                '<div class="corbeille-item">' +
                    '<div class="corbeille-item-info">' +
                        '<span class="corbeille-item-type">✓ Tâche</span>' +
                        '<span class="corbeille-item-name">' + escapeHtml(t.title) + '</span>' +
                        '<span class="corbeille-item-date">' + escapeHtml(project ? project.name : '—') + ' • Supprimé le ' + deletedDate + '</span>' +
                    '</div>' +
                    '<div class="corbeille-item-actions">' +
                        '<button class="btn btn-sm btn-secondary" onclick="restoreItem(\'task\',\'' + t.id + '\')">♺ Restaurer</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="permanentDelete(\'task\',\'' + t.id + '\')">✕ Supprimer</button>' +
                    '</div>' +
                '</div>';
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// ─── 2. MODÈLES DE PROJETS (Templates) ──────────────

/**
 * Templates de projets prédéfinis.
 */
var PROJECT_TEMPLATES = [
    {
        name: 'Site Web',
        description: 'Projet de développement web complet',
        color: '#6366f1',
        tasks: [
            { title: 'Design / Maquettes', priority: 'haute' },
            { title: 'Frontend (HTML/CSS/JS)', priority: 'haute' },
            { title: 'Backend / API', priority: 'moyenne' },
            { title: 'Tests & QA', priority: 'moyenne' },
            { title: 'Déploiement', priority: 'basse' }
        ]
    },
    {
        name: 'App Mobile',
        description: 'Application mobile iOS/Android',
        color: '#22c55e',
        tasks: [
            { title: 'UI/UX Design', priority: 'haute' },
            { title: 'Développement iOS/Android', priority: 'haute' },
            { title: 'Backend / API', priority: 'moyenne' },
            { title: 'Tests & QA', priority: 'moyenne' },
            { title: 'Publication App Store / Play Store', priority: 'basse' }
        ]
    },
    {
        name: 'Marketing',
        description: 'Campagne marketing digitale',
        color: '#f59e0b',
        tasks: [
            { title: 'Stratégie & Objectifs', priority: 'haute' },
            { title: 'Création de contenu', priority: 'moyenne' },
            { title: 'Campagnes publicitaires', priority: 'haute' },
            { title: 'Analytics & Reporting', priority: 'basse' }
        ]
    },
    {
        name: 'Projet personnalisé',
        description: 'Projet vide à personnaliser',
        color: '#64748b',
        tasks: []
    }
];

/**
 * Initialise le menu déroulant des templates.
 */
function initTemplateDropdown() {
    var menu = document.getElementById('projectTemplateMenu');
    if (!menu) return;
    
    menu.innerHTML = PROJECT_TEMPLATES.map(function(tpl, i) {
        return '<button type="button" class="template-option" onclick="createProjectFromTemplate(' + i + ')">' +
            '<strong>' + escapeHtml(tpl.name) + '</strong>' +
            '<span>' + escapeHtml(tpl.description) + ' • ' + tpl.tasks.length + ' tâches</span>' +
        '</button>';
    }).join('');
    
    var btn = document.getElementById('projectTemplateBtn');
    if (btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        });
    }
    
    // Fermer le menu quand on clique ailleurs
    document.addEventListener('click', function() {
        menu.classList.add('hidden');
    });
}

/**
 * Crée un projet à partir d'un template avec ses tâches prédéfinies.
 * @param {number} templateIndex - Index du template
 */
window.createProjectFromTemplate = function(templateIndex) {
    var tpl = PROJECT_TEMPLATES[templateIndex];
    if (!tpl) return;
    
    var project = {
        id: generateId(),
        name: tpl.name,
        description: tpl.description,
        color: tpl.color,
        deadline: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
        isTemplate: true
    };
    
    appData.projects.push(project);
    
    // Créer les tâches du template
    tpl.tasks.forEach(function(t) {
        var task = {
            id: generateId(),
            projectId: project.id,
            title: t.title,
            priority: t.priority,
            status: 'todo',
            assignedTo: '',
            createdAt: new Date().toISOString(),
            completed: false,
            deletedAt: null,
            attachments: [],
            tags: [],
            subtasks: []
        };
        appData.tasks.push(task);
    });
    
    saveData();
    closeAllModals();
    renderAll();
    showToast('Projet "' + tpl.name + '" créé avec ' + tpl.tasks.length + ' tâches', 'success');
};

// ─── 3. ÉTIQUETTES / TAGS ───────────────────────────

/**
 * Ajoute une étiquette à une tâche.
 * @param {string} taskId - ID de la tâche
 * @param {string} tag - Nom de l'étiquette
 */
window.addTagToTask = function(taskId, tag) {
    var task = getTaskById(taskId);
    if (!task || !tag) return;
    if (!task.tags) task.tags = [];
    if (task.tags.indexOf(tag) === -1) {
        task.tags.push(tag);
        saveData();
        renderAll();
    }
};

/**
 * Retire une étiquette d'une tâche.
 * @param {string} taskId - ID de la tâche
 * @param {string} tag - Nom de l'étiquette
 */
window.removeTagFromTask = function(taskId, tag) {
    var task = getTaskById(taskId);
    if (!task || !task.tags) return;
    task.tags = task.tags.filter(function(t) { return t !== tag; });
    saveData();
    renderAll();
};

/**
 * Retourne toutes les étiquettes uniques utilisées.
 */
function getAllTags() {
    var tags = {};
    appData.tasks.forEach(function(t) {
        if (t.tags) {
            t.tags.forEach(function(tag) {
                tags[tag] = true;
            });
        }
    });
    return Object.keys(tags);
}

/**
 * Initialise le champ de saisie des étiquettes dans le modal tâche.
 */
function initTagInput() {
    var input = document.getElementById('taskTagInput');
    var suggestions = document.getElementById('taskTagSuggestions');
    if (!input) return;
    
    var currentTags = [];
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var tag = input.value.trim().toLowerCase();
            if (tag) {
                var taskId = document.getElementById('taskId').value;
                if (taskId) {
                    addTagToTask(taskId, tag);
                }
                currentTags.push(tag);
                renderCurrentTags(currentTags);
                input.value = '';
            }
        }
    });
    
    // Afficher les suggestions
    input.addEventListener('focus', function() {
        var allTags = getAllTags();
        var filtered = allTags.filter(function(t) { return currentTags.indexOf(t) === -1; });
        if (filtered.length > 0) {
            suggestions.innerHTML = filtered.slice(0, 6).map(function(t) {
                return '<span class="tag-suggestion" onclick="pickSuggestion(\'' + t.replace(/'/g, "\\'") + '\')">' + escapeHtml(t) + '</span>';
            }).join('');
        }
    });
    
    function pickSuggestion(tag) {
        var taskId = document.getElementById('taskId').value;
        if (taskId) {
            addTagToTask(taskId, tag);
        }
        currentTags.push(tag);
        renderCurrentTags(currentTags);
        input.value = '';
        suggestions.innerHTML = '';
    }
    
    function renderCurrentTags(tags) {
        var container = document.getElementById('taskTagsContainer');
        // Afficher les tags existants au-dessus de l'input
        var existingTagsHtml = tags.map(function(t) {
            return '<span class="tag-badge">' + escapeHtml(t) + ' <span class="tag-remove" onclick="removeTagFromList(\'' + t.replace(/'/g, "\\'") + '\')">×</span></span>';
        }).join('');
        // On garde l'input et suggestions, on ajoute les tags avant
    }
}

function removeTagFromList(tag) {
    var taskId = document.getElementById('taskId').value;
    if (taskId) {
        removeTagFromTask(taskId, tag);
    }
}

/**
 * Initialise le filtre par étiquette.
 */
function initTagFilter() {
    var select = document.getElementById('filterTaskTag');
    if (!select) return;
    
    var allTags = getAllTags();
    select.innerHTML = '<option value="">Toutes étiquettes</option>';
    allTags.forEach(function(tag) {
        var option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        select.appendChild(option);
    });
    
    select.addEventListener('change', renderTasks);
}

// ─── 4. SOUS-TÂCHES ──────────────────────────────────

/**
 * Ajoute une sous-tâche à une tâche.
 * @param {string} taskId - ID de la tâche
 * @param {string} title - Titre de la sous-tâche
 */
window.addSubtask = function(taskId, title) {
    var task = getTaskById(taskId);
    if (!task || !title) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({
        id: generateId(),
        title: title,
        completed: false
    });
    saveData();
    renderTaskDetail(taskId);
};

/**
 * Bascule l'état d'une sous-tâche.
 * @param {string} taskId - ID de la tâche
 * @param {string} subtaskId - ID de la sous-tâche
 */
window.toggleSubtask = function(taskId, subtaskId) {
    var task = getTaskById(taskId);
    if (!task || !task.subtasks) return;
    var subtask = task.subtasks.find(function(s) { return s.id === subtaskId; });
    if (subtask) {
        subtask.completed = !subtask.completed;
        saveData();
        renderTaskDetail(taskId);
    }
};

/**
 * Supprime une sous-tâche.
 * @param {string} taskId - ID de la tâche
 * @param {string} subtaskId - ID de la sous-tâche
 */
window.deleteSubtask = function(taskId, subtaskId) {
    var task = getTaskById(taskId);
    if (!task || !task.subtasks) return;
    task.subtasks = task.subtasks.filter(function(s) { return s.id !== subtaskId; });
    saveData();
    renderTaskDetail(taskId);
};

/**
 * Affiche le détail d'une tâche avec sous-tâches.
 */
window.openTaskDetail = function(taskId) {
    var task = getTaskById(taskId);
    if (!task) return;
    
    document.getElementById('taskDetailId').value = task.id;
    document.getElementById('taskDetailTitle').textContent = task.title;
    document.getElementById('taskDetailProject').textContent = getProjectById(task.projectId) ? getProjectById(task.projectId).name : '—';
    document.getElementById('taskDetailStatus').value = task.status;
    document.getElementById('taskDetailPriority').value = task.priority;
    document.getElementById('taskDetailAssignedTo').value = task.assignedTo || '';
    document.getElementById('taskDetailDeadline').value = task.deadline || '';
    
    // Tags
    renderTaskDetailTags(task);
    
    // Sous-tâches
    renderTaskDetail(taskId);
    
    document.getElementById('taskDetailModal').classList.remove('hidden');
};

function renderTaskDetail(taskId) {
    var task = getTaskById(taskId);
    if (!task) return;
    
    var container = document.getElementById('subtasksList');
    var progressText = document.getElementById('subtaskProgressText');
    var progressBar = document.getElementById('subtaskProgressBar');
    
    var subtasks = task.subtasks || [];
    var completed = subtasks.filter(function(s) { return s.completed; }).length;
    var total = subtasks.length;
    
    if (progressText) progressText.textContent = completed + '/' + total;
    if (progressBar) progressBar.style.width = total > 0 ? Math.round((completed / total) * 100) + '%' : '0%';
    
    if (subtasks.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0;">Aucune sous-tâche</p>';
    } else {
        container.innerHTML = subtasks.map(function(s) {
            return '' +
                '<div class="subtask-item' + (s.completed ? ' completed' : '') + '">' +
                    '<input type="checkbox" class="subtask-checkbox" ' + (s.completed ? 'checked' : '') + ' onchange="toggleSubtask(\'' + task.id + '\',\'' + s.id + '\')">' +
                    '<span class="subtask-title">' + escapeHtml(s.title) + '</span>' +
                    '<button class="subtask-delete-btn" onclick="deleteSubtask(\'' + task.id + '\',\'' + s.id + '\')">×</button>' +
                '</div>';
        }).join('');
    }
}

function renderTaskDetailTags(task) {
    var container = document.getElementById('taskDetailTags');
    if (!container) return;
    
    var tags = task.tags || [];
    var input = document.getElementById('taskDetailTagInput');
    
    var tagsHtml = tags.map(function(t) {
        return '<span class="tag-badge">' + escapeHtml(t) + ' <span class="tag-remove" onclick="removeTagFromTask(\'' + task.id + '\',\'' + t.replace(/'/g, "\\'") + '\')">×</span></span>';
    }).join('');
    
    // Remplacer le contenu sauf l'input
    var currentInput = container.querySelector('input');
    container.innerHTML = tagsHtml;
    if (currentInput) container.appendChild(currentInput);
    
    if (input) {
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagToTask(task.id, input.value.trim().toLowerCase());
                input.value = '';
                renderTaskDetailTags(getTaskById(task.id));
            }
        };
    }
}

// ─── 5. MODE LISTE / MODE CARTES ─────────────────────

/**
 * Bascule entre l'affichage liste et cartes.
 */
window.toggleViewMode = function(mode) {
    localStorage.setItem('gestionprojet_viewmode', mode);
    var cardsBtn = document.getElementById('viewCardsBtn');
    var listBtn = document.getElementById('viewListBtn');
    
    if (mode === 'list') {
        if (cardsBtn) cardsBtn.classList.remove('active');
        if (listBtn) listBtn.classList.add('active');
    } else {
        if (cardsBtn) cardsBtn.classList.add('active');
        if (listBtn) listBtn.classList.remove('active');
    }
    
    renderTasks();
};

/**
 * Retourne le mode d'affichage actuel.
 */
function getViewMode() {
    return localStorage.getItem('gestionprojet_viewmode') || 'cards';
}

// ─── 6. CALENDRIER ───────────────────────────────────

var calendarCurrentDate = new Date();

/**
 * Rendu du calendrier mensuel.
 */
function renderCalendar() {
    var grid = document.getElementById('calendarGrid');
    var label = document.getElementById('calendarMonthLabel');
    if (!grid || !label) return;
    
    var year = calendarCurrentDate.getFullYear();
    var month = calendarCurrentDate.getMonth();
    
    label.textContent = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    
    // En-têtes jours
    var headers = 'Lun Mar Mer Jeu Ven Sam Dim'.split(' ');
    var html = '<div class="calendar-week-header">' + headers.map(function(d) {
        return '<div class="calendar-day-header">' + d + '</div>';
    }).join('') + '</div>';
    
    // Calculer les jours du mois
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startDay = firstDay.getDay() || 7; // Lundi = 1
    startDay -= 1; // Ajuster pour commencer lundi
    
    var daysInMonth = lastDay.getDate();
    var today = new Date();
    var isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
    html += '<div class="calendar-grid-body">';
    
    // Jours du mois précédent
    var prevMonthDays = new Date(year, month, 0).getDate();
    for (var i = startDay - 1; i >= 0; i--) {
        html += '<div class="calendar-day other-month">' + (prevMonthDays - i) + '</div>';
    }
    
    // Jours du mois
    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var isToday = isCurrentMonth && today.getDate() === d;
        
        // Événements du jour
        var dayEvents = [];
        var activeProjects = getActiveProjects();
        activeProjects.forEach(function(p) {
            if (p.deadline && p.deadline.substring(0, 10) === dateStr) {
                dayEvents.push({ type: 'project', name: p.name, color: p.color });
            }
        });
        getActiveTasks().forEach(function(t) {
            if (t.deadline && t.deadline.substring(0, 10) === dateStr) {
                dayEvents.push({ type: 'task', name: t.title, color: null });
            }
        });
        
        var eventsHtml = dayEvents.slice(0, 3).map(function(ev) {
            return '<div class="calendar-event" style="background:' + (ev.color || 'var(--primary)') + '">' + escapeHtml(ev.name.substring(0, 15)) + '</div>';
        }).join('');
        
        if (dayEvents.length > 3) {
            eventsHtml += '<div class="calendar-more">+' + (dayEvents.length - 3) + ' autres</div>';
        }
        
        html += '<div class="calendar-day' + (isToday ? ' today' : '') + '" onclick="showDayEvents(\'' + dateStr + '\')">' +
            '<span class="calendar-day-number">' + d + '</span>' +
            '<div class="calendar-day-events">' + eventsHtml + '</div>' +
        '</div>';
    }
    
    // Jours du mois suivant
    var totalCellsFilled = startDay + daysInMonth;
    var remaining = 7 - (totalCellsFilled % 7);
    if (remaining < 7) {
        for (var r = 1; r <= remaining; r++) {
            html += '<div class="calendar-day other-month">' + r + '</div>';
        }
    }
    
    html += '</div>';
    grid.innerHTML = html;
}

/**
 * Affiche les événements d'un jour spécifique.
 */
window.showDayEvents = function(dateStr) {
    var modal = document.getElementById('calendarDayModal');
    var title = document.getElementById('calendarDayModalTitle');
    var eventsContainer = document.getElementById('calendarDayEvents');
    
    var dateFormatted = formatDate(dateStr);
    title.textContent = 'Événements du ' + dateFormatted;
    
    var events = [];
    var activeProjects = getActiveProjects();
    activeProjects.forEach(function(p) {
        if (p.deadline && p.deadline.substring(0, 10) === dateStr) {
            events.push({ type: 'project', name: p.name, color: p.color });
        }
    });
    getActiveTasks().forEach(function(t) {
        if (t.deadline && t.deadline.substring(0, 10) === dateStr) {
            var project = getProjectById(t.projectId);
            events.push({ type: 'task', name: t.title, subtitle: project ? project.name : '', priority: t.priority });
        }
    });
    
    if (events.length === 0) {
        eventsContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Aucun événement ce jour</p>';
    } else {
        eventsContainer.innerHTML = events.map(function(ev) {
            var badge = ev.type === 'project'
                ? '<span class="badge" style="background:' + ev.color + ';color:white">📁 Projet</span>'
                : '<span class="badge badge-priority ' + (ev.priority || 'moyenne') + '">✓ Tâche</span>';
            return '<div class="calendar-day-event-item">' +
                badge +
                '<div><strong>' + escapeHtml(ev.name) + '</strong>' +
                (ev.subtitle ? '<br><small>' + escapeHtml(ev.subtitle) + '</small>' : '') +
                '</div></div>';
        }).join('');
    }
    
    modal.classList.remove('hidden');
};

// ─── 7. TRI AVANCÉ ───────────────────────────────────

/**
 * Trie les tâches selon le mode sélectionné.
 * @param {Array} tasks - Liste des tâches
 * @returns {Array} Tâches triées
 */
function sortTasks(tasks) {
    var mode = document.getElementById('sortTasksSelect') ? document.getElementById('sortTasksSelect').value : 'default';
    var dir = document.getElementById('sortDirBtn') && document.getElementById('sortDirBtn').classList.contains('desc') ? -1 : 1;
    
    var priorityOrder = { haute: 0, moyenne: 1, basse: 2 };
    
    var sorted = tasks.slice();
    
    switch (mode) {
        case 'deadline_asc':
            sorted.sort(function(a, b) {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
            break;
        case 'deadline_desc':
            sorted.sort(function(a, b) {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(b.deadline) - new Date(a.deadline);
            });
            break;
        case 'created_asc':
            sorted.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
            break;
        case 'created_desc':
            sorted.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
            break;
        case 'priority_asc':
            sorted.sort(function(a, b) { return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1); });
            break;
        case 'name_asc':
            sorted.sort(function(a, b) { return a.title.localeCompare(b.title, 'fr'); });
            break;
        case 'name_desc':
            sorted.sort(function(a, b) { return b.title.localeCompare(a.title, 'fr'); });
            break;
        default:
            // Tri par défaut : non-complétées puis par priorité
            sorted.sort(function(a, b) {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
            });
    }
    
    if (mode !== 'default' && dir === -1 && mode.indexOf('_asc') === -1 && mode.indexOf('_desc') === -1) {
        sorted.reverse();
    }
    
    return sorted;
}

// ─── INITIALISATION DES NOUVELLES FONCTIONNALITÉS ─────

function initNewFeatures() {
    // Purge les anciens éléments supprimés au démarrage
    purgeOldDeletedItems();
    
    // Templates
    initTemplateDropdown();
    
    // Tags
    initTagInput();
    initTagFilter();
    
    // View mode
    var viewMode = getViewMode();
    if (viewMode === 'list') {
        toggleViewMode('list');
    }
    
    var cardsBtn = document.getElementById('viewCardsBtn');
    var listBtn = document.getElementById('viewListBtn');
    if (cardsBtn) cardsBtn.addEventListener('click', function() { toggleViewMode('cards'); });
    if (listBtn) listBtn.addEventListener('click', function() { toggleViewMode('list'); });
    
    // Sort
    var sortSelect = document.getElementById('sortTasksSelect');
    if (sortSelect) sortSelect.addEventListener('change', renderTasks);
    
    var sortDirBtn = document.getElementById('sortDirBtn');
    if (sortDirBtn) {
        sortDirBtn.addEventListener('click', function() {
            this.classList.toggle('desc');
            renderTasks();
        });
    }
    
    // Calendar navigation
    var calPrev = document.getElementById('calendarPrev');
    var calNext = document.getElementById('calendarNext');
    var calToday = document.getElementById('calendarToday');
    
    if (calPrev) calPrev.addEventListener('click', function() {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
        renderCalendar();
    });
    if (calNext) calNext.addEventListener('click', function() {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
        renderCalendar();
    });
    if (calToday) calToday.addEventListener('click', function() {
        calendarCurrentDate = new Date();
        renderCalendar();
    });
    
    // Task detail form submit
    var taskDetailForm = document.getElementById('taskDetailForm');
    if (taskDetailForm) {
        taskDetailForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var id = document.getElementById('taskDetailId').value;
            var task = getTaskById(id);
            if (!task) return;
            
            task.status = document.getElementById('taskDetailStatus').value;
            task.priority = document.getElementById('taskDetailPriority').value;
            task.assignedTo = document.getElementById('taskDetailAssignedTo').value.trim();
            task.deadline = document.getElementById('taskDetailDeadline').value || null;
            task.completed = task.status === 'done';
            
            saveData();
            closeAllModals();
            renderAll();
            showToast('Tâche modifiée', 'success');
        });
    }
    
    // Task detail delete
    var taskDetailDeleteBtn = document.getElementById('taskDetailDeleteBtn');
    if (taskDetailDeleteBtn) {
        taskDetailDeleteBtn.addEventListener('click', function() {
            var id = document.getElementById('taskDetailId').value;
            closeAllModals();
            softDeleteTask(id);
        });
    }
    
    // Subtask add input
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
    
    // Calendar tab: render when switching
    var calTab = document.querySelector('[data-tab="calendar"]');
    if (calTab) {
        calTab.addEventListener('click', function() {
            renderCalendar();
        });
    }
    
    // Corbeille tab: render when switching
    var corbeilleTab = document.querySelector('[data-tab="corbeille"]');
    if (corbeilleTab) {
        corbeilleTab.addEventListener('click', function() {
            renderCorbeille();
        });
    }
}

// Modifier renderAll pour inclure les nouvelles vues
var originalRenderAll = renderAll;
renderAll = function() {
    originalRenderAll();
    if (currentTab === 'calendar') renderCalendar();
    if (currentTab === 'corbeille') renderCorbeille();
};

// Modifier renderTasks pour utiliser getActiveTasks et sortTasks
renderTasks = function() {
    var container = document.getElementById('tasksList');
    if (!container) return;
    
    var filterProject = document.getElementById('filterTaskProject') ? document.getElementById('filterTaskProject').value : '';
    var filterStatus = document.getElementById('filterTaskStatus') ? document.getElementById('filterTaskStatus').value : '';
    var filterPriority = document.getElementById('filterTaskPriority') ? document.getElementById('filterTaskPriority').value : '';
    var filterTag = document.getElementById('filterTaskTag') ? document.getElementById('filterTaskTag').value : '';
    
    var hasFilters = filterProject || filterStatus || filterPriority || filterTag;
    
    // Mettre à jour le filtre de tags
    var tagSelect = document.getElementById('filterTaskTag');
    if (tagSelect) {
        var allTags = getAllTags();
        var currentVal = tagSelect.value;
        tagSelect.innerHTML = '<option value="">Toutes étiquettes</option>';
        allTags.forEach(function(tag) {
            var option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            if (tag === currentVal) option.selected = true;
            tagSelect.appendChild(option);
        });
    }
    
    // Filtrage
    var tasks = getActiveTasks();
    if (filterProject) tasks = tasks.filter(function(t) { return t.projectId === filterProject; });
    if (filterStatus) tasks = tasks.filter(function(t) { return t.status === filterStatus; });
    if (filterPriority) tasks = tasks.filter(function(t) { return t.priority === filterPriority; });
    if (filterTag) tasks = tasks.filter(function(t) { return t.tags && t.tags.indexOf(filterTag) !== -1; });
    
    // Tri
    tasks = sortTasks(tasks);
    
    // Afficher/masquer les colonnes Kanban
    var kanbanColumns = document.getElementById('kanbanColumns');
    if (kanbanColumns) {
        if (hasFilters) {
            kanbanColumns.classList.add('hidden');
        } else {
            kanbanColumns.classList.remove('hidden');
        }
    }
    
    if (hasFilters) {
        if (tasks.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>Aucune tâche</p></div>';
        } else {
            container.innerHTML = tasks.map(function(t) { return renderTaskItem(t); }).join('');
        }
        return;
    }
    
    // Sans filtres : Kanban ou liste selon le mode
    container.innerHTML = '';
    var viewMode = getViewMode();
    
    if (viewMode === 'list') {
        renderKanbanList(tasks);
    } else {
        renderKanbanColumn('todo', tasks);
        renderKanbanColumn('in_progress', tasks);
        renderKanbanColumn('done', tasks);
    }
};

/**
 * Affiche les tâches en mode liste compacte.
 */
function renderKanbanList(tasks) {
    var container = document.getElementById('tasksList');
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>Aucune tâche</p></div>';
        return;
    }
    
    container.innerHTML = '' +
        '<div class="task-list-header">' +
            '<span>Tâche</span>' +
            '<span>Projet</span>' +
            '<span>Priorité</span>' +
            '<span>Statut</span>' +
            '<span>Deadline</span>' +
            '<span></span>' +
        '</div>' +
        tasks.map(function(t) {
            var project = getProjectById(t.projectId);
            return '' +
                '<div class="task-list-item priority-' + t.priority + '" draggable="true" data-task-id="' + t.id + '">' +
                    '<span class="task-list-title">' + (t.completed ? '✅ ' : '☐ ') + escapeHtml(t.title) + '</span>' +
                    '<span class="task-list-project">' + escapeHtml(project ? project.name : '—') + '</span>' +
                    '<span class="badge badge-priority ' + t.priority + '">' + t.priority + '</span>' +
                    '<span class="badge badge-status ' + t.status + '">' + getStatusLabel(t.status) + '</span>' +
                    '<span class="task-list-deadline">' + (t.deadline ? formatDate(t.deadline) : '—') + '</span>' +
                    '<span class="task-list-actions">' +
                        '<button class="btn btn-sm btn-secondary" onclick="editTask(\'' + t.id + '\')">✎</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="softDeleteTask(\'' + t.id + '\')">✕</button>' +
                    '</span>' +
                '</div>';
        }).join('');
}

// Modifier renderTaskItem pour ajouter tags et sous-tâches
var originalRenderTaskItem = renderTaskItem;
renderTaskItem = function(t) {
    var project = getProjectById(t.projectId);
    var attachCount = (t.attachments || []).length;
    var subtaskCount = (t.subtasks || []).length;
    var completedSubtasks = (t.subtasks || []).filter(function(s) { return s.completed; }).length;
    var tags = t.tags || [];
    
    var tagsHtml = tags.map(function(tag) {
        return '<span class="tag-badge">' + escapeHtml(tag) + '</span>';
    }).join('');
    
    var attachHtml = '';
    if (attachCount > 0) {
        attachHtml = '<span class="task-attachment-icon">📎 ' + attachCount + '</span>';
    }
    
    var subtaskHtml = '';
    if (subtaskCount > 0) {
        subtaskHtml = '<span class="task-subtask-icon">☑ ' + completedSubtasks + '/' + subtaskCount + '</span>';
    }
    
    return '' +
        '<div class="task-item priority-' + t.priority + (t.completed ? ' completed' : '') + ' task-card-view" draggable="true" data-task-id="' + t.id + '" onclick="openTaskDetail(\'' + t.id + '\')">' +
            '<div class="task-checkbox' + (t.completed ? ' checked' : '') + '" onclick="event.stopPropagation(); toggleTask(\'' + t.id + '\')">' +
                (t.completed ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
            '</div>' +
            '<div class="task-content">' +
                '<div class="task-title">' + escapeHtml(t.title) + '</div>' +
                '<div class="task-info">' +
                    '<span class="task-project-name">📁 ' + escapeHtml(project ? project.name : '—') + '</span>' +
                    '<span class="badge badge-priority ' + t.priority + '">' + t.priority + '</span>' +
                    '<span class="badge badge-status ' + t.status + '">' + getStatusLabel(t.status) + '</span>' +
                    (t.assignedTo ? '<span>👤 ' + escapeHtml(t.assignedTo) + '</span>' : '') +
                    attachHtml + subtaskHtml +
                '</div>' +
                (tagsHtml ? '<div class="task-tags-row">' + tagsHtml + '</div>' : '') +
            '</div>' +
            '<div class="task-actions">' +
                '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editTask(\'' + t.id + '\')" title="Modifier">✎</button>' +
                '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); softDeleteTask(\'' + t.id + '\')" title="Supprimer">✕</button>' +
            '</div>' +
        '</div>';
};

// Modifier renderProjects pour utiliser getActiveProjects et afficher badge template
renderProjects = function() {
    var container = document.getElementById('projectsList');
    if (!container) return;
    
    var projects = getActiveProjects();
    
    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📁</div><p>Aucun projet. Créez-en un !</p></div>';
        return;
    }
    
    container.innerHTML = projects.map(function(p) {
        var projectTasks = getActiveTasks().filter(function(t) { return t.projectId === p.id; });
        var completedCount = projectTasks.filter(function(t) { return t.status === 'done'; }).length;
        
        return '' +
            '<div class="project-card">' +
                '<div class="project-card-header" style="background:' + escapeHtml(p.color) + '">' +
                    '<h3>' + escapeHtml(p.name) + '</h3>' +
                    '<p>' + escapeHtml(p.description || 'Pas de description') + '</p>' +
                '</div>' +
                '<div class="project-card-body">' +
                    '<div class="project-meta">' +
                        '<span class="badge badge-status ' + (completedCount === projectTasks.length && projectTasks.length > 0 ? 'done' : 'todo') + '">' +
                            completedCount + '/' + projectTasks.length + ' tâches' +
                        '</span>' +
                        (p.deadline ? '<span class="project-deadline">📅 ' + formatDate(p.deadline) + '</span>' : '') +
                        (p.isTemplate ? '<span class="badge" style="background:var(--primary);color:white;font-size:0.65rem;">MODÈLE</span>' : '') +
                    '</div>' +
                    '<div class="progress-bar">' +
                        '<div class="progress-fill" style="width:' + getProjectProgress(p.id) + '%; background:' + escapeHtml(p.color) + '"></div>' +
                    '</div>' +
                    '<div class="progress-text">' + getProjectProgress(p.id) + '% complété</div>' +
                    '<div class="project-card-actions">' +
                        '<button class="btn btn-sm btn-secondary" onclick="editProject(\'' + p.id + '\')">✎ Modifier</button>' +
                        '<button class="btn btn-sm btn-danger" onclick="softDeleteProject(\'' + p.id + '\')">✕ Supprimer</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }).join('');
};

// Modifier renderDashboard pour utiliser les données actives
renderDashboard = function() {
    var projects = getActiveProjects();
    var tasks = getActiveTasks();
    
    document.getElementById('statProjects').textContent = projects.length;
    document.getElementById('statTasksTotal').textContent = tasks.length;
    document.getElementById('statTasksDone').textContent = tasks.filter(function(t) { return t.status === 'done'; }).length;
    document.getElementById('statTasksProgress').textContent = tasks.filter(function(t) { return t.status === 'in_progress'; }).length;
    
    var progressContainer = document.getElementById('dashboardProgress');
    if (projects.length === 0) {
        progressContainer.innerHTML = '<div class="empty-state"><p>Aucun projet</p></div>';
    } else {
        progressContainer.innerHTML = projects.map(function(p) {
            var progress = getProjectProgress(p.id);
            return '' +
                '<div class="dashboard-progress-item">' +
                    '<div class="dashboard-progress-info">' +
                        '<span class="dashboard-progress-name" style="color:' + escapeHtml(p.color) + '">' + escapeHtml(p.name) + '</span>' +
                        '<span class="dashboard-progress-value">' + progress + '%</span>' +
                    '</div>' +
                    '<div class="progress-bar">' +
                        '<div class="progress-fill" style="width:' + progress + '%; background:' + escapeHtml(p.color) + '"></div>' +
                    '</div>' +
                '</div>';
        }).join('');
    }
    
    var priorityTasks = tasks.filter(function(t) {
        return t.priority === 'haute' && t.status !== 'done';
    });
    var priorityContainer = document.getElementById('priorityTasks');
    if (priorityTasks.length === 0) {
        priorityContainer.innerHTML = '<div class="empty-state"><p>Aucune tâche prioritaire 🎉</p></div>';
    } else {
        priorityContainer.innerHTML = priorityTasks.map(function(t) {
            var project = getProjectById(t.projectId);
            return '' +
                '<div class="priority-task-item">' +
                    '<div>' +
                        '<div class="task-title" style="font-size:0.9rem">' + escapeHtml(t.title) + '</div>' +
                        '<div class="task-project">📁 ' + escapeHtml(project ? project.name : 'Projet supprimé') + '</div>' +
                    '</div>' +
                    '<span class="badge badge-priority haute">Haute</span>' +
                '</div>';
        }).join('');
    }
};

// Modifier deleteProjectConfirm et deleteTaskConfirm pour utiliser soft delete
deleteProjectConfirm = function(id) {
    var project = getProjectById(id);
    if (!project) return;
    var taskCount = appData.tasks.filter(function(t) { return t.projectId === id; }).length;
    var msg = taskCount > 0
        ? 'Mettre à la corbeille "' + project.name + '" et ses ' + taskCount + ' tâche(s) ?'
        : 'Mettre à la corbeille le projet "' + project.name + '" ?';
    
    openConfirmModal(msg, function() {
        softDeleteProject(id);
    });
};

deleteTaskConfirm = function(id) {
    var task = getTaskById(id);
    if (!task) return;
    openConfirmModal('Mettre à la corbeille la tâche "' + task.title + '" ?', function() {
        softDeleteTask(id);
    });
};

// ═══ Mobile Nav Menu ═══
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
        if (menu.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    
    overlay.addEventListener('click', closeMenu);
    
    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var tab = this.getAttribute('data-tab');
            if (tab) {
                switchTab(tab);
            }
            closeMenu();
        });
    });
    
    // Sync active state with current tab
    var observer = new MutationObserver(function() {
        var currentTab = document.querySelector('.tab-content.active');
        if (!currentTab) return;
        var tabId = currentTab.id;
        navItems.forEach(function(item) {
            item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
        });
    });
    
    // Initial sync
    var activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        navItems.forEach(function(item) {
            item.classList.toggle('active', item.getAttribute('data-tab') === activeTab.id);
        });
    }
}



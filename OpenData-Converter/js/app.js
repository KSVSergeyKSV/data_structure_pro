/* 
 * OpenData Web Converter - Main Application
 * Version: 2.0 (МР 4.0 compliant)
 */

// ============================================
// GLOBAL STATE
// ============================================
const AppState = {
    currentProfile: null,
    profiles: [],
    registryData: [],
    sourceData: null,
    sourceHeaders: [],
    transliteratedHeaders: [],
    conversionSettings: {
        transliterate: false,
        customHeaders: {}
    },
    logs: []
};

// ============================================
// GOST 7.79-2000 SYSTEM B TRANSLITERATION
// ============================================
const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
};

function transliterate(text) {
    if (!text) return text;
    let result = '';
    for (let char of text) {
        result += translitMap[char] || char;
    }
    // Replace spaces and special chars with underscore, lowercase
    result = result.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
    return result || 'column';
}

// ============================================
// LOCAL STORAGE MANAGEMENT
// ============================================
const Storage = {
    KEY_PROFILES: 'odwc_profiles',
    KEY_CURRENT: 'odwc_current_profile',
    
    loadProfiles() {
        try {
            const data = localStorage.getItem(this.KEY_PROFILES);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load profiles:', e);
            return [];
        }
    },
    
    saveProfiles(profiles) {
        localStorage.setItem(this.KEY_PROFILES, JSON.stringify(profiles));
    },
    
    getCurrentProfileId() {
        return localStorage.getItem(this.KEY_CURRENT);
    },
    
    setCurrentProfileId(id) {
        localStorage.setItem(this.KEY_CURRENT, id);
    },
    
    getProfile(id) {
        const profiles = this.loadProfiles();
        return profiles.find(p => p.id === id);
    },
    
    saveProfile(profile) {
        const profiles = this.loadProfiles();
        const idx = profiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) {
            profiles[idx] = profile;
        } else {
            profiles.push(profile);
        }
        this.saveProfiles(profiles);
    },
    
    deleteProfile(id) {
        const profiles = this.loadProfiles();
        const filtered = profiles.filter(p => p.id !== id);
        this.saveProfiles(filtered);
        if (this.getCurrentProfileId() === id) {
            localStorage.removeItem(this.KEY_CURRENT);
        }
    }
};

// ============================================
// LOGGING SYSTEM
// ============================================
function logEvent(eventType, details = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        eventType,
        details,
        profileId: AppState.currentProfile?.id
    };
    AppState.logs.push(entry);
    if (AppState.currentProfile) {
        if (!AppState.currentProfile.logs) AppState.currentProfile.logs = [];
        AppState.currentProfile.logs.push(entry);
        Storage.saveProfile(AppState.currentProfile);
    }
    console.log('[LOG]', eventType, details);
}

// ============================================
// PROFILE MANAGEMENT UI
// ============================================
function renderProfileManager() {
    const container = document.getElementById('profileManager');
    const profiles = Storage.loadProfiles();
    
    let html = '<div class="panel">';
    html += '<h2>📁 Управление разделами</h2>';
    
    if (profiles.length === 0) {
        html += '<p class="info">У вас нет созданных разделов. Создайте новый профиль для начала работы.</p>';
    } else {
        html += '<ul class="profile-list">';
        profiles.forEach(p => {
            const isActive = AppState.currentProfile?.id === p.id;
            html += `<li class="${isActive ? 'active' : ''}">
                <span><strong>${escapeHtml(p.name)}</strong> - ${escapeHtml(p.position || '')}</span>
                <div class="actions">
                    ${!isActive ? `<button onclick="selectProfile('${p.id}')">Выбрать</button>` : ''}
                    <button onclick="editProfile('${p.id}')">✏️</button>
                    <button onclick="exportProfile('${p.id}')">📤</button>
                    <button onclick="deleteProfile('${p.id}')" class="danger">🗑️</button>
                </div>
            </li>`;
        });
        html += '</ul>';
    }
    
    html += '<button class="primary" onclick="showCreateProfileForm()">+ Создать новый раздел</button>';
    html += '<button onclick="importProfile()">📥 Импорт раздела</button>';
    html += '</div>';
    
    container.innerHTML = html;
}

function showCreateProfileForm() {
    const name = prompt('Введите ФИО:');
    if (!name) return;
    const position = prompt('Введите должность:');
    const contacts = prompt('Введите контакты (email, телефон):');
    
    const profile = {
        id: 'profile_' + Date.now(),
        name,
        position: position || '',
        contacts: contacts || '',
        createdAt: new Date().toISOString(),
        registry: null,
        drafts: [],
        logs: []
    };
    
    Storage.saveProfile(profile);
    selectProfile(profile.id);
    logEvent('PROFILE_CREATED', { profileId: profile.id });
}

function selectProfile(id) {
    AppState.currentProfile = Storage.getProfile(id);
    Storage.setCurrentProfileId(id);
    renderProfileManager();
    renderRegistry();
    logEvent('PROFILE_SELECTED', { profileId: id });
    alert(`Раздел "${AppState.currentProfile.name}" активирован.`);
}

function editProfile(id) {
    const profile = Storage.getProfile(id);
    const name = prompt('ФИО:', profile.name);
    if (!name) return;
    const position = prompt('Должность:', profile.position);
    const contacts = prompt('Контакты:', profile.contacts);
    
    profile.name = name;
    profile.position = position || '';
    profile.contacts = contacts || '';
    Storage.saveProfile(profile);
    if (AppState.currentProfile?.id === id) {
        AppState.currentProfile = profile;
    }
    renderProfileManager();
    logEvent('PROFILE_EDITED', { profileId: id });
}

function deleteProfile(id) {
    if (!confirm('Вы уверены? Все данные раздела будут удалены.')) return;
    Storage.deleteProfile(id);
    if (AppState.currentProfile?.id === id) {
        AppState.currentProfile = null;
    }
    renderProfileManager();
    logEvent('PROFILE_DELETED', { profileId: id });
}

function exportProfile(id) {
    const profile = Storage.getProfile(id);
    const json = JSON.stringify(profile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `odwc_profile_${id}.json`);
    logEvent('PROFILE_EXPORTED', { profileId: id });
}

function importProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const profile = JSON.parse(event.target.result);
                if (!profile.id || !profile.name) throw new Error('Invalid profile format');
                profile.id = 'profile_' + Date.now(); // New ID to avoid conflicts
                Storage.saveProfile(profile);
                renderProfileManager();
                logEvent('PROFILE_IMPORTED', { profileId: profile.id });
                alert('Профиль успешно импортирован!');
            } catch (err) {
                alert('Ошибка импорта: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ============================================
// REGISTRY MODULE (STEP 1)
// ============================================
function renderRegistry() {
    if (!AppState.currentProfile) {
        document.getElementById('registryModule').innerHTML = '<p class="info">Выберите или создайте раздел для работы с реестром.</p>';
        return;
    }
    
    const container = document.getElementById('registryModule');
    const registry = AppState.currentProfile.registry;
    
    let html = '<div class="panel">';
    html += '<h2>📋 Шаг 1: Реестр наборов данных</h2>';
    
    if (!registry || !registry.data || registry.data.length === 0) {
        html += '<p>Загрузите внутренний реестр наборов открытых данных (Excel/CSV).</p>';
        html += '<input type="file" id="registryFile" accept=".xlsx,.xls,.csv" onchange="loadRegistry(event)">';
        html += '<p class="info">Файл должен содержать колонки: ID, Название, Владелец, Контакты, Описание, Ключевые слова, Частота, Дата создания</p>';
    } else {
        html += '<p>Реестр загружен. Выберите набор данных:</p>';
        html += '<input type="text" id="registrySearch" placeholder="Поиск..." oninput="filterRegistry()" style="width:100%;margin-bottom:10px;">';
        html += '<div style="max-height:300px;overflow:auto;"><table class="data-table" id="registryTable">';
        html += '<thead><tr><th>ID</th><th>Название</th><th>Владелец</th><th>Действие</th></tr></thead><tbody>';
        
        registry.data.forEach((row, idx) => {
            html += `<tr data-idx="${idx}">
                <td>${escapeHtml(row.id || row.ID || '-')}</td>
                <td>${escapeHtml(row.title || row.Name || row.Название || '-')}</td>
                <td>${escapeHtml(row.owner || row.Owner || row.Владелец || '-')}</td>
                <td><button onclick="selectRegistryItem(${idx})">Выбрать</button></td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        html += '<button onclick="clearRegistry()" class="danger">Очистить реестр</button>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function loadRegistry(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = e.target.result;
            let workbook;
            
            if (file.name.endsWith('.csv')) {
                const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
                workbook = { Sheets: { Sheet1: parsed.data } };
            } else {
                workbook = XLSX.read(data, { type: 'array' });
            }
            
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            
            AppState.currentProfile.registry = {
                fileName: file.name,
                loadedAt: new Date().toISOString(),
                data: jsonData
            };
            Storage.saveProfile(AppState.currentProfile);
            renderRegistry();
            logEvent('REGISTRY_LOADED', { fileName: file.name, recordCount: jsonData.length });
        } catch (err) {
            alert('Ошибка загрузки реестра: ' + err.message);
        }
    };
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function filterRegistry() {
    const query = document.getElementById('registrySearch').value.toLowerCase();
    const rows = document.querySelectorAll('#registryTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

function selectRegistryItem(idx) {
    const item = AppState.currentProfile.registry.data[idx];
    AppState.currentProfile.selectedDataset = item;
    AppState.conversionSettings.customHeaders = {};
    renderRegistry();
    renderPassport();
    logEvent('DATASET_SELECTED', { itemId: idx });
    alert('Набор данных выбран. Перейдите к Шагу 2 для загрузки файла данных.');
}

function clearRegistry() {
    if (!confirm('Очистить реестр?')) return;
    AppState.currentProfile.registry = null;
    AppState.currentProfile.selectedDataset = null;
    Storage.saveProfile(AppState.currentProfile);
    renderRegistry();
    renderPassport();
    logEvent('REGISTRY_CLEARED');
}

// ============================================
// DATA CONVERSION ENGINE (STEP 2-3)
// ============================================
function renderDataUpload() {
    const container = document.getElementById('dataUploadModule');
    
    let html = '<div class="panel">';
    html += '<h2>📊 Шаг 2: Загрузка файла данных</h2>';
    
    if (!AppState.sourceData) {
        html += '<input type="file" id="sourceFile" accept=".xlsx,.xls,.csv,.txt,.json" onchange="loadSourceData(event)">';
        html += '<p class="info">Поддерживаемые форматы: XLSX, XLS, CSV, TXT, JSON</p>';
    } else {
        html += '<p><strong>Файл загружен:</strong> ' + escapeHtml(AppState.sourceData.fileName) + '</p>';
        html += '<p>Строк: ' + AppState.sourceData.data.length + ', Колонок: ' + AppState.sourceHeaders.length + '</p>';
        
        // Transliteration settings
        html += '<div class="translit-settings">';
        html += '<h3>Транслитерация заголовков</h3>';
        html += '<label><input type="radio" name="translit" value="no" checked onchange="toggleTranslit(false)"> Без транслитерации (кириллица)</label><br>';
        html += '<label><input type="radio" name="translit" value="yes" onchange="toggleTranslit(true)"> Транслитерировать по ГОСТ 7.79-2000 (система Б)</label>';
        html += '<p class="info"><small>ГОСТ 7.79-2000 система Б: а→a, ж→zh, щ→sch и т.д.</small></p>';
        html += '</div>';
        
        // Header preview table
        html += '<div id="headerPreview" style="display:none;">';
        html += '<h4>Предпросмотр заголовков:</h4>';
        html += '<table class="data-table"><thead><tr><th>Исходный</th><th>Транслитерированный</th><th>Ручная правка</th></tr></thead><tbody>';
        
        AppState.sourceHeaders.forEach((h, idx) => {
            const translit = transliterate(h);
            AppState.transliteratedHeaders[idx] = translit;
            html += `<tr>
                <td>${escapeHtml(h)}</td>
                <td>${escapeHtml(translit)}</td>
                <td><input type="text" value="${escapeHtml(translit)}" onchange="updateCustomHeader(${idx}, this.value)"></td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        
        // Duplicate warning
        const duplicates = findDuplicates(AppState.transliteratedHeaders);
        if (duplicates.length > 0) {
            html += '<p class="warning">⚠️ Обнаружены дубликаты после транслитерации: ' + duplicates.join(', ') + '</p>';
        }
        
        html += '</div>';
        
        html += '<button class="primary" onclick="proceedToConversion()">Конвертировать →</button>';
        html += '<button onclick="clearSourceData()" class="danger">Очистить</button>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function loadSourceData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = e.target.result;
            let workbook, jsonData;
            
            if (file.name.endsWith('.json')) {
                jsonData = JSON.parse(data);
                if (!Array.isArray(jsonData)) jsonData = [jsonData];
            } else if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
                const parsed = Papa.parse(data, { header: true, skipEmptyLines: true });
                jsonData = parsed.data;
                AppState.sourceHeaders = parsed.meta.fields || [];
            } else {
                workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                const firstRow = jsonData[0] || {};
                AppState.sourceHeaders = Object.keys(firstRow);
            }
            
            AppState.sourceData = {
                fileName: file.name,
                loadedAt: new Date().toISOString(),
                data: jsonData
            };
            
            if (!AppState.sourceHeaders.length && jsonData.length > 0) {
                AppState.sourceHeaders = Object.keys(jsonData[0]);
            }
            
            AppState.transliteratedHeaders = [...AppState.sourceHeaders];
            renderDataUpload();
            logEvent('SOURCE_DATA_LOADED', { fileName: file.name, rowCount: jsonData.length });
        } catch (err) {
            alert('Ошибка загрузки файла: ' + err.message);
        }
    };
    
    if (file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function toggleTranslit(enable) {
    AppState.conversionSettings.transliterate = enable;
    const preview = document.getElementById('headerPreview');
    preview.style.display = enable ? 'block' : 'none';
    
    if (enable) {
        AppState.transliteratedHeaders = AppState.sourceHeaders.map(h => transliterate(h));
    } else {
        AppState.transliteratedHeaders = [...AppState.sourceHeaders];
    }
    renderDataUpload();
}

function updateCustomHeader(idx, value) {
    AppState.transliteratedHeaders[idx] = value || 'column_' + idx;
    AppState.conversionSettings.customHeaders[idx] = value;
    
    // Check for duplicates
    const duplicates = findDuplicates(AppState.transliteratedHeaders);
    const warningEl = document.querySelector('.warning');
    if (duplicates.length > 0) {
        if (!warningEl) {
            const newWarning = document.createElement('p');
            newWarning.className = 'warning';
            newWarning.textContent = '⚠️ Обнаружены дубликаты: ' + duplicates.join(', ');
            document.getElementById('headerPreview').appendChild(newWarning);
        } else {
            warningEl.textContent = '⚠️ Обнаружены дубликаты: ' + duplicates.join(', ');
        }
    } else if (warningEl) {
        warningEl.remove();
    }
}

function findDuplicates(arr) {
    const counts = {};
    const dupes = [];
    arr.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    for (const key in counts) {
        if (counts[key] > 1) dupes.push(key);
    }
    return dupes;
}

function clearSourceData() {
    if (!confirm('Очистить загруженный файл данных?')) return;
    AppState.sourceData = null;
    AppState.sourceHeaders = [];
    AppState.transliteratedHeaders = [];
    renderDataUpload();
    logEvent('SOURCE_DATA_CLEARED');
}

function proceedToConversion() {
    // Validate headers for duplicates
    const duplicates = findDuplicates(AppState.transliteratedHeaders);
    if (duplicates.length > 0) {
        if (!confirm('Обнаружены дубликаты заголовков. Продолжить?')) return;
    }
    
    goToStep(4);
    renderStructureValidation();
    logEvent('CONVERSION_STARTED', { transliterate: AppState.conversionSettings.transliterate });
}

// ============================================
// STRUCTURE VALIDATION (STEP 3)
// ============================================
function renderStructureValidation() {
    const container = document.getElementById('structureModule');
    
    let html = '<div class="panel">';
    html += '<h2>🔍 Шаг 3: Валидация структуры</h2>';
    
    if (!AppState.sourceData) {
        html += '<p class="warning">Сначала загрузите файл данных на Шаге 2.</p>';
    } else {
        // Auto-detect column types
        const structure = detectStructure(AppState.sourceData.data, AppState.sourceHeaders);
        AppState.detectedStructure = structure;
        
        html += '<table class="data-table"><thead><tr><th>Поле</th><th>Тип</th><th>Длина</th><th>Заполненность</th></tr></thead><tbody>';
        
        structure.forEach(field => {
            html += `<tr>
                <td>${escapeHtml(field.field_name)}</td>
                <td>${field.type}</td>
                <td>${field.length}</td>
                <td>${field.nonEmpty}/${AppState.sourceData.data.length}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        html += '<p class="success">✓ Структура определена автоматически</p>';
        html += '<button class="primary" onclick="goToStep(4)">Перейти к паспорту →</button>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function detectStructure(data, headers) {
    return headers.map((header, idx) => {
        const values = data.map(row => row[header]).filter(v => v !== '' && v !== null && v !== undefined);
        const nonEmpty = values.length;
        
        let type = 'string';
        let maxLen = 0;
        
        if (nonEmpty > 0) {
            const allInt = values.every(v => /^-?\d+$/.test(String(v)));
            const allFloat = values.every(v => /^-?\d*\.?\d+$/.test(String(v)));
            const allDate = values.every(v => !isNaN(Date.parse(String(v))));
            
            if (allInt) type = 'integer';
            else if (allFloat) type = 'float';
            else if (allDate) type = 'date';
            
            maxLen = Math.max(...values.map(v => String(v).length));
        }
        
        return {
            field_id: AppState.transliteratedHeaders[idx] || header,
            field_name: header,
            type,
            length: maxLen,
            nonEmpty
        };
    });
}

// ============================================
// PASSPORT GENERATION (STEP 4)
// ============================================
function renderPassport() {
    const container = document.getElementById('passportModule');
    const dataset = AppState.currentProfile?.selectedDataset;
    const profile = AppState.currentProfile;
    
    let html = '<div class="panel">';
    html += '<h2>📄 Шаг 4: Паспорт набора данных (МР 4.0)</h2>';
    
    if (!dataset) {
        html += '<p class="info">Выберите набор данных в реестре (Шаг 1) для автозаполнения паспорта.</p>';
    }
    
    const fields = [
        { id: 'dataset_id', label: 'ID набора', hint: 'Уникальный идентификатор' },
        { id: 'dataset_title', label: 'Название', hint: 'Полное наименование набора' },
        { id: 'owner', label: 'Владелец', hint: 'Наименование ведомства' },
        { id: 'contacts', label: 'Контакты', hint: 'Email, телефон ответственного' },
        { id: 'description', label: 'Описание', hint: 'Краткое описание содержимого' },
        { id: 'keywords', label: 'Ключевые слова', hint: 'Через запятую' },
        { id: 'frequency', label: 'Частота обновления', hint: 'ежегодно, ежеквартально, ежемесячно' },
        { id: 'created_date', label: 'Дата создания', hint: 'ГГГГ-ММ-ДД' },
        { id: 'modified_date', label: 'Дата изменения', hint: 'ГГГГ-ММ-ДД' }
    ];
    
    html += '<form id="passportForm">';
    fields.forEach(f => {
        const value = dataset ? (dataset[f.id] || dataset[f.label] || '') : '';
        html += `<div class="form-group">
            <label title="${f.hint}">${f.label} ℹ️</label>
            <input type="text" id="${f.id}" value="${escapeHtml(value)}" required>
        </div>`;
    });
    html += '</form>';
    
    html += '<button class="primary" onclick="generatePassport()">Сгенерировать паспорт</button>';
    html += '</div>';
    container.innerHTML = html;
    
    // Auto-fill from profile
    if (profile && !dataset) {
        setTimeout(() => {
            document.getElementById('owner').value = profile.name;
            document.getElementById('contacts').value = profile.contacts;
        }, 100);
    }
}

function generatePassport() {
    const passport = {
        dataset_id: document.getElementById('dataset_id').value,
        dataset_title: document.getElementById('dataset_title').value,
        owner: document.getElementById('owner').value,
        contacts: document.getElementById('contacts').value,
        description: document.getElementById('description').value,
        keywords: document.getElementById('keywords').value.split(',').map(s => s.trim()),
        frequency: document.getElementById('frequency').value,
        created_date: document.getElementById('created_date').value,
        modified_date: document.getElementById('modified_date').value || new Date().toISOString().split('T')[0],
        structure: AppState.detectedStructure,
        generatedAt: new Date().toISOString()
    };
    
    AppState.passport = passport;
    logEvent('PASSPORT_GENERATED', { datasetId: passport.dataset_id });
    alert('Паспорт сгенерирован! Перейдите к Шагу 5 для экспорта.');
    goToStep(5);
    renderExport();
}

// ============================================
// EXPORT MODULE (STEP 5)
// ============================================
function renderExport() {
    const container = document.getElementById('exportModule');
    
    let html = '<div class="panel">';
    html += '<h2>📦 Шаг 5: Экспорт пакета файлов</h2>';
    
    if (!AppState.passport) {
        html += '<p class="warning">Сначала сгенерируйте паспорт на Шаге 4.</p>';
    } else {
        html += '<p>Будут сгенерированы следующие файлы:</p>';
        html += '<ul>';
        html += '<li>data.csv - Данные (UTF-8 с BOM, разделитель ;)</li>';
        html += '<li>structure.csv - Описание структуры (CSV)</li>';
        html += '<li>structure.json - Машиночитаемая структура</li>';
        html += '<li>meta.json - Паспорт набора (JSON)</li>';
        html += '<li>meta.html - Паспорт набора (HTML)</li>';
        html += '<li>report.log - Журнал операций</li>';
        html += '</ul>';
        html += '<button class="primary large" onclick="generateArchive()">📥 Скачать ZIP-архив</button>';
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function generateArchive() {
    try {
        const zip = new JSZip();
        const passport = AppState.passport;
        const headers = AppState.conversionSettings.transliterate 
            ? AppState.transliteratedHeaders 
            : AppState.sourceHeaders;
        
        // 1. data.csv (UTF-8 with BOM, semicolon separator)
        const csvData = convertToCSV(AppState.sourceData.data, headers);
        const bom = '\uFEFF';
        zip.file('data.csv', bom + csvData);
        
        // 2. structure.csv
        const structureCsv = convertStructureToCSV(passport.structure);
        zip.file('structure.csv', bom + structureCsv);
        
        // 3. structure.json
        zip.file('structure.json', JSON.stringify(passport.structure, null, 2));
        
        // 4. meta.json
        zip.file('meta.json', JSON.stringify(passport, null, 2));
        
        // 5. meta.html
        const metaHtml = generateMetaHtml(passport);
        zip.file('meta.html', metaHtml);
        
        // 6. report.log
        const logContent = AppState.logs
            .filter(l => l.profileId === AppState.currentProfile?.id)
            .map(l => `${l.timestamp} [${l.eventType}] ${JSON.stringify(l.details)}`)
            .join('\n');
        zip.file('report.log', logContent);
        
        // Generate and download
        zip.generateAsync({ type: 'blob' }).then(blob => {
            const filename = `odwc_${passport.dataset_id || 'dataset'}_${new Date().toISOString().split('T')[0]}.zip`;
            saveAs(blob, filename);
            logEvent('ARCHIVE_GENERATED', { filename, fileSize: blob.size });
            alert('Архив успешно создан и загружен!');
        });
        
    } catch (err) {
        alert('Ошибка генерации архива: ' + err.message);
        logEvent('EXPORT_ERROR', { error: err.message });
    }
}

function convertToCSV(data, headers) {
    const lines = [];
    
    // Header row
    lines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';'));
    
    // Data rows
    data.forEach(row => {
        const values = headers.map(h => {
            let val = row[h] !== undefined ? row[h] : '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        });
        lines.push(values.join(';'));
    });
    
    return lines.join('\n');
}

function convertStructureToCSV(structure) {
    const lines = ['field_id;field_name;type;length'];
    structure.forEach(f => {
        lines.push(`${f.field_id};${f.field_name};${f.type};${f.length}`);
    });
    return lines.join('\n');
}

function generateMetaHtml(passport) {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Паспорт набора данных: ${escapeHtml(passport.dataset_title)}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; }
        h1 { color: #333; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <h1>Паспорт набора открытых данных</h1>
    <div class="field"><span class="label">ID:</span> ${escapeHtml(passport.dataset_id)}</div>
    <div class="field"><span class="label">Название:</span> ${escapeHtml(passport.dataset_title)}</div>
    <div class="field"><span class="label">Владелец:</span> ${escapeHtml(passport.owner)}</div>
    <div class="field"><span class="label">Контакты:</span> ${escapeHtml(passport.contacts)}</div>
    <div class="field"><span class="label">Описание:</span> ${escapeHtml(passport.description)}</div>
    <div class="field"><span class="label">Ключевые слова:</span> ${passport.keywords.join(', ')}</div>
    <div class="field"><span class="label">Частота обновления:</span> ${escapeHtml(passport.frequency)}</div>
    <div class="field"><span class="label">Дата создания:</span> ${escapeHtml(passport.created_date)}</div>
    <div class="field"><span class="label">Дата изменения:</span> ${escapeHtml(passport.modified_date)}</div>
    
    <h2>Структура данных</h2>
    <table>
        <tr><th>Поле</th><th>Тип</th><th>Длина</th></tr>
        ${passport.structure.map(f => `<tr><td>${escapeHtml(f.field_name)}</td><td>${f.type}</td><td>${f.length}</td></tr>`).join('')}
    </table>
    
    <p><small>Сгенерировано: ${passport.generatedAt}<br>OpenData Web Converter v2.0 (МР 4.0)</small></p>
</body>
</html>`;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function goToStep(stepNum) {
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    const stepEl = document.getElementById('step' + stepNum);
    if (stepEl) stepEl.classList.add('active');
    
    // Update progress bar
    document.querySelectorAll('.progress-bar span').forEach((el, idx) => {
        el.className = idx < stepNum ? 'completed' : (idx === stepNum - 1 ? 'current' : '');
    });
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Load existing profile
    const currentId = Storage.getCurrentProfileId();
    if (currentId) {
        AppState.currentProfile = Storage.getProfile(currentId);
    }
    
    renderProfileManager();
    renderRegistry();
    renderDataUpload();
    renderPassport();
    renderExport();
    
    logEvent('APP_STARTED');
});

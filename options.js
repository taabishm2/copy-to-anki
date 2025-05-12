// options.js
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const statusBar = document.getElementById('status-bar');
    const statusText = document.getElementById('status-text');
    const refreshLink = document.getElementById('refresh-status');
    const pendingSum = document.getElementById('pending-summary');
    const deckSel = document.getElementById('deck');
    const modelSel = document.getElementById('model');
    const enableGpt = document.getElementById('enable-gpt');
    // const gptSel = document.getElementById('gpt-model');
    const keyInput = document.getElementById('openai-key');
    const keyToggle = document.getElementById('toggle-password');
    const testApiBtn = document.getElementById('test-api');
    const ankiToggle = document.getElementById('anki-toggle');
    const ankiBody = document.getElementById('anki-body');
    const gptToggle = document.getElementById('gpt-toggle');
    const gptBody = document.getElementById('gpt-body');
    const notification = document.getElementById('notification');
    const resetBtn = document.getElementById('reset-settings');
    const statusHelp = document.getElementById('status-help');
    const confirmGptEl = document.getElementById('confirm-gpt');


    // Default settings
    const DEFAULT_SETTINGS = {
        deckName: 'Default',
        modelName: 'Basic',
        gptEnabled: false,
        // gptModel: 'gpt-3.5-turbo',
        openaiKey: '',
        confirmGpt: false
    };

    // GPT Models list - keep updated with available models
    const GPT_MODELS = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
    ];

    // Helpers
    function showNotification(message, isError = false) {
        notification.textContent = message;

        // reset any previous state
        notification.classList.remove('show', 'error');

        // trigger reflow to restart animation
        void notification.offsetWidth;

        if (isError) notification.classList.add('error');
        notification.classList.add('show');

        if (!isError) {
            setTimeout(() => {
                notification.classList.remove('show', 'error');
            }, 2500);
        }
    }

    function toggleSection(bodyEl, toggleEl, open) {
        // Get the current height before making changes
        const initialHeight = bodyEl.scrollHeight;

        if (open) {
            // Set a specific height first for smooth animation
            if (!bodyEl.classList.contains('active')) {
                bodyEl.style.maxHeight = '0px';
                // Force a reflow to ensure the browser registers the initial height
                bodyEl.offsetHeight;
                bodyEl.classList.add('active');
                bodyEl.style.maxHeight = initialHeight + 'px';
                // Remove the inline style after transition completes
                setTimeout(() => {
                    bodyEl.style.maxHeight = '';
                }, 300);
            }
            toggleEl.textContent = '▾';
        } else {
            // Set exact current height before collapsing for smooth animation
            if (bodyEl.classList.contains('active')) {
                bodyEl.style.maxHeight = initialHeight + 'px';
                // Force a reflow
                bodyEl.offsetHeight;
                bodyEl.style.maxHeight = '0px';
                setTimeout(() => {
                    bodyEl.classList.remove('active');
                    bodyEl.style.maxHeight = '';
                }, 300);
            }
            toggleEl.textContent = '▸';
        }
    }

    function toggleGPTSection(on) {
        gptBody.querySelectorAll('select, input, button').forEach(el => {
            el.disabled = !on;
        });
        gptBody.style.opacity = on ? '1' : '0.6';
    }

    // API Communication
    async function fetchAnki(action, params = {}) {
        try {
            const res = await fetch('http://127.0.0.1:8765', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    version: 6,
                    params
                })
            });

            if (!res.ok) {
                throw new Error(`Network error: ${res.status}`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data.result;
        } catch (err) {
            if (!err.message.includes('Failed to fetch')) {
                console.error(`Anki API error (${action}):`, err);
            }
            throw err;
        }
    }

    async function testOpenAI(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'Say "API connection successful"' }],
                    max_tokens: 10
                })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true };
            } else {
                return {
                    success: false,
                    error: data.error?.message || 'Unknown API error'
                };
            }
        } catch (err) {
            console.error('OpenAI API error:', err);
            return {
                success: false,
                error: 'Network error: Could not connect to OpenAI API'
            };
        }
    }

    // Storage functions
    async function loadSettings() {
        return new Promise(resolve => {
            chrome.storage.sync.get(DEFAULT_SETTINGS, result => {
                resolve(result);
            });
        });
    }

    function saveSettings(settings) {
        return new Promise(resolve => {
            chrome.storage.sync.set(settings, () => {
                showNotification('Settings saved');
                resolve();
            });
        });
    }

    async function updatePendingCards() {
        try {
            const { pendingClips = [] } = await chrome.storage.local.get({ pendingClips: [] });
            pendingSum.textContent = `${pendingClips.length} cards pending sync to Anki`;
        } catch (err) {
            console.error('Error getting pending cards:', err);
        }
    }

    // Populate models dropdown
    // function populateGptModels() {
    //     gptSel.innerHTML = '';
    //     GPT_MODELS.forEach(model => {
    //         const option = new Option(model.name, model.id);
    //         gptSel.add(option);
    //     });
    // }

    // Initialize UI
    async function initializeUI() {
        // populateGptModels();

        // Load settings
        const settings = await loadSettings();

        deckSel.innerHTML = `<option value="${settings.deckName}">${settings.deckName}</option>`;
        modelSel.innerHTML = `<option value="${settings.modelName}">${settings.modelName}</option>`;

        // Apply settings to UI
        deckSel.value = settings.deckName;
        modelSel.value = settings.modelName;
        enableGpt.checked = settings.gptEnabled;
        // gptSel.value = settings.gptModel;
        keyInput.value = settings.openaiKey;

        // Confirm‐GPT toggle
        confirmGptEl.checked = settings.confirmGpt;
        confirmGptEl.addEventListener('change', async () => {
            await saveSettings({ confirmGpt: confirmGptEl.checked });
        });

        // Set initial section states
        toggleSection(ankiBody, ankiToggle, false);
        toggleSection(gptBody, gptToggle, false);
        toggleGPTSection(settings.gptEnabled);

        // Check Anki connection
        await refreshAnkiStatus();

        // Update pending cards count
        await updatePendingCards();
    }

    // Check Anki status
    async function refreshAnkiStatus() {
        statusBar.classList.remove('connected', 'disconnected', 'warning');
        statusBar.className = 'status-bar';

        try {
            statusBar.classList.add('connected');
            statusText.textContent = `Anki connected`;

            // hide the help text when connected
            statusHelp.style.display = 'none';

            // Reload stored settings
            const { deckName, modelName } = await loadSettings();

            // Populate decks

            const decks = await fetchAnki('deckNames');
            deckSel.innerHTML = '';
            decks.forEach(d => deckSel.add(new Option(d, d)));

            // Re-select saved deck, fallback to first deck if saved deck doesn't exist
            if (decks.includes(deckName)) {
                deckSel.value = deckName;
            } else if (decks.length > 0) {
                deckSel.value = decks[0];
                await saveSettings({ deckName: decks[0] });
            }

            // Populate models
            const models = await fetchAnki('modelNames');
            modelSel.innerHTML = '';
            models.forEach(m => modelSel.add(new Option(m, m)));

            // Re-select saved model, fallback to first model if saved model doesn't exist
            if (models.includes(modelName)) {
                modelSel.value = modelName;
            } else if (models.length > 0) {
                modelSel.value = models[0];
                await saveSettings({ modelName: models[0] });
            }

            // Enable controls
            deckSel.disabled = false;
            modelSel.disabled = false;
            ankiBody.style.opacity = '1';

            // Auto-expand Anki section on successful connection
            toggleSection(ankiBody, ankiToggle, true);

        } catch (err) {
            if (err.message.includes('Failed to fetch')) {
                // Set disconnected status
                statusBar.classList.add('disconnected');
                statusText.textContent = 'Anki connection failed';

                // show the help text when disconnected
                statusHelp.style.display = 'block';

                // Disable controls
                deckSel.disabled = true;
                modelSel.disabled = true;
                ankiBody.style.opacity = '0.6';

                // Collapse Anki section
                toggleSection(ankiBody, ankiToggle, false);
            } else {
                console.error('Anki connection error:', err);
                statusBar.classList.add('warning');
                statusText.textContent = "Error encountered: " + err.message;
            }
        }
    }

    // Validate OpenAI API key format
    function validateApiKey(key) {
        // Basic validation: Check if it starts with 'sk-' and has sufficient length
        const isValid = key.startsWith('sk-') && key.length > 20;

        if (!isValid && key.trim() !== '') {
            return false;
        } else {
            return true;
        }
    }

    // Event listeners
    refreshLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await refreshAnkiStatus();
    });

    // Section toggle handlers
    ankiToggle.parentElement.addEventListener('click', () => {
        const isOpen = ankiBody.classList.toggle('active');
        toggleSection(ankiBody, ankiToggle, isOpen);
    });

    gptToggle.parentElement.addEventListener('click', () => {
        const isOpen = gptBody.classList.toggle('active');
        toggleSection(gptBody, gptToggle, isOpen);
    });

    // Settings change handlers
    deckSel.addEventListener('change', async () => {
        await saveSettings({ deckName: deckSel.value });
    });

    modelSel.addEventListener('change', async () => {
        await saveSettings({ modelName: modelSel.value });
    });

    enableGpt.addEventListener('change', async () => {
        const enabled = enableGpt.checked;
        await saveSettings({ gptEnabled: enabled });
        toggleGPTSection(enabled);

        // Auto-expand/collapse GPT section
        toggleSection(gptBody, gptToggle, enabled);
    });

    // gptSel.addEventListener('change', async () => {
    //     await saveSettings({ gptModel: gptSel.value });
    // });

    // Debounce function for API key input
    let keyInputTimeout;
    keyInput.addEventListener('input', () => {
        clearTimeout(keyInputTimeout);
        const key = keyInput.value.trim();

        // Validate key format
        validateApiKey(key);

        // Save after short delay to avoid excessive storage operations
        keyInputTimeout = setTimeout(async () => {
            await saveSettings({ openaiKey: key });
        }, 500);
    });

    // Show/hide password toggle
    keyToggle.addEventListener('click', () => {
        if (keyInput.type === 'password') {
            keyInput.type = 'text';
            keyToggle.textContent = '🔒';
        } else {
            keyInput.type = 'password';
            keyToggle.textContent = '👁️';
        }
    });

    // Test API key
    testApiBtn.addEventListener('click', async () => {
        const apiKey = keyInput.value.trim();

        if (!validateApiKey(apiKey)) {
            showNotification('Invalid API key format', true);
            return;
        }

        testApiBtn.disabled = true;
        testApiBtn.textContent = 'Testing...';

        try {
            const result = await testOpenAI(apiKey);

            if (result.success) {
                showNotification('API key is working!');
            } else {
                keyError.textContent = result.error;
                showNotification('API key validation failed', true);
            }
        } catch (err) {
            showNotification('Connection error', true);
        } finally {
            testApiBtn.disabled = false;
            testApiBtn.textContent = '🔑 Test API Key';
        }
    });

    // Reset settings
    resetBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (confirm('Reset all settings to defaults?')) {
            await chrome.storage.sync.set(DEFAULT_SETTINGS);
            showNotification('Settings reset to defaults');
            await initializeUI();
        }
    });

    // Initialize app
    initializeUI();
});
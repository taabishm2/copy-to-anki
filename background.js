// background.js
import { addToAnki } from "./ankiProvider.js";
import { generateFront } from "./chatgptProvider.js";

// --- Constants ---
const CMD_SAVE = "save-to-anki";
const ALARM_SYNC = "syncPending";
const SYNC_DELAY = 0.1; // (6s)

let syncScheduled = false;

// --- Helpers ---
function notify(tabId, status, message) {
    chrome.tabs.sendMessage(tabId, { status, message });
}

async function getSelectionHtml(tabId) {
    return new Promise(resolve =>
        chrome.tabs.sendMessage(tabId, { action: "getSelectionHtml" }, resp =>
            resolve(resp?.html || "")
        )
    );
}

async function getSettings() {
    return new Promise(resolve =>
        chrome.storage.sync.get(
            {
                deckName: "Default",
                modelName: "Basic",
                gptEnabled: false,
                // gptModel: "gpt-3.5-turbo",
                openaiKey: "",
                confirmGpt: false
            },
            resolve
        )
    );
}

async function updateBadge() {
    const { pendingClips = [] } = await chrome.storage.local.get({ pendingClips: [] });
    const count = pendingClips.length;
    chrome.action.setBadgeText({ text: count ? String(count) : "" });
    chrome.action.setTitle({
        title: count
            ? `${count} clip${count === 1 ? "" : "s"} pending`
            : "Web Clipper to Anki"
    });


    if (count) {
        // red background + white text when there are clips
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
        chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
    } else {
        // clear background & text color when no clips
        chrome.action.setBadgeBackgroundColor({ color: "#000" });
        chrome.action.setBadgeTextColor({ color: "#000" });
    }
}

async function queueClip(clip) {
    const { pendingClips = [] } = await chrome.storage.local.get({ pendingClips: [] });
    pendingClips.push(clip);
    await chrome.storage.local.set({ pendingClips });
    updateBadge();
    scheduleSync();
}

// Simplified one-off sync scheduling
function scheduleSync() {
    if (syncScheduled) return;
    syncScheduled = true;
    chrome.alarms.create(ALARM_SYNC, { delayInMinutes: SYNC_DELAY });
}

// Flush queue
async function flushQueue() {
    const { pendingClips = [] } = await chrome.storage.local.get({ pendingClips: [] });
    if (!pendingClips.length) return;

    const remaining = [];
    for (const clip of pendingClips) {
        try {
            await addToAnki(clip.front, clip.backHtml, clip.deckName, clip.modelName);
        } catch {
            remaining.push(clip);
        }
    }
    await chrome.storage.local.set({ pendingClips: remaining });
    updateBadge();

    if (remaining.length) scheduleSync();
}

// --- Event Handlers ---

chrome.runtime.onInstalled.addListener(() => {

});

chrome.runtime.onInstalled.addListener(() => {
    chrome.runtime.getPlatformInfo(platform => {
        syncScheduled = false;
        updateBadge();

        const modKey = platform.os === "mac" ? "⌘" : "Ctrl";  // mac → Command, others → Ctrl :contentReference[oaicite:0]{index=0}
        const title = `✏️ Save to Anki (${modKey}+Shift+K)`;

        chrome.storage.local.get({ pendingClips: [] }, ({ pendingClips }) => {
            if (pendingClips.length) scheduleSync();
        });

        // Rebuild context menu
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: CMD_SAVE,
                title: title,
                contexts: ["selection"]
            });
        });
    });
});

chrome.runtime.onStartup.addListener(() => {
    syncScheduled = false;
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_SYNC) {
        syncScheduled = false;
        flushQueue();
    }
});

// Context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CMD_SAVE && tab?.id) {
        handleAction(tab, info);
    }
});

// Keyboard shortcut
chrome.commands.onCommand.addListener(command => {
    if (command === CMD_SAVE) {
        chrome.tabs.query({ active: true, currentWindow: true })
            .then(([tab]) => tab?.id && handleAction(tab, {}));
    }
});

// Messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Handle flushing of the queue
    if (msg.action === "flushQueue") {
        flushQueue().then(() => {
            updateBadge();
            sendResponse();
        });
        return true;
    }

    // Handle manual save events
    if (msg.action === "manualSave") {
        (async () => {
            const settings = await getSettings();
            try {
                await addToAnki(msg.front, msg.backHtml, msg.deckName, settings.modelName);
                notify(sender.tab.id, "success", "Saved to Anki!");
                sendResponse({ success: true });
            } catch (err) {
                const isOffline = err instanceof TypeError;
                if (isOffline) {
                    await queueClip({ front: msg.front, backHtml: msg.backHtml, ...settings });
                    updateBadge();
                    notify(sender.tab.id, "success", "Anki offline – saved locally");
                    sendResponse({ queued: true });
                } else {
                    notify(sender.tab.id, "error", err.message || "Save failed");
                    sendResponse({ error: err.message });
                }
            }
        })();
        return true;
    }
    if (msg.action === "openPopup") {
        chrome.action.openPopup();
    }
});

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

async function handleAction(tab, info) {
    const pageTitle = tab.title || "";
    const pageUrl = tab.url || info.pageUrl || "";

    const settings = await getSettings();
    const rawHtml = await getSelectionHtml(tab.id);

    // — check AnkiConnect availability once per invocation —
    let ankiOnline = true;
    try {
        await fetch("http://127.0.0.1:8765", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "version", version: 6 })
        });
    } catch {
        ankiOnline = false;
    }

    let deckList = [];
    try {
        deckList = await fetchAnki("deckNames");
    } catch {
        // ignore — deckList stays []
    }

    const backWithSource = `
    ${rawHtml}
    <div style="
        font-size:12px;
        color:#6c757d;
        margin-top:8px;
        ">
        <br>
        <hr>
        Generated with <a href="https://github.com/taabishm2/copy-to-anki">copy-to-anki</a> from:
        <a href="${pageUrl}"
        target="_blank"
        style="
            color:#6c757d;
            text-decoration:none;
            border-bottom:1px dotted #6c757d;
        ">
        ${pageTitle}
        </a>
    </div>
    `;

    // 1) If GPT is disabled, always open the manual prompt
    if (!settings.gptEnabled) {
        chrome.tabs.sendMessage(tab.id, {
            action: "askFrontInput",
            backHtml: backWithSource,
            frontHtml: "",
            deckName: settings.deckName,
            deckList: deckList,
            ankiOnline: ankiOnline,
        });
        return;
    }

    // 2) GPT is enabled — try to generate
    notify(tab.id, "pending", "Generating flashcard…");
    let front;
    try {
        front = await generateFront(rawHtml, settings.gptModel, pageTitle, pageUrl);
    } catch (gptErr) {
        // → show manual prompt with error, include ankiOnline
        chrome.tabs.sendMessage(tab.id, {
            action: "askFrontInput",
            backHtml: backWithSource,
            frontHtml: "",
            error: gptErr.message,
            deckName: settings.deckName,
            deckList: deckList,
            ankiOnline: ankiOnline
        });
        return;
    }

    // 2b) On GPT success:
    if (settings.confirmGpt) {
        // → show manual prompt pre-filled with generated question
        chrome.tabs.sendMessage(tab.id, {
            action: "askFrontInput",
            backHtml: backWithSource,
            frontHtml: front,
            deckName: settings.deckName,
            deckList: deckList,
            ankiOnline: ankiOnline
        });
        return;
    }

    // 3) Confirm-off: auto-save immediately
    notify(tab.id, "pending", "Saving to Anki…");
    try {
        await addToAnki(front, backWithSource, settings.deckName, settings.modelName);
        notify(tab.id, "success", "Saved to Anki!");
    } catch (ankiErr) {
        const isOffline = ankiErr instanceof TypeError;
        if (isOffline) {
            await queueClip({ front, backHtml: rawHtml, ...settings });
            notify(tab.id, "success", "Anki offline – saved locally");
        } else {
            console.error("Anki clip failed:", ankiErr);
            notify(tab.id, "error", ankiErr.message || "Save failed");
        }
    }
}

let toastEl = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 1) Copy the selected text as HTML
    if (msg.action === "getSelectionHtml") {
        let html = "";
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            const container = document.createElement("div");
            for (let i = 0; i < sel.rangeCount; i++) {
                container.appendChild(sel.getRangeAt(i).cloneContents());
            }
            html = container.innerHTML;
        }
        sendResponse({ html });
        return true;
    }

    // 2) Prompt user for card front when GPT is disabled
    if (msg.action === "askFrontInput") {
        // 1) Create overlay
        const overlay = document.createElement("div");
        overlay.id = "manual-overlay";
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999
        });
        overlay.addEventListener("click", e => {
            if (e.target === overlay) overlay.remove();
        });

        // 2) Create dialog box
        const box = document.createElement("div");
        box.id = "manual-box";

        // 3) Error HTML (if any)
        let errorHtml = "";
        if (msg.error) {
            errorHtml = `
            <div id="manual-error" class="manual-error">
              ⚠️ Oops. Failed to auto-generate question.<br>
              <code>${msg.error}</code><br>
              
              <span style="font-size:1.16em; font-weight:500">💡 You can still save this card after typing a question below.</span>
            </div>
          `;
        }

        // 4) Deck select — enabled only if msg.ankiOnline===true
        const deckName = msg.deckName || "Default";
        const deckDisabled = msg.ankiOnline ? "" : "disabled";
        const deckHelp = msg.ankiOnline
            ? ""
            : `<span class="muted-text" style="font-size:12px; margin-top:6px;">
                🟠 Deck can only be changed when Anki is connected
            </span>`;

        // Use the full list if available, otherwise show just the saved deck
        const options = (msg.deckList && msg.deckList.length)
            ? msg.deckList
            : [deckName];

        const deckSelectHtml = `
            <label style="display:flex; flex-direction:column; margin-top:12px;">
              <span>Deck</span>
              <select id="manual-deck" ${deckDisabled}>
                ${options.map(d =>
            `<option value="${d}"${d === deckName ? " selected" : ""}>${d}</option>`
        ).join("")}
              </select>
              ${deckHelp}
            </label>
          `;

        // 5) Note model notice
        const modelNotice = `
          <div class="muted-text" style="font-size:12px;">
            ⚠️ Only the "Basic" Anki note type is supported for now
          </div>
        `;

        // 6) Build inner HTML
        box.innerHTML += `
        ${errorHtml}
        <h2 id="manual-heading" style="margin:0 0 8px;font-size:16px;">Enter flashcard question</h2>
        <div style="margin-bottom:12px">
            ${deckSelectHtml}
        </div>
        <label for="manual-front-input" class="muted-text" 
            style="display:block; font-size:12px; margin-bottom:4px;">
            Front of the card:
        </label>
        <textarea id="manual-front-input"
            style="width:100%;height:80px;padding:8px;font-size:14px;
                border:1px solid #ccc;border-radius:4px;resize:vertical;"
            placeholder="Type your question here…"></textarea>

        <!-- Editable back field -->
        <label for="manual-back-input" class="muted-text" 
            style="display:block; font-size:12px; margin-bottom:4px; margin-top:12px;">
            Back of the card:
        </label>
        <div id="manual-back-input" contenteditable="true"
            style="width:100%;min-height:150px;max-height:250px;overflow-y:auto;
                padding:8px;font-size:14px;border:1px solid #ccc;border-radius:4px;
                background:#fff;">${msg.backHtml}</div>

        <div>
            ${modelNotice}
        </div>

        <div id="manual-button-row">
        <button id="manual-enable-gpt-btn" class="manual-button-secondary">
            <span style="font-size:1.1em"><b>Setup ChatGPT</b></span><br/>
            <span class="muted-text" style="font-size:12px; margin-top:4px;">
            to generate cards automatically!
            </span>
        </button>
        <button id="manual-save-btn" class="manual-button">
            <b>Save to Anki</b>
        </button>
        </div>
        `;

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        Object.assign(closeBtn.style, {
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: "#666"
        });
        closeBtn.onclick = () => overlay.remove();
        box.appendChild(closeBtn);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // 7) Prefill generated question (if provided)
        const frontInput = box.querySelector("#manual-front-input");
        if (msg.frontHtml) {
            frontInput.value = msg.frontHtml;
        }

        // 8) Enable Save only when there's text
        const saveBtn = box.querySelector("#manual-save-btn");
        frontInput.addEventListener("input", () => {
            const hasText = frontInput.value.trim().length > 0;
            saveBtn.disabled = !hasText;
            saveBtn.style.opacity = hasText ? "1" : "0.6";
        });

        // 9) Save handler
        saveBtn.onclick = () => {
            const question = frontInput.value.trim();
            if (!question) return;

            const selectedDeck = box.querySelector("#manual-deck").value;
            const backInput = box.querySelector("#manual-back-input");
            const editedBackHtml = backInput.innerHTML;
            chrome.runtime.sendMessage({
                action: "manualSave",
                front: question,
                backHtml: editedBackHtml,
                deckName: selectedDeck
            });
            overlay.remove();
        };

        // 10) Enable GPT handler
        box.querySelector("#manual-enable-gpt-btn").onclick = () => {
            chrome.runtime.sendMessage({ action: "openPopup" });
            overlay.remove();
        };

        return;
    }

    // Toast notifications
    if (!msg.status) return;

    if (!toastEl) {
        toastEl = document.createElement("div");
        Object.assign(toastEl.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "8px 12px",
            color: "#fff",
            fontSize: "14px",
            borderRadius: "4px",
            zIndex: 9999,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            opacity: "0",
            transition: "opacity 0.3s ease"
        });
        document.body.appendChild(toastEl);
    }

    toastEl.textContent = msg.message;
    toastEl.style.background =
        msg.status === "success" ? "rgba(40,167,69,0.9)" :
            msg.status === "error" ? "rgba(220,53,69,0.9)" :
                "rgba(23,162,184,0.9)";
    toastEl.style.opacity = "1";

    if (msg.status === "success") {
        setTimeout(() => {
            toastEl.style.opacity = "0";
            setTimeout(() => {
                toastEl.remove();
                toastEl = null;
            }, 300);
        }, 1500);
    }
});
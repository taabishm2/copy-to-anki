export async function addToAnki(front, backHtml, deckName = "Default", modelName = "Basic") {
    const response = await fetch("http://127.0.0.1:8765", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "addNote",
            version: 6,
            params: {
                note: {
                    deckName: deckName,
                    modelName: modelName,
                    fields: { Front: front, Back: backHtml },
                    tags: ["copy-to-anki"]
                }
            }
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
}
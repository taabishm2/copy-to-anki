export async function generateFront(
    text,
    pageTitle = "",
    pageUrl = ""
) {
    // Load key + model from the user's settings
    const { openaiKey, gptModel } = await new Promise(resolve =>
        chrome.storage.sync.get(
            { openaiKey: "", gptModel: "gpt-3.5-turbo" },
            resolve
        )
    );

    if (!openaiKey) {
        throw new Error(
            "OpenAI API key not found – please enable GPT and enter your key in the options."
        );
    }

    // Build your request using the stored model
    const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: gptModel,
                messages: [
                    {
                        role: "system",
                        content: `
                            You are an expert Anki flashcard creator. Given an HTML snippet that will appear on the back of a card, write one clear, concise question for the front that tests the snippet's single most important idea. 
                            Ignore all HTML tags—use only the visible text. Output *only* the question. The following HTML snippet comes from a page titled "${pageTitle}" (${pageUrl})`,
                    },
                    {
                        role: "user",
                        content: `Create the front‑side question for this back‑side HTML:\n\n${text}`,
                    },
                ],
                temperature: 0.7,
                max_tokens: 64,
            }),
        }
    );

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || JSON.stringify(data, null, 2));
    }

    return data.choices[0].message.content.trim();
}

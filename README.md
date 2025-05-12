# copy-to-anki

A browser extension that lets you highlight text on any web page and generate an Anki flashcard for it using ChatGPT (or manually).
Requires Anki to be installed with the (AnkiConnect)[https://ankiweb.net/shared/info/2055492159] add-on installed

## Features

* **Context menu & keyboard shortcut**: Save selection via right‑click or `Ctrl+Shift+K` / `⌘+Shift+K`.
* **Rich HTML capture**: Retains links, formatting, and images in the card back.
* **Auto generation**: If enabled, uses OpenAI API to craft concise questions for flashcard fronts.
* **Offline queue**: Notes created when Anki is closed are stored locally and automatically synced when AnkiConnect is available.
* **Configurable**: Choose deck, note model, and auto/manual generation of the flashcard.

## Usage

1. Highlight text on any page.
2. Right‑click and choose **Save to Anki** (or press `Ctrl+Shift+K` / `⌘+Shift+K`).
3. If ChatGPT integration is enabled, congrats, your flashcard is already saved!

## Configuration

Click the toolbar icon to open the popup and customize:

* **Deck**: Target Anki deck name.
* **Note Model**: Use any installed note type (Basic, Cloze, etc.). (Only notes with "front" and "back" sections are supported)
* **GPT Settings** Auto generate questions for a note using ChatGPT. Provide an API key in the options and enable it.
* **Pending Clips**: See how many clips are queued and click **Sync Now** to force a sync.
* **Anki Status**: Displays whether AnkiConnect is reachable.

## Changelog

### Other
Icon Designed by [Freepik](www.freepik.com). [Link to icon](https://www.freepik.com/icon/abstract_720669)
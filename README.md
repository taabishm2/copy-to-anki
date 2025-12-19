# copy-to-anki

![Demo](demo.gif)

A browser extension that lets you highlight text on any web page and generate an Anki flashcard for it using ChatGPT (or manually).
Requires Anki to be installed with the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed.

## Features

* **Right click or use shortcut**: Select text > right-click > "Save to Anki". Or simply select and `Ctrl+Shift+H` / `⌘+Shift+H`.
* **Rich HTML capture**: Saved notes retain all links, formatting, latex, images and other features from a web page.
* **Auto generation**: If enabled, uses OpenAI API to craft concise questions for the front of the flashcard.
* **Offline queue**: Notes created when Anki is closed are stored locally and automatically synced when AnkiConnect is available.
* **Configurable**: Choose deck, note model, and auto/manual generation of the flashcard.

## Usage

1. Highlight text on any page.
2. Right‑click and choose **Save to Anki** (or press `Ctrl+Shift+H` / `⌘+Shift+H`).
3. If ChatGPT integration is enabled, congrats, your flashcard is already saved!

## Configuration

Click the toolbar icon to open the popup and customize:

* **Deck**: Target Anki deck name.
* **Note Model**: Use any installed note type (Basic, Cloze, etc.). (Only notes with "front" and "back" sections are supported for now)
* **GPT Settings** Auto generate questions for a note using ChatGPT. Provide an OpenAI API key in the options to use.

## Changelog

### Other
Icon Designed by [Freepik](www.freepik.com). [Link to icon](https://www.freepik.com/icon/abstract_720669)

## Website (GitHub Pages)

This repo includes a single-page, SEO-friendly landing page under `docs/`.

### Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set:
	- **Source**: Deploy from a branch
	- **Branch**: `main`
	- **Folder**: `/docs`

After a minute or two, your site should publish at something like:

`https://taabishm2.github.io/copy-to-anki/`

### SEO placeholders to update

- Optional: add a custom social preview image at `docs/assets/og.png` (currently a copy of the extension icon).

# AdBlock Extension

A highly efficient and customizable ad-blocking browser extension that blocks ads, trackers, and other unwanted content using multiple filter lists and custom rules.

## Features

- Blocks ads, trackers, and other unwanted content
- Custom rule support for advanced filtering
- Whitelist functionality for trusted sites
- Automatic rule updates
- Lightweight and fast performance
- Privacy-focused (no data collection)

## You need

- Node.js (v14 or higher)
- npm (v7 or higher)
- Python 3.7+
- Chrome

## 🏗️ Development Commands

- **Start development server**
  ```bash
  npm run dev
  ```
  This will watch for changes and rebuild automatically.

- **Build for production**
  ```bash
  npm run build
  ```

- **Update filter lists**
  ```bash
  npm run update:rules
  ```
  This fetches the latest filter lists and processes them.

- **Run scheduled updates daemon**
  ```bash
  npm run daemon
  ```
  Runs a background process to periodically update filter lists.

## 🧩 Loading the Extension

### Chrome/Chromium-based Browsers
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `dist` directory from this project

### Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `dist` directory

## 🛠️ Customization

### Adding Custom Rules
1. Edit `config/custom_rules.txt`
2. Add your custom filter rules (one per line)
3. Run `npm run update:rules` to apply changes

### Managing Whitelist
1. Edit `config/whitelist.txt`
2. Add domains to whitelist (one per line)
3. Run `npm run update:rules` to apply changes

## 📦 Included Filter Lists
- EasyList (ads)
- EasyPrivacy (trackers)
- Fanboy's Annoyance List (popups, social widgets, etc.)
- Custom rules from `config/custom_rules.txt`

## 🔄 Automatic Updates

The extension can automatically update its filter lists using a scheduled task. The update daemon (`tools/schedule_updates.js`) runs daily to fetch the latest filter lists.

## 🛡️ Privacy

This extension runs entirely in your browser and does not collect any personal information. All filtering happens locally on your device.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

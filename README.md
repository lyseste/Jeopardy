<h1 align="center">
  <img src=assets/logo.png alt="Jeopardy Studio logo" height="72">
</h1>
<p align="center">
  <span align="center">A fully client-side Jeopardy-style board editor and player built with vanilla JavaScript. Create custom boards, attach media to questions, and play directly in the browser.</span>
</p>
<br/><br/>

## ✨ Features
### 🧩 Board Editor

- Create and edit multiple boards
- Custom categories
- Configurable question values
- Edit question text and answers
- Optional hint cost per question

### 🖼 Media Support

- Upload and attach media files to any question
  - Stored in IndexedDB
  - Persisted across refreshes
  - Loaded dynamically in play mode
  - Included in export/import
- Embed media from URL for larger files like videos

### 🎮 Play Mode

- Interactive game board layout
- Click questions to open modal view
- Answer hidden until revealed
- Media displayed inline

### 💾 Local Storage

- Boards saved locally in the browser
- Data persists between sessions

### 📤 Import & Export

- Export boards as JSON
- Import previously exported boards
- Media metadata preserved

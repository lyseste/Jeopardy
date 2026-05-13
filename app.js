let boards = JSON.parse(localStorage.getItem("jeopardyBoards") || "{}");
let currentBoard = null;
let currentBoardName = null;
let currentQuestion = null;
let editingMedia = [];
let inlinePanelCoords = null;
let teams = [];
let mediaDB;
let currentPanelCommit = null; // async fn to flush the open question panel

const mainMenu = document.getElementById("mainMenu");
const editor = document.getElementById("editor");
const playMode = document.getElementById("playMode");
const questionModal = document.getElementById("questionModal");
const scoreboard = document.getElementById("scoreboard");

function saveLocal() {
  localStorage.setItem("jeopardyBoards", JSON.stringify(boards));
}

// ------------- MEDIA DATABASE -------------
async function initMediaDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("QuizMediaDB", 1);
    request.onupgradeneeded = function (event) {
      mediaDB = event.target.result;
      if (!mediaDB.objectStoreNames.contains("media")) {
        mediaDB.createObjectStore("media", { keyPath: "id" });
      }
    };
    request.onsuccess = function (event) {
      mediaDB = event.target.result;
      resolve();
    };
    request.onerror = function () {
      reject("IndexedDB failed to open.");
    };
  });
}

function saveMediaBlob(id, blob) {
  return new Promise((resolve, reject) => {
    const tx = mediaDB.transaction("media", "readwrite");
    const store = tx.objectStore("media");
    store.put({ id, blob });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

function getMediaBlob(id) {
  return new Promise((resolve, reject) => {
    const tx = mediaDB.transaction("media", "readonly");
    const store = tx.objectStore("media");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = reject;
  });
}

function deleteMediaBlob(id) {
  const tx = mediaDB.transaction("media", "readwrite");
  tx.objectStore("media").delete(id);
}

// ------------- BREADCRUMB -------------
function setBreadcrumb(items) {
  const bc = document.getElementById("breadcrumb");
  bc.innerHTML = "";

  items.forEach((item, i) => {
    const span = document.createElement("span");
    span.className = "breadcrumbItem" + (i === items.length - 1 ? " active" : "");
    span.textContent = item.label;
    if (item.onclick) {
      span.classList.add("clickable");
      span.onclick = item.onclick;
    }
    bc.appendChild(span);

    if (i < items.length - 1) {
      const sep = document.createElement("span");
      sep.className = "breadcrumbSep";
      sep.textContent = "›";
      bc.appendChild(sep);
    }
  });
}

// ------------- BOARD CARDS -------------
function refreshBoardCards() {
  const container = document.getElementById("boardCards");
  const emptyState = document.getElementById("emptyState");
  container.innerHTML = "";

  const names = Object.keys(boards);

  if (names.length === 0) {
    emptyState.classList.remove("hidden");
    container.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  container.classList.remove("hidden");

  names.forEach((name) => {
    const board = boards[name];
    const catCount = board.visibleCategories || board.categories?.length || 0;
    const qCount = catCount * (board.visibleRows || 5);

    const card = document.createElement("div");
    card.className = "boardCard";

    const cardName = document.createElement("div");
    cardName.className = "boardCardName";
    cardName.textContent = name;

    const meta = document.createElement("div");
    meta.className = "boardCardMeta";

    const catStat = document.createElement("div");
    catStat.className = "boardCardStat";
    catStat.innerHTML = `<i class="fa-solid fa-table-columns"></i> ${catCount} categories`;

    const qStat = document.createElement("div");
    qStat.className = "boardCardStat";
    qStat.innerHTML = `<i class="fa-solid fa-circle-question"></i> ${qCount} questions`;

    meta.appendChild(catStat);
    meta.appendChild(qStat);

    const actions = document.createElement("div");
    actions.className = "boardCardActions";

    const playBtn = document.createElement("button");
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
    playBtn.onclick = () => playBoard(name);

    const editBtn = document.createElement("button");
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
    editBtn.classList.add("secondaryBtn");
    editBtn.onclick = () => editBoard(name);

    const exportBtn = document.createElement("button");
    exportBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
    exportBtn.classList.add("secondaryBtn");
    exportBtn.title = "Export";
    exportBtn.style.flex = "0";
    exportBtn.onclick = () => exportBoard(name);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.className = "boardCardDeleteBtn";
    deleteBtn.title = "Delete board";
    deleteBtn.onclick = () => deleteBoard(name);

    actions.appendChild(playBtn);
    actions.appendChild(editBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(cardName);
    card.appendChild(meta);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

// ------------- INITIALIZE -------------
async function initApp() {
  boards = JSON.parse(localStorage.getItem("jeopardyBoards") || "{}");
  await initMediaDB();
  refreshBoardCards();
  setBreadcrumb([{ label: "Boards" }]);

  document.getElementById("newBoardBtn").onclick = createBoard;
  document.getElementById("newBoardBtnEmpty").onclick = createBoard;
  document.getElementById("importBoardBtn").onclick = () => document.getElementById("importFile").click();
  document.getElementById("importFile").onchange = importBoard;
  document.getElementById("saveBoardBtn").onclick = saveBoard;
  document.getElementById("addTeamBtn").onclick = addTeam;
  document.getElementById("finalBtn").onclick = openFinalQuestion;

  // Inline number controls for grid dimensions
  document.getElementById("catDecBtn").onclick = () => adjustGrid("cat", -1);
  document.getElementById("catIncBtn").onclick = () => adjustGrid("cat", 1);
  document.getElementById("rowDecBtn").onclick = () => adjustGrid("row", -1);
  document.getElementById("rowIncBtn").onclick = () => adjustGrid("row", 1);

  document.getElementById("catCount").addEventListener("change", () => generateGrid());
  document.getElementById("rowCount").addEventListener("change", () => generateGrid());

  document.querySelectorAll(".backBtn").forEach((btn) => {
    btn.onclick = backToMenu;
  });

  initPanelResizer();
  initBoardNameInput();
  initNavToggle();

  // About modal
  document.getElementById("aboutInfo").addEventListener("click", () => {
    document.getElementById("infoModal").classList.add("active");
  });
  document.getElementById("infoModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("infoModal")) {
      document.getElementById("infoModal").classList.remove("active");
    }
  });
  document.getElementById("closeInfo").addEventListener("click", () => {
    document.getElementById("infoModal").classList.remove("active");
  });
}
initApp();

function adjustGrid(type, delta) {
  const input = document.getElementById(type === "cat" ? "catCount" : "rowCount");
  const newVal = Math.max(1, Math.min(10, parseInt(input.value) + delta));
  input.value = newVal;
  generateGrid();
}

// ------------- NAV COLLAPSE -------------
function initNavToggle() {
  const collapseBtn = document.getElementById("collapseNav");
  const showBtn = document.getElementById("showNav");
  if (!collapseBtn || !showBtn) return;

  collapseBtn.addEventListener("click", () => {
    document.body.classList.add("navHidden");
  });

  showBtn.addEventListener("click", () => {
    document.body.classList.remove("navHidden");
  });
}

// ------------- BOARD RENAME -------------
function initBoardNameInput() {
  const input = document.getElementById("boardNameInput");
  if (!input) return;
  input.addEventListener("change", () => commitBoardRename(input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      input.blur();
    } else if (e.key === "Escape") {
      input.value = currentBoardName || "";
      input.blur();
    }
  });
}

function commitBoardRename(input) {
  if (!currentBoardName) return;
  const newName = input.value.trim();
  if (!newName) {
    input.value = currentBoardName;
    return;
  }
  if (newName === currentBoardName) return;
  if (boards[newName]) {
    showToast(`A board named "${newName}" already exists`);
    input.value = currentBoardName;
    return;
  }

  // Reinsert under new key, preserving order
  const reordered = {};
  for (const key of Object.keys(boards)) {
    if (key === currentBoardName) {
      reordered[newName] = boards[currentBoardName];
    } else {
      reordered[key] = boards[key];
    }
  }
  boards = reordered;
  currentBoardName = newName;

  saveLocal();
  setBreadcrumb([
    { label: "Boards", onclick: backToMenu },
    { label: newName },
  ]);
  showToast("Board renamed");
}

// ------------- PANEL RESIZER -------------
function initPanelResizer() {
  const resizer = document.getElementById("panelResizer");
  const panel = document.getElementById("questionPanel");
  if (!resizer || !panel) return;

  // Restore saved width
  const saved = parseInt(localStorage.getItem("v3PanelWidth"), 10);
  if (saved && saved >= 240 && saved <= 700) {
    panel.style.width = saved + "px";
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = panel.getBoundingClientRect().width;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const delta = startX - e.clientX; // drag left = grow panel
    const newWidth = Math.max(240, Math.min(700, startWidth + delta));
    panel.style.width = newWidth + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem("v3PanelWidth", parseInt(panel.style.width, 10));
  });
}

// ------------- BOARD MANAGEMENT -------------
function createBoard() {
  let name = prompt("Board name?");
  if (!name || !name.trim()) return;
  name = name.trim();
  boards[name] = {
    categories: [],
    final: null,
    visibleCategories: 5,
    visibleRows: 5,
  };
  saveLocal();
  refreshBoardCards();
  editBoard(name);
}

function deleteBoard(name) {
  if (confirm(`Delete "${name}"?`)) {
    delete boards[name];
    saveLocal();
    refreshBoardCards();
  }
}

function editBoard(name) {
  currentBoardName = name;
  currentBoard = boards[name];

  document.getElementById("boardNameInput").value = name;
  document.getElementById("catCount").value = currentBoard.visibleCategories || 5;
  document.getElementById("rowCount").value = currentBoard.visibleRows || 5;

  mainMenu.classList.add("hidden");
  editor.classList.remove("hidden");

  setBreadcrumb([
    { label: "Boards", onclick: backToMenu },
    { label: name },
  ]);

  generateGrid();
  resetQuestionPanel();
}

function playBoard(name) {
  currentBoardName = name;
  currentBoard = boards[name];

  mainMenu.classList.add("hidden");
  playMode.classList.remove("hidden");

  setBreadcrumb([
    { label: "Boards", onclick: backToMenu },
    { label: name },
    { label: "Playing" },
  ]);

  buildBoard();
}

async function backToMenu() {
  await commitPanelEdits();
  editor.classList.add("hidden");
  playMode.classList.add("hidden");
  mainMenu.classList.remove("hidden");
  currentBoard = null;
  currentBoardName = null;
  teams = [];
  setBreadcrumb([{ label: "Boards" }]);
  refreshBoardCards();
}

// ------------- EDITOR -------------
async function generateGrid() {
  if (!currentBoard) return;
  await commitPanelEdits();
  let requestedCats = parseInt(document.getElementById("catCount").value) || 5;
  let requestedRows = parseInt(document.getElementById("rowCount").value) || 5;

  currentBoard.visibleCategories = requestedCats;
  currentBoard.visibleRows = requestedRows;

  while (currentBoard.categories.length < requestedCats) {
    currentBoard.categories.push({
      title: "Category " + (currentBoard.categories.length + 1),
      questions: [],
    });
  }

  currentBoard.categories.forEach((cat) => {
    while (cat.questions.length < requestedRows) {
      cat.questions.push({
        value: (cat.questions.length + 1) * 100,
        type: "text",
        question: "",
        answer: "",
        media: [],
      });
    }
  });

  renderEditorGrid();
  resetQuestionPanel();
}

function renderEditorGrid() {
  const grid = document.getElementById("editorGrid");
  grid.innerHTML = "";

  const columnsRow = document.createElement("div");
  columnsRow.className = "editorGridColumns";

  for (let c = 0; c < currentBoard.visibleCategories; c++) {
    let category = currentBoard.categories[c];
    let div = document.createElement("div");
    div.className = "editorColumn";

    let title = document.createElement("h3");
    title.contentEditable = true;
    title.textContent = category.title;
    title.oninput = () => (category.title = title.textContent);
    div.appendChild(title);

    for (let r = 0; r < currentBoard.visibleRows; r++) {
      let q = category.questions[r];
      const btn = document.createElement("button");
      btn.className = "editorTile";
      btn.onclick = () => selectTile(c, r, btn);

      const valueSpan = document.createElement("span");
      valueSpan.className = "editorTileValue";
      valueSpan.textContent = "$" + q.value;

      const icon = document.createElement("i");
      icon.className = getQuestionIconClass(q.type) + " editorTileIcon";

      btn.appendChild(icon);
      btn.appendChild(valueSpan);
      q._editorButton = btn;
      div.appendChild(btn);
    }

    columnsRow.appendChild(div);
  }
  grid.appendChild(columnsRow);

  const finalRow = document.createElement("div");
  finalRow.className = "finalRow";
  const editFinalBtn = document.createElement("button");
  editFinalBtn.innerHTML = '<i class="fa-solid fa-star"></i> Edit Final Jeopardy';
  editFinalBtn.className = "editFinalBtn";
  editFinalBtn.onclick = () => selectFinal(editFinalBtn);
  finalRow.appendChild(editFinalBtn);
  grid.appendChild(finalRow);
}

function getQuestionIconClass(type) {
  switch (type) {
    case "video": return "fa-solid fa-video";
    case "audio": return "fa-solid fa-volume-high";
    default: return "fa-solid fa-font";
  }
}

// ------------- INLINE PANEL -------------
function clearTileSelection() {
  document.querySelectorAll(".editorTile.selected, .editFinalBtn.selected")
    .forEach(el => el.classList.remove("selected"));
}

async function commitPanelEdits() {
  if (currentPanelCommit) {
    const fn = currentPanelCommit;
    currentPanelCommit = null;
    await fn();
  }
}

async function selectTile(c, r, btn) {
  await commitPanelEdits();
  clearTileSelection();
  btn.classList.add("selected");
  inlinePanelCoords = { c, r };
  openInlinePanel({ c, r });
}

async function selectFinal(btn) {
  await commitPanelEdits();
  if (!currentBoard.final) {
    currentBoard.final = { value: 0, type: "text", question: "", answer: "", media: [], hintCost: 0 };
  }
  clearTileSelection();
  btn.classList.add("selected");
  inlinePanelCoords = { isFinal: true };
  openInlinePanel({ isFinal: true });
}

function resetQuestionPanel() {
  inlinePanelCoords = null;
  currentPanelCommit = null;
  const panel = document.getElementById("questionPanel");
  panel.innerHTML = `
    <div class="panelPlaceholder">
      <div class="placeholderIcon"><i class="fa-regular fa-hand-pointer"></i></div>
      <p>Click any question tile<br>to edit it here</p>
    </div>
  `;
}

async function openInlinePanel(target) {
  const isFinal = !!target.isFinal;
  const q = isFinal
    ? currentBoard.final
    : currentBoard.categories[target.c].questions[target.r];
  const panel = document.getElementById("questionPanel");

  // Load existing media for this question
  editingMedia = [];
  if (q.media && Array.isArray(q.media)) {
    for (let m of q.media) {
      if (m.type === "embed") {
        editingMedia.push({
          type: "embed",
          url: m.url || "",
          label: m.label || "",
          role: m.role || "question",
          name: m.name || "Embedded Media",
          mediaId: m.mediaId || null,
        });
      } else {
        try {
          const blob = await getMediaBlob(m.mediaId);
          if (!blob) continue;
          editingMedia.push({
            mediaId: m.mediaId,
            label: m.label || "",
            type: blob.type,
            name: m.name || "Imported File",
            tempFile: blob,
            role: m.role || "question",
          });
        } catch (err) {
          console.warn("Failed to load media:", err);
        }
      }
    }
  }

  panel.innerHTML = "";

  const content = document.createElement("div");
  content.className = "panelContent";

  // Header
  const header = document.createElement("div");
  header.className = "panelHeader";
  const headerTitle = document.createElement("h3");
  const headerLabel = () => isFinal
    ? `Final Jeopardy · $${q.value}`
    : `${currentBoard.categories[target.c].title} · $${q.value}`;
  headerTitle.textContent = headerLabel();
  header.appendChild(headerTitle);
  content.appendChild(header);

  // Fields
  const fields = document.createElement("div");
  fields.className = "panelFields";

  // Value
  const valueField = makePanelField("Point Value", "number", q.value);
  const valueInput = valueField.querySelector("input");
  valueInput.min = "0";
  fields.appendChild(valueField);

  // Hint Cost
  const hintField = makePanelField("Hint Cost", "number", q.hintCost || 0);
  const hintInput = hintField.querySelector("input");
  hintInput.min = "0";
  fields.appendChild(hintField);

  // Type select
  const typeField = document.createElement("div");
  typeField.className = "panelField";
  const typeLabel = document.createElement("label");
  typeLabel.textContent = "Type";
  const typeSelect = document.createElement("select");
  ["text", "video", "audio"].forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (q.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeField.appendChild(typeLabel);
  typeField.appendChild(typeSelect);
  fields.appendChild(typeField);

  // Question text
  const qField = document.createElement("div");
  qField.className = "panelField";
  const qLabel = document.createElement("label");
  qLabel.textContent = "Question";
  const qTextarea = document.createElement("textarea");
  qTextarea.value = q.question || "";
  qTextarea.placeholder = "Enter the question...";
  qField.appendChild(qLabel);
  qField.appendChild(qTextarea);
  fields.appendChild(qField);

  // Answer
  const aField = document.createElement("div");
  aField.className = "panelField";
  const aLabel = document.createElement("label");
  aLabel.textContent = "Answer";
  const aInput = document.createElement("input");
  aInput.type = "text";
  aInput.value = q.answer || "";
  aInput.placeholder = "Enter the answer...";
  aField.appendChild(aLabel);
  aField.appendChild(aInput);
  fields.appendChild(aField);

  content.appendChild(fields);

  // Media section
  const mediaSection = document.createElement("div");
  mediaSection.className = "panelMediaSection";
  const mediaLbl = document.createElement("div");
  mediaLbl.className = "panelMediaLabel";
  mediaLbl.textContent = "Media";
  mediaSection.appendChild(mediaLbl);

  const mediaBtns = document.createElement("div");
  mediaBtns.className = "panelMediaBtns";

  const uploadBtn = document.createElement("button");
  uploadBtn.className = "linkbtn";
  uploadBtn.innerHTML = '<i class="fa-solid fa-paperclip"></i> Upload';
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.hidden = true;
  uploadBtn.onclick = () => fileInput.click();

  fileInput.addEventListener("change", async (e) => {
    for (let file of e.target.files) {
      const mediaId = "media_" + crypto.randomUUID();
      await saveMediaBlob(mediaId, file);
      editingMedia.push({ mediaId, label: "", type: file.type, name: file.name, role: "question" });
    }
    renderPanelMediaList(mediaListContainer);
    e.target.value = "";
  });

  const embedBtn = document.createElement("button");
  embedBtn.className = "linkbtn";
  embedBtn.innerHTML = '<i class="fa-solid fa-link"></i> Embed URL';
  embedBtn.onclick = () => {
    editingMedia.push({ type: "embed", url: "", label: "", role: "question" });
    renderPanelMediaList(mediaListContainer);
  };

  mediaBtns.appendChild(uploadBtn);
  mediaBtns.appendChild(fileInput);
  mediaBtns.appendChild(embedBtn);
  mediaSection.appendChild(mediaBtns);

  const mediaListContainer = document.createElement("div");
  mediaListContainer.className = "mediaPreviewList";
  mediaSection.appendChild(mediaListContainer);

  renderPanelMediaList(mediaListContainer);
  content.appendChild(mediaSection);

  panel.appendChild(content);

  // Capture the panel's current state into currentBoard. Called automatically
  // when the user switches questions, closes the panel, navigates away, or
  // clicks the Save Board button.
  const capturedMedia = editingMedia;
  currentPanelCommit = async () => {
    q.value = parseInt(valueInput.value) || 0;
    q.hintCost = parseInt(hintInput.value) || 0;
    q.type = typeSelect.value;
    q.question = qTextarea.value;
    q.answer = aInput.value;

    const finalMedia = [];
    for (let m of capturedMedia) {
      if (m.tempFile) await saveMediaBlob(m.mediaId, m.tempFile);
      if (m.type === "embed" && !m.mediaId) m.mediaId = "embed_" + crypto.randomUUID();
      finalMedia.push({
        mediaId: m.mediaId,
        label: m.label || "",
        type: m.type,
        name: m.name,
        role: m.role || "question",
        url: m.type === "embed" ? m.url : undefined,
      });
    }
    q.media = finalMedia;

    if (!isFinal && q._editorButton) {
      const valueEl = q._editorButton.querySelector(".editorTileValue");
      const iconEl = q._editorButton.querySelector(".editorTileIcon");
      if (valueEl) valueEl.textContent = "$" + q.value;
      if (iconEl) iconEl.className = getQuestionIconClass(q.type) + " editorTileIcon";
    }

    saveLocal();
  };
}

function makePanelField(labelText, inputType, value) {
  const field = document.createElement("div");
  field.className = "panelField";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = inputType;
  input.value = value;
  field.appendChild(label);
  field.appendChild(input);
  return field;
}

function renderPanelMediaList(container) {
  container.innerHTML = "";

  editingMedia.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mediaItem";

    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;gap:6px;align-items:center;";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Label";
    labelInput.value = file.label || "";
    labelInput.className = "mediaLabelInput";
    labelInput.style.cssText = "flex:1;min-height:unset;margin:0;";
    labelInput.addEventListener("input", () => { file.label = labelInput.value; });

    const roleSelect = document.createElement("select");
    roleSelect.className = "mediaRoleSelect";
    ["question", "hint", "answer"].forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      if ((file.role || "question") === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener("change", () => { file.role = roleSelect.value; });

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "<span>✕</span>";
    removeBtn.className = "removeMediaBtn";
    removeBtn.onclick = () => {
      if (file.mediaId) deleteMediaBlob(file.mediaId);
      editingMedia.splice(index, 1);
      renderPanelMediaList(container);
    };

    row1.appendChild(labelInput);
    row1.appendChild(roleSelect);
    row1.appendChild(removeBtn);
    wrapper.appendChild(row1);

    if (file.type === "embed") {
      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.placeholder = "Paste media URL...";
      urlInput.value = file.url || "";
      urlInput.style.cssText = "width:100%;min-height:unset;margin-top:6px;";
      urlInput.addEventListener("input", () => { file.url = urlInput.value; });
      wrapper.appendChild(urlInput);
    } else {
      const nameEl = document.createElement("div");
      nameEl.style.cssText = "font-size:11px;color:var(--text-muted);margin-top:4px;";
      nameEl.textContent = file.name || "File";
      wrapper.appendChild(nameEl);
    }

    container.appendChild(wrapper);
  });
}

// ------------- LEGACY EDITOR MODAL (kept for compatibility, no longer triggered) -------------
document.getElementById("addMediaBtn").onclick = () => document.getElementById("editMedia").click();
document.getElementById("addEmbedBtn").onclick = () => {
  editingMedia.push({ type: "embed", url: "", label: "", role: "question" });
  renderMediaPreview();
};

document.getElementById("editMedia").addEventListener("change", async (e) => {
  for (let file of e.target.files) {
    const mediaId = "media_" + crypto.randomUUID();
    await saveMediaBlob(mediaId, file);
    editingMedia.push({ mediaId, label: "", type: file.type, name: file.name, role: "question" });
  }
  renderMediaPreview();
  e.target.value = "";
});

async function renderMediaPreview() {
  const container = document.getElementById("mediaPreviewList");
  container.innerHTML = "";

  for (let index = 0; index < editingMedia.length; index++) {
    const file = editingMedia[index];
    const isEmbed = file.type === "embed";

    const wrapper = document.createElement("div");
    wrapper.className = "mediaItem";

    const previewWrapper = document.createElement("div");
    previewWrapper.className = "mediaPreviewWrapper";

    const labelRoleRow = document.createElement("div");
    labelRoleRow.style.cssText = "display:flex;gap:10px;align-items:center;";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Optional label: $(hint)";
    labelInput.value = file.label || "";
    labelInput.className = "mediaLabelInput";
    labelInput.addEventListener("input", () => { file.label = labelInput.value; });

    const roleSelect = document.createElement("select");
    roleSelect.className = "mediaRoleSelect";
    ["question", "hint", "answer"].forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
      if ((file.role || "question") === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener("change", () => { file.role = roleSelect.value; });

    labelRoleRow.appendChild(labelInput);
    labelRoleRow.appendChild(roleSelect);
    wrapper.appendChild(labelRoleRow);

    if (isEmbed) {
      const urlPreviewRow = document.createElement("div");
      urlPreviewRow.className = "mediaUrlPreviewRow";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.placeholder = "Enter media URL...";
      urlInput.value = file.url || "";
      urlInput.className = "mediaUrlInput";
      urlInput.addEventListener("input", () => { file.url = urlInput.value; });

      const previewBtn = document.createElement("button");
      previewBtn.textContent = "Preview";
      previewBtn.className = "previewMediaBtn";

      urlPreviewRow.appendChild(urlInput);
      urlPreviewRow.appendChild(previewBtn);
      wrapper.appendChild(urlPreviewRow);

      const previewContainer = document.createElement("div");
      previewContainer.className = "embedPreviewContainer";
      previewContainer.textContent = "Embedded media (no preview yet)";
      previewWrapper.appendChild(previewContainer);

      if (file.url && file.url.trim()) renderEmbedPreview(file, previewContainer);
      previewBtn.onclick = () => renderEmbedPreview(file, previewContainer);
    } else {
      let preview;
      if (file.type.startsWith("image/")) {
        preview = document.createElement("img");
      } else if (file.type.startsWith("audio/")) {
        preview = document.createElement("audio");
        preview.controls = true;
      } else if (file.type.startsWith("video/")) {
        preview = document.createElement("video");
        preview.controls = true;
      } else {
        preview = document.createElement("div");
        preview.textContent = file.name;
      }
      if (file.mediaId && file.tempFile) preview.src = URL.createObjectURL(file.tempFile);
      preview.className = "mediaPreview";
      previewWrapper.appendChild(preview);
    }

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "<span>✕</span>";
    removeBtn.className = "removeMediaBtn";
    removeBtn.onclick = () => {
      if (file.mediaId) deleteMediaBlob(file.mediaId);
      editingMedia.splice(index, 1);
      renderMediaPreview();
    };

    wrapper.appendChild(previewWrapper);
    previewWrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  }
}

function renderEmbedPreview(file, previewContainer) {
  previewContainer.innerHTML = "";
  const url = file.url?.trim();
  if (!url) return;

  let element;
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    element = document.createElement("video");
    element.controls = true;
    element.src = url;
  } else if (url.match(/\.(mp3|wav|ogg)$/i)) {
    element = document.createElement("audio");
    element.controls = true;
    element.src = url;
  } else if (url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
    element = document.createElement("img");
    element.src = url;
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    element = document.createElement("iframe");
    element.src = convertYouTubeUrl(url);
    element.allowFullscreen = true;
  } else {
    previewContainer.textContent = "Unsupported embed format.";
    return;
  }
  element.className = "mediaPreview";
  previewContainer.appendChild(element);
}

function convertYouTubeUrl(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&]+)/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}`;
}

document.getElementById("cancelQuestionBtn").onclick = () => {
  document.getElementById("editorModal").classList.remove("active");
};

document.getElementById("saveQuestionBtn").onclick = async () => {
  const q = currentBoard.final;

  q.value = parseInt(document.getElementById("editValue").value) || 0;
  q.hintCost = parseInt(document.getElementById("editHintCost").value) || 0;
  q.type = document.getElementById("editType").value;
  q.question = document.getElementById("editQuestionText").value;
  q.answer = document.getElementById("editAnswerText").value;

  const finalMedia = [];
  for (let m of editingMedia) {
    if (m.tempFile) await saveMediaBlob(m.mediaId, m.tempFile);
    if (m.type === "embed" && !m.mediaId) m.mediaId = "embed_" + crypto.randomUUID();
    finalMedia.push({
      mediaId: m.mediaId,
      label: m.label || "",
      type: m.type,
      name: m.name,
      role: m.role || "question",
      url: m.type === "embed" ? m.url : undefined,
    });
  }
  q.media = finalMedia;

  document.getElementById("editorModal").classList.remove("active");
  saveLocal();
  showToast("Final Jeopardy saved");
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

async function saveBoard() {
  await commitPanelEdits();
  saveLocal();
  showToast("Board saved!");
}

function showToast(message, duration = 2000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add("show"); }, 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => container.removeChild(toast), 400);
  }, duration);
}

// ------------- PLAY MODE -------------
function buildBoard() {
  const table = document.getElementById("board");
  table.innerHTML = "";
  scoreboard.innerHTML = "";

  // Scoreboard title
  const sbTitle = document.createElement("div");
  sbTitle.className = "scoreboardTitle";
  sbTitle.textContent = "Scoreboard";
  scoreboard.appendChild(sbTitle);

  const header = document.createElement("tr");
  for (let c = 0; c < currentBoard.visibleCategories; c++) {
    const th = document.createElement("th");
    th.textContent = currentBoard.categories[c].title;
    header.appendChild(th);
  }
  table.appendChild(header);

  for (let r = 0; r < currentBoard.visibleRows; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < currentBoard.visibleCategories; c++) {
      const td = document.createElement("td");
      const q = currentBoard.categories[c].questions[r];
      td.textContent = "$" + q.value;
      td.className = "tile";
      td.onclick = () => openQuestion(c, r, td);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function openQuestion(c, r, tile) {
  currentQuestion = { c, r, tile };
  const q = currentBoard.categories[c].questions[r];
  const category = currentBoard.categories[c];
  openPlayableQuestion(q, { tile, categoryTitle: category.title, value: q.value, isFinal: false });
}

function openFinalQuestion() {
  if (!currentBoard.final) {
    alert("No Final Jeopardy question has been set.");
    return;
  }
  openPlayableQuestion(currentBoard.final, { isFinal: true });
}

async function openPlayableQuestion(questionData, config = {}) {
  const { tile = null, categoryTitle = "", value = "", isFinal = false } = config;
  const questionModal = document.getElementById("questionModal");
  questionModal.innerHTML = "";
  questionModal.classList.add("active");

  const content = document.createElement("div");
  content.className = "questionContent";
  const q = questionData;

  const header = document.createElement("h2");
  header.className = "questionHeader";
  header.textContent = isFinal ? "Final Jeopardy" : `${categoryTitle}  ·  $${value}`;
  content.appendChild(header);

  if (q.question && q.question.trim() !== "") {
    const questionText = document.createElement("div");
    questionText.className = "questionText";
    questionText.textContent = q.question;
    content.appendChild(questionText);
  }

  const answerEl = document.createElement("div");
  answerEl.className = "questionAnswer hiddenAnswer";
  answerEl.textContent = q.answer;
  content.appendChild(answerEl);

  let mediaContainer = null;
  let questionMedia = [], hintMedia = [], answerMedia = [];
  let missingMediaDetected = false;

  if (q.media && q.media.length > 0) {
    for (let file of q.media) {
      if (file.role === "hint") hintMedia.push(file);
      else if (file.role === "answer") answerMedia.push(file);
      else questionMedia.push(file);
    }

    mediaContainer = document.createElement("div");
    mediaContainer.className = "questionMedia";
    content.appendChild(mediaContainer);

    async function renderMediaSet(mediaArray) {
      mediaContainer.innerHTML = "";
      missingMediaDetected = false;

      for (let file of mediaArray) {
        if (file.type === "embed") {
          renderEmbedInModal(file, mediaContainer);
          continue;
        }

        const blob = await getMediaBlob(file.mediaId);
        if (!blob) { missingMediaDetected = true; continue; }

        const url = URL.createObjectURL(blob);
        const labelText = file.label ? file.label.replace(/\$\(\s*hint\s*\)/gi, `$${q.hintCost || 0}`) : "";
        let element;

        if (blob.type.startsWith("video/")) {
          element = document.createElement("video");
          element.controls = true;
          element.style.maxWidth = "80vw";
        } else if (blob.type.startsWith("audio/")) {
          element = document.createElement("audio");
          element.controls = true;
        } else if (blob.type.startsWith("image/")) {
          element = document.createElement("img");
          element.style.maxWidth = "600px";
        }

        if (element) {
          element.src = url;
          const wrapper = document.createElement("div");
          wrapper.className = "questionMediaWrapper";
          wrapper.appendChild(element);
          const labelEl = document.createElement("span");
          labelEl.textContent = labelText || "";
          labelEl.className = "questionMediaLabel";
          wrapper.appendChild(labelEl);
          mediaContainer.appendChild(wrapper);
        }
      }

      if (missingMediaDetected) {
        const warning = document.createElement("div");
        warning.className = "missingMediaWarning";
        warning.textContent = "Media file missing. Please re-import the board.";
        mediaContainer.appendChild(warning);
      }
    }

    await renderMediaSet(questionMedia);

    if (hintMedia.length > 0) {
      const hintWrapper = document.createElement("div");
      hintWrapper.className = "questionMediaWrapper";
      const hintBtn = document.createElement("button");
      const cost = q.hintCost || 0;
      hintBtn.textContent = cost > 0 ? `Show Hint ($${cost})` : "Show Hint";
      hintBtn.className = "questionMediaHintBtn";
      hintBtn.onclick = async () => { await renderMediaSet([...questionMedia, ...hintMedia]); };
      hintWrapper.appendChild(hintBtn);
      const labelPlaceholder = document.createElement("span");
      labelPlaceholder.className = "questionMediaLabel";
      labelPlaceholder.textContent = "";
      hintWrapper.appendChild(labelPlaceholder);
      mediaContainer.appendChild(hintWrapper);
    }

    content._renderMediaSet = renderMediaSet;
  }

  questionModal.appendChild(content);

  const buttonRow = document.createElement("div");
  buttonRow.className = "questionButtons";

  const showAns = document.createElement("button");
  showAns.textContent = "Show Answer";
  showAns.onclick = async () => {
    answerEl.classList.add("visibleAnswer");
    if (tile) { tile.classList.add("blank"); tile.textContent = ""; }
    if (mediaContainer && answerMedia.length > 0 && content._renderMediaSet) {
      await content._renderMediaSet(answerMedia);
    }
  };

  const back = document.createElement("button");
  back.textContent = "Back to Board";
  back.classList.add("secondaryBtn");
  back.onclick = () => { questionModal.classList.remove("active"); };

  buttonRow.appendChild(showAns);
  buttonRow.appendChild(back);
  questionModal.appendChild(buttonRow);
}

function renderEmbedInModal(file, container) {
  const wrapper = document.createElement("div");
  wrapper.className = "questionMediaWrapper";
  let element;
  const url = file.url;

  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    element = document.createElement("video");
    element.controls = true;
    element.src = url;
  } else if (url.match(/\.(mp3|wav|ogg)$/i)) {
    element = document.createElement("audio");
    element.controls = true;
    element.src = url;
  } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    element = document.createElement("img");
    element.src = url;
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    element = document.createElement("iframe");
    element.src = convertYouTubeUrl(url);
    element.allowFullscreen = true;
  }

  if (!element) return;
  wrapper.appendChild(element);
  const labelEl = document.createElement("span");
  labelEl.className = "questionMediaLabel";
  labelEl.textContent = file.label || "";
  wrapper.appendChild(labelEl);
  container.appendChild(wrapper);
}

// ------------- TEAMS (sidebar style) -------------
function addTeam() {
  const teamDiv = document.createElement("div");
  teamDiv.className = "team";

  const removeBtn = document.createElement("button");
  removeBtn.className = "removeTeamBtn";
  removeBtn.innerHTML = "<span>✕</span>";
  removeBtn.setAttribute("data-tooltip", "Remove team");
  removeBtn.onclick = () => {
    teamDiv.remove();
    teams = teams.filter((t) => t.div !== teamDiv);
  };

  const name = document.createElement("h4");
  name.contentEditable = true;
  name.textContent = "";
  name.className = "teamName";
  setTimeout(() => name.focus(), 0);

  const scoreDiv = document.createElement("div");
  scoreDiv.className = "teamScore";
  const team = { div: teamDiv, name, scoreDiv, score: 0 };
  scoreDiv.textContent = team.score;
  scoreDiv.contentEditable = true;
  scoreDiv.addEventListener("blur", () => {
    let raw = scoreDiv.textContent.trim();
    let isNegative = raw.startsWith("-");
    let numericPart = raw.replace(/\D/g, "");
    let value = parseInt(numericPart) || 0;
    if (isNegative) value = -value;
    team.score = value;
    scoreDiv.textContent = team.score;
    updateScoreboard();
  });

  const controls = document.createElement("div");
  controls.className = "teamControls";

  const addBtn = document.createElement("button");
  addBtn.innerHTML = "<span>+</span>";
  addBtn.className = "teamAddBtn";
  addBtn.setAttribute("data-tooltip", "Add points");
  addBtn.onclick = () => { team.score += getLastQuestionValue(); updateScoreboard(); };

  const subBtn = document.createElement("button");
  subBtn.innerHTML = "<span>−</span>";
  subBtn.className = "teamSubBtn";
  subBtn.setAttribute("data-tooltip", "Remove points");
  subBtn.onclick = () => { team.score -= getLastQuestionValue(); updateScoreboard(); };

  const hintBtn = document.createElement("button");
  hintBtn.innerHTML = "<span>?</span>";
  hintBtn.className = "teamHintBtn";
  hintBtn.setAttribute("data-tooltip", "Remove hint cost");
  hintBtn.onclick = () => {
    if (!currentQuestion) return;
    const { c, r } = currentQuestion;
    team.score -= currentBoard.categories[c].questions[r].hintCost || 0;
    updateScoreboard();
  };

  controls.appendChild(addBtn);
  controls.appendChild(subBtn);
  controls.appendChild(hintBtn);
  teamDiv.appendChild(removeBtn);
  teamDiv.appendChild(name);
  teamDiv.appendChild(scoreDiv);
  teamDiv.appendChild(controls);

  // Insert before the add button (keep add button last)
  scoreboard.appendChild(teamDiv);
  teams.push(team);
}

function updateScoreboard() {
  teams.forEach((team) => { team.scoreDiv.textContent = team.score; });
}

function getLastQuestionValue() {
  if (!currentQuestion) return 0;
  const { c, r } = currentQuestion;
  return currentBoard.categories[c].questions[r].value || 0;
}

// ------------- IMPORT AND EXPORT -------------
async function exportBoard(name) {
  const boardData = boards[name];
  const mediaBundle = [];

  for (let cat of boardData.categories) {
    for (let q of cat.questions) {
      if (q.media) {
        for (let m of q.media) {
          const blob = await getMediaBlob(m.mediaId);
          if (!blob) continue;
          const base64 = await fileToBase64(blob);
          mediaBundle.push({ id: m.mediaId, type: blob.type, data: base64 });
        }
      }
    }
  }

  const exportData = { board: boardData, media: mediaBundle };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = name + ".json";
  a.click();
}

async function importBoard(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = async function (e) {
    const data = JSON.parse(e.target.result);
    const name = prompt("Name for imported board?");
    if (!name) return;
    boards[name] = data.board;

    if (data.media && Array.isArray(data.media)) {
      for (let m of data.media) {
        const blob = await fetch(m.data).then((r) => r.blob());
        await saveMediaBlob(m.id, blob);
      }
    }

    saveLocal();
    refreshBoardCards();
    showToast("Board imported!");
  };
  reader.readAsText(file);
  event.target.value = "";
}

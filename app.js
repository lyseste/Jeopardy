let boards = JSON.parse(localStorage.getItem("jeopardyBoards") || "{}");
let currentBoard = null;
let currentQuestion = null;

const boardSelect = document.getElementById("boardSelect");
const mainMenu = document.getElementById("mainMenu");
const editor = document.getElementById("editor");
const playMode = document.getElementById("playMode");
const questionModal = document.getElementById("questionModal");
const scoreboard = document.getElementById("scoreboard");

function saveLocal() {
  localStorage.setItem("jeopardyBoards", JSON.stringify(boards));
}

function refreshDropdown() {
  boardSelect.innerHTML = "";
  for (let name in boards) {
    let opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    boardSelect.appendChild(opt);
  }
}
refreshDropdown();

/* ---------- MENU ACTIONS ---------- */

document.getElementById("newBoardBtn").onclick = createBoard;
document.getElementById("editBoardBtn").onclick = editBoard;
document.getElementById("playBoardBtn").onclick = playBoard;
document.getElementById("deleteBoardBtn").onclick = deleteBoard;
document.getElementById("exportBoardBtn").onclick = exportBoard;
document.getElementById("importFile").onchange = importBoard;
document.getElementById("generateGridBtn").onclick = generateGrid;
document.getElementById("saveBoardBtn").onclick = saveBoard;
document.getElementById("addTeamBtn").onclick = addTeam;
document.getElementById("finalBtn").onclick = showFinal;

document.querySelectorAll(".backBtn").forEach((btn) => {
  btn.onclick = backToMenu;
});

const aboutBtn = document.getElementById("aboutInfo");
const infoModal = document.getElementById("infoModal");

aboutBtn.addEventListener("click", () => {
  infoModal.classList.add("active");
});

infoModal.addEventListener("click", (e) => {
  if (e.target === infoModal) {
    infoModal.classList.remove("active");
  }
});

document.getElementById("closeInfo").addEventListener("click", () => {
  infoModal.classList.remove("active");
});

/* ---------- BOARD MANAGEMENT ---------- */

function createBoard() {
  let name = prompt("Board name?");
  if (!name) return;
  boards[name] = {
    categories: [],
    final: null,
    visibleCategories: 5,
    visibleRows: 5,
  };

  saveLocal();
  refreshDropdown();
}

function deleteBoard() {
  let name = boardSelect.value;
  if (confirm("Delete board?")) {
    delete boards[name];
    saveLocal();
    refreshDropdown();
  }
}

function editBoard() {
  let name = boardSelect.value;
  if (!name) return;
  currentBoard = boards[name];

  document.getElementById("catCount").value =
    currentBoard.visibleCategories || 5;
  document.getElementById("rowCount").value = currentBoard.visibleRows || 5;

  mainMenu.classList.add("hidden");
  editor.classList.remove("hidden");
  generateGrid();
}

function playBoard() {
  let name = boardSelect.value;
  currentBoard = boards[name];
  mainMenu.classList.add("hidden");
  playMode.classList.remove("hidden");
  buildBoard();
}

function backToMenu() {
  editor.classList.add("hidden");
  playMode.classList.add("hidden");
  mainMenu.classList.remove("hidden");
}

/* ---------- EDITOR ---------- */

function generateGrid() {
  let requestedCats = parseInt(document.getElementById("catCount").value);
  let requestedRows = parseInt(document.getElementById("rowCount").value);

  // Ensure visible settings exist
  if (!currentBoard.visibleCategories)
    currentBoard.visibleCategories = requestedCats;
  if (!currentBoard.visibleRows) currentBoard.visibleRows = requestedRows;

  currentBoard.visibleCategories = requestedCats;
  currentBoard.visibleRows = requestedRows;

  // Add missing categories if increasing
  while (currentBoard.categories.length < requestedCats) {
    currentBoard.categories.push({
      title: "Category " + (currentBoard.categories.length + 1),
      questions: [],
    });
  }

  // Ensure each category has enough questions
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
}

function renderEditorGrid() {
  const grid = document.getElementById("editorGrid");
  grid.innerHTML = "";

  for (let c = 0; c < currentBoard.visibleCategories; c++) {
    let category = currentBoard.categories[c];

    let div = document.createElement("div");

    let title = document.createElement("h3");
    title.contentEditable = true;
    title.textContent = category.title;
    title.oninput = () => (category.title = title.textContent);

    div.appendChild(title);

    for (let r = 0; r < currentBoard.visibleRows; r++) {
      let q = category.questions[r];

      const btn = document.createElement("button");
      btn.className = "editorTile";
      btn.onclick = () => editQuestion(c, r);

      // Create value label
      const valueSpan = document.createElement("span");
      valueSpan.className = "editorTileValue";
      valueSpan.textContent = "$" + q.value;

      // Create icon
      const icon = document.createElement("i");
      icon.className = getQuestionIconClass(q.type) + " editorTileIcon";

      // Append both
      btn.appendChild(icon);
      btn.appendChild(valueSpan);

      // Store reference for updates
      q._editorButton = btn;

      q._editorButton = btn;

      div.appendChild(btn);
    }

    grid.appendChild(div);
  }
}

function getQuestionIconClass(type) {
  switch (type) {
    case "video":
      return "fa-solid fa-video";
    case "audio":
      return "fa-solid fa-volume-high";
    case "text":
    default:
      return "fa-solid fa-font";
  }
}

let editingCoords = null;

function editQuestion(c, r) {
  editingCoords = { c, r };
  const q = currentBoard.categories[c].questions[r];

  document.getElementById("editValue").value = q.value;
  document.getElementById("editType").value = q.type;
  document.getElementById("editQuestionText").value = q.question;
  document.getElementById("editAnswerText").value = q.answer;

  document.getElementById("editMedia").value = "";

  document.getElementById("editorModal").classList.add("active");
}

document.getElementById("cancelQuestionBtn").onclick = () => {
  document.getElementById("editorModal").classList.remove("active");
};

document.getElementById("saveQuestionBtn").onclick = async () => {
  const { c, r } = editingCoords;
  const q = currentBoard.categories[c].questions[r];

  q.value = parseInt(document.getElementById("editValue").value) || 0;
  q.type = document.getElementById("editType").value;
  q.question = document.getElementById("editQuestionText").value;
  q.answer = document.getElementById("editAnswerText").value;

  if (q._editorButton) {
    const valueEl = q._editorButton.querySelector(".editorTileValue");
    const iconEl = q._editorButton.querySelector(".editorTileIcon");

    if (valueEl) {
      valueEl.textContent = "$" + q.value;
    }

    if (iconEl) {
      iconEl.className = getQuestionIconClass(q.type) + " editorTileIcon";
    }
  }

  q.type = document.getElementById("editType").value;
  q.question = document.getElementById("editQuestionText").value;
  q.answer = document.getElementById("editAnswerText").value;

  const files = document.getElementById("editMedia").files;

  if (files.length > 0) {
    q.media = [];
    for (let file of files) {
      const base64 = await fileToBase64(file);
      q.media.push(base64);
    }
  }

  document.getElementById("editorModal").classList.remove("active");

  saveLocal();
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

function saveBoard() {
  saveLocal();
  alert("Saved!");
}

/* ---------- PLAY MODE ---------- */

function buildBoard() {
  let table = document.getElementById("board");
  table.innerHTML = "";
  scoreboard.innerHTML = "";

  let header = document.createElement("tr");
  for (let c = 0; c < currentBoard.visibleCategories; c++) {
    let cat = currentBoard.categories[c];
    let th = document.createElement("th");
    th.textContent = cat.title;
    header.appendChild(th);
  }
  table.appendChild(header);

  let rows = currentBoard.visibleRows;
  for (let r = 0; r < rows; r++) {
    let tr = document.createElement("tr");
    for (let c = 0; c < currentBoard.visibleCategories; c++) {
      let cat = currentBoard.categories[c];
      let td = document.createElement("td");
      let q = cat.questions[r];
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

  questionModal.innerHTML = "";
  questionModal.classList.add("active");

  const content = document.createElement("div");

  if (q.type === "text") {
    content.innerHTML = `<h2>${q.question}</h2>`;
  }

  if (q.type === "video") {
    q.media.forEach((src) => {
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.style.maxWidth = "600px";
      video.style.marginBottom = "15px";
      content.appendChild(video);
    });
  }

  if (q.type === "audio") {
    q.media.forEach((src) => {
      const audio = document.createElement("audio");
      audio.src = src;
      audio.controls = true;
      audio.style.marginBottom = "15px";
      content.appendChild(audio);
    });
  }

  if (q.question && q.type !== "text") {
    const text = document.createElement("h2");
    text.textContent = q.question;
    content.appendChild(text);
  }

  questionModal.appendChild(content);

  const showAns = document.createElement("button");
  showAns.textContent = "Show Answer";
  showAns.onclick = () => {
    const ans = document.createElement("h3");
    ans.textContent = q.answer;
    questionModal.appendChild(ans);

    tile.classList.add("blank");
    tile.textContent = "";
  };

  questionModal.appendChild(showAns);

  const back = document.createElement("button");
  back.textContent = "Back to Board";
  back.onclick = () => {
    questionModal.classList.remove("active");
  };

  questionModal.appendChild(back);
}

function addTeam() {
  let teamDiv = document.createElement("div");
  teamDiv.className = "team";

  // Remove button
  let removeBtn = document.createElement("button");
  removeBtn.className = "removeTeamBtn";
  removeBtn.innerHTML = "<span>✕</span>";
  removeBtn.onclick = () => {
    teamDiv.remove();
  };

  // Editable name
  let name = document.createElement("h4");
  name.contentEditable = true;
  name.textContent = "";
  name.className = "teamName";

  // Auto-focus name after adding
  setTimeout(() => {
    name.focus();
  }, 0);

  // Score display
  let score = 0;
  let scoreDiv = document.createElement("div");
  scoreDiv.textContent = score;

  // Add/Subtract buttons
  let controls = document.createElement("div");
  controls.className = "teamControls";

  let addBtn = document.createElement("button");
  addBtn.innerHTML = "<span>+</span>";
  addBtn.onclick = () => {
    score += 100;
    scoreDiv.textContent = score;
  };

  let subBtn = document.createElement("button");
  subBtn.innerHTML = "<span>−</span>";
  subBtn.onclick = () => {
    score -= 100;
    scoreDiv.textContent = score;
  };

  controls.appendChild(addBtn);
  controls.appendChild(subBtn);

  teamDiv.appendChild(removeBtn);
  teamDiv.appendChild(name);
  teamDiv.appendChild(scoreDiv);
  teamDiv.appendChild(controls);

  scoreboard.appendChild(teamDiv);
}

function showFinal() {
  let q = currentBoard.final;
  alert("Final Jeopardy:\n" + q.question + "\nAnswer:\n" + q.answer);
}

/* ---------- IMPORT / EXPORT ---------- */

function exportBoard() {
  let name = boardSelect.value;
  let dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(boards[name]));
  let a = document.createElement("a");
  a.href = dataStr;
  a.download = name + ".json";
  a.click();
}

function importBoard(event) {
  let file = event.target.files[0];
  let reader = new FileReader();
  reader.onload = function (e) {
    let data = JSON.parse(e.target.result);
    let name = prompt("Name for imported board?");
    boards[name] = data;
    saveLocal();
    refreshDropdown();
  };
  reader.readAsText(file);
}

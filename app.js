let boards = JSON.parse(localStorage.getItem("jeopardyBoards") || "{}");
let currentBoard = null;
let currentQuestion = null;
let editingMedia = [];
let teams = [];

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
  document.getElementById("editHintCost").value = q.hintCost || 0;
  document.getElementById("editType").value = q.type;
  document.getElementById("editQuestionText").value = q.question;
  document.getElementById("editAnswerText").value = q.answer;

  editingMedia = [];

  if (q.media && Array.isArray(q.media)) {
    q.media.forEach((file) => {
      if (typeof file === "string") {
        let detectedType = "";

        if (file.startsWith("data:image")) detectedType = "image/*";
        else if (file.startsWith("data:audio")) detectedType = "audio/*";
        else if (file.startsWith("data:video")) detectedType = "video/*";

        editingMedia.push({
          name: "Imported File",
          type: detectedType,
          data: file,
        });
      } else if (typeof file === "object" && file.data) {
        editingMedia.push(file);
      }
    });
  }

  renderMediaPreview();

  document.getElementById("editMedia").value = "";

  document.getElementById("editorModal").classList.add("active");
}

document.getElementById("addMediaBtn").onclick = () => {
  document.getElementById("editMedia").click();
};

document.getElementById("editMedia").addEventListener("change", async (e) => {
  const files = e.target.files;

  for (let file of files) {
    const base64 = await fileToBase64(file);
    editingMedia.push({
      name: file.name,
      type: file.type,
      data: base64,
    });
  }

  renderMediaPreview();
  e.target.value = "";
});

function renderMediaPreview() {
  const container = document.getElementById("mediaPreviewList");
  container.innerHTML = "";

  editingMedia.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mediaItem";

    const previewWrapper = document.createElement("div");
    previewWrapper.className = "mediaPreviewWrapper";

    let preview;

    if (file.type.startsWith("image/")) {
      preview = document.createElement("img");
      preview.src = file.data;
    } else if (file.type.startsWith("audio/")) {
      preview = document.createElement("audio");
      preview.src = file.data;
      preview.controls = true;
    } else if (file.type.startsWith("video/")) {
      preview = document.createElement("video");
      preview.src = file.data;
      preview.controls = true;
    } else {
      preview = document.createElement("div");
      preview.textContent = file.name;
    }

    preview.className = "mediaPreview";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Optional label: $(hint) to insert hint cost";
    labelInput.value = file.label || "";
    labelInput.className = "mediaLabelInput";

    labelInput.addEventListener("input", () => {
      file.label = labelInput.value;
    });

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "<span>✕</span>";
    removeBtn.className = "removeMediaBtn";
    removeBtn.onclick = () => {
      editingMedia.splice(index, 1);
      renderMediaPreview();
    };

    previewWrapper.appendChild(preview);
    previewWrapper.appendChild(removeBtn);

    wrapper.appendChild(labelInput);
    wrapper.appendChild(previewWrapper);
    container.appendChild(wrapper);
  });
}

document.getElementById("cancelQuestionBtn").onclick = () => {
  document.getElementById("editorModal").classList.remove("active");
};

document.getElementById("saveQuestionBtn").onclick = async () => {
  const { c, r } = editingCoords;
  const q = currentBoard.categories[c].questions[r];

  q.value = parseInt(document.getElementById("editValue").value) || 0;
  q.hintCost = parseInt(document.getElementById("editHintCost").value) || 0;
  q.type = document.getElementById("editType").value;
  q.question = document.getElementById("editQuestionText").value;
  q.answer = document.getElementById("editAnswerText").value;

  q.media = [...editingMedia];

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
  const category = currentBoard.categories[c];

  questionModal.innerHTML = "";
  questionModal.classList.add("active");

  const content = document.createElement("div");
  content.className = "questionContent";

  /* --------------------------
     HEADER (Category + Value)
  -------------------------- */
  const header = document.createElement("h2");
  header.className = "questionHeader";
  header.textContent = `${category.title}  $${q.value}`;
  content.appendChild(header);

  /* --------------------------
     QUESTION TEXT (Always if exists)
  -------------------------- */
  if (q.question && q.question.trim() !== "") {
    const questionText = document.createElement("div");
    questionText.className = "questionText";
    questionText.textContent = q.question;
    content.appendChild(questionText);
  }

  /* --------------------------
     ANSWER (Hidden Initially)
  -------------------------- */
  const answerEl = document.createElement("div");
  answerEl.className = "questionAnswer";
  answerEl.classList.add("hiddenAnswer");
  answerEl.textContent = q.answer;
  content.appendChild(answerEl);

  /* --------------------------
     MEDIA (Below question/answer)
  -------------------------- */
  if (q.media && q.media.length > 0) {
    const mediaContainer = document.createElement("div");
    mediaContainer.className = "questionMedia";

    q.media.forEach((file) => {
      const fileData = typeof file === "string" ? file : file.data;
      const fileType = typeof file === "string" ? "" : file.type;
      const labelText =
        typeof file === "object" && file.label
          ? file.label.replace(/\$\(\s*hint\s*\)/gi, `$${q.hintCost || 0}`)
          : "";

      let element;

      if (fileType.startsWith("video/") || fileData.startsWith("data:video")) {
        element = document.createElement("video");
        element.controls = true;
        element.style.maxWidth = "80vw";
      } else if (
        fileType.startsWith("audio/") ||
        fileData.startsWith("data:audio")
      ) {
        element = document.createElement("audio");
        element.controls = true;
      } else if (
        fileType.startsWith("image/") ||
        fileData.startsWith("data:image")
      ) {
        element = document.createElement("img");
        element.style.maxWidth = "600px";
      }

      if (element) {
        element.src = fileData;

        // Wrap media and label
        const wrapper = document.createElement("div");
        wrapper.className = "questionMediaWrapper";
        
        wrapper.appendChild(element);

        // Add label if exists
        if (labelText.trim() !== "") {
          const labelEl = document.createElement("span");
          labelEl.textContent = labelText;
          labelEl.className = "questionMediaLabel";
          wrapper.appendChild(labelEl);
        }

        

        mediaContainer.appendChild(wrapper);
      }
    });

    content.appendChild(mediaContainer);
  }

  questionModal.appendChild(content);

  /* --------------------------
     BUTTON ROW
  -------------------------- */
  const buttonRow = document.createElement("div");
  buttonRow.className = "questionButtons";

  const showAns = document.createElement("button");
  showAns.textContent = "Show Answer";
  showAns.onclick = () => {
    answerEl.classList.add("visibleAnswer");

    tile.classList.add("blank");
    tile.textContent = "";
  };

  const back = document.createElement("button");
  back.textContent = "Back to Board";
  back.onclick = () => {
    questionModal.classList.remove("active");
  };

  buttonRow.appendChild(showAns);
  buttonRow.appendChild(back);

  questionModal.appendChild(buttonRow);
}

function addTeam() {
  let teamDiv = document.createElement("div");
  teamDiv.className = "team";

  let removeBtn = document.createElement("button");
  removeBtn.className = "removeTeamBtn";
  removeBtn.innerHTML = "<span>✕</span>";
  removeBtn.onclick = () => {
    teamDiv.remove();
    teams = teams.filter((t) => t.div !== teamDiv);
  };

  let name = document.createElement("h4");
  name.contentEditable = true;
  name.textContent = "";
  name.className = "teamName";
  setTimeout(() => name.focus(), 0);

  let scoreDiv = document.createElement("div");
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

  let controls = document.createElement("div");
  controls.className = "teamControls";

  let addBtn = document.createElement("button");
  addBtn.innerHTML = "<span>+</span>";
  addBtn.className = "teamAddBtn";
  addBtn.onclick = () => {
    team.score += getLastQuestionValue();
    updateScoreboard();
  };

  let subBtn = document.createElement("button");
  subBtn.innerHTML = "<span>−</span>";
  subBtn.className = "teamSubBtn";
  subBtn.onclick = () => {
    team.score -= getLastQuestionValue();
    updateScoreboard();
  };

  const hintBtn = document.createElement("button");
  hintBtn.innerHTML = "<span>?</span>";
  hintBtn.className = "teamHintBtn";
  hintBtn.onclick = () => {
    if (!currentQuestion) return;

    const { c, r } = currentQuestion;
    const q = currentBoard.categories[c].questions[r];
    const cost = q.hintCost || 0;

    team.score -= cost;
    updateScoreboard();
  };

  controls.appendChild(addBtn);
  controls.appendChild(subBtn);
  controls.appendChild(hintBtn);

  teamDiv.appendChild(removeBtn);
  teamDiv.appendChild(name);
  teamDiv.appendChild(scoreDiv);
  teamDiv.appendChild(controls);

  scoreboard.appendChild(teamDiv);

  teams.push(team);
}

function updateScoreboard() {
  teams.forEach((team) => {
    team.scoreDiv.textContent = team.score;
  });
}

function getLastQuestionValue() {
  if (!currentQuestion) return 0;

  const { c, r } = currentQuestion;
  const q = currentBoard.categories[c].questions[r];

  return q.value || 0;
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

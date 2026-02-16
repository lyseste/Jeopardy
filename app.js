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
    boardSelect.innerHTML="";
    for(let name in boards){
        let opt = document.createElement("option");
        opt.value=name;
        opt.textContent=name;
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

document.querySelectorAll(".backBtn").forEach(btn=>{
    btn.onclick = backToMenu;
});

/* ---------- BOARD MANAGEMENT ---------- */

function createBoard(){
    let name = prompt("Board name?");
    if(!name) return;
    boards[name] = {categories:[], final:null};
    saveLocal();
    refreshDropdown();
}

function deleteBoard(){
    let name = boardSelect.value;
    if(confirm("Delete board?")){
        delete boards[name];
        saveLocal();
        refreshDropdown();
    }
}

function editBoard(){
    let name = boardSelect.value;
    if(!name) return;
    currentBoard = boards[name];
    mainMenu.classList.add("hidden");
    editor.classList.remove("hidden");
}

function playBoard(){
    let name = boardSelect.value;
    currentBoard = boards[name];
    mainMenu.classList.add("hidden");
    playMode.classList.remove("hidden");
    buildBoard();
}

function backToMenu(){
    editor.classList.add("hidden");
    playMode.classList.add("hidden");
    mainMenu.classList.remove("hidden");
}

/* ---------- EDITOR ---------- */

function generateGrid(){
    let cats = document.getElementById("catCount").value;
    let rows = document.getElementById("rowCount").value;
    currentBoard.categories = [];
    let grid = document.getElementById("editorGrid");
    grid.innerHTML="";

    for(let c=0;c<cats;c++){
        let category = {title:"Category "+(c+1), questions:[]};
        currentBoard.categories.push(category);

        let div = document.createElement("div");
        div.innerHTML=`<h3 contenteditable>${category.title}</h3>`;

        for(let r=0;r<rows;r++){
            let q = {value:(r+1)*100, type:"text", question:"", answer:"", media:[]};
            category.questions.push(q);

            let btn = document.createElement("button");
            btn.textContent="$"+q.value;
            btn.onclick=()=>editQuestion(c,r);
            div.appendChild(btn);
        }
        grid.appendChild(div);
    }

    currentBoard.final = {type:"text", question:"", answer:"", media:[]};
}

function editQuestion(c,r){
    let q = currentBoard.categories[c].questions[r];
    let text = prompt("Question text:", q.question);
    if(text!==null) q.question=text;
    let ans = prompt("Answer:", q.answer);
    if(ans!==null) q.answer=ans;
}

function saveBoard(){
    saveLocal();
    alert("Saved!");
}

/* ---------- PLAY MODE ---------- */

function buildBoard(){
    let table = document.getElementById("board");
    table.innerHTML="";
    scoreboard.innerHTML="";

    let header = document.createElement("tr");
    currentBoard.categories.forEach(cat=>{
        let th = document.createElement("th");
        th.textContent = cat.title;
        header.appendChild(th);
    });
    table.appendChild(header);

    let rows = currentBoard.categories[0].questions.length;
    for(let r=0;r<rows;r++){
        let tr = document.createElement("tr");
        currentBoard.categories.forEach((cat,c)=>{
            let td = document.createElement("td");
            let q = cat.questions[r];
            td.textContent = "$"+q.value;
            td.className="tile";
            td.onclick=()=>openQuestion(c,r,td);
            tr.appendChild(td);
        });
        table.appendChild(tr);
    }
}

function openQuestion(c,r,tile){
    currentQuestion = {c,r,tile};
    let q = currentBoard.categories[c].questions[r];

    questionModal.innerHTML="";
    questionModal.classList.add("active");

    questionModal.innerHTML += `<h2>${q.question}</h2>`;

    let showAns = document.createElement("button");
    showAns.textContent="Show Answer";
    showAns.onclick=()=>{
        questionModal.innerHTML += `<h3>${q.answer}</h3>`;
        tile.classList.add("blank");
        tile.textContent="";
    };
    questionModal.appendChild(showAns);

    let back=document.createElement("button");
    back.textContent="Back";
    back.onclick=()=>questionModal.classList.remove("active");
    questionModal.appendChild(back);
}

function addTeam(){
    let name = prompt("Team name?");
    if(!name) return;

    let teamDiv=document.createElement("div");
    teamDiv.className="team";
    teamDiv.innerHTML=`<h4 contenteditable>${name}</h4><div>0</div>`;
    let score=0;
    let scoreDiv=teamDiv.querySelector("div");

    let add=document.createElement("button");
    add.textContent="+";
    add.onclick=()=>{score+=100;scoreDiv.textContent=score};

    let sub=document.createElement("button");
    sub.textContent="-";
    sub.onclick=()=>{score-=100;scoreDiv.textContent=score};

    teamDiv.appendChild(add);
    teamDiv.appendChild(sub);
    scoreboard.appendChild(teamDiv);
}

function showFinal(){
    let q=currentBoard.final;
    alert("Final Jeopardy:\n"+q.question+"\nAnswer:\n"+q.answer);
}

/* ---------- IMPORT / EXPORT ---------- */

function exportBoard(){
    let name=boardSelect.value;
    let dataStr="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(boards[name]));
    let a=document.createElement("a");
    a.href=dataStr;
    a.download=name+".json";
    a.click();
}

function importBoard(event){
    let file=event.target.files[0];
    let reader=new FileReader();
    reader.onload=function(e){
        let data=JSON.parse(e.target.result);
        let name=prompt("Name for imported board?");
        boards[name]=data;
        saveLocal();
        refreshDropdown();
    }
    reader.readAsText(file);
}

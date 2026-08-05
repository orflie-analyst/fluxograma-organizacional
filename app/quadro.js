import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  setDoc,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { requireAuth, renderTopbar } from "./auth.js";
import { clear, el } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CHAVE_QUADRO_ATIVO = "fluxograma_quadro_ativo";

const ROTULOS_PROMPT = {
  conta: "Nome da conta/empresa:",
  sdr: "Nome do SDR:",
  bdr: "Nome do BDR:",
  closer: "Nome do Closer:",
};

let quadrosCache = [];
let quadroAtualId = null;
let quadroInscritoId = null;
let unsubQuadroAtual = null;

let estado = { nos: [], conexoes: [] };
let selecionado = null;
let arrastando = false;
let elementosPorId = {};

requireAuth(async (user, perfil) => {
  renderTopbar("quadro.html", perfil);

  document.getElementById("btn-add-conta").addEventListener("click", () => adicionarNo("conta"));
  document.getElementById("btn-add-sdr").addEventListener("click", () => adicionarNo("sdr"));
  document.getElementById("btn-add-bdr").addEventListener("click", () => adicionarNo("bdr"));
  document.getElementById("btn-add-closer").addEventListener("click", () => adicionarNo("closer"));

  const q = query(collection(db, "quadros"), orderBy("criadoEm", "asc"));
  onSnapshot(q, async (snap) => {
    quadrosCache = snap.docs.map((d) => ({ id: d.id, nome: d.data().nome || "Sem nome" }));

    if (quadrosCache.length === 0) {
      const novo = await addDoc(collection(db, "quadros"), {
        nome: "Quadro 1",
        nos: [],
        conexoes: [],
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      quadroAtualId = novo.id;
      return; // o próprio addDoc vai disparar este onSnapshot de novo
    }

    if (!quadroAtualId || !quadrosCache.some((q2) => q2.id === quadroAtualId)) {
      const salvo = localStorage.getItem(CHAVE_QUADRO_ATIVO);
      quadroAtualId = quadrosCache.some((q2) => q2.id === salvo) ? salvo : quadrosCache[0].id;
    }

    renderAbas();
    garantirInscricaoQuadroAtual();
  });
});

function garantirInscricaoQuadroAtual() {
  if (quadroInscritoId === quadroAtualId) return;
  quadroInscritoId = quadroAtualId;

  if (unsubQuadroAtual) unsubQuadroAtual();
  selecionado = null;
  const ref = doc(db, "quadros", quadroAtualId);
  unsubQuadroAtual = onSnapshot(ref, (snap) => {
    const dados = snap.data() || {};
    estado = { nos: dados.nos || [], conexoes: dados.conexoes || [] };
    if (!arrastando) renderQuadro();
  });
}

function selecionarQuadro(id) {
  if (id === quadroAtualId) return;
  quadroAtualId = id;
  localStorage.setItem(CHAVE_QUADRO_ATIVO, id);
  renderAbas();
  garantirInscricaoQuadroAtual();
}

async function novoQuadro() {
  const nome = window.prompt("Nome do novo quadro:");
  if (!nome || !nome.trim()) return;
  const ref = await addDoc(collection(db, "quadros"), {
    nome: nome.trim(),
    nos: [],
    conexoes: [],
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  selecionarQuadro(ref.id);
}

async function renomearQuadro(id, nomeAtual) {
  const nome = window.prompt("Novo nome do quadro:", nomeAtual);
  if (!nome || !nome.trim() || nome.trim() === nomeAtual) return;
  await updateDoc(doc(db, "quadros", id), { nome: nome.trim() });
}

async function excluirQuadro(id) {
  if (quadrosCache.length <= 1) {
    window.alert("Esse é o único quadro — crie outro antes de excluir este.");
    return;
  }
  const alvo = quadrosCache.find((q2) => q2.id === id);
  if (!window.confirm(`Excluir o quadro "${alvo?.nome}" definitivamente? Essa ação não pode ser desfeita.`)) return;
  await deleteDoc(doc(db, "quadros", id));
  if (id === quadroAtualId) {
    const restantes = quadrosCache.filter((q2) => q2.id !== id);
    if (restantes.length > 0) selecionarQuadro(restantes[0].id);
  }
}

function renderAbas() {
  const container = document.getElementById("quadro-abas");
  clear(container);

  for (const q2 of quadrosCache) {
    const btnRemover = el(
      "button",
      {
        class: "btn-remover-aba",
        type: "button",
        title: "Excluir quadro",
        onclick: (e) => {
          e.stopPropagation();
          excluirQuadro(q2.id);
        },
      },
      "×"
    );
    const aba = el(
      "button",
      {
        class: `aba-quadro${q2.id === quadroAtualId ? " ativa" : ""}`,
        type: "button",
        onclick: () => selecionarQuadro(q2.id),
        ondblclick: (e) => {
          e.stopPropagation();
          renomearQuadro(q2.id, q2.nome);
        },
      },
      [q2.nome, btnRemover]
    );
    container.appendChild(aba);
  }

  container.appendChild(
    el("button", { class: "aba-nova", type: "button", title: "Novo quadro", onclick: novoQuadro }, "+")
  );
}

function adicionarNo(tipo) {
  const rotulo = window.prompt(ROTULOS_PROMPT[tipo] || "Nome:");
  if (!rotulo || !rotulo.trim()) return;
  estado.nos.push({
    id: crypto.randomUUID(),
    tipo,
    label: rotulo.trim(),
    x: 40 + Math.round(Math.random() * 120),
    y: 40 + Math.round(Math.random() * 120),
  });
  salvarEstado();
  renderQuadro();
}

function removerNo(id) {
  estado.nos = estado.nos.filter((n) => n.id !== id);
  estado.conexoes = estado.conexoes.filter((c) => c.deId !== id && c.paraId !== id);
  if (selecionado === id) selecionado = null;
  salvarEstado();
  renderQuadro();
}

function selecionarOuConectar(id) {
  if (!selecionado) {
    selecionado = id;
    renderQuadro();
    return;
  }
  if (selecionado === id) {
    selecionado = null;
    renderQuadro();
    return;
  }
  const existente = estado.conexoes.find(
    (c) => (c.deId === selecionado && c.paraId === id) || (c.deId === id && c.paraId === selecionado)
  );
  if (existente) {
    estado.conexoes = estado.conexoes.filter((c) => c.id !== existente.id);
  } else {
    estado.conexoes.push({ id: crypto.randomUUID(), deId: selecionado, paraId: id });
  }
  selecionado = null;
  salvarEstado();
  renderQuadro();
}

async function salvarEstado() {
  if (!quadroAtualId) return;
  await setDoc(
    doc(db, "quadros", quadroAtualId),
    { nos: estado.nos, conexoes: estado.conexoes, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}

function renderQuadro() {
  const canvas = document.getElementById("quadro-canvas");
  canvas.querySelectorAll(".no").forEach((n) => n.remove());
  elementosPorId = {};

  for (const no of estado.nos) {
    const btnRemover = el(
      "button",
      {
        class: "btn-remover",
        type: "button",
        onclick: (e) => {
          e.stopPropagation();
          removerNo(no.id);
        },
      },
      "×"
    );
    const classeSelecionado = selecionado === no.id ? " selecionado" : "";
    const nodeEl = el(
      "div",
      { class: `no ${no.tipo}${classeSelecionado}`, style: `left:${no.x}px; top:${no.y}px;` },
      [no.label, btnRemover]
    );
    configurarArrasto(nodeEl, no);
    elementosPorId[no.id] = nodeEl;
    canvas.appendChild(nodeEl);
  }

  desenharConexoes();
}

function configurarArrasto(nodeEl, no) {
  nodeEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".btn-remover")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = no.x;
    const origY = no.y;
    let moveu = false;
    arrastando = true;
    nodeEl.setPointerCapture(e.pointerId);

    function aoMover(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moveu = true;
      no.x = origX + dx;
      no.y = origY + dy;
      nodeEl.style.left = `${no.x}px`;
      nodeEl.style.top = `${no.y}px`;
      desenharConexoes();
    }

    function aoSoltar() {
      nodeEl.releasePointerCapture(e.pointerId);
      nodeEl.removeEventListener("pointermove", aoMover);
      nodeEl.removeEventListener("pointerup", aoSoltar);
      arrastando = false;
      if (moveu) {
        salvarEstado();
      } else {
        selecionarOuConectar(no.id);
      }
    }

    nodeEl.addEventListener("pointermove", aoMover);
    nodeEl.addEventListener("pointerup", aoSoltar);
  });
}

function centroDoNo(no) {
  const elNo = elementosPorId[no.id];
  const largura = elNo ? elNo.offsetWidth : 120;
  const altura = elNo ? elNo.offsetHeight : 40;
  return { x: no.x + largura / 2, y: no.y + altura / 2 };
}

function desenharConexoes() {
  const svg = document.getElementById("svg-conexoes");
  clear(svg);
  for (const c of estado.conexoes) {
    const de = estado.nos.find((n) => n.id === c.deId);
    const para = estado.nos.find((n) => n.id === c.paraId);
    if (!de || !para) continue;
    const p1 = centroDoNo(de);
    const p2 = centroDoNo(para);
    const linha = document.createElementNS(SVG_NS, "line");
    linha.setAttribute("x1", p1.x);
    linha.setAttribute("y1", p1.y);
    linha.setAttribute("x2", p2.x);
    linha.setAttribute("y2", p2.y);
    svg.appendChild(linha);
  }
}

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { requireAuth, renderTopbar } from "./auth.js";
import { clear, el } from "./dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const quadroRef = doc(db, "quadro", "principal");

let estado = { nos: [], conexoes: [] };
let selecionado = null;
let arrastando = false;
let elementosPorId = {};

requireAuth(async (user, perfil) => {
  renderTopbar("quadro.html", perfil);

  document.getElementById("btn-add-conta").addEventListener("click", () => adicionarNo("conta"));
  document.getElementById("btn-add-operador").addEventListener("click", () => adicionarNo("operador"));

  onSnapshot(quadroRef, (snap) => {
    const dados = snap.data() || {};
    estado = { nos: dados.nos || [], conexoes: dados.conexoes || [] };
    if (!arrastando) renderQuadro();
  });
});

function adicionarNo(tipo) {
  const rotulo = window.prompt(tipo === "conta" ? "Nome da conta/empresa:" : "Nome do operador:");
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
  await setDoc(quadroRef, {
    nos: estado.nos,
    conexoes: estado.conexoes,
    atualizadoEm: serverTimestamp(),
  });
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

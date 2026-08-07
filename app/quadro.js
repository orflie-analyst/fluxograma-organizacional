import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
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

// Categorias padrão, usadas só pra migrar o doc antigo (config/categorias no
// formato {conta: "Conta", ...}) pra uma lista de categorias com cor própria,
// e como fallback caso o doc ainda não exista.
const CATEGORIAS_PADRAO = [
  { id: "conta", nome: "Conta", cor: "#f5821f" },
  { id: "sdr", nome: "SDR", cor: "#3b82f6" },
  { id: "bdr", nome: "BDR", cor: "#a78bfa" },
  { id: "closer", nome: "Closer", cor: "#22c55e" },
];

// Cores sugeridas pra categorias novas — escolhe a primeira ainda não usada.
const PALETA_CORES = [
  "#f5821f",
  "#3b82f6",
  "#a78bfa",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
];

let categorias = CATEGORIAS_PADRAO;

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

  renderToolbar();
  renderLegenda();

  onSnapshot(doc(db, "config", "categorias"), (snap) => {
    const dados = snap.data();
    if (dados && Array.isArray(dados.lista)) {
      categorias = dados.lista;
    } else {
      // Doc antigo (formato chave->nome) ou inexistente: migra pro novo formato,
      // preservando qualquer nome já customizado.
      const antigas = dados || {};
      categorias = CATEGORIAS_PADRAO.map((c) => ({ ...c, nome: antigas[c.id] || c.nome }));
      setDoc(doc(db, "config", "categorias"), { lista: categorias });
    }
    renderToolbar();
    renderLegenda();
    renderQuadro();
  });

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

function renderToolbar() {
  const container = document.getElementById("quadro-toolbar");
  clear(container);
  for (const cat of categorias) {
    container.appendChild(
      el(
        "button",
        { class: "btn-no-tipo", type: "button", onclick: () => adicionarNo(cat.id) },
        [el("span", { class: "swatch", style: `background:${cat.cor};` }), `+ ${cat.nome}`]
      )
    );
  }
}

function renderLegenda() {
  const container = document.getElementById("legenda-lista");
  clear(container);
  for (const cat of categorias) {
    const btnRemover = el(
      "button",
      {
        class: "btn-remover-aba",
        type: "button",
        title: "Excluir categoria",
        onclick: (e) => {
          e.stopPropagation();
          excluirCategoria(cat.id, cat.nome);
        },
      },
      "×"
    );
    container.appendChild(
      el(
        "div",
        { class: "legenda-item", title: "Duplo clique pra renomear" },
        [
          el("span", { class: "swatch", style: `background:${cat.cor};` }),
          el(
            "span",
            { ondblclick: (e) => { e.stopPropagation(); renomearCategoria(cat.id, cat.nome); } },
            cat.nome
          ),
          btnRemover,
        ]
      )
    );
  }
  container.appendChild(
    el("button", { class: "aba-nova", type: "button", title: "Nova categoria", onclick: novaCategoria }, "+")
  );
}

async function salvarCategorias(novaLista) {
  categorias = novaLista;
  await setDoc(doc(db, "config", "categorias"), { lista: novaLista });
}

async function novaCategoria() {
  const nome = window.prompt("Nome da nova categoria:");
  if (!nome || !nome.trim()) return;
  const corUsada = new Set(categorias.map((c) => c.cor));
  const cor = PALETA_CORES.find((c) => !corUsada.has(c)) || PALETA_CORES[categorias.length % PALETA_CORES.length];
  await salvarCategorias([...categorias, { id: crypto.randomUUID(), nome: nome.trim(), cor }]);
}

async function renomearCategoria(id, nomeAtual) {
  const novo = window.prompt("Novo nome pra essa categoria:", nomeAtual);
  if (!novo || !novo.trim() || novo.trim() === nomeAtual) return;
  await salvarCategorias(categorias.map((c) => (c.id === id ? { ...c, nome: novo.trim() } : c)));
}

async function excluirCategoria(id, nome) {
  if (categorias.length <= 1) {
    window.alert("Precisa manter pelo menos uma categoria.");
    return;
  }
  const todosQuadros = await getDocs(collection(db, "quadros"));
  const emUso = todosQuadros.docs.some((d) => (d.data().nos || []).some((n) => n.tipo === id));
  if (emUso) {
    window.alert(
      `Não dá pra excluir "${nome}" — ainda tem item(ns) usando essa categoria em algum quadro. Renomeie ou exclua esses itens primeiro.`
    );
    return;
  }
  if (!window.confirm(`Excluir a categoria "${nome}"?`)) return;
  await salvarCategorias(categorias.filter((c) => c.id !== id));
}

function adicionarNo(tipo) {
  const cat = categorias.find((c) => c.id === tipo);
  const rotulo = window.prompt(`Nome do novo item (${cat?.nome || "categoria"}):`);
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

async function renomearNo(id, labelAtual) {
  const novoLabel = window.prompt("Novo nome:", labelAtual);
  if (!novoLabel || !novoLabel.trim() || novoLabel.trim() === labelAtual) return;
  const no = estado.nos.find((n) => n.id === id);
  if (!no) return;
  no.label = novoLabel.trim();
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

function hexParaRgba(hex, alpha) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderQuadro() {
  const canvas = document.getElementById("quadro-canvas");
  canvas.querySelectorAll(".no").forEach((n) => n.remove());
  elementosPorId = {};

  for (const no of estado.nos) {
    const cat = categorias.find((c) => c.id === no.tipo);
    const cor = cat?.cor || "#888888";
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
      {
        class: `no${classeSelecionado}`,
        style: `left:${no.x}px; top:${no.y}px; --cor-categoria:${cor}; --fundo-categoria:${hexParaRgba(cor, 0.15)};`,
        ondblclick: (e) => {
          e.stopPropagation();
          renomearNo(no.id, no.label);
        },
      },
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

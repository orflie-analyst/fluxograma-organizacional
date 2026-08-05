import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db, getAdminCreationApp } from "./firebase-init.js";
import { requireAuth, renderTopbar } from "./auth.js";
import { clear, el } from "./dom.js";

requireAuth(async (user, perfil) => {
  renderTopbar("admin.html", perfil);

  if (!perfil.isAdmin) {
    const conteudo = document.getElementById("conteudo");
    clear(conteudo);
    conteudo.appendChild(
      el("div", { class: "card" }, el("p", { class: "aviso-vazio" }, "Você não tem permissão para acessar esta página."))
    );
    return;
  }

  await carregarUsuarios();
  configurarFormUsuario();
  configurarFormEditarUsuario();
});

async function carregarUsuarios() {
  const tbody = document.querySelector("#tabela-usuarios tbody");
  clear(tbody);
  const snap = await getDocs(query(collection(db, "usuarios"), orderBy("nome")));
  snap.forEach((u) => {
    const dados = u.data();
    tbody.appendChild(
      el("tr", {}, [
        el("td", {}, dados.nome),
        el("td", {}, dados.email),
        el("td", {}, dados.isAdmin ? "Sim" : "Não"),
        el("td", {}, dados.ativo === false ? "Inativo" : "Ativo"),
        el(
          "td",
          {},
          el(
            "button",
            { class: "btn secondary", type: "button", onclick: () => abrirEdicaoUsuario(u.id, dados) },
            "Editar"
          )
        ),
      ])
    );
  });
}

function configurarFormUsuario() {
  const form = document.getElementById("form-usuario");
  const erro = document.getElementById("erro-usuario");
  const sucesso = document.getElementById("sucesso-usuario");
  const btn = document.getElementById("btn-criar-usuario");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.classList.add("hidden");
    sucesso.classList.add("hidden");

    const nome = document.getElementById("u-nome").value.trim();
    const email = document.getElementById("u-email").value.trim();
    const senha = document.getElementById("u-senha").value;
    const isAdmin = document.getElementById("u-admin").checked;

    if (!nome || !email || senha.length < 6) return;

    btn.disabled = true;
    btn.textContent = "Criando...";

    // Instância separada do Firebase App só pra não substituir a sessão do admin logado.
    const secondaryApp = getAdminCreationApp();
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nome,
        email,
        isAdmin,
        ativo: true,
        criadoEm: serverTimestamp(),
      });
      await signOut(secondaryAuth);

      form.reset();
      sucesso.textContent = `Usuário "${nome}" criado. Repasse o email e a senha inicial a ele.`;
      sucesso.classList.remove("hidden");
      await carregarUsuarios();
    } catch (err) {
      erro.textContent =
        err.code === "auth/email-already-in-use"
          ? "Já existe uma conta com esse email."
          : "Não foi possível criar o usuário.";
      erro.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Criar usuário";
    }
  });
}

let uidEmEdicao = null;

function abrirEdicaoUsuario(uid, dados) {
  uidEmEdicao = uid;

  document.getElementById("editar-usuario-email").textContent = dados.email;
  document.getElementById("e-nome").value = dados.nome || "";
  document.getElementById("e-admin").checked = !!dados.isAdmin;
  document.getElementById("e-ativo").checked = dados.ativo !== false;

  document.getElementById("erro-editar-usuario").classList.add("hidden");
  const card = document.getElementById("card-editar-usuario");
  card.classList.remove("hidden");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fecharEdicaoUsuario() {
  uidEmEdicao = null;
  document.getElementById("card-editar-usuario").classList.add("hidden");
}

function configurarFormEditarUsuario() {
  const form = document.getElementById("form-editar-usuario");
  const erro = document.getElementById("erro-editar-usuario");
  const btn = document.getElementById("btn-salvar-usuario");

  document.getElementById("btn-cancelar-edicao").addEventListener("click", fecharEdicaoUsuario);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!uidEmEdicao) return;
    erro.classList.add("hidden");

    const nome = document.getElementById("e-nome").value.trim();
    if (!nome) return;
    const isAdmin = document.getElementById("e-admin").checked;
    const ativo = document.getElementById("e-ativo").checked;

    btn.disabled = true;
    btn.textContent = "Salvando...";
    try {
      await updateDoc(doc(db, "usuarios", uidEmEdicao), { nome, isAdmin, ativo });
      fecharEdicaoUsuario();
      await carregarUsuarios();
    } catch (err) {
      erro.textContent = "Não foi possível salvar as alterações.";
      erro.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar";
    }
  });
}

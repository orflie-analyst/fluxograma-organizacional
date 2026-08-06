import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { el } from "./dom.js";

export function login(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

export function logout() {
  return signOut(auth);
}

// Troca a própria senha do usuário logado. Exige a senha atual porque o Firebase
// só permite updatePassword logo após uma autenticação "recente" — reautentica
// primeiro pra funcionar mesmo com a sessão aberta há horas.
export async function trocarSenha(senhaAtual, novaSenha) {
  const user = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, senhaAtual);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, novaSenha);
}

// Chama callback(user, perfil) quando autenticado; redireciona pra index.html se não estiver.
// Contas só são criadas por um admin (sem auto-cadastro) — ver admin.html.
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists() || snap.data().ativo === false) {
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }
    callback(user, snap.data());
  });
}

// Redireciona pra quadro.html se já estiver logado (usado em index.html).
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (snap.exists() && snap.data().ativo !== false) {
      window.location.href = "quadro.html";
    }
  });
}

export function renderTopbar(activePage, perfil) {
  const links = [{ href: "quadro.html", label: "Quadro" }];
  if (perfil.isAdmin) links.push({ href: "admin.html", label: "Administração" });
  links.push({ href: "conta.html", label: "Minha Conta" });

  const nav = el("nav", {}, [
    el("a", { href: "https://orflie-analyst.github.io/central/" }, "← Central"),
    ...links.map((l) =>
      el("a", { href: l.href, class: l.href === activePage ? "active" : "" }, l.label)
    ),
  ]);
  nav.appendChild(el("span", { id: "usuario-nome" }, perfil.nome || ""));
  nav.appendChild(
    el("button", { class: "link-btn", type: "button", onclick: () => logout().then(() => (window.location.href = "index.html")) }, "Sair")
  );

  const brand = el("a", { href: "quadro.html", class: "brand" }, [
    el("img", { src: "assets/orflie-logo.png", alt: "Orflie" }),
    el("span", {}, "Fluxograma Organizacional"),
  ]);

  const header = el("header", { class: "topbar" }, [brand, nav]);
  document.body.insertBefore(header, document.body.firstChild);
}

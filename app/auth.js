import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
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

  const nav = el(
    "nav",
    {},
    links.map((l) =>
      el("a", { href: l.href, class: l.href === activePage ? "active" : "" }, l.label)
    )
  );
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

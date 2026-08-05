import { requireAuth, renderTopbar, trocarSenha } from "./auth.js";

requireAuth(async (user, perfil) => {
  renderTopbar("conta.html", perfil);
  document.getElementById("conta-email").textContent = `Email: ${user.email}`;

  const form = document.getElementById("form-senha");
  const erro = document.getElementById("erro-senha");
  const sucesso = document.getElementById("sucesso-senha");
  const btn = document.getElementById("btn-trocar-senha");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.classList.add("hidden");
    sucesso.classList.add("hidden");

    const senhaAtual = document.getElementById("senha-atual").value;
    const novaSenha = document.getElementById("senha-nova").value;
    const novaSenha2 = document.getElementById("senha-nova2").value;

    if (novaSenha !== novaSenha2) {
      erro.textContent = "As senhas não coincidem.";
      erro.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Salvando...";
    try {
      await trocarSenha(senhaAtual, novaSenha);
      form.reset();
      sucesso.classList.remove("hidden");
    } catch (err) {
      erro.textContent =
        err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
          ? "Senha atual incorreta."
          : "Não foi possível trocar a senha.";
      erro.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar nova senha";
    }
  });
});

# Fluxograma Organizacional — Orflie

Quadro interativo pra reuniões de diretoria: caixas de "Conta" (empresa cliente) e
"Operador" que se arrastam e conectam, mostrando quem atende qual conta. Substitui o
Excel/papel que o diretor usava antes. Leia este arquivo primeiro ao retomar o trabalho.

Projeto irmão do [ServiceOrder](../ServiceOrder/CONTEXT.md) — mesma stack e boa parte
do código reaproveitados de lá (`app/dom.js`, `style.css`/logo, padrão de `auth.js` e
`admin.html`), mas é um repositório e um projeto Firebase **separados**.

## Stack

- Firebase Auth (email/senha) + Firestore. **Sem auto-cadastro** — diferente do
  ServiceOrder, aqui só o admin cria contas (o quadro mostra estrutura organizacional,
  decisão deliberada por ser mais sensível).
- Site estático (HTML/CSS/JS módulo, sem build) publicado no GitHub Pages.

## Contas

- **GitHub**: repo `orflie-analyst/fluxograma-organizacional`, mesma conta usada no
  ServiceOrder (já com acesso admin).
- **Firebase**: projeto próprio (ver `.firebaserc`), na conta Google
  `arnaldo.hungria@orflie.com` — separado do `orflie-serviceorder` de propósito, pra
  manter regras/dados de cada app isolados (mesmo padrão dos projetos irmãos DojoPass).

## Modelo de dados (Firestore)

- `usuarios/{uid}`: `nome`, `email`, `isAdmin`, `ativo`. Sem conceito de departamento
  — todo usuário com conta pode editar o quadro igualmente.
- `quadro/principal` — **documento único, compartilhado** (não uma coleção):
  - `nos`: array de `{id, tipo: 'conta' | 'operador', label, x, y}`
  - `conexoes`: array de `{id, deId, paraId}`
  - `atualizadoEm`

  Deliberadamente um doc só pra v1 (dezenas de nós cabem tranquilo no limite de 1MiB
  por doc do Firestore). Se um dia precisar de múltiplos quadros (por unidade de
  negócio, por exemplo), migrar pra uma coleção `quadros/{quadroId}` sem quebrar o
  formato interno de `nos`/`conexoes`.

## Regras de segurança

`usuarios`: só admin cria/gerencia (sem `autoCadastroValido`, não existe aqui).
`quadro/{docId}`: leitura/escrita liberada pra qualquer usuário autenticado e `ativo` —
sem granularidade por usuário, já que o admin curou quem tem conta.

## Páginas

- `index.html` — login (sem opção de criar conta).
- `quadro.html` — o quadro em si: toolbar "+ Conta"/"+ Operador" (usa `prompt()` pro
  nome), nós arrastáveis (`<div>` posicionados em absoluto via `pointerdown`/
  `pointermove`/`pointerup`, sem lib externa), conectar clicando em dois nós em
  sequência (toggle), excluir via botão "×" no nó. `<svg>` sobreposto desenha as
  linhas entre os centros dos nós conectados, recalculado a cada mudança de posição.
  Autosave (grava o doc inteiro a cada mutação, sem botão "Salvar") + `onSnapshot`
  pra sincronizar em tempo real entre abas/dispositivos abertos.
- `admin.html` — CRUD de usuário (criar + editar nome/isAdmin/ativo), sem seção de
  departamentos (não existe aqui).

## Gotchas conhecidos (herdados do ServiceOrder, aplicam aqui também)

- **XSS**: nunca `innerHTML` com dado de usuário — sempre `createElement`/`textContent`
  (o helper `el()` em `app/dom.js` já faz isso por padrão).
- **Criação de usuário sem apagar sessão do admin**: `admin.html` usa uma segunda
  instância nomeada do Firebase App (`getAdminCreationApp()`).
- **Regras do Firestore vs. UI**: qualquer permissão nova tem que ser reforçada em
  `firestore.rules`, não só escondida na UI.
- **Cache do GitHub Pages**: assets servem `Cache-Control: max-age=600` — depois de
  um deploy, um navegador que já visitou o site pode continuar servindo `.js`/`.css`
  antigos por até 10 min mesmo com reload forçado. Pra verificar uma mudança recém-
  publicada sem esperar, importar o módulo com `?v=` cache-buster ou usar `curl`
  direto confirma o que já está na origem.

## Decisão de design: seleção vs. arrasto no quadro

O mesmo gesto de clique no nó serve pra duas coisas: mover (arrastar) ou selecionar/
conectar (clicar sem mover). `configurarArrasto()` em `app/quadro.js` distingue pelos
`pointermove` recebidos entre o `pointerdown` e o `pointerup`: se o cursor se moveu
mais que ~4px, conta como arrasto (salva a nova posição); se não moveu, conta como
clique (abre/fecha seleção, ou cria/remove uma conexão se já havia um nó selecionado).
O botão "×" de excluir precisa ignorar esse fluxo (`e.target.closest('.btn-remover')`
no início do `pointerdown`), senão clicar nele também dispararia a seleção do nó.

## Limitação conhecida (aceita pra v1)

Se dois usuários editarem o quadro ao mesmo tempo e uma atualização remota chegar
*durante* um arrasto local em andamento, a posição arrastada localmente pode ser
perdida (a atualização remota substitui `estado` inteiro). Baixo risco na prática —
só 1-2 pessoas devem ter conta aqui — mas não é uma resolução de conflito de verdade.

## Status (2026-08-05)

**No ar e funcional**, testado ponta a ponta em produção:
- GitHub Pages: https://orflie-analyst.github.io/fluxograma-organizacional/
- Firebase: projeto `orflie-fluxograma` (conta @orflie.com), Firestore em
  `southamerica-east1`.
- Primeiro admin criado: `arnaldo.hungria@orflie.com` (mesmo processo de bootstrap
  documentado no ServiceOrder — REST `accounts:signUp` + regra temporariamente
  escopada pro uid + Firestore REST + reverter).
- Testado no navegador: criar Conta/Operador, selecionar, conectar, desconectar
  (toggle), excluir nó (conexão some junto), arrastar (posição persiste), e
  sincronização em tempo real entre duas abas abertas simultaneamente — tudo
  confirmado direto contra o Firestore de produção.
- `admin.html` confirmado: tabela de usuários mostra Arnaldo como admin/ativo,
  formulários de criar e editar presentes e funcionais (mesmo mecanismo de segunda
  instância do Firebase App já validado no ServiceOrder).

> ⚠️ **DESATIVADO em 2026-09-08.** GitHub Pages desligado (site fora do ar), repo e
> dados no Firestore (`orflie-fluxograma`, projeto isolado) mantidos intactos.

# Fluxograma Organizacional — Orflie

Quadro interativo pra reuniões de diretoria: caixas de "Conta" (empresa cliente) e de
colaborador — **SDR** (azul), **BDR** (roxo) ou **Closer** (verde) — que se arrastam e
conectam, mostrando quem atende qual conta. Substitui o Excel/papel que o diretor
usava antes. Leia este arquivo primeiro ao retomar o trabalho.

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
- `quadros/{quadroId}` — **um doc por quadro/aba** (migrado do doc único original
  `quadro/principal` em 2026-08-05):
  - `nome`: nome da aba, mostrado na barra de abas de `quadro.html`.
  - `nos`: array de `{id, tipo: 'conta' | 'sdr' | 'bdr' | 'closer', label, x, y}` —
    cores/swatches de cada tipo em `style.css` (`--cor-conta`/`--cor-sdr`/etc.) e na
    legenda lateral de `quadro.html`.
  - `conexoes`: array de `{id, deId, paraId}`
  - `criadoEm`, `atualizadoEm`

  Cada doc continua pequeno o bastante pra não chegar perto do limite de 1MiB do
  Firestore. `app/quadro.js` escreve com `setDoc(..., {merge: true})` ao salvar
  nos/conexoes, pra nunca sobrescrever `nome`/`criadoEm` por acidente.

## Regras de segurança

`usuarios`: só admin cria/gerencia (sem `autoCadastroValido`, não existe aqui).
`quadros/{quadroId}`: leitura/escrita/criação/exclusão liberada pra qualquer usuário
autenticado e `ativo` — sem granularidade por usuário, já que o admin curou quem tem
conta. Vale pra qualquer quadro, não só o "Principal".

## Páginas

- `index.html` — login (sem opção de criar conta).
- `quadro.html` — o quadro em si:
  - **Abas** (`.quadro-abas`, topo da página): uma por doc em `quadros/`, ordenadas
    por `criadoEm`. Clicar troca (`selecionarQuadro`), "+" cria uma nova
    (`novoQuadro`, usa `prompt()` pro nome), duplo clique renomeia
    (`renomearQuadro`), "×" exclui (`excluirQuadro`, com `confirm()` e bloqueado se
    for o único quadro restante — sempre precisa sobrar pelo menos um). A aba ativa
    é lembrada por navegador via `localStorage` (`fluxograma_quadro_ativo`), não é
    compartilhada entre usuários — cada um pode estar numa aba diferente.
  - Toolbar "+ Conta"/"+ SDR"/"+ BDR"/"+ Closer" (usa `prompt()` pro nome, mensagem
    diferente por tipo em `ROTULOS_PROMPT`), nós arrastáveis (`<div>` posicionados
    em absoluto via `pointerdown`/`pointermove`/`pointerup`, sem lib externa),
    conectar clicando em dois nós em sequência (toggle), excluir via botão "×" no
    nó. `<svg>` sobreposto desenha as linhas entre os centros dos nós conectados,
    recalculado a cada mudança de posição. Legenda lateral (`.quadro-legenda`)
    explica a cor de cada tipo. Autosave (grava nos/conexoes do quadro ativo a cada
    mutação, sem botão "Salvar") + `onSnapshot` — dois listeners independentes: um
    na coleção `quadros` (mantém a lista de abas atualizada em tempo real) e outro
    no doc do quadro ativo (mantém nós/conexões sincronizados). Trocar de aba
    cancela a inscrição (`unsubQuadroAtual`) do quadro anterior antes de assinar o
    novo, pra não vazar listeners.
- `admin.html` — CRUD de usuário (criar + editar nome/isAdmin/ativo), sem seção de
  departamentos (não existe aqui).
- `conta.html` — qualquer usuário logado troca a própria senha (`trocarSenha()` em
  `app/auth.js`: reautentica com a senha atual antes de chamar `updatePassword`,
  porque o Firebase exige login "recente" pra essa operação).

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

**Atualização 2026-08-05 (mesmo dia, depois):** tipos de nó trocados de "Operador"
genérico pra três papéis reais da Orflie — SDR/BDR/Closer, cada um com cor própria —
com legenda lateral no quadro. Página `conta.html` adicionada pra troca de senha
(testada: trocar, reverter, e confirmado que senha atual errada é rejeitada com
`auth/invalid-credential`). Quadro populado com as 38 contas de
`Clientes Ativos - Orflie.xlsx` (planilha em `Desktop\ARNALDO HUNGRIA`, lida com
`openpyxl`) como nós tipo `conta`, em grid de 8 colunas — **substituindo** 7 contas
de teste que já existiam no quadro (nomes em maiúsculas/abreviados, sem conexões,
removidas por serem duplicatas inconsistentes das mesmas empresas da planilha).

**Atualização 2026-08-05 (mesmo dia, mais tarde ainda) — múltiplos quadros:**
migrado de doc único (`quadro/principal`) pra coleção (`quadros/{id}`), com UI de
abas em `quadro.html`. Migração rodou em produção com uma janela curta de regras
duplicadas (`quadro/{docId}` e `quadros/{quadroId}` liberados juntos, revertido
logo depois de mover os dados) — ver git log se precisar repetir esse padrão pra
outro projeto. Testado no ar: criar aba nova, trocar entre abas confirmando que as
38 contas do quadro "Principal" continuam intactas, renomear via duplo clique,
excluir aba (com bloqueio confirmado ao tentar excluir a única restante).

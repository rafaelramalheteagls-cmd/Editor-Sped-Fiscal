# Suporte a Tema Claro / Escuro (Light & Dark Mode) no SPED Fiscal Editor Pro

Adiciona a funcionalidade completa de alternância entre **Tema Escuro** (Dark Mode) e **Tema Claro** (Light Mode) na aplicação, com botão de controle direto na barra de navegação superior (Navbar) e persistência automática no armazenamento local (`localStorage`), mantendo o tema escuro como padrão inicial conforme definido pelo usuário.

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> - **Tema Padrão**: Tema Escuro (`dark`) como padrão inicial na primeira visita.
> - **Persistência**: Lembrar a última escolha feita pelo usuário via `localStorage` (chave `sped_theme_preference`).
> - **Posicionamento**: Botão com ícones intuitivos (Sol / Lua) posicionado diretamente na barra de navegação superior junto às ações principais.

---

## 1. Visão Geral & Conceito

- **O que faz**: Permite que o analista fiscal e auditor contábil alterne entre o modo escuro (ideal para ambientes de baixa luminosidade e longas jornadas de auditoria em telas OLED/LED) e o modo claro (ideal para conferência diária, impressão e ambientes corporativos iluminados).
- **Público-Alvo**: Contadores, analistas fiscais, auditores e operadores de ERP que manipulam arquivos SPED EFD ICMS/IPI e CT-e por muitas horas seguidas.
- **Valor Principal**: Conforto visual ergonômico, redução da fadiga ocular e consistência visual rigorosa com alta densidade de dados tabulares em ambos os modos.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais
1. **Primeiro Acesso**: A aplicação carrega no tema Escuro padrão (`slate-900 / slate-950`).
2. **Alternância Instantânea**: Ao clicar no botão de tema na barra superior (ícone de Sol no modo escuro / Lua no modo claro):
   - A classe `.dark` é adicionada ou removida de `document.documentElement` (`<html>`).
   - A preferência é salva no `localStorage`.
   - O feedback visual ocorre em tempo real sem recarregar a página e sem perda de dados fiscais ou da pilha de Desfazer/Refazer.
3. **Persistência ao Recarregar**: Ao recarregar ou reabrir o navegador, a preferência anterior é restaurada imediatamente.

### Paleta de Cores e Tokens
- **Tema Escuro (Dark Mode)**:
  - Fundo principal: `slate-950` / `slate-900`
  - Superfícies e Cards: `slate-900` / `slate-800` com bordas sutis `slate-800` / `slate-700`
  - Texto primário: `slate-100` / `white`
  - Texto secundário/metadados: `slate-400`
  - Tabelas e grelhas: Zebrado sutil `slate-800/50` e `slate-900`
  - Destaques funcionais: `emerald-500` (ações primárias e validações aprovadas), `blue-400` (CT-e e relatórios), `amber-400` (advertências), `rose-400` (erros fiscais)
- **Tema Claro (Light Mode)**:
  - Fundo principal: `slate-100` / `slate-50`
  - Superfícies e Cards: `white` com bordas sutis `slate-200`
  - Texto primário: `slate-900` / `slate-800`
  - Texto secundário/metadados: `slate-500`
  - Tabelas e grelhas: Zebrado sutil `white` e `slate-50` com linhas divisórias nítidas
  - Destaques funcionais: `emerald-600`, `blue-600`, `amber-600`, `red-600`
- **Barra de Navegação**:
  - Ajustada com elegância para contrastar perfeitamente em ambos os modos, mantendo o botão de tema bem visível e com tooltips informativos ("Alternar para Tema Claro" / "Alternar para Tema Escuro").

---

## 3. Principais Decisões de Produto & Arquitetura

- **Gerenciamento Centralizado de Tema (React Context ou Hook `useTheme`)**:
  - *Abordagem*: Criar um contexto/hook `useTheme` fornecendo `theme: 'dark' | 'light'` e `toggleTheme()`.
  - *Por que*: Permite que qualquer componente (Navbar, abas de relatórios, gráficos, modais) reaja ou consulte o tema atual quando necessário sem acoplamentos rígidos.
- **Configuração no Tailwind CSS v4**:
  - *Abordagem*: Declarar `@custom-variant dark (&:where(.dark, .dark *));` no `src/index.css`.
  - *Por que*: O Tailwind CSS v4 suporta a diretiva `@custom-variant dark` para permitir alternância baseada na classe `.dark` no elemento raiz (`<html class="dark">`).
- **Compatibilidade Completa com Modais e Relatórios**:
  - Garantir que todos os modais (Reconciliação ICMS/CST, Importação CT-e, Inventário Bloco H, Relatório PDF) e todas as abas (Dashboard, Editor de Registros, Análise CFOP, Validação Fiscal, Busca Global) possuam classes responsivas de tema (`bg-white dark:bg-slate-900`, `text-slate-800 dark:text-slate-100`, `border-slate-200 dark:border-slate-800`).

---

## 4. Arquitetura Técnica & Estrutura de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    SPED Fiscal Editor Pro                   │
│               Root Layout (`html.dark` / `html`)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       ┌──────────────────┐          ┌──────────────────┐
       │   ThemeContext   │          │   localStorage   │
       │ ('dark'|'light') │◄────────►│('sped_theme_pref)│
       └────────┬─────────┘          └──────────────────┘
                │
                ├─────────────────────────────┐
                ▼                             ▼
   ┌──────────────────────────┐  ┌──────────────────────────┐
   │          Navbar          │  │     Workspace Tabs       │
   │ ┌──────────────────────┐ │  │ ┌──────────────────────┐ │
   │ │ Theme Toggle Button  │ │  │ │ DashboardTab         │ │
   │ │ (Sun ☀️ / Moon 🌙)   │ │  │ │ RecordEditorTab      │ │
   │ └──────────────────────┘ │  │ │ CfopAnalysisTab      │ │
   │                          │  │ │ ValidationTab        │ │
   │                          │  │ │ GlobalSearchTab      │ │
   └──────────────────────────┘  │ └──────────────────────┘ │
                                 │                          │
                                 │ Modais (IcmsCst, Cte,    │
                                 │         Inventário, PDF) │
                                 └──────────────────────────┘
```

### Etapas de Execução Planejadas
1. **Configuração de Estilos e Variantes**:
   - Ajustar `src/index.css` para habilitar a variante `dark` no Tailwind v4.
   - Definir script inline ou inicializador no `index.html` para aplicar a classe `dark` antes da renderização inicial, evitando flashes brancos (FOUC).
2. **Criação do `ThemeContext` & Hook `useTheme`**:
   - Arquivo `src/context/ThemeContext.tsx` gerenciando estado, sincronização com o DOM e `localStorage`.
3. **Integração na `Navbar`**:
   - Inserir o botão de alternância de tema no grupo de controles da Navbar ao lado do botão de PDF e Desfazer/Refazer.
4. **Refinamento Estético nas Abas e Componentes**:
   - Adaptar classes de fundo, texto e bordas nas abas principais (`App.tsx`, `DashboardTab.tsx`, `RecordEditorTab.tsx`, `CfopAnalysisTab.tsx`, `ValidationTab.tsx`, `GlobalSearchTab.tsx`).
   - Assegurar contraste legível para campos de formulário, grelhas tabulares e modais.
5. **Verificação & Testes**:
   - Validar alternância instantânea sem erros de compilação ou regressões funcionais.

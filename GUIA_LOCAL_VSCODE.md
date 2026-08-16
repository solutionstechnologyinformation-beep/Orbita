# Órbita — Guia de Execução Local no VS Code

Este guia apresenta o passo a passo completo para clonar, configurar, executar e testar o software **Órbita** localmente utilizando o **Visual Studio Code**.

---

## 📋 Pré-requisitos do Sistema

1. **Node.js**: Versão 22.x ou superior recomendada (compatível com Node 20+).
2. **Gerenciador de Pacotes**: `pnpm` (recomendado) ou `npm`.
3. **Git**: Para clonar o repositório.

---

## 🚀 1. Clonagem e Configuração do Ambiente

1. Abra o terminal e clone o repositório oficial do projeto:
   ```bash
   git clone https://github.com/solutionstechnologyinformation-beep/Orbita.git
   cd Orbita
   ```

2. Instale as dependências do projeto:
   ```bash
   pnpm install
   ```
   *(Caso utilize npm: `npm install`)*

---

## ⚙️ 2. Configuração de Variáveis de Ambiente (.env)

O repositório inclui um template seguro. Crie seu arquivo de ambiente local na raiz do projeto:

```bash
cp .env.example .env
```

Abra o arquivo `.env` gerado no VS Code e preencha os valores necessários (como banco de dados MySQL/TiDB e chave JWT de sessão). Para testes locais rápidos utilizando armazenamento em arquivo e SQLite/MySQL local, o sistema já conta com fallbacks integrados.

---

## 💻 3. Abertura e Configuração no VS Code

1. Abra a pasta do projeto no VS Code:
   ```bash
   code .
   ```
2. O VS Code detectará automaticamente as configurações em `.vscode/settings.json` e sugerirá a instalação das extensões recomendadas (Tailwind CSS IntelliSense, Vitest Explorer, ESLint, Prettier) em `.vscode/extensions.json`.

---

## ▶️ 4. Execução do Servidor de Desenvolvimento

Para rodar a aplicação em modo de desenvolvimento (com recarregamento instantâneo via Vite e Express):

```bash
pnpm dev
```

O servidor local iniciará tipicamente em:
👉 `http://localhost:3000`

---

## 🧪 5. Execução dos Testes Unitários (Vitest)

Para rodar a suíte completa de testes automatizados do sistema:

```bash
pnpm test
```

Para rodar com interface gráfica interativa do Vitest:
```bash
pnpm test:ui
```

---

## 🗂️ 6. Estrutura de Pastas do Projeto

```
client/
  src/
    components/   ← Componentes reutilizáveis (incluindo o Guia de Apresentação e o Assistente IA)
    pages/        ← Telas do sistema (Dashboard, Projetos, Kanban, Gantt, Sprints, Relatórios, etc.)
    contexts/     ← Contextos React (Tema, Autenticação)
    lib/          ← Utilitários de cliente e tRPC
server/
  _core/          ← Infraestrutura central (OAuth, LLM, S3, ambiente)
  routers.ts      ← Contratos tRPC do backend
  db.ts           ← Consultas Drizzle ORM e MySQL
drizzle/          ← Esquema do banco de dados e migrações
storage/          ← Utilitários de persistência e S3
todo.md           ← Roadmap e status das tarefas do projeto
```

---

## ✨ Principais Funcionalidades Disponíveis no Pacote Local

- **Dashboard Executivo e OKRs**: Visão consolidada com indicadores, tendências e filtros globais por período.
- **Gestão de Projetos e Contratos CRS**: Estrutura multi-tenant para empresas, clientes e trechos geoespaciais KML/KMZ.
- **Kanban e Gantt Avançados**: Fluxo de tarefas, dependências temporais, marcos e visualização otimizada para dispositivos móveis.
- **Exportações Executivas**: Relatórios em PDF institucional e planilhas Excel avançadas (`exceljs`) com aba de capa, indicadores, barras de progresso e congelamento de painéis.
- **Segurança 2FA Real**: Autenticação de dois fatores via TOTP e códigos de backup de uso único.
- **Operação Offline Resiliente**: Fila de rascunhos em `localStorage` e sincronização automática com repetição controlada.
- **Assistente de IA & Guia Interativo**: Botão lateral para iniciar a apresentação guiada por todas as abas do sistema, além de assistente integrado.

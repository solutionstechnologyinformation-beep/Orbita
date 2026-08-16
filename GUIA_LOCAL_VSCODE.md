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

Crie manualmente um arquivo `.env` na raiz do projeto — ele não deve ser versionado — e informe pelo menos os valores do banco, da sessão e do cadastro local:

```dotenv
NODE_ENV=development
LOCAL_AUTH_ENABLED=true
DATABASE_URL=mysql://usuario:senha@localhost:3306/orbita
JWT_SECRET=troque-por-uma-chave-local-longa-e-aleatoria
```

Abra o arquivo `.env` no VS Code e complete as integrações opcionais, como OAuth, Resend, Stripe e Google Calendar, somente quando forem necessárias. Nunca compartilhe nem publique o arquivo `.env` real.

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


## 🔐 7. Primeira execução: criar usuário e empresa local

A tela inicial do Órbita agora começa pela entrada nativa de acesso. Clique em **Entrar** ou **Criar conta grátis** para abrir o `SecureLoginModal`.

Na opção **Cadastre-se**, informe o nome do administrador, o nome da empresa, o e-mail e uma senha com pelo menos oito caracteres. O backend cria automaticamente a empresa inicial, associa o usuário como `company_admin`, grava somente o hash scrypt da senha e inicia uma sessão local com cookie HTTP-only. Depois do cadastro, o usuário é encaminhado ao Dashboard já dentro do seu tenant.

Para as próximas execuções, utilize **Entrar com segurança** com o mesmo e-mail e senha. Se o administrador ativar 2FA, o fluxo preservará a etapa TOTP e os códigos de backup de uso único. O botão **Entrar com OAuth do Sistema** continua disponível como acesso alternativo quando o ambiente corporativo estiver configurado.

No modo de desenvolvimento, o cadastro local é habilitado por padrão. Em produção, defina `LOCAL_AUTH_ENABLED=false` e permita a criação de novos usuários somente por convite ou pela área administrativa da empresa. A configuração pode ser alterada para `LOCAL_AUTH_ENABLED=true` em um ambiente de homologação controlado.

### Verificação de isolamento

Depois de criar o primeiro ambiente, confirme que o usuário aparece como administrador da empresa, que os projetos exibidos pertencem ao `companyId` criado e que usuários de outra empresa não conseguem consultar esses registros. O contexto do backend continua resolvendo o tenant pelo Host e aplicando a validação de pertencimento antes de expor branding ou dados.

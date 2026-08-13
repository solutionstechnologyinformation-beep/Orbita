# Orbita — Plataforma de Gestão de Contratos e Ordens de Serviço

O **Orbita** é uma plataforma robusta, elegante e independente para gerenciamento de projetos de engenharia, contratos (CRS) e ordens de serviço (OS) [1]. Desenvolvida com uma arquitetura moderna baseada em **React 19**, **tRPC 11**, **Express 4**, **Drizzle ORM** e **MySQL/TiDB**, a aplicação oferece visibilidade em tempo real, quadros Kanban interativos, relatórios analíticos, gráficos de Gantt e sincronização com calendários externos [1] [2].

---

## Arquitetura e Tecnologias

A aplicação foi estruturada seguindo rigorosos padrões de engenharia de software e separação de responsabilidades por camadas, garantindo manutenibilidade, segurança e tipagem ponta a ponta sem duplicação de contratos [1] [2].

| Camada | Tecnologias Principais | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19, Tailwind CSS 4, Wouter, Recharts, Lucide Icons | Interface responsiva com tema claro, modo sidebar persistente e componentes modulares |
| **Backend** | Node.js, Express 4, tRPC 11, TypeScript | API tipada com procedimentos protegidos e públicos centralizados em `server/routers.ts` [2] |
| **Persistência** | Drizzle ORM, MySQL / TiDB | Mapeamento relacional seguro com migrações gerenciadas e consultas otimizadas em `server/db.ts` [2] |
| **Integrações** | Stripe API, Google Calendar OAuth 2.0, AWS S3 | Processamento de assinaturas, webhook de pagamentos e sincronização de eventos de agenda |

---

## Estrutura de Diretórios do Projeto

O repositório está organizado de forma modular para facilitar a navegação, o desenvolvimento colaborativo e a execução local ou em produção:

```text
orbita/
├── client/                   # Aplicação frontend em React
│   ├── public/               # Ativos estáticos públicos
│   └── src/
│       ├── components/       # Componentes reutilizáveis (Layout, Map, Modais)
│       ├── pages/            # Páginas principais (Dashboard, Kanban, Gantt, Projetos, etc.)
│       ├── lib/              # Utilitários e cliente tRPC
│       └── App.tsx           # Roteamento e layout estrutural
├── server/                   # Backend em Express e tRPC
│   ├── _core/                # Infraestrutura base (Autenticação OAuth, LLM, Storage)
│   ├── routers.ts            # Procedimentos e contratos tRPC da API
│   ├── db.ts                 # Funções de consulta e manipulação Drizzle ORM
│   ├── stripe-webhook.ts     # Manipulador de eventos de pagamento Stripe
│   └── *.test.ts             # Testes unitários Vitest (Auth, Dashboard, Stripe, Gantt)
├── drizzle/                  # Definição de esquemas de banco e migrações
│   └── schema.ts             # Tabelas e relacionamentos do banco de dados
├── shared/                   # Constantes e tipos compartilhados
└── package.json              # Dependências e scripts de execução
```

---

## Funcionalidades Principais

1. **Dashboard Executivo e SLA**: Visão geral com cartões de indicadores de desempenho (KPIs), métricas de pontualidade, vencimentos próximos, feed de atividades recentes e exportação completa em PDF formatado.
2. **Quadro Kanban de Tarefas**: Gestão visual de fases e status (Pendente, Em Andamento, Compartilhado, Publicado, Arquivado, Bloqueado) com suporte a drag-and-drop por `@dnd-kit`.
3. **Linha do Tempo (Gantt) Avançada**: Exibição temporal por períodos (meses/semanas), barras proporcionais às datas de início e fim, agrupamento por disciplina, contrato ou responsável, e subtarefas expansíveis.
4. **Gestão de Contratos (CRS) e Ordens de Serviço (OS)**: Cadastro detalhado de clientes, códigos de contrato, áreas, perímetros urbanos em unidades e tipos de obra.
5. **Integração com Google Calendar**: Sincronização automatizada de eventos de agenda e tarefas por usuário via OAuth 2.0.
6. **Billing e Assinaturas (Stripe)**: Planos estruturados (Starter, Basic, Pro) com suporte a checkout, webhook de confirmação e portal de gerenciamento de assinaturas.

---

## Guia de Execução no GitHub

Para clonar e executar o Orbita em seu próprio ambiente ou servidor de desenvolvimento a partir do GitHub, siga os passos abaixo:

### Pré-requisitos
- **Node.js** versão 22 ou superior instalado [3].
- Gerenciador de pacotes **pnpm** [3].
- Instância de banco de dados **MySQL** ou **TiDB** acessível.

### 1. Clonar o Repositório
```bash
git clone https://github.com/solutionstechnologyinformation-beep/Orbita.git
cd Orbita
```

### 2. Instalar as Dependências
```bash
pnpm install
```

### 3. Configurar as Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com as chaves necessárias (ou utilize o painel de configuração do seu ambiente) [2]:
```env
DATABASE_URL=mysql://usuario:senha@host:porta/banco
JWT_SECRET=seu_segredo_jwt
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
GOOGLE_CALENDAR_CLIENT_ID=seu_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=seu_client_secret
```

### 4. Executar os Testes Unitários
Para garantir a integridade da aplicação antes de iniciar o servidor, execute a suíte de testes automatizados com Vitest [4]:
```bash
pnpm test
```

### 5. Iniciar o Servidor de Desenvolvimento
```bash
pnpm dev
```
A aplicação estará disponível em `http://localhost:3000` [2] [3].

---

## Referências

[1] **Manus AI**. *Especificação Funcional e Arquitetural do Orbita*. Documentação Interna de Projeto, 2026.  
[2] **tRPC & Drizzle Documentation**. *End-to-end Type-safe APIs with React and TypeScript*. Disponível em: <https://trpc.io/>.  
[3] **Node.js Foundation**. *Node.js v22 Release Notes and Package Management Guidelines*. Disponível em: <https://nodejs.org/>.  
[4] **Vitest Testing Framework**. *Fast Unit Testing in Vite-powered Applications*. Disponível em: <https://vitest.dev/>.

---

*Desenvolvido com excelência por **Manus AI** para **Orbita**.*

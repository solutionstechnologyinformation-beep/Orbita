# Órbita — Plataforma de Gestão de Contratos e Ordens de Serviço (LS Solutions)

O **Órbita** é uma plataforma robusta, elegante e independente para gerenciamento de projetos de engenharia, contratos (CRS) e ordens de serviço (OS) [1]. Desenvolvida com uma arquitetura moderna baseada em **React 19**, **tRPC 11**, **Express 4**, **Drizzle ORM** e **MySQL/TiDB**, a aplicação oferece visibilidade em tempo real, quadros Kanban interativos, relatórios analíticos, gráficos de Gantt, visualização GIS avançada de KML/KMZ e painel administrativo por empresa [1] [2].

---

## Arquitetura e Tecnologias

A aplicação foi estruturada seguindo rigorosos padrões de engenharia de software e separação de responsabilidades por camadas, garantindo manutenibilidade, segurança e tipagem ponta a ponta sem duplicação de contratos [1] [2].

| Camada | Tecnologias Principais | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19, Tailwind CSS 4, Wouter, Recharts, Lucide Icons | Interface responsiva com tema claro/escuro, modo sidebar recolhível e componentes modulares |
| **Backend** | Node.js, Express 4, tRPC 11, TypeScript | API tipada com procedimentos protegidos e públicos centralizados em `server/routers.ts` [2] |
| **Persistência** | Drizzle ORM, MySQL / TiDB | Mapeamento relacional seguro com migrações gerenciadas, multi-tenant por `companyId` e consultas otimizadas em `server/db.ts` [2] |
| **GIS & Relatórios** | Google Maps JS API, HTML2Canvas, Parsers KML/KMZ | Visualização geoespacial com painel lateral, busca, ordenação, hover, balões de atributos e exportação em PDF |

---

## Estrutura de Diretórios do Projeto

O repositório está organizado de forma modular para facilitar a navegação, o desenvolvimento colaborativo e a execução local ou em produção:

```text
orbita/
├── client/                   # Aplicação frontend em React
│   ├── public/               # Ativos estáticos públicos
│   └── src/
│       ├── components/       # Componentes reutilizáveis (Layout, Map, Modais)
│       ├── pages/            # Páginas principais (Dashboard, Kanban, Gantt, CompanyAdmin, etc.)
│       ├── lib/              # Utilitários e cliente tRPC
│       └── App.tsx           # Roteamento e layout estrutural
├── server/                   # Backend em Express e tRPC
│   ├── _core/                # Infraestrutura base (Autenticação OAuth, LLM, Storage)
│   ├── routers.ts            # Procedimentos e contratos tRPC da API
│   ├── db.ts                 # Funções de consulta e manipulação Drizzle ORM
│   └── *.test.ts             # Testes unitários Vitest (mais de 135 testes automatizados)
├── drizzle/                  # Definição de esquemas de banco e migrações
│   └── schema.ts             # Tabelas e relacionamentos do banco de dados (companies, users, crs, tasks, etc.)
├── shared/                   # Constantes, tipos e parsers compartilhados (map-element-data.ts)
└── package.json              # Dependências e scripts de execução
```

---

## Funcionalidades Principais

1. **Dashboard Executivo e GIS**: Visão geral com cartões de indicadores de desempenho, métricas de extensão por tipo de obra e mapa KML/KMZ integrado com painel lateral, busca, ordenação A–Z e por geometria, hover sincronizado e balões com atributos completos.
2. **Quadro Kanban de Tarefas**: Gestão visual com arraste por mouse entre colunas, coluna "Concluído" com cards sombreados e remoção automática de atraso em tarefas 100% concluídas.
3. **Painel Company Admin**: Gestão dedicada para administradores de empresa gerenciarem usuários e projetos restritos ao seu próprio tenant.
4. **Preferências e Alertas**: Configuração de prazos de alerta persistidos em `notification_preferences` e respeitados pelo sistema de notificações central.

---

## Guia de Execução Local via GitHub

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
```

### 4. Executar a Migração do Banco de Dados
```bash
pnpm db:push
```

### 5. Executar os Testes Unitários
Para garantir a integridade da aplicação antes de iniciar o servidor, execute a suíte de testes automatizados com Vitest [4]:
```bash
pnpm test -- --run
```

### 6. Iniciar o Servidor de Desenvolvimento
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

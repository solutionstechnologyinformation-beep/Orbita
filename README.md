# Órbita — Plataforma de Gestão de Contratos e Ordens de Serviço

O **Órbita** é uma plataforma robusta, elegante e independente para gerenciamento de projetos de engenharia, contratos (CRS) e ordens de serviço (OS) [1]. Desenvolvida com uma arquitetura moderna baseada em **React 19**, **tRPC 11**, **Express 4**, **Drizzle ORM** e **MySQL/TiDB**, a aplicação oferece visibilidade em tempo real, quadros Kanban interativos, relatórios analíticos, gráficos de Gantt, visualização GIS avançada de KML/KMZ e painel administrativo por empresa [1] [2].

---

## Arquitetura em Camadas

A aplicação foi estruturada seguindo rigorosos padrões de engenharia de software e separação de responsabilidades por camadas, garantindo manutenibilidade, segurança e tipagem ponta a ponta sem duplicação de contratos [1] [2].

| Camada | Tecnologias Principais | Descrição |
| :--- | :--- | :--- |
| **Interface (Frontend)** | React 19, Tailwind CSS 4, Wouter, Recharts, Lucide Icons | Interface responsiva com tema claro/escuro, modo sidebar recolhível, controle global de período e layout mobile adaptativo |
| **Lógica de Negócio (Backend)** | Node.js, Express 4, tRPC 11, TypeScript | API tipada com procedimentos protegidos e públicos centralizados em `server/routers.ts` [2] |
| **Persistência (Database)** | Drizzle ORM, MySQL / TiDB | Mapeamento relacional seguro com migrações gerenciadas, multi-tenant por `companyId` e consultas otimizadas em `server/db.ts` [2] |
| **GIS & Relatórios** | Google Maps JS API, HTML2Canvas, Parsers KML/KMZ | Visualização geoespacial com painel lateral retrátil, busca, ordenação, hover, balões de atributos, filtros rápidos de status e exportação em PDF |

---

## Estrutura de Diretórios do Projeto

O repositório está organizado de forma modular para facilitar a navegação, o desenvolvimento colaborativo e a execução local ou em produção:

```text
orbita/
├── client/                   # Aplicação frontend em React
│   ├── public/               # Ativos estáticos públicos (favicon, robots.txt)
│   └── src/
│       ├── components/       # Componentes reutilizáveis (Layout, Map, Modais)
│       ├── pages/            # Páginas principais (Dashboard, Kanban, Gantt, CompanyAdmin, etc.)
│       ├── contexts/         # Contextos globais (GlobalPeriodContext, ThemeContext)
│       ├── lib/              # Utilitários e cliente tRPC
│       └── App.tsx           # Roteamento e layout estrutural
├── server/                   # Backend em Express e tRPC
│   ├── _core/                # Infraestrutura base (Autenticação OAuth, LLM, Storage, Map)
│   ├── routers.ts            # Procedimentos e contratos tRPC da API
│   ├── db.ts                 # Funções de consulta e manipulação Drizzle ORM
│   └── *.test.ts             # Testes unitários Vitest (mais de 228 testes automatizados)
├── drizzle/                  # Definição de esquemas de banco e migrações
│   └── schema.ts             # Tabelas e relacionamentos do banco de dados (companies, users, crs, tasks, etc.)
├── shared/                   # Constantes, tipos e parsers compartilhados (map-element-data.ts, report-summary.ts)
└── package.json              # Dependências e scripts de execução
```

---

## Guia de Execução Local e Testes via GitHub

Para clonar e executar o Órbita em seu próprio ambiente ou servidor de desenvolvimento a partir do GitHub, siga os passos abaixo:

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
Crie um arquivo `.env` na raiz do projeto com as chaves necessárias [2]:
```env
DATABASE_URL=mysql://usuario:senha@host:porta/banco
JWT_SECRET=seu_segredo_jwt
```

### 4. Executar as Migrações do Banco de Dados
As alterações de schema devem ser aplicadas de forma controlada. Para habilitar o estado de digitação do chat, garanta que a tabela auxiliar esteja presente:

```sql
CREATE TABLE IF NOT EXISTS chat_typing_states (
  conversationId INT NOT NULL,
  userId INT NOT NULL,
  lastTypedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversationId, userId)
);
```

### 5. Executar a Suíte de Testes Automatizados
Para verificar a integridade da aplicação antes de iniciar o servidor, execute todos os testes com Vitest [4]:
```bash
pnpm test -- run
```

### 6. Iniciar o Servidor de Desenvolvimento
```bash
pnpm dev
```
A aplicação estará disponível em `http://localhost:3000` [2] [3].

---

## Relatório de Auditoria de Segurança e Controles de Informação

A arquitetura do **Órbita** foi submetida a uma varredura rigorosa de segurança de dados e conformidade, adotando defesas em profundidade contra os principais vetores de vulnerabilidade corporativa [1].

### Resumo dos Controles de Segurança Implementados

| Camada de Defesa | Mecanismo Aplicado | Descrição Técnica |
| :--- | :--- | :--- |
| **Autenticação & Sessão** | Cookies `HttpOnly`, `Secure` e `SameSite=Lax` | Proteção contra roubo de tokens de sessão via XSS e requisições cross-site [1]. |
| **Isolamento Multi-Tenant** | Filtragem obrigatória por `companyId` | Garante que consultas de banco de dados filtrem estritamente os dados pertencentes à empresa do usuário autenticado [1] [2]. |
| **Validação de Entrada** | Schemas estritos com **Zod** | Sanitização automática e validação de tipo ponta a ponta em todos os procedimentos tRPC [2]. |
| **Proteção contra SQL Injection** | **Drizzle ORM** com Prepared Statements | Consultas SQL construídas por parâmetros tipados, eliminando vulnerabilidades de injeção direta de código [2]. |
| **Controle de Acesso (RBAC)** | `protectedProcedure` & `adminProcedure` | Barreiras baseadas em papéis (`user`, `admin`, `master_admin`, `company_admin`, `leader`) que bloqueiam acessos não autorizados [1] [2]. |
| **Auditoria de Operações** | Registro de logs em `activity_logs` | Rastreabilidade completa de alterações, exclusões e acessos críticos no sistema [1]. |
| **Domínios por Tenant** | `company_domains` + verificação TXT | Cada empresa pode ter domínio próprio, com status pendente/verificado/desativado e escopo protegido por `companyId`. |
| **Resolução de Host** | `server/tenant-resolver.ts` + contexto tRPC | O sistema normaliza o hostname calculado pelo Express e só carrega branding de domínios verificados; o Host não substitui a autorização do usuário. |
| **2FA Administrativo** | TOTP, QR Code e códigos de recuperação | Administradores podem habilitar autenticação de dois fatores pelo painel de segurança. |

---

## Plataforma Multi-Tenant e Domínios Personalizados

O Orbita usa uma **marca única** para todas as empresas e separa os espaços de trabalho por `companyId`. O Administrador Master ou o administrador autorizado da empresa pode abrir **Administração → Domínios**, cadastrar um hostname e configurar a verificação de posse por DNS.

O fluxo é:

1. Cadastre um domínio como `app.empresa.com.br`, sem `https://`, caminho ou porta.
2. Copie o valor retornado pelo Orbita e crie um registro TXT no host `_orbita-verification.app.empresa.com.br`.
3. Clique em **Verificar DNS**. O backend consulta o TXT e só altera o status para `verified` quando o token coincidir.
4. Após a verificação no Orbita e a configuração no provedor de hospedagem, defina o domínio como **Primário**.
5. Configure o registro CNAME, A, ALIAS ou ANAME exigido pela hospedagem e aguarde o certificado SSL/TLS gerenciado pelo provedor.

O contexto tRPC utiliza o `req.hostname` calculado pelo Express e nunca confia diretamente em `x-forwarded-host`. Mesmo em um domínio verificado, os dados continuam protegidos pela sessão e pelo `companyId`; um domínio identifica o espaço visual, mas não concede autorização.

A migração reproduzível está em `drizzle/0016_add-company-domains.sql`. Em ambientes novos, execute as migrações do projeto antes de iniciar o servidor. Em produção, o provisionamento automático de SSL deve ser realizado pela hospedagem ou por um reverse proxy persistente com ACME; a aplicação não armazena chaves privadas de certificados.

## Nome da Marca e Escolha do Domínio

`Orbita` continua como a marca única do produto, mas a disponibilidade e a exclusividade de um nome devem ser confirmadas no registrador e em uma pesquisa de marca antes da compra. Não é possível afirmar que `orbita.com.br` ou `orbita.com` estejam livres sem uma consulta no momento do registro. Como alternativas de pesquisa sem números, podem ser avaliados `orbitaops.com.br`, `orbitaexec.com.br`, `orbitafluxo.com.br` e `orbitaos.com.br`; essas opções são sugestões e não disponibilidade confirmada.

Consulte `docs/domain-name-research.md` para o registro das fontes e recomendações. A consulta oficial de domínios `.br` deve ser feita no [Registro.br][5], enquanto registradores comerciais como o [Name.com][6] oferecem busca por extensões e alternativas.

### Uso do domínio principal `www.orbita.com.br`

Para usar `www.orbita.com.br` como endereço global da marca, cadastre esse domínio no provedor de hospedagem e aponte o registro DNS `www` conforme o endpoint fornecido. Para espaços específicos por empresa, prefira subdomínios como `empresa-a.orbita.com.br` e `empresa-b.orbita.com.br`, cadastrando cada um na tela de Domínios do Orbita.

---

## Referências

[1] **Manus AI**. *Especificação Funcional e Arquitetural do Órbita*. Documentação Interna de Projeto, 2026.
[2] **tRPC & Drizzle Documentation**. *End-to-end Type-safe APIs with React and TypeScript*. Disponível em: <https://trpc.io/>.  
[3] **Node.js Foundation**. *Node.js v22 Release Notes and Package Management Guidelines*. Disponível em: <https://nodejs.org/>.  
[4] **Vitest Testing Framework**. *Fast Unit Testing in Vite-powered Applications*. Disponível em: <https://vitest.dev/>.
[5] **Registro.br**. *Consulta e registro de domínios `.br`*. Disponível em: <https://registro.br/dominio/>.
[6] **Name.com**. *Domain Name Search*. Disponível em: <https://www.name.com/domain/search>.

---

*Desenvolvido com excelência por **Manus AI** para **Órbita**.*

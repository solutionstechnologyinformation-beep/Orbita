# Órbita — Guia de Autenticação, Usuários e Replicação Multi-Tenant Local

Este documento orienta como configurar, gerenciar e testar o sistema de **usuários, login local, papéis e isolamento por empresa (tenant)** antes de iniciar a comercialização e a distribuição da solução.

---

## 🔐 1. Estrutura Inicial de Autenticação

O **Órbita** foi projetado para operar de forma independente, permitindo que cada empresa cliente possua um ambiente isolado com seus próprios administradores, colaboradores e dados.

### Papéis do Sistema (Roles)
1. **Master Admin**: Acesso irrestrito a todas as empresas, configurações globais do sistema, auditoria e migração.
2. **Company Admin (Admin da Empresa)**: Gerenciamento completo dos projetos, contratos CRS, membros, branding corporativo e domínios da respectiva empresa.
3. **User (Usuário/Colaborador)**: Participação em projetos, movimentação de cards no Kanban, registro de apontamentos no Gantt e interações no chat.
4. **Leader (Líder)**: Coordenação operacional e acompanhamento das equipes permitidas.

---

## 🛠️ 2. Como Criar e Gerenciar o Primeiro Administrador Local

Ao executar o projeto pela primeira vez no VS Code (`pnpm dev`), a aplicação inicializa o banco de dados e as tabelas definidas em `drizzle/schema.ts`.

### Passo a passo para criar o primeiro usuário admin local:
1. Acesse a tela inicial do sistema (`/`).
2. Clique em **Entrar** ou **Criar conta grátis** para abrir o `SecureLoginModal`.
3. Selecione **Cadastre-se** e informe:
   - **Nome do Administrador**;
   - **Nome da Empresa**;
   - **E-mail Corporativo**;
   - **Senha segura**, com no mínimo oito caracteres.
4. O backend cria automaticamente um tenant em `companies`, gera o `companyId`, registra o usuário como `company_admin`, grava somente o hash scrypt e cria uma sessão local por cookie HTTP-only.
5. Após o redirecionamento, valide o branding e os dados do Dashboard. Usuários adicionais podem ser criados pela área **Admin da Empresa**.

No desenvolvimento, o cadastro local fica habilitado por padrão. Em produção, use `LOCAL_AUTH_ENABLED=false` e restrinja novas contas a convites ou ao fluxo administrativo. O OAuth continua disponível no botão **Entrar com OAuth do Sistema**, mas não é obrigatório para iniciar o ambiente local.

---

## 🏢 3. Replicação Multi-Tenant para Venda da Solução

Para implantar o Órbita para diferentes empresas clientes de forma independente:

1. **Isolamento de Dados**: Cada empresa possui um `companyId` exclusivo no banco de dados MySQL/TiDB. Todas as entidades (projetos, contratos CRS, tarefas Kanban, trechos KMZ, eventos de agenda e relatórios) filtram automaticamente os registros vinculados ao tenant ativo.
2. **Configuração de Domínio e Branding**: Na aba **Admin da Empresa**, cada cliente pode carregar seu próprio logotipo (com suporte a modo claro e escuro) e definir a cor primária corporativa.
3. **Backup e Migração por Tenant**: A ferramenta de **Migração e Backups** permite exportar e importar snapshots completos em formato JSON ou planilhas Excel estruturadas por empresa, facilitando a portabilidade e a entrega do ambiente pronto para cada novo cliente.

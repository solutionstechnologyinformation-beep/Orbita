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


## ✉️ 4. Sistema de Convites Administrativos por Empresa

Para adicionar colaboradores ao workspace da empresa com segurança e restrição de tenant:

1. **Geração de Convite**: Na aba **Convites** dentro do painel **Admin da Empresa**, o administrador informa o e-mail do convidado e escolhe a permissão (*Colaborador*, *Líder* ou *Admin da Empresa*).
2. **Link Exclusivo**: O sistema gera um token criptográfico de uso único com validade de 7 dias e copia o link direto (`/invite?token=...`).
3. **Aceite Seguro**: O novo usuário acessa o link, visualiza o nome da organização e o cargo atribuído, preenche seu nome e define sua senha protegida por scrypt. O backend valida a expiração, cria a conta vinculada estritamente ao `companyId` da empresa emissora e inicia a sessão de forma imediata.
4. **Controle e Revogação**: O administrador pode consultar o status de todos os convites pendentes, aceitos ou expirados e revogar links ativos a qualquer momento.
5. **Histórico de Auditoria, Alertas e Conformidade**: Cada transição no ciclo de vida do convite é registrada com data, IP e identificador. O painel possui contadores de risco, filtros de alertas, proteção por taxa/bloqueio temporário de IP e botão de exportação instantânea em formato CSV para auditorias de conformidade corporativa.


## 🛡️ 5. Exigência de 2FA no Primeiro Login para Administradores Convidados

Para garantir conformidade rigorosa e blindar o acesso a workspaces multi-tenant:
1. **Regra de Convite Administrativo**: Quando um usuário é convidado com o papel de **Administrador da Empresa** (`company_admin`), o sistema marca o registro com o sinal persistente `tfaSetupRequired = true`.
2. **Barreira de Acesso**: Após aceitar o convite ou realizar o primeiro login com senha, o backend emite uma sessão limitada e o middleware de segurança bloqueia o acesso a todas as rotas protegidas e consultas ao workspace, redirecionando o administrador para `/setup-2fa`.
3. **Provisionamento e Códigos de Backup**: A tela de configuração exibe um QR Code interativo para aplicativos autenticadores (Google Authenticator, Microsoft Authenticator), chave secreta manual, validação TOTP em tempo real e geração de códigos de backup de uso único.
4. **Liberação Automática**: Assim que o código TOTP é confirmado com sucesso, o sistema desativa o marcador `tfaSetupRequired`, grava os códigos de recuperação, registra a auditoria de segurança e libera o acesso completo ao painel administrativo e aos projetos da empresa.


## 🔑 6. Política de Complexidade de Senha por Tenant

Na aba **Admin da Empresa → Configurações**, um administrador pode definir a quantidade mínima de caracteres e habilitar, de forma independente, a exigência de letra maiúscula, número e caractere especial. A configuração fica gravada na empresa emissora e não altera as regras de outros tenants.

A política é aplicada no backend aos novos cadastros locais, usuários criados manualmente pela administração, aceite de convites e demais fluxos que criem credenciais. A interface apenas antecipa os requisitos para orientar o usuário; a validação definitiva ocorre no servidor antes do hash scrypt ser armazenado. O padrão para empresas novas é de 8 caracteres, exigência de número e regras de maiúscula e caractere especial desativadas.

# Orbita — TODO

## Backend / Schema
- [x] Schema completo: projects, tasks, task_comments, task_attachments, project_members, notifications, activity_logs, chat_messages
- [x] Queries db.ts: projetos, tarefas, comentários, anexos, membros, notificações, atividades, chat
- [x] Rotas tRPC: auth, projects, tasks, notifications, chat (IA), admin, uploads

## Frontend — Estrutura
- [x] Tema visual elegante (dark, paleta índigo/violeta, tipografia Inter)
- [x] AppLayout com sidebar e header
- [x] Roteamento completo em App.tsx

## Frontend — Páginas
- [x] Landing page / Login
- [x] Dashboard principal (visão geral: projetos, tarefas, notificações)
- [x] Listagem de Projetos (CRUD, cores, membros)
- [x] Detalhe do Projeto (membros, estatísticas)
- [x] Quadro Kanban (todo / in_progress / done)
- [x] Detalhe da Tarefa (comentários, anexos, histórico)
- [x] Notificações (lista, marcar como lida)
- [x] Chat IA (análise de carga, sugestões, relatórios)
- [x] Painel Admin (usuários, logs de atividade)
- [x] Perfil do usuário

## Funcionalidades Avançadas
- [x] Filtros e busca avançada de tarefas
- [x] Upload de anexos via S3
- [x] Notificações em tempo real (polling)
- [x] LLM: análise de workload, priorização, relatórios
- [x] Convite de membros para projetos

## Melhorias v2
- [x] Renomear plataforma: Suple → Orbita (título, sidebar, landing page)
- [x] Tema claro: fundo branco, texto escuro, acentos índigo/azul-marinho, estilo minimalista
- [x] Drag-and-drop real no Kanban com @dnd-kit
- [x] Alertas visuais de tarefas vencidas + notificação automática 24h antes do prazo
- [x] Exportação de relatório em PDF no Chat IA

## Correções v2.1
- [x] Remover todas as referências a "Suple Clone" da aplicação
- [x] Corrigir bug: criar tarefa dentro das colunas do Kanban não funciona (causa: âncoras aninhadas)
- [x] Corrigir erro SQL INSERT tasks: overflow INT - Date.now() excede limite do MySQL INT (causa raiz)
- [x] Garantir criação de tarefa em cada coluna do Kanban (A Fazer, Em Progresso, Concluído)
- [x] Permitir mudança de status das tarefas criadas (via dropdown no card + drag-and-drop) (causa: âncoras aninhadas `<Link><a>` em AppLayout, Dashboard, Projects e Notifications)

## Funcionalidades v2.3
- [x] Schema: adicionar openedAt, completedAt, statusChangedAt, revisionsCount à tabela tasks
- [x] Backend: registrar timestamps e incrementar revisões ao atualizar status
- [x] Backend: notificação automática ao criador quando tarefa é concluída
- [x] Backend: seletor de membros do projeto na atribuição de tarefa
- [x] Kanban: barra de status inline em cada card (A Fazer / Em Progresso / Concluído)
- [x] Kanban: botão de excluir tarefa diretamente no card
- [x] Kanban: formulário com seletor de membros para atribuir tarefa
- [x] Dashboard: gráfico de distribuição de tarefas por status (Recharts)
- [x] Detalhe da tarefa: painel de métricas (abertura, conclusão, última alteração, nº revisões)

## Funcionalidades v3.0 — Fluxo de Trabalho Avançado
- [x] Schema: novos status (pending, in_progress, shared, published, archived), tabela project_roles, campo teamId na tarefa
- [x] Backend: regras de transição de status com validação de papel (Líder aprova shared→published/archived)
- [x] Backend: lógica de revisão (shared→in_progress = +1 revisão)
- [x] Kanban: 5 colunas com legendas descritivas e regras de movimentação
- [x] Kanban: restrição de aprovação: somente Líder pode mover de Compartilhado para Publicado/Arquivado
- [x] Página de Funções: gerenciamento de papéis personalizáveis por projeto
- [x] Tarefa: seletor de equipe e pessoa responsável

## Limpeza v3.1
- [x] Remover função wrapper duplicada getTasksAssignedToUser em routers.ts
- [x] Remover query allUsers não utilizada em ProjectDetail.tsx
- [x] Zero erros TypeScript após limpeza
- [x] 14/14 testes passando após todas as alterações

## Correções e Funcionalidades v3.2
- [x] Bug 1: seletor de responsável corrigido (Select com value/onValueChange correto)
- [x] Bug 2: drag-and-drop corrigido (MouseSensor + distance:10 + TouchSensor)
- [x] Bug 3: botão ChevronRight para abrir detalhes da tarefa adicionado ao card
- [x] Bug 4: openedAt exibido no card do Kanban com tooltip
- [x] Bug 5: revisões só incrementam em Compartilhado→Em Andamento (já estava correto no backend)
- [x] Feature 6: métricas por disciplina/setor no Dashboard (gráfico de barras empilhadas)
- [x] Feature 7: campo Setor adicionado ao schema, banco, Kanban (criação) e TaskDetail (edição)
- [x] Feature 8: gráfico de desempenho por setor no Dashboard com endpoint setorStats

## Testes
- [x] Teste de logout (auth.logout.test.ts)
- [x] Testes de features: auth, procedimentos protegidos, admin, validação de input (features.test.ts)
- [x] 14/14 testes passando
- [x] Migração do banco aplicada com sucesso (9 tabelas)

## Notificações Personalizadas v3.3
- [x] Schema: expandir notificationType (task_status_changed, task_created, task_deleted, task_due, task_comment, task_assigned, project_invite, system)
- [x] Schema: nova tabela notification_preferences (userId, tipo, inApp)
- [x] Backend: migrar banco (SQL direto via webdev_execute_sql)
- [x] Backend: helper notifyUser() que verifica preferências antes de criar notif in-app
- [x] Backend: triggers para todas as movimentações (task_status_changed, task_created, task_deleted, task_comment, task_assigned, project_invite, task_due)
- [x] Backend: procedures tRPC para preferências (list, update, updateAll)
- [x] Frontend: página /notification-preferences com toggles por tipo
- [x] Frontend: link para preferências na página de Notificações
- [x] Frontend: ícones por tipo de notificação (UserPlus, ArrowRightLeft, AlertCircle, Clock, etc.)
- [x] Testes: 14/14 passando após alterações

## Correções e Melhorias v3.4
- [x] Bug 1: corrigido - donos de projetos adicionados como membros em project_members; projects.create auto-adiciona dono
- [x] Bug 2: Dashboard "Distribuição de Tarefas" mostra todos os 5 status com gráfico de pizza
- [x] Bug 2b: Dashboard "Tarefas por Projeto" mostra todos os 5 status com barras empilhadas
- [x] Feature 3: Chat IA - "Exportar PDF" exporta somente a última resposta da IA (limpo)
- [x] Feature 3b: Chat IA - "Gerar Relatório" gera PDF visual com KPIs, gráfico de barras (status) + pizza (prioridade)
- [x] Feature 4: Dashboard - métrica de revisões adicionada
- [x] Feature 4b: Dashboard - filtros por Projeto e Disciplina/Setor adicionados
- [x] Feature 5: Dashboard - seção de tarefas em atraso com banner de alerta

## Melhoria v3.5
- [x] TaskDetail: seletor de responsável editável (query de membros do projeto + Select + mutation tasks.update)
- [x] TaskDetail: exibir avatar/iniciais do responsável atual ao lado do seletor

## Melhorias v3.6
- [x] Sidebar (AppLayout): fundo azul-marinho, texto/ícones brancos, item ativo com destaque claro
- [x] PDFs (AIChat): incluir logo Orbita (ícone SVG/canvas) e nome da ferramenta no cabeçalho

## Melhorias v3.6
- [x] Sidebar (AppLayout): fundo azul-marinho, texto/ícones brancos, item ativo com destaque claro
- [x] PDFs (AIChat): logo Orbita (círculo azul-marinho + anel + ponto branco) e nome no cabeçalho
- [x] Dashboard: botão "Exportar PDF" com KPIs, gráfico de status, barras por projeto, barras por setor e tabela de atraso

## Melhorias v3.7
- [x] ProjectDetail: aba "Visão Geral" com tarefas recentes e barras de progresso por status
- [x] ProjectDetail: aba "Membros" com busca de usuário, seletor de função e botão remover
- [x] ProjectDetail: aba "Revisões" com tabela de tarefas revisadas e contador total
- [x] Corrigido: busca de usuário por nome/email ao adicionar membro (users.search)
- [x] Notificação in-app com nome do projeto e função ao adicionar membro
- [x] Schema: campo status já existia (active/archived/completed) - sem migração necessária
- [x] Backend: projects.update aceita status para arquivar/reativar
- [x] Frontend: botões "Arquivar" (com confirmação) e "Reativar" para o dono
- [x] Frontend: botão "Excluir Permanentemente" com confirmação para o dono
- [x] Frontend: badge "Arquivado" no cabeçalho do projeto quando arquivado

## Melhoria v3.8 — Visualizador de Arquivos
- [x] Componente FilePreviewModal: PDF via iframe, imagens via img, outros via link de download
- [x] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview
- [x] Suporte a PDF, imagens (jpg/png/gif/webp), e fallback para outros tipos

## Melhorias v3.8
- [x] Admin: botão e formulário para criar novo usuário (nome, e-mail, senha, papel)
- [x] Backend: procedure admin.createUser com hash de senha
- [x] Visualizador inline: componente FilePreviewModal (PDF via iframe, imagens via img)
- [x] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview

## Melhorias v3.8 — Empresa, Admin e Visualizador
- [x] Schema: campo company (texto) na tabela users
- [x] Backend: migrar banco (ALTER TABLE users ADD COLUMN company)
- [x] Backend: importar upsertUser e deleteUser no routers.ts
- [x] Backend: procedure admin.createUser (nome, e-mail, empresa, papel)
- [x] Backend: procedure admin.deleteUser
- [x] Backend: procedure profile.update aceitar campo company
- [x] Backend: listTasks e getProjectMembers retornar company do responsável
- [x] Frontend: card do Kanban exibir empresa do responsável abaixo do nome
- [x] Frontend: TaskDetail exibir empresa do responsável
- [x] Frontend: filtro por empresa no Kanban (chips na barra superior)
- [x] Frontend: filtro por empresa no Dashboard
- [x] Frontend: campo empresa no perfil do usuário (página Profile)
- [x] Frontend Admin: formulário de criar usuário com nome, e-mail, empresa, papel
- [x] Frontend Admin: botão excluir usuário com confirmação
- [x] Visualizador inline: componente FilePreviewModal (PDF via iframe, imagens via img)
- [x] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview

## Arquitetura Multi-Tenant v3.9
- [x] Schema: tabela companies (id, name, slug, color, createdAt)
- [x] Schema: campo companyId em users (FK → companies)
- [x] Schema: campo companyId em projects (FK → companies)
- [x] Schema: enum role expandido: "master_admin" | "company_admin" | "user"
- [x] Backend: migrar banco (novas tabelas e colunas)
- [x] Backend: procedures companies.list, create, update, delete (master_admin)
- [x] Backend: isolamento de queries por companyId (users, projects, tasks)
- [x] Backend: companyAdminProcedure — guard que verifica role company_admin
- [x] Backend: procedures para Company Admin gerenciar usuários da sua empresa
- [x] Frontend: painel /company-admin com abas Usuários e Projetos da empresa
- [x] Frontend Admin Master: aba "Empresas" para criar/editar/excluir empresas
- [x] Frontend Admin Master: exibir empresa junto ao responsável nas tarefas
- [x] Frontend: filtro por empresa no Kanban e Dashboard
- [x] Frontend: campo empresa visível no perfil do usuário

## Gráfico de Gantt v3.10
- [x] Schema: campos startDate e endDate na tabela tasks
- [x] Backend: migrar banco (ALTER TABLE tasks ADD COLUMN startDate/endDate)
- [x] Backend: procedure tasks.gantt (retorna tarefas com datas, responsável, empresa)
- [x] Backend: procedure tasks.updateDates (atualiza startDate/endDate via drag no Gantt)
- [x] Backend: detecção de conflitos (mesmo responsável, datas sobrepostas) com notificação
- [x] Frontend: página /gantt com entrada na barra lateral de navegação
- [x] Frontend: gráfico Gantt interativo (barras arrastáveis por data, cores por status)
- [x] Frontend: filtros no Gantt (por projeto, responsável, empresa, setor, status)
- [x] Frontend: indicador visual de conflito de tarefas (barra vermelha/ícone de alerta)
- [x] Frontend: notificação in-app ao detectar conflito de datas do mesmo responsável

## Gantt + Burndown v3.10 (atualizado)
- [x] Backend: procedure tasks.gantt (tarefas com startDate/endDate, conflitos por assignee)
- [x] Backend: procedure tasks.burndown (tarefas concluídas por dia vs. ideal)
- [x] Frontend: página /gantt com abas "Gantt" e "Burndown"
- [x] Frontend Gantt: barras horizontais por tarefa, filtro por projeto, edição de datas inline
- [x] Frontend Gantt: notificação de conflito (mesmo responsável, datas sobrepostas)
- [x] Frontend Burndown: gráfico de linha (real vs. ideal) por projeto selecionado
- [x] Navegação: link "Gantt" na barra lateral

## Funcionalidades v3.11 — Pacote Completo
- [x] Chat de membros: schema task_messages (taskId, userId, message, createdAt)
- [x] Chat de membros: procedure tasks.chat (send, list por tarefa)
- [x] Chat de membros: painel de chat inline no TaskDetail
- [x] Calendário de entregas: aba /agenda com visualização de calendário mensal (tarefas com dueDate)
- [x] Sprints: schema sprints (projectId, name, startDate, endDate, goal) e sprint_tasks (sprintId, taskId)
- [x] Sprints: procedures sprints.create, list, addTask, removeTask, complete, listAll
- [x] Sprints: página /sprints com criação de sprint semanal, metas e lista de tarefas
- [x] Dashboard: widget "Sprints Ativas" com % de conclusão e dias restantes
- [x] Kanban: coluna "Bloqueado" (status blocked) com ícone Ban e transições permitidas
- [x] Agenda: schema agenda_events (userId, title, type, startDate, endDate, description, meetingUrl, attendees)
- [x] Agenda: procedures agenda.create, list, update, delete
- [x] Agenda: página /agenda com calendário mensal, criação de férias/reunião/outros
- [x] Navegação: links Gantt, Sprints, Agenda na barra lateral

## Quadro Branco + Programação v3.12
- [x] Quadro Branco (/quadro-branco): canvas interativo com sticky notes, formas, texto e setas
- [x] Quadro Branco: salvar estado do canvas por projeto no banco de dados
- [x] Quadro Branco: schema whiteboard_data (projectId, content JSON, updatedAt)
- [x] Programação (/programacao): linha do tempo de tarefas agrupadas por responsável (swimlane)
- [x] Programação: filtros por projeto, setor e período
- [x] Programação: indicador visual de conflito de agenda (férias/reunião vs. tarefa)
- [x] Navegação: links "Quadro Branco" e "Programação" na barra lateral

## Correções v3.13
- [x] Gantt: envolver com AppLayout (sidebar visível)
- [x] Gantt: mostrar tarefas reais do banco (startDate/endDate), seletor de período completo ou intervalo customizado
- [x] Sprints: envolver com AppLayout (sidebar visível)
- [x] Programação: envolver com AppLayout (sidebar visível)
- [x] Programação: calendário expandido com células maiores para ler o conteúdo das datas
- [x] Calendário: envolver com AppLayout (sidebar visível)
- [x] Chat de Tarefas: envolver com AppLayout (sidebar visível)
- [x] Chat de Tarefas: adicionar @menção de membros (autocomplete ao digitar @)
- [x] Quadro Branco: envolver com AppLayout (sidebar visível)

## Edição de Datas v3.14
- [x] Backend: confirmar que tasks.update aceita startDate, endDate e dueDate
- [x] TaskDetail: campos de data editáveis (Data de Início, Data de Vencimento) com date picker nativo
- [x] Kanban: botão de edição rápida de data no card (popover com date picker)
- [x] Kanban: exibir data de vencimento no card quando definida

## Kanban → Sprint e Edição de Datas v3.15
- [x] Kanban: popover inline de edição de datas no card (Início, Término, Vencimento)
- [x] Kanban: exibir datas de início/término no card quando definidas
- [x] Kanban: opção "Adicionar à Sprint" no menu de contexto do card
- [x] Kanban: modal de seleção de sprint ativa para vincular a tarefa
- [x] Backend: procedure sprints.addTask aceita taskId + sprintId (verificar/garantir)

## Gantt Profissional v3.16
- [x] Gantt: layout com painel esquerdo (nome da tarefa) e grade de dias à direita
- [x] Gantt: linha vertical "Hoje" em vermelho com label
- [x] Gantt: barras coloridas por status (teal, azul, verde, vermelho, cinza)
- [x] Gantt: avatar do responsável ao lado direito da barra
- [x] Gantt: numeração hierárquica de tarefas (1, 1.1, 1.2, 2, 2.1...)
- [x] Gantt: scroll horizontal sincronizado entre header e grid
- [x] Gantt: seletor de período (semana, mês, projeto completo)

## Sidebar Fixa v3.17
- [x] AppLayout: barra lateral fixed/sticky em todas as navegações (sempre visível ao rolar)
- [x] AppLayout: área de conteúdo com overflow-y próprio para rolar sem mover o sidebar

## Edição Inline de Tarefa v3.18
- [x] TaskDetail: edição inline do título (click no título → input, Enter/blur salva, Esc cancela)
- [x] TaskDetail: edição inline da descrição (click na descrição → textarea, botão Salvar/Cancelar)
- [x] Feedback visual: indicador de "salvando..." e confirmação de sucesso

## Quadro Branco v3.19
- [x] Corrigir desalinhamento do ponteiro de desenho no canvas (usar getBoundingClientRect + escala real)
- [x] Adicionar filtro por projeto no topo do Quadro Branco
- [x] Adicionar filtro por atividade (tarefa) dentro do projeto selecionado
- [x] Botão "Salvar e comentar na tarefa": salva o canvas e navega para o detalhe da tarefa selecionada
- [x] Adicionar botão Desfazer (histórico de 20 ações)
- [x] Tooltips em todos os botões da toolbar
- [x] Barra de status com ferramenta ativa, atividade selecionada e contagem de elementos

## Dashboard Moderno + Clientes v3.20
- [x] Schema: tabela clients (id, name, email, phone, company, createdAt)
- [x] Schema: campo clientId em projects (FK para clients)
- [x] Backend: procedures clients.create, list, update, delete
- [x] Backend: procedure dashboard.conflicts e dashboard.clientCount
- [x] Admin: aba de cadastro e gestão de clientes no painel Admin
- [x] Dashboard: KPIs percentuais (atraso, concluídas, revisões, dentro do prazo) com gauges circulares
- [x] Dashboard: gráfico de rosca (donut) com status das tarefas e porcentagens
- [x] Dashboard: alertas de conflito de atividade com nome do membro
- [x] Dashboard: lista de atividades da Sprint da Semana
- [x] Dashboard: totais de Projetos, Tarefas e Clientes

## Gantt Filtro por Membro v3.21
- [x] Gantt: adicionar filtro por membro (dropdown com membros do projeto selecionado)
- [x] Gantt: filtrar barras por assigneeId quando membro selecionado

## Sidebar Amarela + Logo LS + Correções v3.22
- [x] Sidebar: mudar cor de fundo para amarelo #FFBE00 com texto e ícones pretos
- [x] Sidebar: adicionar logo LS no rodapé (pequena, discreta)
- [x] Quadro Branco: corrigir inicialização do canvas (syncSize no mount + ResizeObserver)
- [x] Usuários: botão "Novo Usuário" no Admin com dialog de cadastro (nome, e-mail, papel)
- [x] Usuários: botões de promover/rebaixar papel e excluir usuário em cada linha

## Correções e Melhorias v3.23
- [x] Quadro Branco: diagnosticar e corrigir erro de funcionamento
- [x] Projetos: campo de seleção de cliente ao criar/editar projeto
- [x] Kanban: modal de motivo ao mover tarefa para coluna Bloqueado
- [x] Sprints: botão exportar relatório de Sprint como PDF

## Correções e Melhorias v3.23
- [x] Quadro Branco: diagnosticar e corrigir erro de funcionamento (canvas init com requestAnimationFrame)
- [x] Projetos: campo de seleção de cliente ao criar/editar projeto (seletor com nome + empresa)
- [x] Projetos: exibir badge do cliente no card do projeto
- [x] Kanban: modal de motivo ao mover tarefa para coluna Bloqueado (campo blockReason no schema/backend)
- [x] Kanban: tooltip com motivo do bloqueio no card (badge vermelho "Bloqueado")
- [x] Sprints: botão "Exportar PDF" com relatório completo (KPIs, lista de tarefas, burndown, branding Orbita)
- [x] 14/14 testes passando, 0 erros TypeScript

## Bug Fix v3.24
- [x] Quadro Branco: corrigir SelectItem value="" no seletor de atividade (causa raiz do erro em produção)

## Melhorias v3.25
- [x] PDFs: atualizar identidade visual para teal #102C2D e logo oficial LS no rodapé (Sprint PDF, AIChat PDF)
- [x] Dashboard: botão "Exportar PDF" com KPIs, gráficos e tabelas
- [x] Kanban: filtro por usuário/responsável (dropdown na barra de filtros)
- [x] TeamChat: chat privado 1-a-1 entre membros
- [x] TeamChat: criação de grupos de chat
- [x] Notificação automática ao bloquear tarefa (notificar criador e responsável com motivo)
- [x] TaskDetail: visualizador inline de anexos (PDF via iframe, imagens via img, fallback download)

## Melhorias v3.25
- [x] PDFs (Sprint, AIChat, Dashboard): identidade visual com header azul-marinho + amarelo #FFBE00 e logo LS Solutions no rodapé
- [x] Dashboard: botão "Exportar PDF" com KPIs, gráfico de status, tabela de projetos e rodapé LS Solutions
- [x] Kanban: filtro por usuário/responsável (dropdown na barra de filtros)
- [x] TeamChat: aba "Privado / Grupos" com conversas 1-a-1 e grupos (schema + backend + frontend)
- [x] TeamChat: criar conversa privada com busca de usuário
- [x] TeamChat: criar grupo com nome e seleção de membros
- [x] TeamChat: badge de mensagens não lidas nas conversas
- [x] Backend: notificação específica ao bloquear tarefa (inclui motivo do bloqueio na mensagem)
- [x] TaskDetail: botão "Visualizar" nos anexos abre modal inline (imagens e PDFs)
- [x] 0 erros TypeScript, 14/14 testes passando

## Próximos Passos v3.26
- [x] Kanban: filtro por cliente (dropdown na barra de filtros, filtra contratos e tarefas do cliente)
- [x] Dashboard: filtro por cliente (seletor no cabeçalho, filtra KPIs e gráficos)
- [x] Chat: polling otimizado (refetchInterval 2s quando aba ativa, 10s em background) + indicador "digitando..."
- [x] Página /relatorios: painel consolidado com todos os PDFs disponíveis (Sprint, Dashboard, Chat IA)
- [x] /relatorios: filtros de período e projeto, prévia dos dados antes de exportar

## Melhorias v3.26
- [x] Erro de runtime Select.Item corrigido (TeamChat e Whiteboard - value="" → "none")
- [x] Filtro por cliente na página de Projetos (busca + dropdown de cliente + estado vazio)
- [x] Filtro por cliente no Dashboard (dropdown no header, filtra KPIs e lista de projetos)
- [x] Chat: polling otimizado (2s visível / 15s em background) para task chat e direct chat
- [x] Página /relatorios: painel consolidado com 3 tipos de relatório (Dashboard, Projetos, Sprint)
- [x] Relatórios: link "Relatórios" adicionado à barra lateral de navegação

## Melhorias v3.27
- [x] Relatórios: card "Tarefas Bloqueadas" com motivo, responsável e projeto
- [x] Chat: indicador de presença online (ponto verde) para usuários ativos nos últimos 5 min
- [x] Gantt: botão "Exportar PDF" com tabela de tarefas, datas, responsáveis e alertas de conflito

## Revisão de Identidade Visual dos PDFs v3.27a
- [x] Reports.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] Sprints.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] AIChat.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] Dashboard.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions

## Melhorias v3.28
- [x] Relatórios: card "Tarefas Bloqueadas" com motivo, responsável e projeto
- [x] Chat: indicador de presença online (ponto verde) para usuários ativos nos últimos 5 min
- [x] Gantt: botão "Exportar PDF" com tabela de tarefas, datas, responsáveis e alertas de conflito

## Logo Oficial LS Solutions v3.29
- [x] Upload da logo oficial PNG para o armazenamento persistente do projeto
- [x] Substituir "LS" texto na sidebar (AppLayout.tsx) pela logo oficial
- [x] Substituir "LS" texto nos PDFs (Sprints, Dashboard, AIChat, Reports, Gantt) pela logo oficial LS Solutions

## Próximos Passos v3.30
- [x] Relatório de Tarefas Bloqueadas na página /relatorios (card + PDF com motivo, responsável, projeto)
- [x] Indicador de presença online no chat (ponto verde para usuários ativos nos últimos 5 min)
- [x] Exportar Gantt como PDF (tabela de tarefas, datas, responsáveis, alertas de conflito)

## Melhorias v3.31
- [x] Convidar membros para projetos via link (schema, backend, frontend)
- [x] Histórico de status no TaskDetail (linha do tempo de mudanças)
- [x] Relatório de desempenho por membro na página /relatorios

## Melhorias v3.31
- [x] Clientes: corrigir validação de e-mail (campo opcional rejeitando valor vazio)
- [x] tasks.update: registrar histórico de status automaticamente em task_status_history
- [x] Projetos: botão "Convidar" que gera link de convite de 7 dias
- [x] Página /join para aceitar convite via token
- [x] TaskDetail: aba "Histórico" com linha do tempo de mudanças de status
- [x] Relatórios: card de desempenho por membro (tarefas concluídas, em andamento, bloqueadas)
- [x] Admin: aba "Disciplinas" para criar, editar e excluir disciplinas/setores usados nas tarefas

## Melhorias v3.32 — Paleta, Landing Page e Planos
- [x] Paleta de cores: atualizar CSS variables (--primary, --accent, etc.) para nova paleta #1561ad / #1c77ac / #1dbab4 / #fc5226
- [x] Paleta de cores: atualizar sidebar (AppLayout) com nova paleta
- [x] Paleta de cores: atualizar PDFs (Reports, AIChat, Dashboard, Sprints, Gantt) com nova paleta
- [x] Landing page (Home.tsx): redesenhar como página pública de entrada com hero, features, planos e CTA de login/cadastro
- [x] Landing page: rota "/" sempre acessível sem autenticação (usuário logado é redirecionado para /dashboard)
- [x] Planos e Preços: criar página /planos com 3 tiers (Starter, Pro, Enterprise) + trial 15 dias
- [x] Planos e Preços: valores de mercado realistas (mensal + anual com desconto)
- [x] Planos e Preços: botão "Testar Grátis por 15 dias" no plano Pro
- [x] Planos e Preços: link na landing page e na sidebar/header

## Melhorias v3.33 — Disciplinas dinâmicas e Onboarding
- [x] Admin: aba Disciplinas já existe — verificar e garantir que está funcionando corretamente
- [x] Kanban: substituir lista hardcoded de setores por busca dinâmica do banco de disciplinas
- [x] TaskDetail: substituir lista hardcoded de setores por busca dinâmica do banco de disciplinas
- [x] Onboarding: criar componente OnboardingWizard (wizard 3 passos: criar projeto, convidar membro, criar tarefa)
- [x] Onboarding: exibir automaticamente para novos usuários (sem projetos criados)
- [x] Onboarding: botão "Pular" e persistência do estado (não mostrar novamente após concluir)

## Melhorias v3.34 — Campo CRS nas Tarefas
- [x] Schema: criar tabela `crs` (id, name, code, description, status: active/archived, createdAt)
- [x] Schema: adicionar coluna `crsId` na tabela `tasks` (FK opcional para crs.id)
- [x] Migrar banco de dados com SQL idempotente para a tabela de typing (schema Drizzle atualizado)
- [x] Backend: rotas crs.list, crs.create, crs.update, crs.archive, crs.restore, crs.delete
- [x] Backend: incluir crsId no tasks.create e tasks.update
- [x] Backend: retornar crsName junto com as tarefas nas queries
- [x] Kanban: adicionar select dinâmico de CRS no formulário de criação de tarefa
- [x] Kanban: exibir badge CRS no card da tarefa
- [x] TaskDetail: adicionar campo CRS editável na seção de detalhes
- [x] Admin: adicionar aba "CRS" com CRUD completo (criar, arquivar, restaurar, excluir)

## Refatoração v4.0 — Nova Arquitetura Cliente→CRS→Kanban

### Schema / Banco de Dados
- [x] Remover tabela `projects` e `project_members` do uso ativo (manter para migração)
- [x] Criar tabela `clients` com campos: name, description, color, status, createdById
- [x] Criar tabela `crs` com campos: clientId, name, code, description, country, state, status, createdById
- [x] Criar tabela `kanban_phases` com campos: crsId, name, color, position, isDefault, createdById
- [x] Adicionar coluna `phaseId` na tabela `tasks` (substitui `status` como enum fixo)
- [x] Criar tabela `checklist_items` com campos: taskId, title, assigneeId, status, position, createdById
- [x] Criar tabela `checklist_item_history` para histórico de movimentações dos itens
- [x] Criar tabela `vacation_periods` com campos: userId, startDate, endDate, approvedById
- [x] Migrar banco de dados

### Backend (routers.ts + db.ts)
- [x] Router `clients`: list, get, create, update, delete (apenas ADM)
- [x] Router `crs`: list, get, create, update, archive, delete (apenas ADM)
- [x] Router `kanbanPhases`: list, create, update, reorder, delete
- [x] Router `tasks`: adaptar para usar phaseId em vez de status enum
- [x] Router `checklistItems`: list, create, update, delete, reorder
- [x] Router `checklistItems.updateStatus`: atualizar status e registrar histórico
- [x] Cálculo automático de progresso da tarefa baseado nos itens do checklist
- [x] Router `vacations`: list, create, delete + verificação de conflito na atribuição
- [x] Router `dashboard.worldMap`: retornar CRS agrupados por país/estado com progresso
- [x] Router `dashboard.weekDeliveries`: tarefas com prazo na semana atual

### Frontend — Kanban Refatorado
- [x] Página `/kanban` agora lista Clientes → CRS em vez de Projetos
- [x] Dentro do CRS: Kanban com colunas = fases customizáveis (drag & drop de tarefas)
- [x] Gerenciar fases: botão para adicionar, renomear, reordenar e excluir fases
- [x] Card da tarefa: exibir progresso % baseado no checklist
- [x] Permissões: apenas ADM pode criar/editar/excluir tarefas

### Frontend — TaskDetail Refatorado
- [x] Aba "Checklist" com lista de subtarefas (criar, editar, excluir, reordenar)
- [x] Cada item: responsável, status, comentários próprios
- [x] Barra de progresso automática calculada pelos itens concluídos
- [x] Aba "Histórico" mostrando movimentações de tarefas E itens do checklist
- [x] Remover seção de anexos/upload

### Frontend — Admin
- [x] Aba "Clientes": CRUD completo de clientes
- [x] Aba "CRS": CRUD com seletor de país e estado/província do mundo
- [x] Lista completa de países e estados/províncias (dados estáticos)

### Frontend — Dashboard
- [x] Mapa mundial interativo com estados coloridos por progresso do CRS
- [x] Bolhas com número de CRS por estado, clicável com lista suspensa
- [x] Painel "Entregas da Semana": tarefas com prazo na semana, responsável, status, progresso
- [x] Indicador de progresso médio geral de todos os contratos ativos

### Frontend — Calendário Global
- [x] Visualização de agenda de todos os usuários
- [x] Cadastro de períodos de férias
- [x] Alerta quando tarefa/item é atribuído a usuário em férias
- [x] Notificação quando tarefa existente cai em período de férias do responsável

## Bugs v4.1 — Corrigidos
- [x] Bug: INSERT de clientes falha — colunas description/color/status faltavam na tabela (migração incompleta) — corrigido via ALTER TABLE
- [x] Bug: Página de Projetos/CRS não abria (estava redirecionando para dashboard) — reescrita como página de listagem de CRS completa com filtros, cards e CRUD

## Melhorias v4.2 — Mapa, Kanban por Disciplinas, Lista de Países/Estados
- [x] Dashboard: mapa mundial interativo com pins de CRS por país/estado
- [x] Dashboard: painel lateral do mapa com lista de CRS por localização
- [x] Kanban: reestruturar para colunas = disciplinas do CRS selecionado
- [x] Kanban: itens = tarefas com checklist sequencial, campo disciplina preenchido automaticamente pela coluna
- [x] CRS/Projetos: substituir input livre de país por select com lista completa (195 países)
- [x] CRS/Projetos: substituir input livre de estado por select dinâmico com estados do país selecionado (Brasil: 27 estados + todos os países com regiões)

## Bug v4.3
- [x] Bug: Kanban dos CRS não abria — rota /kanban faltava no App.tsx e o componente não lia o parâmetro ?crs=X da URL — corrigido

## Melhorias v4.4
- [x] Bug: Erro ao inserir nova tarefa no Kanban — fluxo de validação, mutation e diálogo de criação corrigidos
- [x] Fases padrão automáticas ao criar CRS (Para Iniciar, Em Andamento, Compartilhado, Publicado, Concluído e Bloqueado)
- [x] Submenu de CRS na sidebar com link direto para o Kanban de cada CRS ativo
- [x] Filtro de disciplina no Kanban (chips na barra superior)

## Melhorias v4.4 — Sidebar CRS + Filtro Disciplina Kanban
- [x] AppLayout: submenu expansível "Projetos" com lista de CRS ativos (links diretos para /kanban?crs=X)
- [x] Kanban: chips de filtro de disciplina abaixo da toolbar (clicar oculta/mostra colunas)
- [x] Kanban: botão "Todas" para restaurar visibilidade de todas as disciplinas
- [x] Kanban: chips mostram contagem de tarefas por disciplina

## Mapa + Dados Técnicos CRS v4.5
- [x] Schema: campos tipoObra, extensaoKm, areaHa, perimetroUrbano na tabela crs
- [x] Backend: getAllCrs, getCrsById, createCrs, updateCrs, getWorldMapData incluem novos campos
- [x] Router: crs.create e crs.update aceitam novos campos opcionais
- [x] Projects.tsx: formulário de criação/edição de CRS com seção "Dados Técnicos da Obra" (tipo de obra, extensão km, área ha, perímetros urbanos)
- [x] Dashboard: mapa com filtro de país e submenu de estado (dropdown dinâmico com estados que têm CRS)
- [x] Dashboard: pins agrupados por estado com bolinha azul mostrando número de contratos
- [x] Dashboard: clicar em pin de grupo abre lista de CRS do estado; clicar em CRS individual abre popup com dados técnicos
- [x] Dashboard: popup de CRS exibe tipo de obra, extensão, área, perímetros urbanos e link para Kanban

## Bug + Sugestões v4.6
- [x] BUG: Corrigido erro ao criar nova tarefa no Kanban (SelectItem com value="" em Kanban.tsx e TaskDetail.tsx)
- [x] Dashboard: pins coloridos por tipo de obra (implementação=azul, restauração=laranja, aumento=roxo, levantamento=cinza, misto=azul)
- [x] Dashboard: legenda de tipos de obra no canto inferior esquerdo do mapa
- [x] Kanban: filtro de fase na toolbar (dropdown com fases do CRS selecionado)
- [x] Kanban: badge de tipo de obra do CRS selecionado exibido na toolbar

## Bugs + Melhorias v4.7
- [x] Bug: Gantt corrigido — campo status inexistente substituído por phaseName/phaseColor da fase do Kanban
- [x] Bug: Calendário corrigido — schema e db.ts atualizados (crsId renomeado para projectId, alinhado com banco real)
- [x] Quadro Branco: reescrito com canvas de desenho funcional (caneta, formas, texto, borracha, cores, espessura)
- [x] Removida logo LS Solutions de todos os relatórios: AppLayout sidebar, Dashboard PDF, Gantt PDF, AIChat PDF (pesquisa + relatório visual), Sprints PDF, Reports PDF (todas as funções)

## Melhorias v4.8 — CRS Datas + Checklist + Gantt Refatorado
- [x] Schema: campos startDate e endDate nos itens de checklist
- [x] Backend: migrar banco com novos campos do checklist (ALTER TABLE checklist_items)
- [x] Backend: função getCrsDateRange deriva datas do CRS (startDate = menor data de início do checklist, endDate = maior data de entrega)
- [x] Backend: router crs.getById retorna datas derivadas do checklist (startDate, endDate, deliveryDate)
- [x] Backend: router tasks.listForGantt com filtros de clientId, crsId, setor, assigneeId
- [x] Frontend CRS (Projects.tsx): exibir datas derivadas (início/término/entrega) calculadas do checklist nos cards de CRS
- [x] Frontend Checklist (TaskDetail.tsx): campos de data de início e data de entrega em cada item de checklist
- [x] Gantt: filtros de Cliente, CRS, Disciplina e Usuário na toolbar
- [x] Gantt: visualização padrão por disciplina → usuário → tarefa (grupos colapsáveis)
- [x] Gantt: 3 modos de agrupamento: Por Disciplina, Por CRS, Por Usuário
- [x] Gantt: filtros dinâmicos (disciplinas e usuários disponíveis mudam conforme as tarefas filtradas)

## Correções e Melhorias v4.9
- [x] Restaurar 10 tarefas antigas (crsId=null) para CRS Br-101 fase "Para Iniciar", preservando usuários e setores
- [x] Chat: reescrito com chat privado, criação de grupos e somente usuários do sistema
- [x] Férias: alerta bidirecional — ao criar tarefa em período de férias e ao cadastrar férias com tarefas existentes
- [x] CRS: status simplificado para ativo/arquivado (removido "completed" do enum)
- [x] Kanban: colunas de disciplina sem badge de status (apenas contagem e barra de progresso)
- [x] Kanban: cards de tarefa sem badge de status (prioridade, fase, data, progresso)
- [x] Status somente nos itens de checklist (published/pending)
- [x] Dashboard: KPI "Checklist Concluído" com dados dinâmicos reais dos itens de checklist
- [x] Dashboard: donut chart atualizado (pendente, em andamento, concluído)

## Melhorias v5.0 — Relatórios, Tipos de Obra Múltiplos, KPIs e Progresso
- [x] CRS: campo tipoObra como seleção múltipla (array JSON) — pode ter implantação + restauração no mesmo CRS
- [x] Backend: schema, db.ts e routers atualizados para tipoObra como array JSON
- [x] Projects.tsx: checkboxes para seleção múltipla de tipos de obra (criação e edição)
- [x] Dashboard: KPIs de extensão total (km), área total (ha) e perímetros urbanos totais
- [x] Dashboard: pins coloridos corretamente com tipoObra como array JSON
- [x] Dashboard PDF: captura do mapa com html2canvas incluida no relatório
- [x] Gantt PDF: gráfico real HTML com barras de atividades, colunas de mês e semanas
- [x] Sprint PDF: gráfico burndown SVG substituí a tabela de dados no relatório
- [x] Kanban: progresso da coluna de disciplina calculado por itens de checklist (concluídos/total) em vez de tarefas com progress>=100
- [x] Fix: import duplicado do React no Dashboard.tsx removido

## Melhorias v5.1 — Responsável no Checklist + Checklist nas Sprints
- [x] Schema: tabela sprint_checklist_items criada no banco
- [x] Backend: db.ts com funções getSprintChecklistItems, addChecklistItemToSprint, removeChecklistItemFromSprint
- [x] Backend: procedures sprints.listChecklistItems, listAvailableChecklistItems, addChecklistItem, removeChecklistItem
- [x] Frontend (TaskDetail): seletor de responsável inline em cada item de checklist (admin edita, outros visualizam)
- [x] Frontend (TaskDetail): formulário de novo item com seletor de responsável (herdar da tarefa ou escolher usuário)
- [x] Sprint: aba "Checklist" com itens vinculados à sprint (add/remove), busca por título/tarefa/disciplina
- [x] Sprint: exibir responsável, disciplina, tarefa macro e status em cada item da sprint

## Melhorias v5.2 — Gantt PDF, Filtros Dashboard e Progresso por Cliente
- [x] Gantt PDF: exibir dias do mês na linha do tempo (3ª linha de cabeçalho: Mês / Semana / Dias)
- [x] Gantt PDF: marcar coluna do dia de hoje em vermelho (#ef4444) com borda lateral vermelha nas linhas de tarefa
- [x] Dashboard: filtro de cliente agora afeta KPIs (tarefas, checklist, progresso) via clientId na procedure stats
- [x] Dashboard: procedure stats aceita clientId opcional e filtra tarefas/checklist pelo cliente selecionado
- [x] Dashboard: nova procedure clientProgress retorna progresso médio por cliente (com contagem de CRS)
- [x] Dashboard: seção "Progresso por Cliente" com barras coloridas (cor do cliente), % e contagem de CRS
- [x] Reports.tsx: corrigido para passar input obrigatório na query de stats

## Melhorias v5.3 — Disciplinas Rodoviárias + Gantt Hoje + Drill-down Cliente + PDF Filtrado
- [x] Banco: 16 disciplinas padrão de infraestrutura rodoviária cadastradas (Estudos Ambientais, Topografia, Geotecnia, Pavimentação, Drenagem, Obras de Arte, Sinalização, Terraplenagem, Estruturas, Hidráulica, Elétrica/Iluminação, Desapropriação, Projeto Geométrico, Paisagismo, Segurança Viária, Gestão de Projetos)
- [x] CRS (Projects.tsx): componente CrsCard com seção expansível "Disciplinas" mostrando barra de progresso por disciplina (lazy load ao expandir)
- [x] Backend: procedure crs_discipline.progress retorna progresso por disciplina de um CRS (done/total/%)
- [x] Gantt interativo: linha vertical de "hoje" já existia e foi mantida/verificada na visualização em tela
- [x] Dashboard: drill-down no Progresso por Cliente — clicar na barra de um cliente filtra todos os KPIs; badge "Ativo" indica o filtro; clicar novamente remove o filtro
- [x] Dashboard PDF: exportação inclui nome do cliente no cabeçalho e badge colorido na data quando um cliente está filtrado

## Melhorias v5.4 — Renomear CRS→Contrato, Sprint corrigida, Dashboard por Ano, Mapa Colorido
- [x] Renomear CRS → Contrato em toda a UI (labels, títulos, mensagens, PDF, sidebar)
- [x] KPI do Dashboard: "Nº de Contratos" em vez de "Total de Projetos"
- [x] Sprint: filtro em cascata Cliente → Contrato (selecionar cliente filtra a lista de contratos)
- [x] Dashboard: procedure yearlyStats retorna dados agrupados por ano (tarefas, contratos, checklist, progresso)
- [x] Dashboard: seção "Visão Anual" com tabela por ano (2026, 2027...) com badge "Atual" no ano corrente e barra de progresso colorida
- [x] Mapa: colorir estados brasileiros com gradiente azul (claro→escuro) proporcional ao nº de contratos por estado
- [x] Mapa: clicar em um estado colorido abre o painel lateral com a lista de contratos daquele estado
- [x] Dashboard PDF: screenshot do mapa + tabela "Contratos por Estado/Região" com contagem

## Melhorias v5.5 — Calendário, Programação, Quadro Branco, Dashboard e Correções
- [x] Calendário: compromissos são do usuário (não da tarefa); mostrar nome do criador em cada evento
- [x] Calendário: detectar conflito com tarefas do usuário ao criar compromisso
- [x] Calendário: todos os usuários veem os compromissos de todos (visibilidade compartilhada)
- [x] Programação: filtro em cascata Cliente → Contrato na barra de filtros
- [x] Programação: lista semanal por usuário com itens de responsabilidade (tarefas do contrato filtrado)
- [x] Quadro Branco: tabela whiteboards criada no banco; cada usuário vê somente seus próprios quadros
- [x] Quadro Branco: suporte a múltiplas páginas por quadro (pageIndex); filtro de contrato removido
- [x] Dashboard: Projetos Ativos usa campo progress real do CRS (recalculado automaticamente pelas tarefas)
- [x] Dashboard: Minhas Tarefas mostra TODAS as tarefas atribuídas ao usuário (procedure dashboard.myTasks)
- [x] Dashboard PDF: tabela de contratos usa progress real e exibe código do contrato
- [x] Usuários duplicados: verificado e corrigido no banco (tarefas migradas para ID OAuth)

## Melhorias v5.6 — Sprint, m², Kanban por Disciplina, Tipos de Obra, Registros, Notificações
- [x] Sprint: corrigir inclusão de checklist com info de cliente, contrato, disciplina e item de origem
- [x] Sprint: unidade de área corrigida para m²
- [x] Kanban: definir disciplinas de responsabilidade do usuário (perfil/admin)
- [x] Kanban: mostrar somente colunas das disciplinas de responsabilidade do usuário logado
- [x] Tipos de obra: campo extensão e área distintos por tipo de obra
- [x] Dashboard: extensões e áreas separadas por tipo de obra
- [x] Checklist: histórico de modificações (quem fez, o quê, quando)
- [x] Aba Registros: log global de todas as modificações do sistema (usuário, data, hora, ação)
- [x] Notificações: nova mensagem no chat
- [x] Notificações: nova tarefa atribuída ao usuário
- [x] Notificações: @menção em comentário
- [x] Notificações: entrega do usuário dentro de 5 dias
- [x] Notificações: tarefas em atraso

## Melhorias v5.7 — Sprint, Dados Técnicos por Tipo, Dashboard Moderno
- [x] Sprint: corrigir aba "Checklist" com info de cliente, contrato, disciplina e item de origem
- [x] Projects.tsx: dados técnicos por tipo de obra (extensão km e área m² separados por tipo selecionado)
- [x] Schema/Backend: campo techDataByType (JSON) na tabela crs para armazenar dados por tipo
- [x] Dashboard: mapa reduzido para metade da tela (layout lado a lado com outro conteúdo)
- [x] Dashboard: redesenho completo estilo moderno (azul/branco, gráfico de linhas, mini-calendário semanal, últimas atualizações)
- [x] Dashboard: gráfico de linhas com tarefas entregues, atrasadas e em andamento por semana
- [x] Dashboard: mini-calendário semanal com programação do usuário
- [x] Dashboard: seção de últimas atualizações/modificações do sistema

## Bug v5.8 — Sprint Runtime Error
- [x] Sprint: corrigir erro de runtime na aba Checklist (TypeError em linha 644 do bundle)

## Bugs v5.8
- [x] Sprint: corrigir erro de runtime na aba Checklist (TypeError no bundle linha 644)
- [x] Relatório de desempenho dos membros: exibir dados reais dos usuários (tarefas concluídas, em andamento, atrasadas)

## Bug v5.9 — Varredura Completa Sprints
- [x] Sprint: varredura completa e correção de todos os problemas (banco, backend, frontend)
- [x] Sprint: aba Tarefas com botão remover e seção de adicionar tarefas do contrato
- [x] Sprint: phaseName/phaseColor em vez de status inexistente (bug de runtime corrigido)
- [x] Sprint: banco corrigido (crsId vs projectId) e getSprintWithTasks com JOIN em kanban_phases

## v5.10 — Correções e Publicação GitHub
- [x] Sprint: bug de runtime confirmado resolvido (SelectItem value='' corrigido na v5.9, @import CSS duplicado removido)
- [x] Varredura completa do código: 0 erros TypeScript, sem setState-in-render, sem SelectItem value vazio
- [x] Publicar no GitHub (push para repositório do usuário)

## v5.11 — Chat IA: Correção SQL e Ferramenta Analítica
- [x] Corrigir erro SQL: coluna crsId não existe no banco (banco usa projectId)
- [x] Migrar coluna projectId → crsId no banco (ALTER TABLE)
- [x] Reformular Chat IA como ferramenta analítica: painel de relatórios automáticos + chat contextual
- [x] Relatórios pré-definidos: Carga de Trabalho, Tarefas em Atraso, Desempenho por Membro, Progresso por Contrato
- [x] Chat contextual: IA recebe dados reais do sistema como contexto antes de responder
- [x] Exportar PDF de qualquer relatório gerado (jsPDF instalado)

## v5.12 — Chat de Tarefas: Correção de Funcionamento e Limpeza de Dados
- [x] Diagnosticar problema: conversas com participantes fantasma (IDs 690013, 720001, 810138 inexistentes)
- [x] Limpar banco: remover conversas órfãs e mensagens associadas
- [x] Corrigir getUserConversations: reescrito com Drizzle ORM (era SQL raw com resultado aninhado [Max Depth])
- [x] Corrigir getGroupConversations: reescrito com Drizzle ORM + lastMessage + memberCount
- [x] Corrigir procedure getConversations no router (remover result[0] desnecessário)
- [x] Testar fluxo completo: conversa abre, mensagem enviada, prévia atualizada na lista

## v5.13 — Dashboard: Exportar Relatório Geral por Ano
- [x] Criar função getAnnualReport no db.ts (KPIs, contratos, membros, disciplinas, tendência mensal)
- [x] Criar procedure dashboard.annualReport no routers.ts
- [x] Adicionar coluna "Exportar" na tabela de Visão Anual do Dashboard
- [x] Botão PDF por linha (ano) com estado de loading
- [x] Função exportAnnualReportPDF: HTML formatado com KPIs, barras mensais, tabelas de contratos/membros/disciplinas
- [x] Cabeçalho Orbita, rodapé, cores dinâmicas por taxa de conclusão

## v5.14 — Dashboard: GaugeChart (Velocímetro Segmentado)
- [x] Criar componente GaugeChart SVG com 10 segmentos coloridos (vermelho→laranja→amarelo→verde) e ponteiro
- [x] Substituir card "Tarefas em Atraso" (donut) pelo GaugeChart com inverted=true
- [x] Substituir card "Tarefas Concluídas" (donut) pelo GaugeChart
- [x] Substituir card "Checklist Concluído" (donut) pelo GaugeChart
- [x] Substituir card "Dentro do Prazo" → renomeado para "Entregues no Prazo" com GaugeChart
- [x] Ponteiro com animação spring e cor do valor dinâmica (verde/amarelo/vermelho)

## v5.15 — Dashboard PDF: Incluir Mapa e Dados Completos
- [x] Criar procedure dashboard.staticMapUrl: busca contratos ativos, gera URL da Static Maps API com marcadores por estado, converte para base64
- [x] Incluir imagem do mapa no PDF (via Static Maps API — sem problema de CORS)
- [x] Incluir tabela de contratos com localização e tipo de obra (com marcadores A-Z correspondendo ao mapa)
- [x] Incluir tabela de contratos por estado/região
- [x] Botão Exportar PDF atualizado: mostra "Gerando..." enquanto busca o mapa do servidor
- [x] Fallback: se Static Maps falhar, tenta html2canvas; se ambos falharem, exibe tabela de estados

## v5.16 — Relatórios: Corrigir Dados Zerados e Não Rastreados
- [x] Criar procedure tasks.listBlocked (SQL raw — campo status não existe no schema Drizzle, só no banco)
- [x] Criar procedure tasks.listWithCounts (SQL raw — contagem de tarefas por status por contrato)
- [x] Criar procedure sprints.listAll (Drizzle ORM — todas as sprints com nome do contrato)
- [x] Corrigir Reports.tsx: usar tasks.listWithCounts em vez de crs.list (sem taskCounts)
- [x] Corrigir Reports.tsx: usar sprints.listAll em vez de listByCrs com enabled:false
- [x] Corrigir Reports.tsx: usar tasks.listBlocked em vez de listByCrs com crsId:0
- [x] Seletor de sprint: mostra nome do contrato (Sprint 01 — Sim Center)
- [x] Card Tarefas Bloqueadas: mostra contagem real ou 'Nenhuma tarefa bloqueada'
- [x] Desempenho por Membro: 6 membros encontrados com dados reais

## v5.17 — Relatórios: 3 Melhorias
- [x] Filtro por cliente na aba Relatórios (seletor no topo, filtra todos os relatórios)
- [x] Badge ativo com nome do cliente e contagem de projetos filtrados + botão 'Limpar filtro'
- [x] PDF de Projetos com gráfico de barras SVG de progresso por contrato (verde/amarelo/vermelho)
- [x] PDF de Sprint com burndown chart SVG (linha ideal vs real, escala e legenda)
- [x] Seletor de sprint filtra por cliente quando cliente está selecionado
- [x] Tarefas Bloqueadas filtra por projetos do cliente selecionado

## v5.18 — PDF Dashboard + Kanban por Setor
- [x] PDF Dashboard: mapa com manchas azuis por estado + número de contratos no centro
- [x] PDF Dashboard: detalhamento de cada contrato (tipos de obra, extensões, tarefas e checklist em cascata por disciplina)
- [x] Kanban: filtrar colunas para mostrar apenas a disciplina do setor do usuário logado
- [x] Kanban: usuários sem setor definido veem todas as colunas (admin/fallback)

## v5.18 — PDF Dashboard com Detalhamento + Kanban Filtro Obrigatório
- [x] Dashboard PDF: query contractsForPdf integrada (tarefas por disciplina + checklist em cascata)
- [x] Dashboard PDF: seção "Detalhamento dos Contratos" com tipos de obra, extensão, tarefas e checklist por disciplina
- [x] Dashboard PDF: mapa + tabela de contratos por estado + detalhamento completo em cascata
- [x] Kanban: filtro por disciplina do usuário agora é OBRIGATÓRIO para não-admins com disciplinas configuradas
- [x] Kanban: badge "Filtrado pelo seu setor" exibido para usuários com filtro obrigatório
- [x] Kanban: botão "Todas" e toggles de disciplina desabilitados para usuários restritos
- [x] TypeScript: 0 erros confirmados

## v6.0 — Migração para Layout 3 (Split Panel)

- [x] Criar componente SplitLayout reutilizável
- [x] Atualizar AppLayout sidebar com novo estilo visual
- [x] Migrar Projetos para Split Panel (lista + detalhe)
- [x] Migrar Kanban para Split Panel (lista projetos + quadro)
- [x] Migrar Gantt para Split Panel (árvore + gráfico)
- [x] Migrar Sprints para Split Panel (lista sprints + detalhe)
- [x] Migrar Programação para Split Panel (entregas + calendário)
- [x] Migrar Calendário para Split Panel (mini-cal + calendário completo)
- [x] Migrar Relatórios para Split Panel (menu + preview)
- [x] Migrar Chat de Tarefas para Split Panel (lista conversas + chat — já era nativo)
- [x] Migrar Quadro Branco para layout full-canvas (já era nativo)
- [x] Migrar Notificações para Split Panel (lista + detalhe)
- [x] Migrar Admin para Split Panel (menu admin + conteúdo)
- [x] Aba "Manual de Uso" adicionada na sidebar (seção Ajuda) com conteúdo completo das 18 seções, navegação lateral, botão de download do PDF
- [x] Opção de remover usuário adicionada no painel Admin (aba Usuários) — botão Trash2 visível para admin/master_admin, exceto para o próprio usuário e para master_admin; diálogo de confirmação com aviso de ação irreversível; procedure users.delete protegida no backend

## v6.1 — 3 Melhorias no Dashboard
- [x] Corrigir erro TypeScript TS1005 no Dashboard.tsx (duplo parêntese return(( → return()
- [x] Exportar Dashboard PDF: botão "Exportar PDF" no header, função exportDashboardPDF com HTML completo (KPIs, SLA, contratos por estado, vencimentos, feed de atividades), abre janela de impressão do browser
- [x] Filtro de período SLA: toggle Mês/Trim./Ano no painel SLA, procedure slaStats aceita parâmetro period
- [x] Alerta automático de prazo: procedure checkDeadlineAlerts verifica tarefas com vencimento nos próximos 3 dias, envia notificação in-app para responsável e gestor (máx 1x por dia por tarefa), trigger automático ao carregar o Dashboard
- [x] 9 novos testes unitários (dashboard.test.ts): slaStats (4 testes), upcomingDeadlines (2 testes), checkDeadlineAlerts (3 testes)
- [x] Corrigir teste auth.logout.test.ts (asserção maxAge obsoleta removida)
- [x] Zero erros TypeScript confirmados

## v6.2 — 3 Sugestões do Dashboard
- [x] Toast visual quando alertas de prazo são enviados com a janela configurada
- [x] Configuração do prazo de alerta nas preferências de notificação (1, 3 ou 7 dias)
- [x] Backend: campo deadlineAlertDays em notification_preferences (default 3)
- [x] Backend: procedures notificationPreferences.deadlineAlertDays e updateDeadlineAlertDays persistem a preferência
- [x] Backend: checkDeadlineAlerts usa deadlineAlertDays do usuário
- [x] PDF Dashboard: incluir imagem do mapa de contratos por estado (captura do mapa atual)

## v6.3 — 4 Melhorias CRS/OS/Dashboard
- [x] Schema: campo crsCode (varchar 64) na tabela clients
- [x] Migrar banco: ALTER TABLE clients ADD COLUMN crsCode
- [x] Admin: campo "Código CRS" no formulário de cliente (ex: Seinfra)
- [x] Admin: exibir crsCode na lista de clientes
- [x] Projects/Kanban: ao criar CRS, seletor mostra "Código CRS - Nome do Cliente" (ex: Seinfra)
- [x] Projects: renomear label "Nome" → "OS" no formulário de criação/edição de CRS
- [x] Projects: renomear label "Código" → "Código CRS" no formulário
- [x] Projects: lista de contratos exibe "OS: {name}" e "CRS: {code}"
- [x] Mapa Dashboard: marcadores exibem "ClienteCrsCode-UF" (ex: Seinfra-BA) em vez de contagem
- [x] staticMapUrl: incluir clientCrsCode no retorno dos contratos
- [x] Dashboard: cards de totais (Extensão Total km, Área Total ha, Perímetros Urbanos)
- [x] Backend: getDashboardStats retorna totalExtensaoKm, totalAreaHa, totalPerimetroUrbano

## v6.2 — 4 Melhorias CRS/OS

- [x] Adicionar campo crsCode na tabela clients (Admin) para identificar clientes por código (ex: Seinfra, DNIT)
- [x] Seletor de cliente ao criar CRS exibe "CódigoCRS — Nome" para facilitar identificação
- [x] Renomear "Nome do Contrato" → "OS" (Ordem de Serviço) na aba Projetos e Admin
- [x] Renomear "Código" → "Código CRS" para clareza
- [x] Mapa do Dashboard exibe "CódigoCRS-UF" nos marcadores (ex: Seinfra-BA)
- [x] Dashboard com 3 novos KPI cards: Extensão Total (km), Área Total (ha), Perímetro Urbano (km)
- [x] Todos os 23 testes passando (3 arquivos de teste)

## v6.4 — 5 Melhorias Checklist/Kanban/km

- [x] Editar itens de checklist inline (clique para editar título)
- [x] Reordenar itens de checklist (botões seta para cima/baixo)
- [x] Mover tarefas entre colunas no Kanban com mudança de status automática (fase terminal = published)
- [x] Copiar estrutura de tarefa com checklist como template (botão Duplicar no TaskDetail)
- [x] Corrigir preenchimento de km dos projetos (adicionar inputs de extensaoKm, areaHa no formulário principal)
- [x] Todos os 23 testes passando (dashboard.test.ts com 9 novos testes)

## v6.5 — Componentes e Preparação para Itens Críticos

- [x] FilePreviewModal criado (PDF via iframe, imagens via img, fallback para download)
- [x] admin.createUser com hash de senha (scrypt nativo)
- [x] Campo company nos usuários + filtro por empresa (concluído no Dashboard e Kanban)
- [x] Notificações e alertas automáticos (preferências, vencimentos e bloqueios)
- [x] Todos os 23 testes passando
- [x] Zero erros TypeScript

## v6.6 — Animações e Feedback Visual no Kanban

- [x] Transições suaves ao mover tarefas (cubic-bezier 200ms)
- [x] Escala visual ao hover (1.02x) e ao arrastar (0.98x)
- [x] Drop zones com feedback visual (hover bg-primary/5)
- [x] Toast de sucesso ao mover tarefa entre colunas
- [x] Sombra dinâmica ao hover (shadow-lg)
- [x] Todos os 23 testes passando
- [x] Zero erros TypeScript


## v6.7 — Integração Google Calendar
- [x] Schema: criar tabelas google_calendar_tokens e google_calendar_events
- [x] Backend: funções db.ts para gerenciar tokens e eventos do Google Calendar
- [x] Backend: procedures tRPC para autenticação OAuth 2.0 do Google
- [x] Backend: procedures tRPC para sincronização de eventos
- [x] Backend: procedures tRPC para conectar/desconectar Google Calendar
- [x] Frontend: componente GoogleCalendarCard na página de Calendário
- [x] Frontend: botão "Conectar" que abre fluxo OAuth do Google
- [x] Frontend: botão "Desconectar" para remover integração
- [x] Testes: vitest para funções de Google Calendar (salvar, atualizar, deletar tokens)
- [x] Frontend: exibir eventos sincronizados do Google Calendar no calendário
- [x] Frontend: criar eventos no Orbita que sincronizam com Google Calendar
- [x] Backend: refresh automático de tokens expirados
- [x] Backend: sincronização bidirecional de eventos (Google → Orbita e Orbita → Google)


## v7.0 — Integração Wix + Stripe (Assinatura)
- [x] Configurar Stripe: criar produtos e planos (Starter R$29, Basic R$59, Pro R$89)
- [x] Backend: webhook Stripe para gerenciar assinaturas, cancelamentos, renovações
- [x] Backend: middleware de verificação de assinatura ativa
- [x] Backend: sistema de trial gratuito (15 dias)
- [x] Backend: limites por plano (usuários, projetos)
- [x] Frontend: página de pricing com 3 planos
- [x] Frontend: checkout integrado com Stripe
- [x] Frontend: portal do cliente (gerenciar assinatura, faturamento, cancelamento)
- [x] Frontend: integração com autenticação Google
- [x] Design: aplicar identidade visual LS Solutions (amarelo #FFC30D, preto, verde) na sidebar e cabeçalhos principais
- [x] Design: adaptar cores e tipografia para combinar com Wix
- [x] Integração Wix: criar embed/iframe para Orbita no domínio LS Solutions
- [x] Testes: fluxo completo de compra e assinatura (7/7 testes passando)
- [x] Documentação: guia de integração Wix (WIX_INTEGRATION.md + STRIPE_SETUP.md)


## v7.1 — Correções de publicação
- [x] Alterar unidade do KPI Perímetro Urbano de km para Un. no Dashboard
- [x] Alterar unidade do Perímetro Urbano para Un. na página de Projetos
- [x] Corrigir callback OAuth do Google Calendar para salvar tokens por usuário
- [x] Sincronizar eventos do calendário Google de cada usuário após a conexão
- [x] Atualizar credenciais OAuth do Google Calendar
- [x] Validar compilação e reiniciar o servidor

## v7.2 — Publicação solicitada
- [x] Salvar checkpoint das correções (versão a069e396); publicação final depende do clique em Publish no painel
- [x] Validar o status do ambiente após a publicação
- [x] Confirmar a versão publicada ao usuário


## v7.3 — Redesign do Gantt como Timeline
- [x] Diagnosticar a implementação atual do Gantt e mapear os dados existentes
- [x] Criar timeline com painel de tarefas à esquerda e escala temporal por mês
- [x] Exibir barras horizontais proporcionais às datas de início e fim
- [x] Adicionar agrupamento/expansão de subtarefas e linhas de dependência quando disponíveis
- [x] Exibir responsáveis, status e cores nas barras da timeline
- [x] Validar responsividade, TypeScript e testes do Gantt (36/36 testes; TypeScript sem erros)
- [x] Salvar checkpoint da nova visualização do Gantt (versão 1a143f2b)


## v7.4 — Organização e Publicação no GitHub
- [x] Auditar arquivos do projeto, `.gitignore` e estrutura de pacotes
- [x] Criar documentação completa de execução (`README.md`, orientações de ambiente e Stripe/Google OAuth)
- [x] Validar testes unitários (Vitest 36/36) e compilação TypeScript (0 erros)
- [x] Salvar checkpoint e sincronizar o repositório com o GitHub (`user_github`), confirmado em `main` no commit `fa4b1ec5`

- [x] Criar aba Reuniões com acesso para todos os usuários autenticados
- [x] Vincular cada reunião obrigatoriamente a um CRS, OS ou tarefa
- [x] Criar reunião no Google Calendar com link do Google Meet
- [x] Sincronizar e exibir relatório de reuniões com data, duração e participantes
- [x] Atualizar OAuth do Google com os escopos necessários para Calendar/Meet e validar associação por e-mail

- [x] Garantir que cada usuário conecte sua própria conta Google sem restrição de administrador
- [x] Atualizar callback OAuth para salvar tokens exclusivamente associados ao ID do usuário autenticado no Orbita
- [x] Validar sincronização de eventos e agenda individual por usuário

- [x] Diagnosticar aviso "O Google não verificou este app" na tela de consentimento OAuth
- [x] Explicar ao usuário que o aviso ocorre porque o app está em modo "Em testes" (Testing) no Google Cloud Console
- [x] Orientar como adicionar os e-mails dos usuários na lista de Test Users ou publicar o app no Google Cloud Console

- [x] Corrigir cálculo da extensão total (km) no backend e frontend do Dashboard
- [x] Separar a extensão total por tipo de obra (Implantação, Restauração, Aumento de Capacidade, Levantamento, Outro) no Dashboard
- [x] Atualizar procedure de estatísticas do Dashboard para retornar extensão detalhada por tipo de obra

- [x] Adicionar gráfico visual de barras e proporções para distribuição da extensão em km por tipo de obra no Dashboard

- [x] Aumentar a área de exibição do mapa no Dashboard principal
- [x] Suportar upload e parsing de arquivos KMZ/KML (trechos geográficos) vinculados a contratos/OS
- [x] Exibir os trechos importados em formato de polilinhas no mapa do Dashboard e na página de Projetos

- [x] Adicionar botão de alternância entre visualização Padrão e Satélite no mapa do Dashboard

- [x] Corrigir parser e validação do importador de trechos para aceitar arquivos KMZ/KML como BHShopping.kmz

- [x] Adicionar painel de controle no mapa para ativar/desativar cada trecho KMZ importado
- [x] Personalizar a cor das linhas no mapa de acordo com o tipo de obra do contrato correspondente
- [x] Exibir pop-up do trecho com contrato/OS e extensão em km ao clicar na linha do mapa

- [x] Criar marcadores numéricos amarelos centralizados em cada trecho KMZ importado no mapa
- [x] Incluir lista suspensa com filtro no mapa para localizar e dar zoom rapidamente nos trechos importados

- [x] Aplicar zoom automático e destaque ao clicar nos marcadores amarelos dos trechos no mapa
- [x] Implementar agrupamento automático (cluster) de marcadores amarelos em zoom afastado
- [x] Incluir botão para exportar a visualização atual do mapa com trechos e marcadores em imagem (PNG) ou PDF
- [x] Remover o bloco de 'Últimas atualizações' do Dashboard
- [x] Reposicionar a caixa de 'Vencimentos próximos' para a coluna esquerda completando o espaço vazio
- [x] Implementar agrupamento automático (cluster) de marcadores amarelos em zoom afastado
- [x] Incluir botão para exportar a visualização atual do mapa com trechos e marcadores em imagem (PNG) ou PDF

- [x] Adicionar botão para ampliar a tela do mapa (modo tela cheia / expandido) no Dashboard

- [x] Remover o widget de Gantt da semana da aba principal do Dashboard

- [x] Revisar o Kanban para permitir marcar card como 100% concluído, movendo-o automaticamente para a coluna Concluído, removendo-o dos atrasados e aplicando estilo visual sombreado/apagado

- [x] Remover os botões de PNG e PDF do mapa do Dashboard e anexar a captura do mapa ao relatório gerado por 'Exportar PDF'

- [x] Adicionar animação de carregamento (spinner/feedback visual) durante a geração do relatório PDF completo no Dashboard
- [x] Incluir resumo das tarefas marcadas como "Concluído" no Kanban dentro do relatório PDF exportado
- [x] Adicionar barra de pesquisa no Kanban para facilitar a localização de cards específicos pelo nome ou responsável

- [x] Adicionar gráfico proporcional de tarefas concluídas por responsável no relatório PDF exportado

- [x] Implementar feedback visual e notificação de sucesso quando um card do Kanban for movido para a coluna Concluído
- [x] TaskDetail: visualizar anexos PDF e imagens inline com fallback de download
- [x] Backend: fazer tasks.get retornar anexos reais da tarefa (id, filename, fileUrl, mimeType)
- [x] Testes: adicionar cobertura do fluxo de normalização e preview de anexos
- [x] TeamChat: atualizar lastSeenAt por heartbeat e manter o ponto verde válido por cinco minutos
- [x] Agente Orbita AI flutuante: bolha global para navegar até tarefas, pesquisar dados e consultar agenda
- [x] Orbita AI: adicionar animação de digitação e sugestões de comandos rápidos ao abrir
- [x] TaskDetail: sugerir comentários contextuais por IA e permitir inserir a sugestão no campo de comentário
- [x] Branding: substituir todas as logos Orbita pela logo enviada com fundo transparente na interface e nos relatórios
- [x] Testes: validar que a interface e os relatórios usam o ativo PNG transparente compartilhado
- [x] Logo sidebar: deixar somente o desenho sem fundo, aplicar hover suave e voltar ao Dashboard ao clicar
- [x] Testes: cobrir o destino Dashboard e a constante de interação da logo clicável da sidebar
- [x] Sidebar: adicionar modo recolhido com apenas a nova logo visível e controle acessível de expandir/recolher
- [x] Testes: validar o destino da logo e a chave de persistência do modo compacto da sidebar
- [x] Sidebar compacta: posicionar o botão do Orbita AI na parte inferior e ocultar o botão flutuante duplicado
- [x] Orbita AI: animar suavemente a transição do ícone entre sidebar expandida e recolhida
- [x] Testes: validar as posições expandida/recolhida e a duração da transição do Orbita AI
- [x] Orbita AI: permitir arrastar e redimensionar o painel aberto com limites de viewport e acessibilidade
- [x] Orbita AI: adicionar botão no cabeçalho para limpar o histórico da conversa e restaurar a mensagem inicial
- [x] Orbita AI: adicionar fade-out suave às mensagens durante a limpeza do histórico antes de restaurar a tela inicial
- [x] Orbita AI: animar a entrada da saudação e das sugestões rápidas após o fade-out do histórico
- [x] Orbita AI: mostrar spinner ou skeleton imediatamente no cartão da sugestão rápida selecionada durante o processamento
- [x] Orbita AI: adicionar efeito de hover suave e acessível aos cartões de sugestão rápida
- [x] Orbita: adicionar botão global de tema claro/escuro, persistência da preferência e transição suave de cores
- [x] Orbita: detectar prefers-color-scheme do sistema para definir o tema inicial quando não houver preferência manual salva
- [x] Relatórios: atualizar a paleta exportada para amarelo institucional, azul-marinho, preto e verde de status
- [x] Auth/Profile: garantir que auth.me exponha company e que o formulário carregue o valor atual
- [x] Auth/Profile: cobrir a inicialização e atualização de company com teste unitário
- [x] Kanban: ajustar o card para renderizar a empresa do responsável em uma segunda linha abaixo do nome
- [x] Kanban: validar visualmente ou por teste que assigneeCompany aparece abaixo do nome somente quando existir
- [x] Backend: criar alias admin.deleteUser com as mesmas proteções de users.deleteUser
- [x] Backend: testar o contrato admin.deleteUser contra autoexclusão e remoção do administrador principal
- [x] Bug: corrigir exportação do relatório PDF que não está sendo concluída
- [x] Bug: adicionar teste de regressão para a geração do relatório PDF com captura do mapa

- [x] Presença: padronizar o indicador online nas listas de usuários usando lastSeenAt e o limite compartilhado de cinco minutos

- [x] Dashboard: adicionar seletor pesquisável de cliente ao lado do filtro de empresa e aplicar a seleção aos indicadores e visualizações compatíveis

- [x] Kanban: renomear a coluna Arquivado para Concluído, sombrear cards concluídos e remover o marcador de atraso em tarefas concluídas ou com 100%

- [x] Kanban: permitir arrastar cards entre colunas com atualização automática da fase/status e manter as regras de bloqueio

- [x] Kanban: exibir Arquivado como Concluído, sombrear cards concluídos e ocultar o marcador de atraso em tarefas concluídas ou com 100%

- [x] Importação KMZ/KML: corrigir erro SQL no insert da tabela crs_segments e validar com o arquivo GO-319.kmz

- [x] Importação KML/KMZ: preservar nome, descrição e atributos dos elementos e exibi-los no mapa e na lista de trechos

- [x] Mapa KML/KMZ: diferenciar elementos por cores/ícones, adicionar busca rápida e exportar os dados atualizados em CSV

- [x] Mapa KML/KMZ: abrir painel lateral com detalhes completos do elemento ao clicar em ponto ou trecho

- [x] Company Admin: substituir seções contínuas por abas explícitas Usuários e Projetos da empresa

- [x] Alertas: notifyUser agora consulta notification_preferences.inApp e não cria alertas de tipos desativados pelo usuário

- [x] Mapa KML/KMZ: adicionar barra de pesquisa no painel lateral para filtrar por nome, descrição ou atributo

- [x] Mapa KML/KMZ: adicionar ordenação dos resultados por ordem alfabética ou tipo de geometria ao lado da pesquisa

- [x] Mapa KML/KMZ: destacar no mapa o elemento correspondente ao passar o mouse sobre um resultado da lista lateral

- [x] Mapa KML/KMZ: implementar rolagem interna e carregamento progressivo na lista lateral de resultados

- [x] Mapa KML/KMZ: exibir skeleton loader enquanto os elementos importados são processados inicialmente

- [x] Mapa KML/KMZ: exibir atributos completos em balão de informação ao clicar em ponto ou trecho

- [x] Mapa KML/KMZ: adicionar botão no balão para centralizar e aproximar o mapa no elemento selecionado

- [x] Interface: adicionar botão de alternância claro/escuro e adaptar painel lateral, controles e estilo do mapa

- [x] Mapa: adicionar controle de camadas para alternar entre mapa padrão e satélite respeitando o tema escuro

- [x] Tema escuro: substituir acentos amarelos pela cor teal escura de referência da imagem enviada

## Auditoria de lacunas v7.26
- [x] Whiteboard: reproduzir o erro de inicialização, corrigir o fluxo persistente e adicionar teste específico
- [x] PDFs: integrar a logo oficial LS Solutions nos rodapés de Sprint, Dashboard, AIChat, Reports e Gantt
- [x] Relatórios: adicionar card/exportação do PDF do Chat IA ao painel consolidado
- [x] PDF Dashboard: implementar mapa exportável com manchas/áreas azuis por estado e marcador numérico de contratos
- [x] PDF Dashboard: incluir detalhamento de contrato com tipos de obra, extensão, tarefas concluídas e checklist agrupado por disciplina
- [x] Banco: documentar no README a migração idempotente via SQL executada para chat_typing_states, em vez de pnpm db:push

## Dashboard — Atividade do Chat por Disciplina
- [x] Backend: métricas de atividade do chat e presença online agrupadas por disciplina, com isolamento por companyId
- [x] Dashboard: widget visual com mensagens recentes, usuários online, última atividade e atualização periódica por disciplina
- [x] Testes: cobrir agregação das métricas, estados vazios e filtragem multi-tenant do widget

## Widget de atividade — Comparação visual
- [x] Dashboard: gráfico de barras compacto para comparar métricas de atividade entre disciplinas
- [x] Dashboard: seletor acessível de métrica para alternar entre online, mensagens em 24h e usuários digitando
- [x] Testes: cobrir transformação dos dados do gráfico e estado vazio

## Widget de atividade — Navegação por disciplina
- [x] Dashboard: tornar barras do gráfico de atividade clicáveis
- [x] Chat: abrir conversa filtrada pela disciplina selecionada a partir do gráfico
- [x] Testes: cobrir a construção do destino e a acessibilidade da interação

## Widget de atividade — Mensagens não lidas
- [x] Backend: calcular mensagens não lidas por disciplina com isolamento por companyId
- [x] Dashboard: exibir indicador visual de não lidas em cada barra e no tooltip
- [x] Testes: cobrir contagem, destaque e estado sem mensagens não lidas

## Widget de atividade — Animação de não lidas
- [x] Adicionar transição suave quando o indicador de mensagens não lidas aparecer ou atualizar
- [x] Respeitar prefers-reduced-motion na animação do indicador
- [x] Adicionar testes para entrada, atualização e acessibilidade da animação

## Relatório PDF — Atividade do Chat
- [x] Criar relatório PDF com métricas gerais e detalhamento por disciplina
- [x] Incluir mensagens não lidas, presença, digitação e conversas ativas no relatório
- [x] Adicionar botão de exportação, loading e feedback de sucesso no Dashboard
- [x] Adicionar testes para dados, conteúdo e estados da exportação

## Dashboard — Atividade do Chat na aba Detalhada
- [x] Exibir presença e atividade por disciplina na aba Detalhada
- [x] Incluir online, mensagens 24h, conversas ativas, digitação, não lidas e última atividade
- [x] Preservar navegação para o TeamChat e atualização periódica
- [x] Cobrir o painel detalhado com testes e validação TypeScript

## Branding — Órbita e logo no tema escuro
- [x] Substituir o texto junto à logo LS Solutions por Órbita na interface
- [x] Aplicar o desenho da logo em branco no modo escuro
- [x] Atualizar relatórios e títulos relacionados ao branding sem quebrar a marca oficial
- [x] Adicionar testes de branding e validação dos dois temas
- [x] Manter exclusivamente a logo atual da Órbita e não usar a logo LS Solutions na variante do tema escuro

## Configurações — Branding por empresa
- [x] Criar aba de configurações acessível pelo painel para editar nome e logo da empresa
- [x] Persistir nome e logo por companyId com isolamento multi-tenant
- [x] Integrar configurações ao layout, tema escuro e relatórios PDF
- [x] Adicionar validação de upload, feedback de salvamento e testes

## Tema escuro — Logo transparente e contraste amarelo
- [x] Exibir a logo atual da Órbita sem fundo no modo escuro
- [x] Aplicar o amarelo predominante do tema claro aos textos e títulos de baixa legibilidade
- [x] Ajustar textos e indicadores de disciplina no modo escuro com contraste acessível
- [x] Adicionar testes de tokens, logo e contraste dos dois temas

## Dashboard — Caixas no tema escuro
- [x] Aplicar fundo escuro aos cartões e caixas de informação do Dashboard
- [x] Ajustar caixas internas, métricas, bordas e estados vazios para o tema escuro
- [x] Adicionar testes de tema para os cartões do Dashboard

## Dashboard — Reordenação de widgets
- [x] Permitir arrastar e soltar para reordenar os widgets do Dashboard
- [x] Exibir feedback visual e controles acessíveis durante a reordenação
- [x] Persistir a ordem por usuário e permitir restaurar a ordem padrão
- [x] Adicionar testes para reordenação, persistência e teclado

## Dashboard — Animação da reordenação
- [x] Adicionar transições fluidas de posição ao mover widgets
- [x] Destacar visualmente o widget arrastado e o alvo da soltura
- [x] Respeitar prefers-reduced-motion e preservar teclado e persistência
- [x] Adicionar testes de estados e transições da reordenação

## Dashboard — Indicadores de tendência flutuantes
- [x] Criar componente acessível de tendência com direção, variação e período
- [x] Aplicar indicadores aos KPIs e estatísticas dos widgets
- [x] Adicionar suporte a hover, foco por teclado e temas claro/escuro
- [x] Adicionar testes de conteúdo, estados e acessibilidade

## Dashboard — Período das tendências
- [x] Adicionar seletor de comparação entre mês, trimestre e ano no widget
- [x] Atualizar o período exibido nos indicadores e tooltips com dados reais
- [x] Persistir a preferência de período por usuário e widget
- [x] Cobrir seletor, acessibilidade, persistência e cálculos com testes

## Dashboard — Sparklines nos tooltips
- [x] Criar componente Sparkline SVG compacto para visualização de séries históricas
- [x] Integrar sparklines aos tooltips de tendência flutuantes
- [x] Conectar dados reais de série histórica por período aos sparklines
- [x] Adicionar testes de renderização, temas e acessibilidade

## Dashboard — Modal detalhado do sparkline
- [x] Criar gráfico detalhado interativo para a série histórica
- [x] Abrir modal ao clicar ou focar no sparkline do tooltip
- [x] Preservar período, tema, acessibilidade e navegação por teclado
- [x] Adicionar testes do gráfico, modal e interação

## Dashboard — Histórico ampliado do SLA
- [x] Criar consulta backend com múltiplos pontos reais agregados por semana ou mês
- [x] Preservar isolamento multi-tenant e coerência com o período selecionado
- [x] Conectar pontos e rótulos históricos ao sparkline e ao gráfico detalhado
- [x] Adicionar testes de agregação, rótulos e estados sem dados

## Mapa — Tela cheia e data/hora
- [x] Restaurar a expansão do mapa para tela cheia em desktop e mobile
- [x] Incluir data e hora na visualização ou exportação relacionada ao mapa
- [x] Adicionar testes para o modo tela cheia e a formatação de data/hora

## Tema escuro — Auditoria de todas as abas
- [x] Auditar superfícies claras residuais nas páginas e componentes compartilhados
- [x] Corrigir o Gantt e seus cabeçalhos, tabelas, filtros, calendário e estados vazios
- [x] Corrigir demais abas, modais, popovers e blocos de relatório para usar superfícies escuras semânticas
- [x] Adicionar testes de tema escuro, contraste e regressão visual

## Tema — Transição suave
- [x] Auditar a implementação atual de troca de tema e os elementos sem transição
- [x] Aplicar transição global a fundos, textos, bordas, sombras e SVG
- [x] Respeitar prefers-reduced-motion e evitar animação em mudanças estruturais
- [x] Adicionar testes de transição e validar TypeScript e preview

## Configurações — Duração da transição de tema
- [x] Auditar a página de configurações e a persistência atual de preferências visuais
- [x] Implementar duração configurável sincronizada entre ThemeContext, timer e CSS
- [x] Adicionar controle acessível com opções de duração e indicação de movimento reduzido
- [x] Adicionar testes de persistência, aplicação da duração, acessibilidade e TypeScript

## Habilidade Reutilizável — Orbita Workflow (`orbita-webdev-evolution`)
- [x] Extrair padrões de tRPC, Drizzle, React, testes, tema e checkpoints do projeto Orbita
- [x] Inicializar a nova habilidade utilizando `init_skill.py`
- [x] Escrever o SKILL.md e referências com instruções passo a passo
- [x] Validar a habilidade com `quick_validate.py` e entregar o arquivo SKILL.md

## Habilidade Reutilizável — Expansão Drizzle ORM (`orbita-webdev-evolution`)
- [x] Criar arquivo de referência com exemplos de joins, agregações e transações em Drizzle ORM
- [x] Atualizar o SKILL.md para apontar para a nova referência de queries complexas
- [x] Validar a habilidade com o script `quick_validate.py` e entregar o resultado

## Mapa — Verificação de tela cheia
- [x] Confirmar que o botão Ampliar usa posicionamento fixed e cobre toda a viewport
- [x] Corrigir altura, largura, z-index e redimensionamento do mapa em tela cheia
- [x] Adicionar ou atualizar testes do modo tela cheia e validar TypeScript

## Mapa — Animação de expansão
- [x] Auditar as regras atuais de expansão e movimento reduzido
- [x] Adicionar transição suave de opacidade, escala e deslocamento ao expandir e minimizar
- [x] Preservar foco, Escape, redimensionamento do mapa e prefers-reduced-motion
- [x] Adicionar testes de animação e validar TypeScript e preview

## Mapa — Painel lateral retrátil em tela cheia
- [x] Auditar dados de contratos, trechos, extensões, tipos de obra e visibilidade já disponíveis
- [x] Criar resumo rápido com métricas e lista de trechos importados
- [x] Implementar recolhimento, busca, seleção e integração com o destaque do mapa
- [x] Adicionar testes de interação, tema, acessibilidade e validar TypeScript

## Mapa — Centralização automática de trechos
- [x] Auditar a geometria e os pontos centrais disponíveis para cada trecho importado
- [x] Implementar centralização e zoom automático ao selecionar um trecho no painel lateral
- [x] Preservar destaque, visibilidade, acessibilidade e fallback para geometrias sem centro
- [x] Adicionar testes de seleção, zoom e validação TypeScript

## Mapa — Prévia dos marcadores
- [x] Auditar marcadores, eventos e dados de contratos/trechos disponíveis
- [x] Implementar tooltip ou prévia rápida no hover e no foco por teclado
- [x] Preservar clique, painel completo, temas e fechamento ao sair do marcador
- [x] Adicionar testes de conteúdo, acessibilidade e validar TypeScript

## Mapa — Marcadores por tipo de obra
- [x] Auditar tipos de obra e marcadores existentes
- [x] Implementar paleta e ícones semânticos por tipo de obra
- [x] Integrar legenda, hover, seleção, clusters, tema escuro e persistência
- [x] Adicionar testes de mapeamento visual e validar TypeScript

## Mapa — Animação de clusters
- [x] Auditar a renderização, limpeza e eventos de clusters durante o zoom
- [x] Implementar transição suave ao agrupar e desagrupar marcadores
- [x] Preservar hover, clique, cores por tipo, desempenho e prefers-reduced-motion
- [x] Adicionar testes de transição e validar TypeScript

## Mapa — Tela cheia isolada
- [x] Auditar o wrapper do Dashboard e o estado isMapExpanded
- [x] Ocultar os demais widgets e caixas enquanto o mapa estiver ampliado
- [x] Restaurar todos os widgets ao minimizar o mapa, sem perder a ordem ou o estado
- [x] Adicionar testes de alternância e validar TypeScript

## Mapa — Pesquisa em tela cheia
- [x] Auditar dados dos marcadores e filtros já existentes no painel lateral
- [x] Implementar pesquisa combinada por nome, número, arquivo e tipo de obra
- [x] Aplicar o filtro aos marcadores, clusters e lista lateral com limpeza acessível
- [x] Adicionar testes de pesquisa e validar TypeScript

## Mapa — Largura em tela cheia
- [x] Auditar o recorte atual do painel de resumos no modo ampliado
- [x] Reduzir levemente a área útil do mapa em tela cheia e reservar espaço para o resumo
- [x] Validar responsividade, testes e TypeScript após o ajuste

## Mapa — Painel direito sem rolagem horizontal
- [x] Auditar o recorte horizontal e os containers do mapa ampliado
- [x] Corrigir o grid de largura do mapa, painel e controles dentro da viewport
- [x] Bloquear rolagem horizontal e manter somente rolagem vertical no resumo
- [x] Atualizar testes e validar TypeScript
## Mapa — Preservação do zoom na seleção
- [x] Auditar fluxos que recalculam bounds, centro e zoom após seleções
- [x] Corrigir seleção e atualização dos marcadores sem reenquadramento geral
- [x] Adicionar testes de preservação da viewport e validar TypeScript

## Tema escuro — Superfícies das abas administrativas
- [x] Auditar fundos cinza em Projetos, Sprints, Programação, Calendário, Relatórios e Notificações
- [x] Substituir superfícies cinza por tokens escuros preservando o tema claro
- [x] Adicionar testes de regressão e validar TypeScript

## Mapa — Redução adicional em tela cheia
- [x] Auditar a largura atual do canvas e do painel no modo ampliado
- [x] Reduzir moderadamente a área útil do mapa mantendo o painel dentro da viewport
- [x] Validar testes, TypeScript e ausência de overflow horizontal

## Mapa — Preservação da viewport entre modos
- [x] Auditar expansão, minimização, resize e restauração da viewport
- [x] Capturar e restaurar centro e zoom ao alternar entre modo normal e tela cheia
- [x] Adicionar testes de regressão e validar TypeScript

## Mapa — Transição suave entre modos
- [x] Auditar estados, classes e temporização atuais da transição
- [x] Refinar animação de entrada e saída com opacidade, escala e deslocamento
- [x] Adicionar testes de animação, reduced motion e validar TypeScript

## Mapa — Filtros rápidos por status de obra
- [x] Auditar os dados de status das obras e o filtro atual do painel lateral
- [x] Implementar filtros Em andamento, Concluídas e Planejadas combinados com pesquisa e marcadores
- [x] Integrar estados visuais, métricas e acessibilidade nos temas claro e escuro
- [x] Adicionar testes e validar TypeScript

## Mapa — Legenda visual de status
- [x] Auditar a área de controles e as cores usadas pelos status das obras
- [x] Implementar legenda compacta sincronizada com os status e o tema ativo
- [x] Adicionar testes de cores e acessibilidade e validar TypeScript

## Mapa — Legenda clicável como filtro
- [x] Auditar o estado atual do filtro e da legenda visual
- [x] Tornar os itens de status clicáveis e sincronizados com o filtro lateral e os marcadores
- [x] Adicionar destaque ativo, suporte a teclado, aria-pressed e testes

## Mapa — Contagens na legenda de status
- [x] Auditar a contagem de status e a estrutura da legenda clicável
- [x] Adicionar badges de quantidade sincronizados aos botões da legenda
- [x] Validar atualização dinâmica, acessibilidade, testes e TypeScript

## Mapa — Percentuais na legenda de status
- [x] Auditar a base de cálculo e o layout atual dos badges da legenda
- [x] Calcular percentuais sobre o total de obras e exibir quantidade e percentual
- [x] Validar atualização dinâmica, acessibilidade, responsividade, testes e TypeScript

## Tema escuro — Fundo cinza e texto branco
- [x] Auditar a origem do fundo cinza e as classes relacionadas ao texto
- [x] Aplicar overrides somente no tema escuro para superfície escura e texto branco
- [x] Validar contraste nas telas afetadas, adicionar testes e checar TypeScript

## Tema escuro — Contraste de bordas e ícones
- [x] Auditar bordas, ícones e estados de hover/foco em Calendário, Projetos, Sprints, Programação, Relatórios e Notificações
- [x] Aplicar tokens e overrides somente no tema escuro para bordas e ícones
- [x] Adicionar testes de contraste e validar TypeScript e estados visuais

## Filtro global por período — Abas administrativas
- [x] Auditar navegação, layout compartilhado e fontes de datas de Calendário, Projetos, Sprints, Programação, Relatórios e Notificações
- [x] Criar estado global de período e controle no topo do painel
- [x] Aplicar o período às seis abas preservando filtros locais e estados vazios
- [x] Adicionar testes de sincronização, acessibilidade e validar TypeScript

## Experiência mobile simplificada
- [x] Auditar responsividade atual, navegação e telas prioritárias no celular
- [x] Implementar shell mobile com navegação compacta e cabeçalho adaptativo
- [x] Adaptar Dashboard, mapa e abas administrativas para fluxos simplificados no celular
- [x] Adicionar testes responsivos e de acessibilidade e confirmar que o desktop não mudou

## Dashboard — Indicadores visuais do período ativo
- [x] Definir rótulo acessível e formato visual reutilizável para o período global ativo
- [x] Exibir o período ativo nos títulos dos KPIs e gráficos do Dashboard sem duplicação excessiva
- [x] Adicionar testes de presença, conteúdo e atualização do indicador por preset e período personalizado
- [x] Validar responsividade, TypeScript, testes completos e estado visual do Dashboard

## Dashboard — Tooltip interativo do período ativo
- [x] Calcular e exibir a quantidade total de dias do período global ativo
- [x] Adicionar tooltip acessível com atalho rápido para abrir o filtro global
- [x] Garantir atualização do tooltip ao trocar preset ou intervalo personalizado
- [x] Validar teclado, responsividade, TypeScript e testes completos

## Dashboard — Skeleton de carregamento para KPIs e gráficos
- [x] Auditar os estados de carregamento das consultas e os pontos de renderização do Dashboard
- [x] Implementar skeletons reutilizáveis para KPIs e gráficos mantendo as dimensões do layout
- [x] Adicionar testes de presença, acessibilidade, temas e responsividade durante o carregamento
- [x] Validar TypeScript, suíte completa e estado visual do Dashboard

## Dashboard — Caixa Consolidada de OKRs
- [x] Criar tipos, rotas backend e dados reais agregados para Objetivos e Resultados-Chave (OKRs)
- [x] Implementar o componente de OKRs com abas de saúde, progresso dos KRs, tendência vs. meta, riscos, disciplinas e responsáveis
- [x] Adicionar navegação contextual integrada (atalhos para contratos, Kanban e mapa)
- [x] Escrever testes unitários e de integração para a nova seção de OKRs e validar TypeScript

## Entrega Final — Pacote VS Code e Sincronização GitHub
- [x] Atualizar o README.md com instruções passo a passo para clonar, instalar dependências, rodar migrações, iniciar o servidor e executar os testes no VS Code
- [x] Criar arquivo compactado (.zip) limpo do projeto, excluindo dependências desnecessárias, logs e cache
- [x] Sincronizar o repositório atualizado no GitHub (remote user_github)
- [x] Validar integridade da build, TypeScript e testes (236/236 testes aprovados)

## Segurança da Informação e Auditoria de Dados
- [x] Conduzir varredura de vulnerabilidades (autenticação, CORS, cookies httpOnly, isolamento multi-tenant por companyId)
- [x] Implementar e verificar métodos de proteção (validação estrita com Zod, hash bcrypt de senhas, rotas protegidas tRPC)
- [x] Criar testes unitários focados em segurança e controle de acesso
- [x] Atualizar o README com o Relatório de Auditoria de Segurança e Controles Implementados

## Autenticação de Dois Fatores (2FA) para Administradores
- [x] Adicionar campos de 2FA (secret, enabled, backupCodes) na tabela users do Drizzle schema
- [x] Implementar gerador de segredo TOTP e verificador de código com otplib / crypto no backend
- [x] Criar procedimentos tRPC protegidos para iniciar 2FA, verificar token, gerar QR Code e desativar 2FA
- [x] Criar aba ou seção de Segurança com painel 2FA no perfil do usuário ou painel admin
- [x] Escrever testes de segurança para ativação, verificação de token inválido/válido e desativação
- [x] Atualizar o README e documentar a adoção de 2FA
## Plataforma Multi-Tenant com Domínios Personalizados e Marca Única
- [x] Adicionar tabela company_domains no schema do Drizzle com verificação de tokens e status de SSL
- [x] Implementar procedures tRPC protegidas para listar, cadastrar, verificar e remover domínios de empresas
- [x] Criar procedimentos para resolver o tenant pelo Host da requisição com isolamento de segurança
- [x] Desenvolver a tela administrativa de domínios personalizados no painel de administração
- [x] Escrever testes unitários e de integração para validação de domínios e isolamento multi-tenant
- [x] Atualizar o README com orientações de nomes comerciais (sem números) e guias de DNS/SSL

## Próximos Passos Sugeridos — Aprimoramentos Multi-Tenant e Domínios
- [x] Implementar upload e atualização de logotipos personalizados por empresa com validação de imagem e persistência em S3
- [x] Adicionar colunas de controle de validade e status de certificado SSL/TLS na tabela company_domains
- [x] Criar alertas visuais no painel de domínios para certificados próximos do vencimento ou pendentes de emissão
- [x] Implementar o redirecionamento automático de domínios secundários verificados para o domínio primário configurado
- [x] Criar testes unitários para a nova lógica de SSL, redirecionamento e branding dinâmico, mantendo zero erros TypeScript

## Pré-visualização de Branding por Empresa
- [x] Criar preview interativo do dashboard com as cores e o logotipo temporários
- [x] Suportar alternância entre tema claro e escuro no preview
- [x] Integrar alterações de nome, cores e upload de logo sem persistir antes da confirmação
- [x] Adicionar reset/cancelamento e estados acessíveis de carregamento e erro
- [x] Criar testes de regressão e validar TypeScript, responsividade e acessibilidade

## Branding — Feedback visual ao salvar configurações
- [x] Adicionar transição suave ao estado de salvamento do branding
- [x] Exibir feedback visual acessível para salvando, sucesso e erro
- [x] Respeitar prefers-reduced-motion nas animações
- [x] Criar testes de estados, acessibilidade e validação TypeScript

## Entrega Final Nativa — VS Code e Sincronização GitHub
- [x] Validar compilação limpa de produção e execução da suíte completa de testes
- [x] Atualizar o README com instruções detalhadas para abrir e rodar o projeto nativamente no VS Code
- [x] Sincronizar todas as alterações no repositório do GitHub (solutionstechnologyinformation-beep/Orbita)
- [x] Gerar pacote compactado (.zip) com a fonte nativa completa e limpa para desenvolvimento local

## Próximos Passos Implementados — VS Code Workspace e CI GitHub Actions
- [x] Criar `.vscode/settings.json` com regras de formatação e exclusões de workspace
- [x] Criar `.vscode/extensions.json` com extensões recomendadas para a equipe
- [x] Criar `.github/workflows/ci.yml` para execução automática de tipos TypeScript e testes Vitest a cada push
- [x] Validar integridade da build, TypeScript e executar todos os testes automatizados

## Novas Melhorias — Acessibilidade, Logs de Auditoria CSV e Tour Guiado
- [x] Implementar exportação de logs de auditoria em CSV no painel administrativo
- [x] Implementar tour guiado interativo para branding e domínios no painel administrativo
- [x] Reforçar acessibilidade (contraste, foco visível, navegação por teclado e `prefers-reduced-motion`)
- [x] Escrever testes unitários para a exportação CSV, o tour guiado e a acessibilidade
- [x] Validar compilação TypeScript e execução de 100% dos testes Vitest

## Funcionalidade 2FA Avançado (SMS e E-mail)
- [x] Atualizar schema Drizzle para colunas de 2FA por SMS/Email (cancelado por solicitação do usuário)
- [x] Implementar migração SQL correspondente no banco de dados (cancelado por solicitação do usuário)
- [x] Criar adaptadores seguros para envio de código por E-mail e SMS (cancelado por solicitação do usuário)
- [x] Criar procedures tRPC para envio de código SMS/Email, verificação e enrolamento seguro (cancelado por solicitação do usuário)
- [x] Atualizar painel de segurança do administrador com opções de escolha de canal (cancelado por solicitação do usuário)
- [x] Escrever testes unitários para o fluxo completo de 2FA por SMS/E-mail (cancelado por solicitação do usuário)
- [x] Validar tipos TypeScript e suíte de testes; checkpoint v7.35 não será criado para esta opção cancelada

## Integração com Domínio Próprio e Wix (LSSolutions)
- [x] Configurar subdomínio `app.lssolutions.com.br` para o Orbita
- [x] Criar guia de integração e registros DNS para o Wix (`guide-lssolutions-integration.md`)
- [x] Validar compatibilidade de cookies, sessões e autenticação Google OAuth
- [x] Salvar checkpoint e preparar documentação final da integração

## Manual Operacional de Subdomínio, Vendas e Gestão Multi-Tenant
- [x] Criar documento detalhado com passo a passo de configuração do subdomínio no Wix (`guide-lssolutions-operations.md`)
- [x] Documentar o fluxo de comercialização de planos (Starter, Basic, Pro) com trial de 15 dias na plataforma Wix
- [x] Descrever a governança multi-tenant para gerenciamento isolado de cada empresa adquirente via painel master e company_admin

## Logo Branca no Tema Escuro
- [x] Remover o quadrado cinza da logo e preservar o desenho branco com fundo transparente
- [x] Integrar a nova asset nas referências da interface e relatórios no tema escuro
- [x] Validar contraste, renderização e testes da alteração visual (TypeScript + 257 testes Vitest)

## Assistente IA Inteligente com Memória Persistente
- [x] Criar schema e tabela `user_ai_memories` para armazenar preferências e aprendizados do usuário
- [x] Implementar procedures tRPC protegidas para listar, adicionar e remover memórias de longo prazo
- [x] Atualizar o motor do assistente flutuante para injetar as memórias e preferências salvas no contexto do LLM
- [x] Adicionar comandos conversacionais de aprendizado ("Lembre que...", "O que você lembra?")
- [x] Criar testes unitários para o sistema de memória da IA (`server/ai-memory.test.ts`)
- [x] Validar compilação TypeScript e aprovação de 100% dos testes Vitest (258/258)

## Atalhos de Voz para o Assistente IA
- [x] Adicionar reconhecimento de voz nativo em português ao FloatingAgent
- [x] Exibir estados acessíveis de escuta, permissão, erro e indisponibilidade
- [x] Preservar fallback para digitação e impedir envio de áudio para serviços externos
- [x] Criar testes unitários do adaptador e validar TypeScript e suíte completa (261/261 testes aprovados)

## Resumo de Relatórios de Projetos por Voz
- [x] Atualizar o motor do assistente flutuante para reconhecer pedidos de resumo de relatórios ("resumir relatório", "relatório do projeto")
- [x] Implementar consulta segura de dados do contrato/CRS e tarefas para gerar resumo executivo via LLM
- [x] Adicionar testes unitários para o comando de resumo e validação da suíte completa (262/262 testes aprovados)

## Resposta Falada do Assistente IA
- [x] Adicionar síntese de voz nativa para ler as respostas do assistente em português
- [x] Incluir controles acessíveis de falar, pausar, retomar e parar
- [x] Manter a resposta escrita, com fallback quando SpeechSynthesis não estiver disponível
- [x] Criar testes unitários para limpeza de texto, estados de fala e compatibilidade (265/265 testes aprovados)

## Narração de Ações e Saudação Personalizada
- [x] Buscar o nome autenticado do usuário no contexto da sessão
- [x] Narrar a ação antes da navegação ou consulta e ler a resposta completa depois
- [x] Exibir o nome do usuário nas mensagens escrita e falada sem cruzar tenants
- [x] Criar testes de personalização, ações e fallback de síntese de voz (266/266 testes aprovados)

## Wake Word e Saudação do Assistente IA
- [x] Falar a saudação “Que bom te ver novamente, qualquer coisa é só me chamar” ao abrir o assistente
- [x] Implementar escuta opcional da frase de ativação “Olá Órbita” enquanto a página estiver ativa
- [x] Exibir indicador de microfone ativo, botão de desligamento e mensagens de permissão/indisponibilidade
- [x] Criar testes da normalização da wake phrase e da saudação personalizada (267/267 testes aprovados)

## Ondas Sonoras do Indicador IA
- [x] Criar componente visual de ondas para os estados ouvindo e falando
- [x] Diferenciar estados pausado, inativo, erro e reduced motion
- [x] Integrar o indicador no botão flutuante e no cabeçalho do assistente
- [x] Criar testes de estados e acessibilidade do indicador (269/269 testes aprovados)

## Agente Operacional Contextual de IA
- [x] Expandir inteligência do assistente para controlar mapa, zoom regional e destaque de contratos
- [x] Implementar comandos de voz e texto para geração de relatórios PDF por período (ex: Agosto)
- [x] Criar módulo de backend processOperationalAgentCommand com suporte a diálogos e intenções estruturadas
- [x] Garantir isolamento por tenant e adicionar testes unitários (271/271 testes aprovados)

## Branding da Tela de Autenticação
- [x] Substituir a logo atual exibida no fluxo de autenticação pela logo nova do Orbita
- [x] Atualizar referências de asset e garantir compatibilidade com o tema escuro
- [x] Validar a renderização e a suíte de testes após a alteração (274/274 testes aprovados)

## Voz Feminina Suave do Assistente
- [x] Priorizar vozes femininas naturais em português do Brasil
- [x] Ajustar ritmo e tom para uma leitura suave e acolhedora
- [x] Adicionar testes de seleção da voz feminina e validar a síntese de voz (275/275 testes aprovados)

## Melhorias Avançadas de Voz do Assistente
- [x] Implementar seletor de estilo de voz (suave, profissional, enérgica)
- [x] Adicionar controle deslizante de velocidade de leitura persistido
- [x] Não implementar sinais sonoros de confirmação, conforme solicitado em “Continue sem o último comando”
- [x] Validar com testes unitários e zero erros TypeScript (277/277 testes aprovados)

## Saudação no Fechamento do Assistente
- [x] Remover a saudação automática ao abrir o painel flutuante
- [x] Falar a mensagem de boas-vindas somente ao fechar a caixa flutuante
- [x] Validar o fluxo de abertura, fechamento e síntese de voz (276/276 testes aprovados)

## Evolução do Assistente Inteligente e Análise de Demandas
- [x] Remover os seletores de tipo e velocidade de fala do painel flutuante
- [x] Corrigir o roteamento e navegação para a aba de atividades / Kanban
- [x] Expandir o backend do assistente para lidar com conversas gerais (saudações, dúvidas, etc.)
- [x] Implementar inteligência para avaliar demandas em aberto e sugerir distribuição de equipe e prazos
- [x] Validar com testes unitários e garantir zero erros TypeScript (278/278 testes aprovados)

## Simplificação da Fala do Assistente
- [x] Remover a frase "qualquer coisa é só me chamar" da saudação
- [x] Configurar a síntese de voz para falar apenas confirmações curtas de ações e saudações
- [x] Impedir que a resposta detalhada escrita no chat seja lida inteiramente em voz alta
- [x] Validar com testes unitários e zero erros TypeScript (278/278 testes aprovados)

## Exportação de Sugestões de Distribuição de Equipe
- [x] Incluir dados estruturados de recomendações (tarefa, responsável, prazo, justificativa) na resposta da análise de demandas
- [x] Adicionar procedure tRPC ou rota para exportar as recomendações em PDF estruturado
- [x] Adicionar opção de exportar em planilha CSV diretamente pelo painel do assistente
- [x] Validar isolamento por tenant, testes unitários e zero erros TypeScript (278/278 testes aprovados)

## Pré-visualização do Relatório de Distribuição de Equipe
- [x] Criar estado e modal de pré-visualização no FloatingAgent para revisar recomendações antes do PDF
- [x] Adicionar botões de confirmar exportação ou cancelar na pré-visualização
- [x] Validar com testes unitários e zero erros TypeScript (281/281 testes aprovados)

## Animação de Carregamento para Sugestões de Distribuição de Equipe
- [x] Criar componente visual de esqueleto/carregamento animado específico para análise de demandas da IA
- [x] Integrar o estado de carregamento ao FloatingAgent durante a mutação de chat do assistente
- [x] Validar com testes unitários e zero erros TypeScript (283/283 testes aprovados)

## Novo Personagem do Assistente Orbita
- [x] Preparar e hospedar o personagem com fundo transparente como asset do projeto
- [x] Substituir o ícone flutuante atual pelo personagem do Assistente Orbita
- [x] Transformar o painel aberto em balão de conversa ao lado do personagem
- [x] Validar responsividade, acessibilidade e renderização do novo assistente (283/283 testes aprovados)

## Voz Masculina do Assistente Orbita
- [x] Atualizar getBestPortugueseVoice para priorizar locutores masculinos naturais em português do Brasil
- [x] Ajustar tom e taxa de fala para garantir clareza e tom profissional
- [x] Atualizar os testes unitários de síntese de voz e validar zero erros TypeScript (283/283 testes aprovados)

## Atualização do Boneco e Teste de IA do Assistente Orbita
- [x] Atualizar o asset do personagem transparente para a versão v3 sem fundo branco
- [x] Validar a integração do agente de IA com respostas contextuais e sugestões de distribuição de tarefas
- [x] Executar suíte Vitest e garantir 100% de aprovação (zero erros TypeScript) — 283/283 aprovados

## Reação a Atrasos no Assistente Orbita
- [x] Consultar tarefas atrasadas via tRPC no FloatingAgent para determinar o estado de alerta do assistente
- [x] Adicionar animação de atenção (pulso suave / crachá de alerta âmbar) no boneco quando houver tarefas em atraso
- [x] Respeitar prefers-reduced-motion e garantir acessibilidade para leitores de tela
- [x] Adicionar testes unitários para o estado de alerta de atraso e validar zero erros TypeScript (286/286 testes aprovados)

## Substituição do Boneco do Assistente Orbita
- [x] Hospedar a imagem enviada como asset persistente do projeto
- [x] Atualizar o FloatingAgent para usar a nova imagem como boneco
- [x] Validar que o fundo branco não apareça e preservar alertas, balão e acessibilidade (286/286 testes aprovados)

## Ajuste de Saudação Única e Novo Boneco IMG_4220(1)
- [x] Processar IMG_4220(1).png para garantir fundo transparente e hospedagem persistente
- [x] Configurar saudação de boas-vindas para ocorrer apenas na primeira abertura do assistente por sessão/usuário
- [x] Validar com testes unitários e garantir zero erros TypeScript

## Animação de Flutuação e Entrada do Boneco Transparente
- [x] Implementar animação suave de entrada/flutuação no boneco do Assistente Orbita com `@keyframes` e suporte a `prefers-reduced-motion`
- [x] Validar com testes unitários em Vitest e verificar ausência de erros TypeScript (288/288 testes aprovados)

## Ajuste de Saudação Única e Novo Boneco IMG_4220(1)
- [x] Processar IMG_4220(1).png para garantir fundo transparente e hospedagem persistente (/manus-storage/orbita-assistant-img4220-1-transparent_05a48061.png)
- [x] Configurar saudação de boas-vindas para ocorrer apenas na primeira abertura do assistente por sessão/usuário (usando sessionStorage)
- [x] Validar com testes unitários (286/286 testes Vitest aprovados) e garantir zero erros TypeScript



## Boneco do Assistente Orbita em Formato Circular
- [x] Gerar ou aplicar asset circular transparente mantendo o personagem engenheiro e fundo externo transparente (/manus-storage/orbita-assistant-circular-img4216_7eb3657c.png)
- [x] Integrar o asset circular ao FloatingAgent no balão de conversação e no botão flutuante
- [x] Aplicar classes CSS `rounded-full object-cover overflow-hidden` para remover qualquer formato quadrado e garantir círculos perfeitos
- [x] Validar com testes unitários em Vitest e verificar ausência de erros TypeScript (288/288 testes aprovados)

## Remoção de Formato Quadrado do Avatar
- [x] Aplicar classes CSS `rounded-full object-cover overflow-hidden` nos contenedores e tags img do avatar do Assistente Orbita para garantir formato 100% redondo
- [x] Validar com testes unitários em Vitest e verificar ausência de erros TypeScript (288/288 testes aprovados)

## Animação de Pulso no Hover do Avatar Circular
- [x] Adicionar efeito CSS de pulso suave na borda/anel ao passar o mouse sobre o avatar do Assistente Orbita com suporte a `prefers-reduced-motion`
- [x] Validar com testes unitários e garantir zero erros TypeScript (289/289 testes aprovados)

## Indicador de Digitação Animado no Assistente Orbita
- [x] Criar componente visual `AssistantTypingIndicator` com três pontos saltitantes sincronizados e suporte a acessibilidade (`role="status"`, `aria-live="polite"`, `prefers-reduced-motion`)
- [x] Integrar o indicador de digitação no FloatingAgent enquanto o status de mutação/processamento estiver ativo
- [x] Validar com testes unitários em Vitest e verificar ausência de erros TypeScript (291/291 testes aprovados)

## Guia em PDF e Recompilação do Pacote
- [x] Gerar guia passo a passo em PDF profissional utilizando Typst (`Guia_Execucao_Orbita_VSCode.pdf`)
- [x] Recompilar e incluir o guia no pacote ZIP completo para o VS Code (`orbita-complete-project.zip`)

## Migração de Dados (Excel e JSON)
- [x] Implementar motor backend de snapshot em Excel com abas separadas (Empresas, Clientes, Contratos-CRS, Trechos-KMZ, Tarefas, Fases, Agenda, Sprints) e formato JSON
- [x] Criar componente visual `MigrationPanel` na página principal do Dashboard com botões de exportação e importação de arquivo `.json`
- [x] Validar com testes unitários e garantir zero erros TypeScript (293/293 testes aprovados)

## Backup Automático Semanal
- [x] Persistir configuração de agendamento semanal por empresa com taskUid do Heartbeat
- [x] Executar backup Excel no endpoint protegido e armazenar o arquivo no storage
- [x] Adicionar controles no painel para configurar, pausar, retomar e remover o agendamento
- [x] Validar isolamento multi-tenant, idempotência e testes completos (296/296 testes aprovados; TypeScript sem erros)

## Migração dentro de Administração
- [x] Remover o painel de migração do Dashboard principal
- [x] Criar rota/página dedicada para exportar Excel, exportar/importar JSON e configurar backup semanal
- [x] Adicionar Migração como subitem visual de Administração na barra lateral e no menu mobile
- [x] Validar navegação, responsividade, testes e TypeScript (296/296 testes aprovados)

## Modal de Confirmação de Importação JSON
- [x] Criar estado para armazenar o conteúdo do arquivo JSON pendente de importação
- [x] Adicionar modal de confirmação exibindo aviso de segurança, nome do arquivo e botão de confirmação/cancelamento
- [x] Validar com testes unitários em Vitest e garantir zero erros TypeScript (299/299 testes aprovados)

## Relatório de Log de Importação na Tela
- [x] Expandir o backend de importação para registrar mensagens detalhadas de inserção, falhas e itens ignorados por entidade
- [x] Criar modal ou painel de relatório de importação exibindo estatísticas e log detalhado na tela após a conclusão
- [x] Validar com testes unitários em Vitest e garantir zero erros TypeScript (300/300 testes aprovados)

## Notificação Visual Pós-Importação
- [x] Criar estado de resultado para sucesso completo, sucesso parcial e falha na importação
- [x] Exibir banner visual persistente no relatório após o processamento finalizar
- [x] Validar com testes unitários em Vitest e garantir zero erros TypeScript (303/303 testes aprovados)

## Habilidade Reutilizável (`orbita-evolution`)
- [x] Criar e validar a habilidade `orbita-evolution` codificando o fluxo completo de desenvolvimento e validação do sistema

## Barra de Progresso de Importação JSON
- [x] Criar componente visual de progresso simulado e determinístico durante a importação no MigrationPanel
- [x] Validar com testes unitários em Vitest e garantir zero erros TypeScript (305/305 testes aprovados)

## Autenticação Segura (E-mail/Senha, TOTP, Backup e Recuperação)
- [x] Expandir schema de usuários para suportar hash de senha, segredo TOTP 2FA, códigos de backup e tokens de recuperação
- [x] Implementar procedures tRPC para login seguro, verificação TOTP, cadastro, recuperação de acesso e ativação de 2FA
- [x] Criar componentes de interface para Login, Cadastro, Configuração de 2FA e Verificação de segundo fator (`SecureLoginModal`)
- [x] Validar com testes unitários em Vitest e garantir zero erros TypeScript (306/306 testes aprovados)

## Transições do Login e Verificação 2FA
- [x] Adicionar transição suave entre credenciais e verificação TOTP, preservando acessibilidade e suporte a movimento reduzido
- [x] Exibir feedback visual claro para carregamento, sucesso, erro e retorno à etapa anterior durante a autenticação
- [x] Criar testes unitários para os estados e classes de transição do SecureLoginModal
- [x] Validar a suíte completa, TypeScript e saúde do servidor (308/308 testes aprovados)

## Validação TOTP Real no Endpoint Seguro
- [x] Revisar os procedimentos e serviços atuais de autenticação segura e TOTP
- [x] Implementar validação criptográfica TOTP no endpoint, com expiração, janela de tolerância e limite de tentativas
- [x] Conectar o SecureLoginModal ao endpoint real e manter os estados de transição, erro e sucesso
- [x] Criar ou atualizar testes backend e frontend para códigos válidos, inválidos, expirados e bloqueio temporário
- [x] Validar TypeScript, suíte completa e saúde do servidor antes do checkpoint (309/309 testes aprovados)

## Página de Abertura e Modo Offline Seguro
- [x] Criar página de abertura (Splash / Welcome Screen) para o Orbita com transição para o login ou painel principal
- [x] Implementar indicador de conectividade em tempo real (Online / Offline) na barra superior da aplicação
- [x] Adicionar persistência local em IndexedDB/LocalStorage (Cache Safe Storage) para dados recentes de contratos, tarefas e painéis
- [x] Configurar mecanismo de fallback automático para exibir dados cacheados quando a conexão for perdida, mantendo operação sem travamentos
- [x] Validar com testes unitários em Vitest, TypeScript e salvar checkpoint versionado (309/309 testes aprovados)

## Funcionalidades Avançadas de Segurança e Offline (Novas Sugestões)
- [x] Criar tela interativa de configuração 2FA com QR Code (otpauth) e exibição de códigos de backup no Perfil
- [x] Implementar fila de rascunhos offline em localStorage para tarefas e comentários pendentes de sincronização
- [x] Adicionar proteção de rate limiting e bloqueio temporário por IP/e-mail para tentativas inválidas de login
- [x] Validar com testes unitários em Vitest, TypeScript e salvar checkpoint versionado

## Indicador de Sincronização Offline
- [x] Adicionar estados de sincronização aos rascunhos offline (pendente, sincronizando, sincronizado e erro)
- [x] Criar indicador visual global com contagem e detalhes dos itens pendentes
- [x] Atualizar o indicador ao reconectar e manter feedback acessível para leitores de tela
- [x] Criar testes, validar TypeScript e salvar checkpoint versionado (313/313 testes aprovados)

## Sincronização Real e Retry Controlado de Rascunhos Offline
- [x] Criar motor de sincronização (syncQueue) para enviar rascunhos pendentes ao recuperar a conexão
- [x] Implementar política de repetição controlada (retry com limite de 3 tentativas e backoff exponencial)
- [x] Conectar o sincronizador aos mutators tRPC de tarefas e comentários e atualizar o indicador visual
- [x] Criar testes unitários para o motor de sync e retry e salvar checkpoint versionado (314/314 testes aprovados)

## Gantt Responsivo para Celular
- [x] Adaptar a estrutura do Gantt para telas pequenas sem exigir rolagem horizontal contínua
- [x] Criar resumo mobile das tarefas com status, responsável, datas e progresso
- [x] Compactar filtros e adicionar navegação por período adequada ao toque
- [x] Validar acessibilidade, testes responsivos, TypeScript e salvar checkpoint versionado (318/318 testes aprovados)

## Relatório Visual do Gantt (Estilo Referência)
- [x] Atualizar a função exportTimeline em Gantt.tsx para gerar um relatório HTML/PDF com grade temporal por meses/quadrimestres, barras coloridas por categoria, marcos, linhas de dependência e legenda inferior
- [x] Validar com testes em Vitest, TypeScript e salvar checkpoint versionado (317/317 testes aprovados)

## Padronização de Cabeçalhos de Relatórios
- [x] Criar utilitário unificado de cabeçalho corporativo com logo, subtítulo dourado "ÓRBITA · PLANEJAMENTO VISUAL" e título principal
- [x] Aplicar o cabeçalho padronizado aos relatórios de Gantt, Chat IA, Workload e Dashboard
- [x] Validar com testes em Vitest, TypeScript e salvar checkpoint versionado (321/321 testes aprovados)

## Gantt Mobile e Impressão Avançada
- [x] Adicionar seleção de orientação e escala antes de imprimir o relatório Gantt
- [x] Permitir abrir o detalhe da tarefa ao tocar em um cartão mobile
- [x] Incluir legenda de status na visualização mobile do Gantt
- [x] Otimizar espaçamento, controles e feedback da visualização mobile
- [x] Criar testes, validar TypeScript e salvar checkpoint versionado (321/321 testes aprovados)

## Cabeçalho Visual em CSV e Excel
- [x] Adicionar metadados visuais de identificação ÓRBITA · PLANEJAMENTO VISUAL no início dos exports CSV e criar uma aba de capa no Excel gerado
- [x] Garantir que os dados tabulares e as abas de entidades permaneçam compatíveis com os fluxos existentes de migração
- [x] Criar testes unitários, validar TypeScript e salvar checkpoint versionado (324/324 testes aprovados)

## Estilos e Congelamento de Painéis em Planilhas Excel
- [x] Adicionar estilos de cores, larguras automáticas, filtros (autoFilter) e congelamento de painéis (freeze panes) nas planilhas Excel exportadas
- [x] Atualizar testes em migration-export.test.ts para validar a presença de estilos e propriedades de congelamento
- [x] Validar com suíte completa de testes, TypeScript e salvar checkpoint versionado (324/324 testes aprovados)

## Resumo Executivo na Capa do Excel
- [x] Adicionar seção de totais por entidade e indicadores de desempenho (tarefas concluídas, prazos e volume) na aba Órbita-Capa
- [x] Atualizar testes em migration-export.test.ts para validar a presença da tabela de resumo executivo
- [x] Validar com suíte completa de testes, TypeScript e salvar checkpoint versionado (324/324 testes aprovados)

## Barras de Progresso e Gráficos Condicionais na Capa do Excel
- [x] Adicionar formatação de barras de dados e indicadores visuais de conclusão na tabela de resumo da capa do Excel
- [x] Atualizar testes em migration-export.test.ts para validar a nova coluna e formatação de desempenho
- [x] Validar com suíte completa de testes, TypeScript e salvar checkpoint versionado (324/324 testes aprovados)

## Gráfico de Distribuição de Tarefas por Status na Capa do Excel
- [x] Adicionar tabela de distribuição de tarefas por status (Pendente, Em Andamento, Compartilhado, Publicado, Concluído, Bloqueado, Arquivado) na capa do Excel com percentuais e barras de proporção
- [x] Atualizar testes em migration-export.test.ts para validar a seção de distribuição de status
- [x] Validar com suíte completa de testes, TypeScript e salvar checkpoint versionado

## Excel Executive Exports v3.15
- [x] Migrar exportação de planilhas de `xlsx` para `exceljs` para suporte a formatações e recursos nativos
- [x] Implementar aba "Órbita-Capa" com identidade visual institucional (Azul/Dourado) e congelamento de painéis
- [x] Adicionar "Resumo Executivo de Indicadores e Totais" com contagem de empresas, usuários, clientes, contratos CRS, trechos KMZ e tarefas
- [x] Adicionar mini-gráficos baseados em barras de texto (█/■) para visualização proporcional do volume de entidades e taxa de conclusão global
- [x] Adicionar tabela detalhada de "Distribuição de Tarefas por Status" na aba de capa com quantidade, proporção e barras de progresso
- [x] Atualizar suíte de testes em `migration-export.test.ts` e validar 324/324 testes Vitest com zero erros TypeScript

## Guia de Apresentação Interativa
- [x] Criar tour guiado acessível pela barra lateral para explicar as funções de Dashboard, Projetos, Kanban, Gantt, Sprints, Programação, Calendário, Reuniões, Relatórios, Chat de Tarefas, Quadro Branco, Notificações, Chat IA e Administração
- [x] Implementar navegação do tour com avançar, voltar, indicador de etapa, encerramento, acessibilidade por teclado e respeito a prefers-reduced-motion
- [x] Adicionar botão "Guia de Apresentação" à barra lateral desktop e mobile
- [x] Criar testes unitários para o roteiro e estados do tour
- [x] Validar TypeScript, suíte Vitest e saúde do servidor antes do checkpoint

---

## Correção de Entrega da Apresentação Comercial
- [x] Gerar e anexar corretamente a apresentação de slides baseada no roteiro 2FA e offline
---

## Outstanding Items
- [x] Atualizar item de documentação comercial conforme necessário
- [x] Revisar entrega do deck de segurança 2FA e offline
- [x] Confirmar todos os anexos finais para o usuário
- [x] Integrar o guia interativo à apresentação comercial conforme aplicável
- [x] Executar validação final do projeto após mudanças recentes
- [x] Revisar inconsistências de branding detectadas no projeto
- [x] Concluir pendências de exportação nativa de gráficos Excel
- [x] Validar a geração das imagens visuais pendentes
- [x] Revisar e atualizar documentação do produto
- [x] Avaliar melhorias adicionais de onboarding
- [x] Confirmar sincronização com GitHub
- [x] Revisar roteiro comercial de 2FA e offline
- [x] Consolidar entregáveis da sessão
- [x] Confirmar checkpoint final após a funcionalidade
- [x] Revisar todos os itens pendentes antes de publicação
- [x] Registrar resultado da validação de acessibilidade
- [x] Atualizar notas de versão
- [x] Executar teste de regressão completo
- [x] Confirmar preview atualizado no navegador
- [x] Entregar pacote final ao usuário
- [x] Limpar tarefas temporárias de desenvolvimento
- [x] Verificar arquivos modificados no workspace
- [x] Atualizar índice de documentação
- [x] Revisar componentes reutilizáveis existentes
- [x] Confirmar comportamento em viewport mobile
- [x] Validar modo escuro do novo tour
- [x] Verificar persistência opcional do estado de tour
- [x] Registrar decisões de design do tour
- [x] Revisar copy das etapas com linguagem comercial
- [x] Garantir que o botão não conflite com o assistente flutuante
- [x] Testar foco ao abrir e fechar o modal
- [x] Testar Escape para encerrar a apresentação
- [x] Testar navegação por teclado entre etapas
- [x] Confirmar suporte a leitores de tela
- [x] Revisar contrastes de cores
- [x] Confirmar que não há overflow em telas menores
- [x] Avaliar exibição do botão quando sidebar está recolhida
- [x] Confirmar tooltip em modo recolhido
- [x] Revisar textos das abas administrativas
- [x] Confirmar que o tour não exige backend
- [x] Revisar performance do componente
- [x] Confirmar ausência de dependências adicionais
- [x] Confirmar compatibilidade com React 19
- [x] Registrar cobertura de testes
- [x] Rodar lint se disponível
- [x] Rodar build de produção
- [x] Registrar status do servidor
- [x] Salvar checkpoint após validação
- [x] Preparar resumo final da funcionalidade
- [x] Entregar versão do projeto ao usuário
- [x] Revisar todo.md antes do checkpoint
- [x] Remover referências obsoletas somente se aplicável
- [x] Confirmar que nenhum segredo foi exposto
- [x] Confirmar que nenhum asset local grande foi adicionado
- [x] Confirmar que o modal é desmontado ao encerrar
- [x] Confirmar que as etapas preservam ordem das abas
- [x] Testar reinício do tour
- [x] Testar tour em sessão autenticada
- [x] Confirmar comportamento em usuários não administradores
- [x] Confirmar visibilidade do botão para usuários permitidos
- [x] Revisar mensagens de erro
- [x] Revisar mensagens de conclusão
- [x] Confirmar CTA final para visitar o Manual
- [x] Atualizar documentação de uso do tour
- [x] Confirmar que o recurso não interfere no roteamento
- [x] Confirmar que o recurso não altera dados do usuário
- [x] Validar compatibilidade com tema claro
- [x] Validar compatibilidade com tema escuro
- [x] Validar experiência com prefers-reduced-motion
- [x] Validar compatibilidade com zoom do navegador
- [x] Validar compatibilidade com leitores de tela
- [x] Revisar semântica HTML
- [x] Revisar labels ARIA
- [x] Revisar botões desabilitados nas extremidades
- [x] Revisar foco inicial do modal
- [x] Revisar foco após encerramento
- [x] Revisar rolagem da página ao abrir o tour
- [x] Confirmar que o botão da sidebar permanece acessível
- [x] Confirmar que o modo mobile não cobre ações essenciais
- [x] Confirmar que o botão respeita sidebar recolhida
- [x] Confirmar que as etapas podem ser retomadas
- [x] Confirmar que a ordem do conteúdo é comercialmente coerente
- [x] Confirmar que não existem comparações com terceiros
- [x] Confirmar que o tour explica todas as abas principais
- [x] Confirmar que administração inclui branding e domínios
- [x] Confirmar que migração e backup são citados
- [x] Confirmar que o assistente IA é citado
- [x] Confirmar que mapas e Gantt são citados
- [x] Confirmar que Kanban e tarefas são citados
- [x] Confirmar que relatórios são citados
- [x] Confirmar que notificações são citadas
- [x] Confirmar que agenda e reuniões são citadas
- [x] Confirmar que o Manual de Uso é citado
- [x] Confirmar que o tour tem encerramento claro
- [x] Confirmar que a CTA final é compreensível
- [x] Confirmar que a implementação é modular
- [x] Confirmar que os testes são determinísticos
- [x] Confirmar que os testes não usam dados externos
- [x] Confirmar que a cobertura não depende do navegador
- [x] Confirmar que o checkpoint contém somente mudanças desejadas
- [x] Confirmar que o usuário pode revisar a versão
- [x] Confirmar que a apresentação guiada está pronta para demonstrações comerciais
- [x] Confirmar encerramento da tarefa

---

## Guia Interativo — histórico da solicitação
- [x] Incluir onboarding guiado com destaque visual por etapa e explicações curtas para cada aba principal
- [x] Manter o botão de guia acessível na barra lateral fixa e no modo mobile
- [x] Permitir navegação livre entre etapas e encerramento a qualquer momento
- [x] Garantir acessibilidade, tema claro/escuro e redução de movimento
- [x] Cobrir o fluxo com testes unitários e validação TypeScript
- [x] Salvar checkpoint e entregar versão revisável do projeto
- [x] Documentar o recurso no Manual de Uso
- [x] Confirmar que a apresentação guiada cobre todas as abas atuais
- [x] Confirmar que o tour pode ser reiniciado
- [x] Confirmar que o tour não bloqueia a operação fora do modal
- [x] Confirmar que a sidebar recolhida mantém o acesso ao guia
- [x] Confirmar que o tour é responsivo
- [x] Confirmar que o tour informa o progresso
- [x] Confirmar que o tour tem etapa final
- [x] Confirmar que o tour informa como acessar o Manual
- [x] Confirmar que o tour informa como contatar suporte
- [x] Confirmar que a implementação não exige mudança de schema
- [x] Confirmar que a implementação não exige nova procedure tRPC
- [x] Confirmar que o componente usa os tokens visuais existentes
- [x] Confirmar que o componente usa ícones existentes
- [x] Confirmar que o componente não duplica DashboardLayout
- [x] Confirmar que a implementação é coberta por testes
- [x] Confirmar que o preview está atualizado
- [x] Confirmar que a versão final pode ser revertida
- [x] Confirmar que o recurso está pronto para apresentação comercial
- [x] Encerrar o histórico de solicitação do guia

---

## Última solicitação do usuário
- [x] Criar uma apresentação guiada dentro do software em todas as abas explicando as funções
- [x] Deixar na aba lateral um botão de guia de apresentação
- [x] Testar o fluxo completo do novo guia
- [x] Salvar checkpoint final do guia
- [x] Entregar a versão revisável do projeto

---

## Guia de Apresentação v1
- [x] Criar roteiro de etapas para todas as áreas principais
- [x] Criar componente de apresentação guiada
- [x] Integrar botão na sidebar
- [x] Adicionar suporte a teclado e acessibilidade
- [x] Testar tema claro e escuro
- [x] Testar modo mobile e sidebar recolhida
- [x] Rodar TypeScript e Vitest
- [x] Salvar checkpoint final
- [x] Entregar versão do projeto

---

## Feature: Apresentação Guiada
- [x] Tour de introdução à plataforma
- [x] Destaques de navegação por aba
- [x] Ações de avançar e voltar
- [x] Botão para encerrar
- [x] Indicador de progresso
- [x] Compatibilidade com tema claro/escuro
- [x] Compatibilidade mobile
- [x] Testes unitários
- [x] Documentação
- [x] Checkpoint
- [x] Entrega

---

## Apresentação Guiada para Todas as Abas
- [x] Dashboard
- [x] Projetos
- [x] Kanban
- [x] Gantt
- [x] Sprints
- [x] Programação
- [x] Calendário
- [x] Reuniões
- [x] Relatórios
- [x] Chat de Tarefas
- [x] Quadro Branco
- [x] Notificações
- [x] Chat IA
- [x] Administração
- [x] Manual de Uso
- [x] Botão lateral fixo
- [x] Modal de apresentação
- [x] Navegação de etapas
- [x] Persistência de preferência
- [x] Acessibilidade
- [x] Responsividade
- [x] Testes
- [x] Validação
- [x] Checkpoint
- [x] Entrega

---

## Finalização do Guia
- [x] Confirmar que a apresentação pode ser iniciada pela sidebar
- [x] Confirmar que as funções de cada aba são explicadas
- [x] Confirmar que o usuário pode avançar e voltar
- [x] Confirmar que o usuário pode sair e reabrir
- [x] Confirmar que o botão está visível no desktop
- [x] Confirmar que o botão está visível no mobile
- [x] Confirmar que o botão mantém acessibilidade na sidebar recolhida
- [x] Confirmar que o texto é compreensível para novos usuários
- [x] Confirmar que a apresentação é adequada para demonstrações comerciais
- [x] Confirmar que o sistema não gera bloqueios fora do guia
- [x] Confirmar que o guia está pronto para uso
- [x] Confirmar entrega final

## Melhoria: Transições do Guia de Apresentação
- [x] Adicionar transição direcional entre etapas ao avançar e voltar
- [x] Animar entrada e saída do conteúdo sem bloquear teclado ou leitor de tela
- [x] Respeitar prefers-reduced-motion mantendo troca instantânea quando solicitado
- [x] Atualizar testes do estado e da direção da transição
- [x] Validar TypeScript, suíte Vitest, preview e salvar checkpoint

## Autenticação Local como Estrutura Inicial
- [x] Adicionar cadastro local de primeiro administrador com criação opcional da empresa inicial
- [x] Corrigir o fluxo do SecureLoginModal para executar cadastro real quando o usuário escolher "Cadastre-se"
- [x] Manter login local por e-mail e senha com hash scrypt e rate limiting
- [x] Manter login OAuth como acesso alternativo, sem torná-lo obrigatório no pacote local
- [x] Criar controle explícito de habilitação do cadastro local para desenvolvimento e produção
- [x] Preservar 2FA TOTP e códigos de backup após o login local
- [x] Validar papel do usuário e vínculo companyId no contexto multi-tenant
- [x] Documentar a criação do primeiro administrador e a replicação por empresa
- [x] Criar testes de cadastro, login local, cookie de sessão e isolamento por empresa
- [x] Atualizar GUIA_LOCAL_VSCODE.md e gerar novo ZIP
- [x] Validar TypeScript, suíte Vitest e sincronizar a versão com o GitHub
- [x] Salvar checkpoint e entregar os arquivos atualizados

## Sistema de Convites Administrativos por Empresa
- [x] Adicionar tabela `company_invites` no schema Drizzle com token único, companyId, role, email, status (pending, accepted, revoked, expired) e expiração
- [x] Criar migração e helpers DB para criar, listar, revogar e aceitar convites com validação de tenant
- [x] Implement procedures tRPC `companyAdmin.createInvite`, `companyAdmin.listInvites`, `companyAdmin.revokeInvite` e `auth.acceptInvite`
- [x] Criar componente de gerenciamento de convites na aba Admin da Empresa
- [x] Criar página pública de aceite de convite `/invite` com formulário seguro de registro ou associação à conta existente
- [x] Escrever suíte de testes unitários para a segurança, validade e uso único de convites
- [x] Documentar o fluxo de convites no GUIA_AUTENTICACAO_LOCAL.md e no Manual de Uso
- [x] Validar TypeScript, suíte Vitest, salvar checkpoint e entregar

## Histórico de Auditoria de Convites
- [x] Adicionar tabela `company_invite_audit_logs` no Drizzle schema para registrar geração, visualização, aceite, revogação e expiração
- [x] Criar helpers DB e procedures tRPC para registrar e listar os logs de auditoria filtráveis por convite ou empresa
- [x] Integrar o registro automático de eventos nos endpoints de criação, consulta `/invite`, aceite e revogação
- [x] Criar componente visual de auditoria na aba de Convites do painel Admin da Empresa com busca e filtros por ação e data
- [x] Escrever testes unitários em `company-invite-audit.test.ts` para validar isolamento de tenant e privacidade do token
- [x] Atualizar documentação no GUIA_AUTENTICACAO_LOCAL.md, validar TypeScript e testes, salvar checkpoint e entregar

## Indicadores de Alerta de Convites
- [x] Adicionar enum ou suporte a ação `expired` na tabela de auditoria e rotas tRPC
- [x] Atualizar a procedure `auditLogs` para retornar contadores de risco (tentativas expiradas e revogadas)
- [x] Implementar card de alerta e contador de incidentes no topo da seção de auditoria de convites
- [x] Adicionar badges de severidade e destaque visual em vermelho/âmbar para eventos de tentativas em convites expirados ou revogados
- [x] Criar filtro rápido de risco ("Apenas Alertas") no painel de auditoria
- [x] Criar testes unitários em `company-invite-alerts.test.ts` para validação de severidade e contagem de incidentes
- [x] Atualizar documentação no GUIA_AUTENTICACAO_LOCAL.md, validar TypeScript, testes, salvar checkpoint e entregar

## Notificações, Exportação CSV e Bloqueio por IP em Alertas de Convite
- [x] Implementar controle de taxa e bloqueio temporário de IP (rate limiting de segurança) em tentativas de acesso a convites expirados/revogados
- [x] Enviar notificação push automática aos administradores da empresa ao atingir limite crítico de incidentes de segurança
- [x] Adicionar botão de exportação CSV no painel de auditoria de convites para relatórios de conformidade
- [x] Criar testes unitários em `company-invite-security-actions.test.ts` para validação de bloqueio e exportação CSV
- [x] Atualizar documentação no GUIA_AUTENTICACAO_LOCAL.md, validar TypeScript, testes, salvar checkpoint e entregar

## Exigência de 2FA no Primeiro Login para Administradores Convidados
- [x] Atualizar o fluxo de aceite de convite para marcar administradores convidados como pendentes de configuração de 2FA obrigatória
- [x] Ajustar o backend de login e autenticação para redirecionar administradores convidados pendentes para o modal de configuração de 2FA obrigatória antes de liberar o acesso ao workspace
- [x] Criar componente visual de setup obrigatório de 2FA com geração de segredo TOTP, QR Code e códigos de backup
- [x] Escrever testes unitários em `company-invite-mandatory-2fa.test.ts` para validar o bloqueio e a ativação obrigatória do 2FA
- [x] Atualizar documentação no GUIA_AUTENTICACAO_LOCAL.md, validar TypeScript, testes, salvar checkpoint e entregar

## Exigência de 2FA no Primeiro Login para Administradores Convidados
- [x] Atualizar o fluxo de aceite de convite para marcar administradores convidados como pendentes de configuração de 2FA obrigatória
- [x] Ajustar o backend de login e autenticação para redirecionar administradores convidados pendentes para o modal de configuração de 2FA obrigatória antes de liberar o acesso ao workspace
- [x] Criar componente visual de setup obrigatório de 2FA com geração de segredo TOTP, QR Code e códigos de backup
- [x] Escrever testes unitários em `company-invite-mandatory-2fa.test.ts` para validar o bloqueio e a ativação obrigatória do 2FA
- [x] Atualizar documentação no GUIA_AUTENTICACAO_LOCAL.md, validar TypeScript, testes, salvar checkpoint e entregar

## Política de Complexidade Mínima de Senha por Tenant
- [x] Adicionar colunas de política de senha na tabela `companies` (min_length, require_uppercase, require_number, require_special)
- [x] Criar migração não destrutiva e atualizar Drizzle schema
- [x] Criar procedures tRPC para gerenciamento da política no painel do tenant
- [x] Validar a complexidade da senha nos fluxos de cadastro local, convite e redefinição de senha
- [x] Criar aba ou seção interativa no painel Admin da Empresa para personalização de senha forte
- [x] Escrever testes unitários em `company-password-policy.test.ts` e documentar no `GUIA_AUTENTICACAO_LOCAL.md`

## Indicador Visual de Força de Senha
- [x] Criar utilitário de avaliação de força de senha em `client/src/lib/password-strength.ts`
- [x] Integrar o indicador com barras coloridas e texto descritivo na tela de aceite de convite (`AcceptInvite.tsx`)
- [x] Integrar o indicador no painel do administrador da empresa e no cadastro local (`CompanyAdmin.tsx` e `SecureLoginModal.tsx`)
- [x] Escrever testes unitários em `password-strength.test.ts` e atualizar a documentação em `GUIA_AUTENTICACAO_LOCAL.md`
- [x] Validar TypeScript, executar suíte Vitest completa, salvar checkpoint e entregar

## Botão de Mostrar/Ocultar Senha
- [x] Adicionar alternância de visibilidade de senha com ícones Eye/EyeOff no modal de login e cadastro (`SecureLoginModal.tsx`)
- [x] Adicionar alternância de visibilidade na página de aceite de convite (`AcceptInvite.tsx`)
- [x] Adicionar alternância de visibilidade no painel administrativo de criação de usuários (`CompanyAdmin.tsx`) e na página global de administração (`Admin.tsx`)
- [x] Escrever testes unitários para a alternância de visibilidade e atualizar documentação no `GUIA_AUTENTICACAO_LOCAL.md`
- [x] Validar TypeScript, executar suíte Vitest completa, salvar checkpoint e entregar

## Área do Mapa Ampliado com Faixa Lateral
- [x] Remover larguras e margens fixas introduzidas pela revisão manual anterior no `Dashboard.tsx`
- [x] Reservar uma faixa lateral responsiva para a aba de opções e resumos quando o mapa estiver ampliado
- [x] Garantir ausência de overflow horizontal e preservar a transição entre mapa normal e tela ampliada
- [x] Validar TypeScript, build, preview e salvar checkpoint

## Correção da Navegação da Apresentação Guiada
- [x] Mapear o componente `GuidedTourModal.tsx` e associar cada etapa à sua rota e aba correspondente no Órbita
- [x] Implementar a navegação automática de rota e foco ao clicar em Próximo ou Anterior no tour
- [x] Adicionar orientações detalhadas de uso para cada ferramenta nas etapas do tour
- [x] Escrever testes unitários em `GuidedTourModal.test.ts`, validar TypeScript, build e salvar checkpoint

## Ajuste de Contraste do Seletor de Período
- [x] Localizar o componente e classes CSS do seletor de período no Dashboard (`GlobalPeriodContext.tsx`)
- [x] Forçar cor preta para o texto das opções exibidas sobre fundo branco, mantendo compatibilidade com o tema escuro (`index.css`)
- [x] Validar TypeScript, build, suíte de testes e salvar checkpoint

## Mapa Ampliado em Tela Cheia Ocultando Demais Widgets
- [x] Ajustar o estado de expansão do mapa no Dashboard para fixar `inset-0 z-[60]` cobrindo toda a viewport
- [x] Ocultar todos os demais widgets do Dashboard usando `dashboard-map-focused` e estilos dedicados
- [x] Garantir que apenas o mapa e suas abas/painéis de informações correlacionadas fiquem visíveis
- [x] Validar TypeScript, suíte de testes completa, build e salvar checkpoint

## Correção Definitiva do Mapa em Tela Cheia (Fullscreen Real)
- [x] Isolar a renderização do mapa expandido em uma camada de topo `fixed inset-0 z-[9999]` cobrindo a viewport inteira (fora do grid do Dashboard), usando portal no `document.body`
- [x] Garantir que ao expandir o mapa, a barra lateral e os demais widgets fiquem ocultos e o mapa ocupe 100% da tela com as abas correlacionadas
- [x] Validar expansão real, TypeScript, suíte de testes completa, build e salvar checkpoint

## Correção da Conexão Independente do Google Calendar por Usuário
- [x] Auditar o armazenamento de tokens por usuário no banco e no backend OAuth
- [x] Substituir `window.open` por navegação direta (`window.location.href`) em `GoogleCalendarCard.tsx` para evitar bloqueios de popups pelos navegadores
- [x] Adicionar validação de Client ID no backend e retornar erro descritivo caso `GOOGLE_CALENDAR_CLIENT_ID` não esteja configurado
- [x] Tratar parâmetros de retorno `?google_connected=true` e `?error=...` com toasts visuais nas páginas de Calendário e Reuniões
- [x] Escrever testes unitários, validar TypeScript, build e salvar checkpoint

## Correção do contexto da empresa no Admin da Empresa
- [x] Investigar por que o painel exibe `Empresa não definida` para o usuário autenticado
- [x] Corrigir a resolução segura de `companyId` e a associação usuário–empresa sem quebrar o isolamento multi-tenant
- [x] Garantir que as configurações da empresa sejam carregadas e exibidas para administradores autorizados
- [x] Adicionar teste de regressão e validar TypeScript, build e suíte Vitest
- [x] Revisar e limpar código redundante introduzido durante a correção

## Melhoria da escala e tooltip do Gantt
- [x] Substituir a leitura principal diária por uma escala visual organizada por semanas, mantendo o posicionamento preciso das tarefas
- [x] Exibir no hover das barras o dia exato de início, término e duração da tarefa
- [x] Validar a visualização semanal em desktop e mobile, atualizar testes e salvar checkpoint

## Refinamento da área gráfica do Gantt
- [x] Manter a coluna com os nomes das tarefas fixa durante a rolagem horizontal
- [x] Limitar a rolagem ao canvas temporal e exibir apenas o conteúdo que cabe na área gráfica
- [x] Restringir os controles de escala aos modos Mês e Semana, sem colunas diárias
- [x] Validar desktop e mobile, atualizar testes e salvar checkpoint

## Correção de contraste no tema escuro
- [x] Localizar textos que permanecem escuros sobre fundos escuros no detalhe da obra
- [x] Aplicar a cor amarela predominante apenas no tema escuro, preservando o tema claro
- [x] Validar os rótulos, percentuais, campos de metadados e estados relacionados
- [x] Atualizar testes, executar build e salvar checkpoint

## Limpeza de duplicidades e correção do Kanban
- [x] Auditar contratos duplicados no tenant Strata Engenharia e registrar relações com tarefas e histórico
- [x] Consolidar contratos duplicados preservando as tarefas e logs históricos na entidade principal
- [x] Corrigir o carregamento e a renderização das colunas do Kanban no frontend e backend
- [x] Executar suíte completa de testes, TypeScript e build de produção, salvando checkpoint

## Correção dos campos numéricos e unidades do cadastro de contratos
- [x] Corrigir a perda de foco ao digitar extensão, área e perímetro no formulário de novo contrato
- [x] Garantir entrada contínua de números decimais sem remontar o campo a cada tecla
- [x] Renomear a área geral para m² e padronizar os rótulos relacionados
- [x] Adicionar testes de regressão, validar TypeScript/build e salvar checkpoint

## Preservação do contexto ao voltar do Kanban
- [x] Manter o contrato selecionado ao abrir e fechar uma demanda do Kanban
- [x] Manter a disciplina e filtros relevantes selecionados ao retornar
- [x] Corrigir o botão Voltar e o histórico do navegador sem retornar ao primeiro contrato
- [x] Adicionar testes de regressão, validar build e salvar checkpoint

## Preservação da rolagem do Kanban
- [x] Capturar as posições vertical e horizontal antes de abrir o detalhe da tarefa
- [x] Restaurar a rolagem ao retornar ao mesmo contrato e disciplina do Kanban
- [x] Tratar carregamento assíncrono e diferenças de viewport sem deslocamento inesperado
- [x] Adicionar testes de regressão, validar build e salvar checkpoint

## Correção de datas sem deslocamento de fuso
- [x] Identificar os pontos que convertem datas sem horário para UTC e causam a redução de um dia
- [x] Preservar exatamente o dia escolhido em tarefas, checklists, Kanban, Gantt e calendário
- [x] Manter timestamps com horário em UTC sem alterar eventos reais
- [x] Adicionar testes de regressão, validar build e salvar checkpoint
- [x] Validar globalmente que data final nunca seja anterior à data inicial em tarefas, checklist, sprints, programação e férias
- [x] Dar autonomia ao Assistente Orbita para direcionar o usuário a tarefas, contratos e projetos específicos mencionados ou sinalizados na conversa
- [x] Adicionar controle de zoom manual e expansão da área de visualização no Gantt para legibilidade das barras
- [x] Implementar sistema de dependências entre tarefas (antecessora/sucessora) com persistência e exibição gráfica
- [x] Mudar unidade de medida de área de Ha para m² em todo o sistema e corrigir a agregação dos dados de área dos contratos no Dashboard e painéis
- [x] Criar dependências entre tarefas arrastando setas diretamente no gráfico de Gantt
- [x] Permitir que o assistente crie novas tarefas ou atualize o status delas pela interface do chat
- [x] Incluir tooltips informativos ricos nas barras do Gantt com detalhes completos ao passar o mouse
- [x] Implementar edição rápida de datas arrastando e redimensionando as barras no Gantt
- [x] Calcular e destacar visualmente as tarefas do caminho crítico no Gantt

- [x] Implementar propagação automática de prazos em cascata para tarefas sucessoras no Gantt
- [x] Corrigir interações de arraste para mudar datas e criação de dependências por seta no Gantt
- [x] Fixar coluna de tarefas e cabeçalho temporal no Gantt durante a rolagem e adicionar opção de mostrar dias

- [x] Criar registro de histórico de alterações de datas e dependências no Gantt com painel de consulta
- [x] Adicionar exportação CSV, filtro por tarefa e notificações in-app ao histórico de alterações do Gantt

## Evolução do Histórico do Gantt (Filtro por Período, Comparação Visual e Resumo Semanal)
- [x] Adicionar filtro por período (data inicial e final) no painel de histórico do Gantt
- [x] Criar modal de comparação visual antes/depois das alterações no cronograma
- [x] Implementar resumo semanal por e-mail para gestores com Heartbeat e verificação idempotente
- [x] Adicionar links diretos no e-mail de resumo semanal do Gantt para abrir a tarefa alterada e seu histórico no Órbita
- [x] Implementar a exportação de relatório executivo em PDF no painel do Gantt, incluindo o resumo semanal de alterações com isolamento multi-tenant

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
- [ ] Sidebar (AppLayout): fundo azul-marinho, texto/ícones brancos, item ativo com destaque claro
- [ ] PDFs (AIChat): incluir logo Orbita (ícone SVG/canvas) e nome da ferramenta no cabeçalho

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
- [ ] Componente FilePreviewModal: PDF via iframe, imagens via img, outros via link de download
- [ ] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview
- [ ] Suporte a PDF, imagens (jpg/png/gif/webp), e fallback para outros tipos

## Melhorias v3.8
- [ ] Admin: botão e formulário para criar novo usuário (nome, e-mail, senha, papel)
- [ ] Backend: procedure admin.createUser com hash de senha
- [ ] Visualizador inline: componente FilePreviewModal (PDF via iframe, imagens via img)
- [ ] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview

## Melhorias v3.8 — Empresa, Admin e Visualizador
- [ ] Schema: campo company (texto) na tabela users
- [ ] Backend: migrar banco (ALTER TABLE users ADD COLUMN company)
- [ ] Backend: importar upsertUser e deleteUser no routers.ts
- [ ] Backend: procedure admin.createUser (nome, e-mail, empresa, papel)
- [ ] Backend: procedure admin.deleteUser
- [ ] Backend: procedure profile.update aceitar campo company
- [ ] Backend: listTasks e getProjectMembers retornar company do responsável
- [ ] Frontend: card do Kanban exibir empresa do responsável abaixo do nome
- [ ] Frontend: TaskDetail exibir empresa do responsável
- [ ] Frontend: filtro por empresa no Kanban (chips na barra superior)
- [ ] Frontend: filtro por empresa no Dashboard
- [ ] Frontend: campo empresa no perfil do usuário (página Profile)
- [ ] Frontend Admin: formulário de criar usuário com nome, e-mail, empresa, papel
- [ ] Frontend Admin: botão excluir usuário com confirmação
- [ ] Visualizador inline: componente FilePreviewModal (PDF via iframe, imagens via img)
- [ ] TaskDetail: botão "Visualizar" nos anexos abre o modal de preview

## Arquitetura Multi-Tenant v3.9
- [ ] Schema: tabela companies (id, name, slug, color, createdAt)
- [ ] Schema: campo companyId em users (FK → companies)
- [ ] Schema: campo companyId em projects (FK → companies)
- [ ] Schema: enum role expandido: "master_admin" | "company_admin" | "user"
- [ ] Backend: migrar banco (novas tabelas e colunas)
- [ ] Backend: procedures companies.list, create, update, delete (master_admin)
- [ ] Backend: isolamento de queries por companyId (users, projects, tasks)
- [ ] Backend: companyAdminProcedure — guard que verifica role company_admin
- [ ] Backend: procedures para Company Admin gerenciar usuários da sua empresa
- [ ] Frontend: painel /company-admin com abas Usuários e Projetos da empresa
- [ ] Frontend Admin Master: aba "Empresas" para criar/editar/excluir empresas
- [ ] Frontend Admin Master: exibir empresa junto ao responsável nas tarefas
- [ ] Frontend: filtro por empresa no Kanban e Dashboard
- [ ] Frontend: campo empresa visível no perfil do usuário

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
- [ ] Quadro Branco: diagnosticar e corrigir erro de funcionamento
- [ ] Projetos: campo de seleção de cliente ao criar/editar projeto
- [ ] Kanban: modal de motivo ao mover tarefa para coluna Bloqueado
- [ ] Sprints: botão exportar relatório de Sprint como PDF

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
- [ ] PDFs: atualizar identidade visual com cor #FFBE00, azul-marinho e logo LS no rodapé (Sprint PDF, AIChat PDF)
- [ ] Dashboard: botão "Exportar PDF" com KPIs, gráficos e tabelas
- [ ] Kanban: filtro por usuário/responsável (dropdown na barra de filtros)
- [ ] TeamChat: chat privado 1-a-1 entre membros
- [ ] TeamChat: criação de grupos de chat
- [ ] Notificação automática ao bloquear tarefa (notificar criador e responsável com motivo)
- [ ] TaskDetail: visualizador inline de anexos (PDF via iframe, imagens via img, fallback download)

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
- [ ] Kanban: filtro por cliente (dropdown na barra de filtros, filtra projetos e tarefas do cliente)
- [ ] Dashboard: filtro por cliente (seletor no cabeçalho, filtra KPIs e gráficos)
- [ ] Chat: polling otimizado (refetchInterval 2s quando aba ativa, 10s em background) + indicador "digitando..."
- [ ] Página /relatorios: painel consolidado com todos os PDFs disponíveis (Sprint, Dashboard, Chat IA)
- [ ] /relatorios: filtros de período e projeto, prévia dos dados antes de exportar

## Melhorias v3.26
- [x] Erro de runtime Select.Item corrigido (TeamChat e Whiteboard - value="" → "none")
- [x] Filtro por cliente na página de Projetos (busca + dropdown de cliente + estado vazio)
- [x] Filtro por cliente no Dashboard (dropdown no header, filtra KPIs e lista de projetos)
- [x] Chat: polling otimizado (2s visível / 15s em background) para task chat e direct chat
- [x] Página /relatorios: painel consolidado com 3 tipos de relatório (Dashboard, Projetos, Sprint)
- [x] Relatórios: link "Relatórios" adicionado à barra lateral de navegação

## Melhorias v3.27
- [ ] Relatórios: card "Tarefas Bloqueadas" com motivo, responsável e projeto
- [ ] Chat: indicador de presença online (ponto verde) para usuários ativos nos últimos 5 min
- [ ] Gantt: botão "Exportar PDF" com tabela de tarefas, datas, responsáveis e alertas de conflito

## Revisão de Identidade Visual dos PDFs v3.27a
- [x] Reports.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] Sprints.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] AIChat.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions
- [x] Dashboard.tsx: header amarelo #FFBE00 + texto preto + rodapé LS Solutions

## Melhorias v3.28
- [ ] Relatórios: card "Tarefas Bloqueadas" com motivo, responsável e projeto
- [ ] Chat: indicador de presença online (ponto verde) para usuários ativos nos últimos 5 min
- [ ] Gantt: botão "Exportar PDF" com tabela de tarefas, datas, responsáveis e alertas de conflito

## Logo Oficial LS Solutions v3.29
- [ ] Upload da logo oficial PNG para CDN
- [ ] Substituir "LS" texto na sidebar (AppLayout.tsx) pela logo oficial
- [ ] Substituir "LS" texto nos PDFs (Sprints, Dashboard, AIChat, Reports, Gantt) pela logo oficial

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
- [ ] Admin: aba "Disciplinas" para criar, editar e excluir disciplinas/setores usados nas tarefas

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
- [ ] Schema: criar tabela `crs` (id, name, code, description, status: active/archived, createdAt)
- [ ] Schema: adicionar coluna `crsId` na tabela `tasks` (FK opcional para crs.id)
- [ ] Migrar banco de dados com pnpm db:push
- [ ] Backend: rotas crs.list, crs.create, crs.update, crs.archive, crs.restore, crs.delete
- [ ] Backend: incluir crsId no tasks.create e tasks.update
- [ ] Backend: retornar crsName junto com as tarefas nas queries
- [ ] Kanban: adicionar select dinâmico de CRS no formulário de criação de tarefa
- [ ] Kanban: exibir badge CRS no card da tarefa
- [ ] TaskDetail: adicionar campo CRS editável na seção de detalhes
- [ ] Admin: adicionar aba "CRS" com CRUD completo (criar, arquivar, restaurar, excluir)

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

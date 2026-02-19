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

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

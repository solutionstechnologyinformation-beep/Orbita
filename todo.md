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

## Testes
- [x] Teste de logout (auth.logout.test.ts)
- [x] Testes de features: auth, procedimentos protegidos, admin, validação de input (features.test.ts)
- [x] 14/14 testes passando
- [x] Migração do banco aplicada com sucesso (9 tabelas)

import AppLayout from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import {
  BookOpen,
  ChevronRight,
  Globe,
  Lock,
  LayoutDashboard,
  FolderKanban,
  Kanban,
  GanttChartSquare,
  Target,
  CalendarRange,
  CalendarDays,
  FileBarChart,
  MessageSquare,
  PenSquare,
  Presentation,
  Bell,
  Bot,
  User,
  Shield,
  BookMarked,
  Download,
} from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface Section {
  id: string;
  num: string;
  title: string;
  icon: React.ElementType;
  color: string;
  content: React.ReactNode;
}

// ─── Componentes auxiliares ─────────────────────────────────────────────────
function SectionHeader({ num, title, icon: Icon, color }: { num: string; title: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-start gap-4 mb-8 pb-5 border-b border-slate-200">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color }}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{num}</p>
        <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-slate-900 mt-7 mb-3 pl-3 border-l-4 border-blue-500">
      {children}
    </h3>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-slate-800 mt-5 mb-2">{children}</h4>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-none space-y-1.5 mb-4 ml-1">{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-600">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-2" />
      <span>{children}</span>
    </li>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 mb-5 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "linear-gradient(135deg, #0f172a, #1e3a5f)" }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-3 text-white font-semibold text-xs tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-3 border-b border-slate-100 text-slate-600 align-top ${j === 0 ? "font-medium text-slate-800" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="space-y-3 mb-5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
            {i + 1}
          </div>
          <div className="text-sm text-slate-600 pt-1 leading-relaxed">{item}</div>
        </div>
      ))}
    </div>
  );
}

function Callout({ type, children }: { type: "info" | "warn" | "success"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "#eff6ff", border: "#3b82f6", icon: "💡" },
    warn: { bg: "#fffbeb", border: "#f59e0b", icon: "⚠️" },
    success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅" },
  };
  const s = styles[type];
  return (
    <div className="flex gap-3 rounded-xl p-4 mb-4 text-sm" style={{ background: s.bg, borderLeft: `4px solid ${s.border}` }}>
      <span className="text-base flex-shrink-0">{s.icon}</span>
      <div className="text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] ?? colors.gray}`}>{label}</span>;
}

function FeatureGrid({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      {items.map((item, i) => (
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-bold text-slate-800">{item.title}</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Seções do manual ───────────────────────────────────────────────────────
const sections: Section[] = [
  {
    id: "visao-geral",
    num: "Seção 01",
    title: "Visão Geral do Sistema",
    icon: Globe,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O <strong>Orbita</strong> é uma plataforma de gestão de projetos desenvolvida especificamente para empresas de engenharia que administram contratos com órgãos públicos e privados. O sistema integra em um único ambiente todas as etapas do ciclo de vida de um projeto: desde o cadastro do contrato e a distribuição de tarefas por disciplina técnica, passando pelo acompanhamento visual em Kanban e Gantt, até a geração de relatórios analíticos e exportação de documentos.</P>
        <H2>Entidades Principais</H2>
        <DataTable
          headers={["Entidade", "Descrição"]}
          rows={[
            ["Cliente", "Órgão ou empresa contratante (ex.: DNIT, DER, SABESP)"],
            ["Contrato (CRS)", "Projeto contratado, vinculado a um cliente, com localização geográfica e dados técnicos da obra"],
            ["Tarefa", "Atividade técnica dentro de um contrato, organizada por disciplina e fase do Kanban"],
          ]}
        />
        <P>Cada tarefa pode conter <strong>itens de checklist</strong> (subtarefas), que são as unidades mínimas de trabalho rastreadas pelo sistema. O progresso de cada tarefa é calculado automaticamente com base na conclusão dos itens de checklist.</P>
        <H2>Módulos Disponíveis</H2>
        <FeatureGrid items={[
          { title: "Dashboard", desc: "Visão consolidada com KPIs, mapa de contratos, burndown e atividade recente." },
          { title: "Projetos / CRS", desc: "Cadastro e gerenciamento completo de contratos e equipes." },
          { title: "Kanban", desc: "Visualização de tarefas por fase com drag-and-drop e checklist expandido." },
          { title: "Gantt", desc: "Cronograma visual de barras com navegação temporal e filtros." },
          { title: "Sprints", desc: "Planejamento ágil com burndown chart e controle de ciclos de trabalho." },
          { title: "Relatórios", desc: "Análises quantitativas com exportação em PDF e relatório anual." },
          { title: "Chat de Tarefas", desc: "Comunicação em tempo real por conversas diretas e grupos de projeto." },
          { title: "Chat IA", desc: "Assistente de inteligência artificial integrado ao sistema." },
        ]} />
      </>
    ),
  },
  {
    id: "acesso",
    num: "Seção 02",
    title: "Acesso e Autenticação",
    icon: Lock,
    color: "linear-gradient(135deg, #14b8a6, #0d9488)",
    content: (
      <>
        <H2>Primeiro Acesso</H2>
        <P>O acesso ao Orbita é realizado por meio de autenticação OAuth segura. Para entrar no sistema:</P>
        <Steps items={[
          "Acesse o endereço fornecido pelo administrador da sua organização.",
          <>Clique no botão <strong>"Entrar"</strong> na tela inicial.</>,
          "Autorize o acesso na janela de autenticação que será aberta.",
          <>Após a autenticação, você será redirecionado automaticamente para o <strong>Dashboard</strong>.</>,
        ]} />
        <Callout type="warn">
          <strong>Atenção:</strong> O sistema não suporta navegação em modo privado/anônimo em alguns navegadores (Safari Private, Firefox com proteção estrita ou Brave com escudos agressivos), pois esses modos bloqueiam os cookies de sessão necessários para a autenticação.
        </Callout>
        <H2>Perfis de Usuário</H2>
        <DataTable
          headers={["Perfil", "Permissões"]}
          rows={[
            [<Badge label="Usuário" color="blue" />, "Acesso a todos os módulos de trabalho; pode criar e editar tarefas nos contratos em que é membro"],
            [<Badge label="Administrador" color="red" />, "Acesso completo, incluindo o módulo Admin para gerenciar usuários, clientes e disciplinas"],
          ]}
        />
        <Callout type="info">
          A promoção de um usuário para administrador é feita pelo próprio administrador no módulo <strong>Admin → Usuários</strong>. Apenas administradores podem alterar perfis.
        </Callout>
        <H2>Sessão e Logout</H2>
        <P>A sessão é mantida por meio de um cookie seguro com tempo de expiração automático. Para encerrar a sessão, clique no seu nome ou avatar no canto inferior esquerdo da sidebar e selecione <strong>"Sair"</strong>.</P>
      </>
    ),
  },
  {
    id: "navegacao",
    num: "Seção 03",
    title: "Navegação e Interface",
    icon: LayoutDashboard,
    color: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    content: (
      <>
        <H2>Sidebar (Barra Lateral)</H2>
        <P>A navegação principal do Orbita é feita pela <strong>sidebar</strong> localizada à esquerda da tela. Ela contém todos os módulos do sistema e permanece visível em todas as páginas. A sidebar possui fundo azul-marinho escuro com o item ativo destacado em azul.</P>
        <DataTable
          headers={["Item de Menu", "Função"]}
          rows={[
            ["Dashboard", "Visão geral e analítica de todos os contratos"],
            ["Projetos", "Lista e gerenciamento de contratos (CRS)"],
            ["Kanban", "Visualização de tarefas por fase e disciplina"],
            ["Gantt", "Cronograma visual de tarefas no tempo"],
            ["Sprints", "Planejamento e acompanhamento de sprints"],
            ["Programação", "Agenda de atividades e alocação de equipe"],
            ["Calendário", "Visualização de eventos e prazos em calendário"],
            ["Relatórios", "Análises, gráficos e exportação de dados"],
            ["Chat de Tarefas", "Mensagens diretas e por grupo entre a equipe"],
            ["Quadro Branco", "Ferramenta de desenho e anotações livres"],
            ["Notificações", "Central de alertas e avisos do sistema"],
            ["Chat IA", "Assistente de inteligência artificial integrado"],
            ["Admin", "Painel de administração (apenas para administradores)"],
          ]}
        />
        <H2>Seleção de Contrato</H2>
        <P>Quando você acessa módulos como <strong>Kanban</strong>, <strong>Gantt</strong> ou <strong>Sprints</strong>, a sidebar exibe automaticamente a lista de contratos ativos. Clique em um contrato para carregá-lo no módulo atual. O contrato selecionado fica destacado na lista e seu nome aparece no cabeçalho da página.</P>
      </>
    ),
  },
  {
    id: "dashboard",
    num: "Seção 04",
    title: "Dashboard",
    icon: LayoutDashboard,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O Dashboard é a página inicial do Orbita e oferece uma visão consolidada de todos os contratos e atividades do sistema. Ele possui dois painéis: <strong>Visão Geral</strong> e <strong>Visão Detalhada</strong>, alternáveis pelos botões no canto superior direito.</P>
        <H2>Visão Geral</H2>
        <DataTable
          headers={["Componente", "O que mostra"]}
          rows={[
            ["KPI Cards", "Contratos este mês, tarefas em risco e contratos concluídos"],
            ["Mapa de Contratos", "Google Maps interativo com marcadores nos estados onde há contratos ativos; zoom automático"],
            ["Burndown da Sprint", "Gráfico comparando ritmo ideal vs. real da sprint atual"],
            ["Contratos por Estado", "Tabela com quantidade, progresso e status por estado"],
            ["Atividade Recente", "Últimas ações realizadas por qualquer membro da equipe"],
            ["Gantt da Semana", "Mini-cronograma das tarefas da semana atual com navegação ← →"],
            ["Extensão por Tipo", "Extensão total (km) detalhada por tipo de obra"],
          ]}
        />
        <H2>Visão Detalhada</H2>
        <FeatureGrid items={[
          { title: "A — Status das Atividades", desc: "Gráfico de rosca com distribuição de tarefas: Concluídas, Em Andamento e Pendentes." },
          { title: "B — Tipo de Obra", desc: "Barras horizontais com quantidade de contratos por tipo (Rodovia, Ferrovia, etc.)." },
          { title: "C — Progresso por Cliente", desc: "Lista de clientes com barra de progresso e percentual médio de conclusão." },
          { title: "D — Minhas Tarefas", desc: "Tarefas atribuídas ao usuário logado com disciplina, data e status." },
          { title: "E — Projetos Ativos", desc: "Cards dos contratos em andamento com cliente, estado e percentual de progresso." },
        ]} />
      </>
    ),
  },
  {
    id: "projetos",
    num: "Seção 05",
    title: "Projetos e Contratos (CRS)",
    icon: FolderKanban,
    color: "linear-gradient(135deg, #22c55e, #16a34a)",
    content: (
      <>
        <P>O módulo <strong>Projetos</strong> é o centro de cadastro e gerenciamento dos contratos. No Orbita, cada projeto é denominado <strong>CRS</strong> (Contrato de Responsabilidade de Serviço).</P>
        <H2>Criar um Novo Contrato</H2>
        <P>Clique no botão <strong>"+ Novo Contrato"</strong> no canto superior direito e preencha os campos:</P>
        <DataTable
          headers={["Campo", "Descrição"]}
          rows={[
            ["Nome", "Nome completo do contrato ou projeto"],
            ["Código", "Código interno de referência (opcional)"],
            ["Cliente", "Selecione o cliente contratante da lista"],
            ["País e Estado", "Localização geográfica da obra"],
            ["Tipo de Obra", "Pode selecionar múltiplos tipos (ex.: Rodovia + Restauração)"],
            ["Extensão (km)", "Extensão linear da obra em quilômetros"],
            ["Área (ha)", "Área da obra em hectares (quando aplicável)"],
            ["Descrição", "Informações adicionais sobre o contrato"],
          ]}
        />
        <Callout type="success">
          Após salvar, o sistema cria automaticamente as <strong>fases padrão do Kanban</strong> para o contrato: Para Iniciar, Em Andamento, Compartilhado e Publicado.
        </Callout>
        <H2>Fases do Kanban por Contrato</H2>
        <P>Cada contrato possui suas próprias fases do Kanban, personalizáveis na aba <strong>"Fases"</strong> da página de detalhes. Você pode adicionar novas fases, reordená-las, definir cores e marcar fases como <strong>"Terminal"</strong> (fases terminais contam como concluídas para o cálculo de progresso).</P>
      </>
    ),
  },
  {
    id: "kanban",
    num: "Seção 06",
    title: "Kanban",
    icon: Kanban,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O módulo <strong>Kanban</strong> oferece uma visualização em colunas das tarefas de um contrato, organizadas por fase. Ele é ideal para acompanhar o fluxo de trabalho diário e identificar gargalos.</P>
        <H2>Selecionando Contrato e Disciplina</H2>
        <P>Ao abrir o Kanban, a sidebar exibe a lista de contratos. Clique no contrato desejado para carregá-lo. Em seguida, use os seletores <strong>"Disciplina 1"</strong> e <strong>"Disciplina 2"</strong> na sidebar para escolher quais disciplinas técnicas deseja visualizar. O board exibe no máximo <strong>duas colunas de disciplina</strong> lado a lado.</P>
        <H2>Informações do Card de Tarefa</H2>
        <DataTable
          headers={["Informação", "Descrição"]}
          rows={[
            ["Prioridade", <span className="flex gap-1 flex-wrap"><Badge label="Baixa" color="gray" /><Badge label="Média" color="blue" /><Badge label="Alta" color="orange" /><Badge label="Urgente" color="red" /></span>],
            ["Status de publicação", "Indica se a tarefa foi publicada/compartilhada"],
            ["Alerta de atraso", "Ícone vermelho quando a data de entrega foi ultrapassada"],
            ["Progresso", "Barra e percentual calculados pelos itens de checklist"],
            ["Responsável", "Nome do usuário atribuído à tarefa"],
            ["Data de entrega", "Data limite da tarefa"],
          ]}
        />
        <H2>Checklist no Card</H2>
        <P>Clique em <strong>"Ver checklist"</strong> no card para expandir a lista de itens diretamente. Para cada item são exibidos: status (pendente/concluído), título, <strong>data de entrega</strong> e <strong>responsável</strong>.</P>
        <H2>Arrastar e Soltar (Drag-and-Drop)</H2>
        <P>Para mover uma tarefa entre fases, clique e segure o card e arraste-o para a coluna da fase desejada. O sistema atualiza automaticamente a fase da tarefa ao soltar o card.</P>
        <H2>Filtros Disponíveis</H2>
        <P>A barra de filtros permite filtrar as tarefas por <strong>status</strong> (Todas, Em Andamento, Concluídas, Atrasadas, Bloqueadas), <strong>responsável</strong> e <strong>fase</strong> específica do Kanban.</P>
      </>
    ),
  },
  {
    id: "gantt",
    num: "Seção 07",
    title: "Gantt",
    icon: GanttChartSquare,
    color: "linear-gradient(135deg, #f59e0b, #d97706)",
    content: (
      <>
        <P>O módulo <strong>Gantt</strong> exibe as tarefas de um contrato em um cronograma visual de barras no tempo, permitindo identificar sobreposições, folgas e o caminho crítico do projeto.</P>
        <H2>Estrutura do Gantt</H2>
        <P>O Gantt é organizado em duas áreas: o <strong>painel esquerdo</strong> com a lista hierárquica das tarefas agrupadas por disciplina, e o <strong>painel direito</strong> com as barras horizontais representando a duração de cada tarefa no calendário. A linha de hoje é marcada com uma linha vertical vermelha.</P>
        <H2>Cores das Barras</H2>
        <DataTable
          headers={["Cor", "Status"]}
          rows={[
            [<Badge label="Azul" color="blue" />, "Em andamento, dentro do prazo"],
            [<Badge label="Verde" color="green" />, "Concluída"],
            [<Badge label="Vermelho" color="red" />, "Atrasada (data de entrega vencida)"],
            [<Badge label="Cinza" color="gray" />, "Pendente / não iniciada"],
          ]}
        />
        <H2>Navegação no Tempo</H2>
        <P>Use os botões de navegação no cabeçalho para centralizar em <strong>Hoje</strong>, avançar/recuar com <strong>← / →</strong> e alterar a escala de tempo (dias, semanas, meses) com o seletor de <strong>Zoom</strong>.</P>
        <H2>Interação com as Barras</H2>
        <P>Clique em uma barra para abrir o painel de detalhes da tarefa. Passe o mouse sobre uma barra para ver um tooltip com o nome da tarefa, responsável, data de início e data de entrega.</P>
      </>
    ),
  },
  {
    id: "sprints",
    num: "Seção 08",
    title: "Sprints",
    icon: Target,
    color: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    content: (
      <>
        <P>O módulo <strong>Sprints</strong> implementa a metodologia ágil de desenvolvimento em ciclos curtos e bem definidos. Cada sprint é vinculada a um contrato e agrupa tarefas e itens de checklist a serem concluídos dentro de um período determinado.</P>
        <H2>Criando uma Sprint</H2>
        <Steps items={[
          "Selecione o contrato na sidebar",
          <>Clique em <strong>"+ Nova Sprint"</strong></>,
          "Preencha o nome, objetivo, data de início e data de término",
          <>Salve a sprint — ela será criada com status <strong>"Planejada"</strong></>,
          <>Para iniciá-la, clique no botão <strong>"Iniciar Sprint"</strong></>,
        ]} />
        <H2>Acompanhamento da Sprint</H2>
        <P>A página da sprint exibe o <strong>Burndown Chart</strong> (comparando ritmo real com ideal), o <strong>progresso geral</strong> em percentual, a <strong>lista de tarefas</strong> associadas com seus status e a <strong>lista de itens de checklist</strong> com responsável e data de entrega.</P>
        <H2>Encerrando uma Sprint</H2>
        <P>Ao final do período, clique em <strong>"Encerrar Sprint"</strong> para marcar a sprint como concluída. O sistema registra o histórico e os itens não concluídos podem ser movidos para a próxima sprint.</P>
      </>
    ),
  },
  {
    id: "programacao",
    num: "Seção 09",
    title: "Programação",
    icon: CalendarRange,
    color: "linear-gradient(135deg, #14b8a6, #0d9488)",
    content: (
      <>
        <P>O módulo <strong>Programação</strong> oferece uma visão de agenda das atividades da equipe, permitindo planejar a alocação de recursos e visualizar a carga de trabalho de cada membro.</P>
        <H2>Visualização da Programação</H2>
        <P>A página de Programação exibe um calendário semanal ou mensal com os eventos e tarefas programadas. Cada evento é representado por um bloco colorido com o nome da atividade e o responsável.</P>
        <H2>Criando Eventos</H2>
        <Steps items={[
          "Clique em um slot de tempo no calendário",
          "Preencha o título, descrição, data e hora de início e término",
          "Selecione o responsável",
          "Salve o evento",
        ]} />
        <H2>Períodos de Férias</H2>
        <P>O módulo de Programação também gerencia os <strong>períodos de férias</strong> dos membros da equipe. Cadastre os períodos de ausência para que o sistema considere a disponibilidade real de cada pessoa ao planejar sprints e alocar tarefas.</P>
      </>
    ),
  },
  {
    id: "calendario",
    num: "Seção 10",
    title: "Calendário",
    icon: CalendarDays,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O módulo <strong>Calendário</strong> oferece uma visão consolidada de todos os prazos, eventos e marcos do projeto em formato de calendário mensal, semanal ou diário.</P>
        <H2>Tipos de Eventos no Calendário</H2>
        <P>O calendário exibe automaticamente:</P>
        <Ul>
          <Li>Datas de entrega de tarefas (marcadas em azul)</Li>
          <Li>Datas de entrega de itens de checklist (marcadas em azul claro)</Li>
          <Li>Início e fim de sprints (marcados em verde)</Li>
          <Li>Eventos de programação (marcados na cor do responsável)</Li>
          <Li>Períodos de férias (marcados em cinza)</Li>
        </Ul>
        <H2>Navegação e Filtros</H2>
        <P>Use os botões <strong>← / →</strong> para navegar entre meses/semanas/dias. O seletor de visualização no canto superior direito permite alternar entre as visões <strong>Mês</strong>, <strong>Semana</strong> e <strong>Dia</strong>.</P>
        <P>Clique em qualquer evento para ver seus detalhes e, quando aplicável, navegar diretamente para a tarefa ou item correspondente.</P>
      </>
    ),
  },
  {
    id: "relatorios",
    num: "Seção 11",
    title: "Relatórios",
    icon: FileBarChart,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O módulo <strong>Relatórios</strong> centraliza as análises quantitativas e qualitativas do desempenho dos projetos, com gráficos interativos e opções de exportação.</P>
        <H2>Tipos de Relatório</H2>
        <DataTable
          headers={["Relatório", "Descrição"]}
          rows={[
            ["Visão Geral", "KPIs consolidados: total de tarefas, concluídas, em andamento, atrasadas"],
            ["Por Contrato", "Detalhamento do progresso de cada contrato com gráficos de barras"],
            ["Por Disciplina", "Distribuição de tarefas e progresso por disciplina técnica"],
            ["Por Membro", "Carga de trabalho e desempenho individual de cada membro da equipe"],
            ["Tendência Mensal", "Evolução do número de tarefas concluídas mês a mês"],
          ]}
        />
        <H2>Exportar Relatório em PDF</H2>
        <Steps items={[
          "Configure os filtros desejados (período, cliente, contrato, disciplina)",
          <>Clique no botão <strong>"Exportar PDF"</strong> no canto superior direito</>,
          "O arquivo será gerado e baixado automaticamente",
        ]} />
        <H2>Relatório Anual</H2>
        <P>Role até o card <strong>"Relatório Anual"</strong>, selecione o ano desejado e clique em <strong>"Exportar PDF Anual"</strong>. O documento inclui: resumo executivo com KPIs do ano, tendência mensal, desempenho por membro, análise por disciplina e detalhamento por contrato.</P>
      </>
    ),
  },
  {
    id: "chat-tarefas",
    num: "Seção 12",
    title: "Chat de Tarefas",
    icon: MessageSquare,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O módulo <strong>Chat de Tarefas</strong> oferece comunicação em tempo real entre os membros da equipe, organizada em conversas diretas e grupos por projeto.</P>
        <H2>Conversas Diretas</H2>
        <Steps items={[
          <>Clique em <strong>"+ Nova Conversa"</strong> na sidebar do chat</>,
          "Selecione o usuário desejado",
          "Digite sua mensagem e pressione Enter",
        ]} />
        <H2>Grupos de Projeto</H2>
        <P>Cada contrato possui automaticamente um grupo de chat associado. Os membros adicionados ao contrato são automaticamente incluídos no grupo. Use o grupo para discussões relacionadas ao projeto, compartilhamento de arquivos e atualizações de status.</P>
        <H2>Comentários em Tarefas</H2>
        <P>Além do chat geral, cada tarefa e cada item de checklist possui uma seção de comentários. Para comentar em uma tarefa, abra o detalhe da tarefa e use o campo de comentário na parte inferior. Os comentários são vinculados à tarefa e ficam registrados no histórico.</P>
      </>
    ),
  },
  {
    id: "quadro-branco",
    num: "Seção 13",
    title: "Quadro Branco",
    icon: PenSquare,
    color: "linear-gradient(135deg, #f59e0b, #d97706)",
    content: (
      <>
        <P>O módulo <strong>Quadro Branco</strong> é uma ferramenta de desenho livre para anotações, diagramas, mapas mentais e esboços durante reuniões e planejamentos.</P>
        <H2>Ferramentas Disponíveis</H2>
        <DataTable
          headers={["Ferramenta", "Função"]}
          rows={[
            ["Caneta", "Desenho livre com espessura e cor ajustáveis"],
            ["Borracha", "Apagar partes do desenho"],
            ["Texto", "Inserir caixas de texto"],
            ["Formas", "Retângulos, círculos e setas"],
            ["Seleção", "Selecionar e mover elementos"],
          ]}
        />
        <H2>Páginas</H2>
        <P>O Quadro Branco suporta múltiplas páginas. Use os botões de navegação na parte inferior para adicionar novas páginas ou navegar entre as existentes.</P>
        <H2>Salvamento Automático</H2>
        <P>O conteúdo do Quadro Branco é salvo automaticamente a cada alteração. Ao retornar ao módulo, o último estado é restaurado automaticamente.</P>
      </>
    ),
  },
  {
    id: "notificacoes",
    num: "Seção 14",
    title: "Notificações",
    icon: Bell,
    color: "linear-gradient(135deg, #ef4444, #dc2626)",
    content: (
      <>
        <P>O módulo <strong>Notificações</strong> centraliza todos os alertas e avisos gerados automaticamente pelo sistema.</P>
        <H2>Tipos de Notificação</H2>
        <DataTable
          headers={["Evento", "Quem recebe"]}
          rows={[
            ["Tarefa atribuída ao usuário", "O responsável pela tarefa"],
            ["Tarefa com prazo vencendo (24h)", "O responsável e o gestor do contrato"],
            ["Tarefa atrasada", "O responsável e o gestor do contrato"],
            ["Comentário em tarefa do usuário", "O autor da tarefa e o responsável"],
            ["Sprint iniciada ou encerrada", "Todos os membros do contrato"],
            ["Novo membro adicionado ao contrato", "O novo membro"],
          ]}
        />
        <H2>Marcando como Lida</H2>
        <P>Clique em uma notificação para marcá-la como lida e, quando aplicável, ser redirecionado para o item relacionado. Use o botão <strong>"Marcar todas como lidas"</strong> para limpar todas as notificações pendentes de uma vez.</P>
      </>
    ),
  },
  {
    id: "chat-ia",
    num: "Seção 15",
    title: "Chat IA",
    icon: Bot,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>O módulo <strong>Chat IA</strong> oferece um assistente de inteligência artificial integrado ao Orbita, capaz de responder perguntas sobre o sistema, ajudar na redação de textos técnicos e auxiliar na análise de dados dos projetos.</P>
        <H2>Como Usar</H2>
        <P>Digite sua pergunta ou solicitação no campo de texto e pressione Enter. O assistente responde em linguagem natural, com suporte a formatação Markdown (listas, tabelas, código).</P>
        <H2>Exemplos de Uso</H2>
        <Ul>
          <Li>"Quais tarefas estão atrasadas no contrato BR-101?"</Li>
          <Li>"Resuma o progresso dos contratos do cliente DNIT"</Li>
          <Li>"Ajude-me a escrever uma justificativa técnica para atraso em obra de terraplanagem"</Li>
          <Li>"Quais são as melhores práticas para gestão de sprints em projetos de infraestrutura?"</Li>
        </Ul>
      </>
    ),
  },
  {
    id: "perfil",
    num: "Seção 16",
    title: "Perfil do Usuário",
    icon: User,
    color: "linear-gradient(135deg, #14b8a6, #0d9488)",
    content: (
      <>
        <H2>Acessando o Perfil</H2>
        <P>Clique no seu nome ou avatar no rodapé da sidebar para acessar o menu de perfil. Selecione <strong>"Perfil"</strong> para abrir a página de configurações pessoais.</P>
        <H2>Informações do Perfil</H2>
        <P>Na página de perfil você pode visualizar e editar:</P>
        <Ul>
          <Li><strong>Nome de exibição</strong></Li>
          <Li><strong>E-mail</strong> (vinculado à conta de autenticação, não editável)</Li>
          <Li><strong>Empresa</strong> e <strong>cargo</strong></Li>
          <Li><strong>Disciplinas de responsabilidade:</strong> Selecione as disciplinas técnicas pelas quais você é responsável. Essa configuração é usada para filtrar automaticamente as tarefas relevantes para você no Kanban e nos relatórios.</Li>
        </Ul>
      </>
    ),
  },
  {
    id: "admin",
    num: "Seção 17",
    title: "Administração",
    icon: Shield,
    color: "linear-gradient(135deg, #ef4444, #dc2626)",
    content: (
      <>
        <P>O módulo <strong>Admin</strong> é acessível apenas para usuários com perfil de <strong>administrador</strong>. Ele centraliza as configurações globais do sistema.</P>
        <H2>Gerenciamento de Usuários</H2>
        <P>Na aba <strong>Usuários</strong>, o administrador pode visualizar todos os usuários cadastrados, alterar o perfil entre Usuário e Administrador, e desativar usuários que não devem mais ter acesso. Para promover um usuário a administrador, clique nos três pontos ao lado do nome e selecione <strong>"Promover a Administrador"</strong>.</P>
        <H2>Gerenciamento de Clientes</H2>
        <P>Na aba <strong>Clientes</strong>, o administrador pode cadastrar, editar e arquivar os clientes (órgãos contratantes). Cada cliente possui nome, tipo (público/privado) e informações de contato.</P>
        <H2>Gerenciamento de Disciplinas</H2>
        <P>Na aba <strong>Disciplinas</strong>, o administrador gerencia as disciplinas técnicas disponíveis no sistema. Para criar uma nova disciplina:</P>
        <Steps items={[
          <>Clique em <strong>"+ Nova Disciplina"</strong></>,
          "Informe o nome e selecione uma cor",
          "Adicione uma descrição (opcional) e salve",
        ]} />
        <H2>Planos e Limites</H2>
        <P>Na aba <strong>Planos</strong>, o administrador visualiza o plano atual da organização e os limites de uso (número de contratos, usuários, armazenamento).</P>
      </>
    ),
  },
  {
    id: "tour-apresentacao",
    num: "Seção 18",
    title: "Guia de Apresentação",
    icon: Presentation,
    color: "linear-gradient(135deg, #f59e0b, #d97706)",
    content: (
      <>
        <P>O <strong>Guia de Apresentação</strong> é um tour interativo que explica as funções principais do Órbita para novos usuários, equipes em treinamento e demonstrações comerciais. O botão fica na parte inferior da barra lateral, abaixo do Manual de Uso.</P>
        <H2>Como iniciar</H2>
        <Steps items={[
          <>Na barra lateral, clique em <strong>"Guia de apresentação"</strong>.</>,
          "Leia a explicação da aba destacada e os três pontos principais apresentados no passo.",
          <>Use <strong>"Próxima aba"</strong> para avançar: o Órbita muda automaticamente para a aba correspondente, destaca sua entrada na barra lateral e mantém o painel explicativo aberto.</>,
          <>Use <strong>"Anterior"</strong> para retornar à ferramenta anterior; o texto, os pontos principais e o destaque acompanham a aba exibida.</>,
          <>Ao finalizar, clique em <strong>"Concluir"</strong>. O guia também pode ser encerrado pelo botão X, clicando fora do painel ou pressionando Esc.</>,
        ]} />
        <H2>O que o tour apresenta</H2>
        <DataTable
          headers={["Bloco", "Conteúdo explicado"]}
          rows={[
            ["Gestão", "Dashboard, projetos, contratos, Kanban, Gantt, sprints e programação"],
            ["Colaboração", "Calendário, reuniões, chat de tarefas e quadro branco"],
            ["Inteligência", "Notificações, Chat IA e Assistente Órbita"],
            ["Governança", "Administração multi-tenant, segurança, branding, domínios e 2FA"],
            ["Continuidade", "Migração, backups, importação, exportação e operação organizada"],
          ]}
        />
        <Callout type="info">
          O tour pode ser navegado por teclado com as setas <strong>←</strong> e <strong>→</strong>. Ao trocar de etapa, a rota e a aba lateral são sincronizadas automaticamente, enquanto o modal permanece aberto para orientar o uso. O foco inicial é direcionado ao botão de fechamento e a interface respeita o tema claro/escuro e tamanhos menores de tela.
        </Callout>
      </>
    ),
  },
  {
    id: "glossario",
    num: "Seção 19",
    title: "Conceitos e Glossário",
    icon: BookMarked,
    color: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    content: (
      <>
        <P>Esta seção define os termos técnicos utilizados no Orbita para garantir que todos os usuários compartilhem o mesmo vocabulário.</P>
        <DataTable
          headers={["Termo", "Definição"]}
          rows={[
            ["CRS", "Contrato de Responsabilidade de Serviço — a entidade central do sistema, representa um projeto contratado"],
            ["Disciplina", "Área técnica de especialização (ex.: Drenagem, Terraplanagem, Geotecnia) usada para categorizar tarefas"],
            ["Fase do Kanban", "Etapa do fluxo de trabalho de um contrato (ex.: Para Iniciar, Em Andamento, Publicado)"],
            ["Fase Terminal", "Fase que representa a conclusão de uma tarefa; tarefas nessa fase contam para o cálculo de progresso"],
            ["Checklist Item", "Subtarefa dentro de uma tarefa; o progresso da tarefa é calculado pela proporção de itens concluídos"],
            ["Sprint", "Ciclo de trabalho com duração definida (geralmente 1–4 semanas) que agrupa tarefas a serem concluídas"],
            ["Burndown", "Gráfico que mostra a redução do trabalho restante ao longo do tempo em uma sprint"],
            ["Progresso", "Percentual de conclusão calculado automaticamente: (itens concluídos / total de itens) × 100"],
            ["Responsável", "Usuário atribuído a uma tarefa ou item de checklist, responsável pela sua execução"],
            ["Publicado", "Status de uma tarefa que foi revisada e aprovada para entrega ao cliente"],
            ["Bloqueado", "Status de uma tarefa que não pode avançar por impedimento externo; requer registro do motivo do bloqueio"],
            ["Drag-and-Drop", "Funcionalidade de arrastar e soltar cards de tarefas entre colunas de fase no Kanban"],
            ["Burndown Chart", "Gráfico de linha que compara o ritmo ideal de conclusão com o ritmo real ao longo de uma sprint"],
          ]}
        />
      </>
    ),
  },
];

// ─── Componente principal ────────────────────────────────────────────────────
export default function UserManual() {
  const [activeId, setActiveId] = useState(sections[0].id);
  const [search, setSearch] = useState("");
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0];

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) =>
      s.title.toLowerCase().includes(q) || s.num.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <AppLayout title="Manual de Uso">
      <div className="flex gap-0 h-full -m-4 lg:-m-6 overflow-hidden">

        {/* ── Sidebar de navegação do manual ── */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          {/* Header */}
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}>
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Manual de Uso</span>
            </div>
            <p className="text-xs text-slate-400 pl-10">Versão 1.0 — 2026</p>
          </div>

          {/* Search */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar seção..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
              />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-1 px-2 space-y-0.5">
            {filteredSections.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhuma seção encontrada</p>
            )}
            {filteredSections.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#1d4ed8" : "#475569",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? "#3b82f6" : "#94a3b8" }} />
                  <span className="text-xs font-medium leading-tight flex-1 text-left">{s.title}</span>
                  {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0 text-blue-400" />}
                </button>
              );
            })}
          </nav>

          {/* Download PDF */}
          <div className="p-3 border-t border-slate-100">
            <a
              href="/manual-orbita.pdf"
              download="Manual-Orbita.pdf"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "linear-gradient(135deg, #0f172a, #1e3a5f)", color: "white" }}
            >
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </a>
          </div>
        </aside>

        {/* ── Conteúdo principal ── */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {/* Cover strip */}
          <div
            className="px-8 py-8 lg:py-10"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%)" }}
          >
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
                style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" }}>
                {activeSection.num}
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white mb-2">{activeSection.title}</h1>
              <p className="text-sm text-blue-300">Orbita — Sistema de Gestão de Contratos e Projetos de Engenharia</p>
            </div>
          </div>

          {/* Content body */}
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8">
            {activeSection.content}
          </div>

          {/* Navigation footer */}
          <div className="max-w-3xl mx-auto px-6 lg:px-8 pb-10">
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              {(() => {
                const idx = sections.findIndex((s) => s.id === activeId);
                const prev = sections[idx - 1];
                const next = sections[idx + 1];
                return (
                  <>
                    {prev ? (
                      <button
                        onClick={() => setActiveId(prev.id)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        <span>{prev.title}</span>
                      </button>
                    ) : <div />}
                    {next ? (
                      <button
                        onClick={() => setActiveId(next.id)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <span>{next.title}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

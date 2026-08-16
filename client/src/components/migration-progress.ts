export type ImportProgressStep = {
  percent: number;
  label: string;
};

export const IMPORT_STEPS: ImportProgressStep[] = [
  { percent: 10, label: "Validando estrutura do arquivo JSON..." },
  { percent: 35, label: "Verificando isolamento por empresa (Tenant)..." },
  { percent: 65, label: "Inserindo empresas, clientes e contratos..." },
  { percent: 90, label: "Processando tarefas, sprints e agendamentos..." },
  { percent: 100, label: "Importação concluída com sucesso!" },
];

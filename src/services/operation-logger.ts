// ===================================================================
// LOGGER DE OPERAÇÕES — Registra toda operação do data-layer
// ===================================================================

export interface OperationLog {
  id: string;
  timestamp: string;
  backend: 'api' | 'cloud';
  backendLabel: string;
  module: string;
  operation: string;
  detail: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

const MAX_LOGS = 500;
let logs: OperationLog[] = [];
let listeners: Array<() => void> = [];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addOperationLog(
  backend: 'api' | 'cloud',
  module: string,
  operation: string,
  detail: string,
  status: 'success' | 'error' = 'success',
  errorMessage?: string,
) {
  const log: OperationLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    backend,
    backendLabel: backend === 'api' ? 'VPS / MariaDB' : 'Cloud / Teste',
    module,
    operation,
    detail,
    status,
    errorMessage,
  };

  logs = [log, ...logs].slice(0, MAX_LOGS);
  listeners.forEach((fn) => fn());
}

export function getOperationLogs(): OperationLog[] {
  return logs;
}

export function clearOperationLogs(): void {
  logs = [];
  listeners.forEach((fn) => fn());
}

export function subscribeToLogs(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

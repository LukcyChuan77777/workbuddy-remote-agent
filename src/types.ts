export interface Task {
  id: string;
  subject: string;
  description?: string;
  status: string;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  content: string;
}

export interface Command {
  id: string;
  action: string;
  target?: string;
  payload?: any;
  timestamp: string;
}

export interface SystemStatus {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  taskCount: number;
  wsClients: number;
}

export interface WSMessage {
  type: 'init' | 'tasks_updated' | 'logs_updated' | 'heartbeat' | 'command_ack';
  payload: any;
  timestamp: string;
}

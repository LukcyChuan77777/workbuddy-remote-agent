import { Task, LogEntry, Command } from './types';
import EventEmitter from 'events';

export const state: {
  tasks: Task[];
  logs: LogEntry[];
  commands: Command[];
  wsClients: Set<any>;
} = {
  tasks: [],
  logs: [],
  commands: [],
  wsClients: new Set(),
};

export const events = new EventEmitter();

import { state, events } from '../state';
import { Task, LogEntry, Command } from '../types';

describe('state', () => {
  // Reset state before each test to avoid interference
  beforeEach(() => {
    state.tasks = [];
    state.logs = [];
    state.commands = [];
    state.wsClients.clear();
    events.removeAllListeners();
  });

  afterEach(() => {
    events.removeAllListeners();
  });

  test('initial state should have empty arrays and sets', () => {
    expect(Array.isArray(state.tasks)).toBe(true);
    expect(state.tasks.length).toBe(0);
    expect(Array.isArray(state.logs)).toBe(true);
    expect(state.logs.length).toBe(0);
    expect(Array.isArray(state.commands)).toBe(true);
    expect(state.commands.length).toBe(0);
    expect(state.wsClients instanceof Set).toBe(true);
    expect(state.wsClients.size).toBe(0);
  });

  test('events should be an EventEmitter instance', () => {
    expect(events).toBeInstanceOf(require('events').EventEmitter);
  });

  test('state.tasks can be updated', () => {
    const task: Task = {
      id: 'task-1',
      subject: 'Test Task',
      status: 'pending',
    };
    state.tasks.push(task);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('task-1');
    expect(state.tasks[0].subject).toBe('Test Task');
  });

  test('state.logs can be updated', () => {
    const log: LogEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      content: 'Test log entry',
    };
    state.logs.push(log);
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].content).toBe('Test log entry');
  });

  test('state.commands can be updated', () => {
    const command: Command = {
      id: 'cmd-1',
      action: 'refresh',
      target: 'tasks',
      timestamp: '2024-01-01T00:00:00Z',
    };
    state.commands.push(command);
    expect(state.commands).toHaveLength(1);
    expect(state.commands[0].action).toBe('refresh');
  });

  test('state.wsClients can hold mock WebSocket objects', () => {
    const mockWs = { readyState: 1, send: jest.fn() } as any;
    state.wsClients.add(mockWs);
    expect(state.wsClients.size).toBe(1);
    expect(state.wsClients.has(mockWs)).toBe(true);
  });

  test('events can emit and listen to custom events', () => {
    const handler = jest.fn();
    events.on('broadcast', handler);
    const msg = { type: 'init', payload: {}, timestamp: '2024-01-01T00:00:00Z' };
    events.emit('broadcast', msg);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  test('multiple listeners can subscribe to the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    events.on('broadcast', handler1);
    events.on('broadcast', handler2);
    events.emit('broadcast', { type: 'heartbeat' });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('state updates are reflected across references', () => {
    const tasksRef = state.tasks;
    const newTask: Task = { id: 't1', subject: 'Ref Test', status: 'completed' };
    tasksRef.push(newTask);
    expect(state.tasks).toContainEqual(newTask);
  });
});

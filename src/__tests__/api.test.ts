import request from 'supertest';
import express from 'express';
import { apiRouter } from '../api';
import { state, events } from '../state';
import { Task, LogEntry, Command } from '../types';

// Create a test app mounting the apiRouter
const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('API endpoints', () => {
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

  describe('GET /api/status', () => {
    test('should return status with empty arrays initially', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('system');
      expect(res.body.tasks).toEqual([]);
      expect(res.body.logs).toEqual([]);
      expect(res.body.system).toHaveProperty('uptime');
      expect(res.body.system).toHaveProperty('memoryUsage');
      expect(res.body.system).toHaveProperty('taskCount', 0);
      expect(res.body.system).toHaveProperty('wsClients', 0);
    });

    test('should return current tasks and logs', async () => {
      const task: Task = { id: 't1', subject: 'Task 1', status: 'pending' };
      const log: LogEntry = { timestamp: '2024-01-01T00:00:00Z', content: 'Log 1' };
      state.tasks.push(task);
      state.logs.push(log);

      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].id).toBe('t1');
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].content).toBe('Log 1');
      expect(res.body.system.taskCount).toBe(1);
    });

    test('should reflect wsClients count', async () => {
      state.wsClients.add({} as any);
      state.wsClients.add({} as any);
      const res = await request(app).get('/api/status');
      expect(res.body.system.wsClients).toBe(2);
    });
  });

  describe('POST /api/command', () => {
    test('should return 400 when action is missing', async () => {
      const res = await request(app)
        .post('/api/command')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing or invalid action');
    });

    test('should return 400 when action is not a string', async () => {
      const res = await request(app)
        .post('/api/command')
        .send({ action: 123 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should create a command and emit broadcast event', async () => {
      const broadcastHandler = jest.fn();
      events.on('broadcast', broadcastHandler);

      const res = await request(app)
        .post('/api/command')
        .send({ action: 'refresh', target: 'tasks', payload: { force: true } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('commandId');
      expect(typeof res.body.commandId).toBe('string');

      expect(state.commands).toHaveLength(1);
      expect(state.commands[0].action).toBe('refresh');
      expect(state.commands[0].target).toBe('tasks');
      expect(state.commands[0].payload).toEqual({ force: true });
      expect(state.commands[0]).toHaveProperty('timestamp');
      expect(state.commands[0]).toHaveProperty('id');

      expect(broadcastHandler).toHaveBeenCalledTimes(1);
      const emitted = broadcastHandler.mock.calls[0][0];
      expect(emitted.type).toBe('command_ack');
      expect(emitted.payload).toMatchObject({ action: 'refresh', target: 'tasks' });
      expect(emitted).toHaveProperty('timestamp');
    });

    test('should use defaults for missing target and payload', async () => {
      const res = await request(app)
        .post('/api/command')
        .send({ action: 'restart' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(state.commands[0].target).toBe('');
      expect(state.commands[0].payload).toBeNull();
    });

    test('should create multiple commands with unique IDs', async () => {
      await request(app).post('/api/command').send({ action: 'a1' });
      await request(app).post('/api/command').send({ action: 'a2' });
      expect(state.commands).toHaveLength(2);
      expect(state.commands[0].id).not.toBe(state.commands[1].id);
    });
  });
});

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { state, events } from './state';
import { Command, WSMessage } from './types';

export const apiRouter = Router();

apiRouter.get('/status', (req, res) => {
  res.json({
    tasks: state.tasks,
    logs: state.logs,
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      taskCount: state.tasks.length,
      wsClients: state.wsClients.size,
    },
  });
});

apiRouter.post('/command', (req, res) => {
  const { action, target, payload } = req.body || {};
  if (!action || typeof action !== 'string') {
    res.status(400).json({ success: false, error: 'Missing or invalid action' });
    return;
  }

  const command: Command = {
    id: randomUUID(),
    action,
    target: target || '',
    payload: payload || null,
    timestamp: new Date().toISOString(),
  };

  state.commands.push(command);
  console.log('Command received:', command);

  events.emit('broadcast', {
    type: 'command_ack',
    payload: command,
    timestamp: new Date().toISOString(),
  } as WSMessage);

  res.json({ success: true, commandId: command.id });
});

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from 'dotenv';

import { state, events } from './state';
import { setupWatcher } from './watcher';
import { apiRouter } from './api';
import { WSMessage } from './types';

config();

const PORT = process.env.PORT || 3456;
const WORKBUDDY_TASKS_DIR = process.env.WORKBUDDY_TASKS_DIR || 'D:\\CODE\\.workbuddy\\tasks';
const WORKBUDDY_MEMORY_DIR = process.env.WORKBUDDY_MEMORY_DIR || 'D:\\CODE\\.workbuddy\\memory';

const app = express();
const server = createServer(app);

app.use(express.json());
app.use('/api', apiRouter);

const wss = new WebSocketServer({ server });

const broadcast = (msg: WSMessage) => {
  const data = JSON.stringify(msg);
  state.wsClients.forEach((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
};

events.on('broadcast', broadcast);

wss.on('connection', (ws: WebSocket) => {
  state.wsClients.add(ws);
  console.log('WS client connected. Total:', state.wsClients.size);

  ws.send(JSON.stringify({
    type: 'init',
    payload: {
      tasks: state.tasks,
      logs: state.logs,
      system: {
        uptime: process.uptime(),
        taskCount: state.tasks.length,
        wsClients: state.wsClients.size,
      },
    },
    timestamp: new Date().toISOString(),
  } as WSMessage));

  ws.on('close', () => {
    state.wsClients.delete(ws);
    console.log('WS client disconnected. Total:', state.wsClients.size);
  });

  ws.on('error', (err) => {
    console.error('WS error:', err);
    state.wsClients.delete(ws);
  });
});

setInterval(() => {
  broadcast({
    type: 'heartbeat',
    payload: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      taskCount: state.tasks.length,
      wsClients: state.wsClients.size,
    },
    timestamp: new Date().toISOString(),
  });
}, 30000);

async function init() {
  await setupWatcher(WORKBUDDY_TASKS_DIR, WORKBUDDY_MEMORY_DIR);
  server.listen(PORT, () => {
    console.log(`WorkBuddy Remote Agent listening on http://localhost:${PORT}`);
  });
}

init();

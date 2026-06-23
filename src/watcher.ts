import { watch } from 'chokidar';
import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { Task, LogEntry, WSMessage } from './types';
import { state, events } from './state';

export async function setupWatcher(tasksDir: string, memoryDir: string) {
  await loadAllTasks(tasksDir);
  await loadAllLogs(memoryDir);

  const taskWatcher = watch(join(tasksDir, '**/*.json'), { ignoreInitial: true });
  const memoryWatcher = watch(join(memoryDir, '*.md'), { ignoreInitial: true });

  const debouncedReloadTasks = debounce(async () => {
    await loadAllTasks(tasksDir);
    broadcastUpdate('tasks_updated', state.tasks);
  }, 500);

  const debouncedReloadLogs = debounce(async () => {
    await loadAllLogs(memoryDir);
    broadcastUpdate('logs_updated', state.logs);
  }, 500);

  taskWatcher.on('all', debouncedReloadTasks);
  memoryWatcher.on('all', debouncedReloadLogs);
}

async function loadAllTasks(tasksDir: string) {
  const tasks: Task[] = [];
  await readTasksRecursive(tasksDir, tasks);
  state.tasks = tasks;
  console.log(`Loaded ${tasks.length} tasks.`);
}

async function readTasksRecursive(dir: string, tasks: Task[]) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await readTasksRecursive(fullPath, tasks);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            tasks.push(...data.map((item: any) => normalizeTask(item, fullPath)));
          } else {
            tasks.push(normalizeTask(data, fullPath));
          }
        } catch (e) {
          console.error(`Failed to parse task file ${fullPath}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`Failed to read tasks directory ${dir}:`, e);
  }
}

function normalizeTask(data: any, sourcePath: string): Task {
  return {
    ...data,
    id: data.id ?? data.taskId ?? basename(sourcePath, '.json'),
    subject: data.subject ?? data.title ?? data.name ?? 'Untitled',
    description: data.description ?? '',
    status: data.status ?? 'pending',
    owner: data.owner ?? data.assignee ?? '',
    createdAt: data.createdAt ?? data.created_at ?? '',
    updatedAt: data.updatedAt ?? data.updated_at ?? '',
    _source: sourcePath,
  };
}

async function loadAllLogs(memoryDir: string, limit: number = 50) {
  try {
    const entries = await readdir(memoryDir, { withFileTypes: true });
    const mdFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
      .sort();
    const latestFiles = mdFiles.slice(-2);
    const logs: LogEntry[] = [];
    for (const file of latestFiles) {
      const content = await readFile(join(memoryDir, file), 'utf-8');
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const fileDate = file.replace('.md', '');
      logs.push(...lines.map(line => {
        const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/);
        return {
          timestamp: tsMatch ? tsMatch[1] : fileDate,
          content: line,
        };
      }));
    }
    state.logs = logs.slice(-limit);
    console.log(`Loaded ${state.logs.length} logs.`);
  } catch (e) {
    console.error(`Failed to read memory directory ${memoryDir}:`, e);
    state.logs = [];
  }
}

function broadcastUpdate(type: WSMessage['type'], payload: any) {
  events.emit('broadcast', {
    type,
    payload,
    timestamp: new Date().toISOString(),
  } as WSMessage);
}

function debounce(fn: (...args: any[]) => void, ms: number) {
  let timer: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

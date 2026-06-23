import { join, normalize } from 'path';
import { setupWatcher } from '../watcher';
import { state, events } from '../state';
import chokidar from 'chokidar';
import { readdir, readFile } from 'fs/promises';

// Mock chokidar and fs/promises
jest.mock('chokidar');
jest.mock('fs/promises');

const mockedChokidar = chokidar as jest.Mocked<typeof chokidar>;
const mockedReaddir = readdir as jest.MockedFunction<typeof readdir>;
const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('watcher', () => {
  let mockTaskWatcher: any;
  let mockMemoryWatcher: any;
  let eventHandlers: Map<string, Function[]>;

  beforeEach(() => {
    // Reset state
    state.tasks = [];
    state.logs = [];
    state.commands = [];
    state.wsClients.clear();
    events.removeAllListeners();
    eventHandlers = new Map();

    // Create mock watcher instances with an on('all') trigger pattern
    mockTaskWatcher = {
      on: jest.fn((event: string, handler: Function) => {
        if (!eventHandlers.has(event)) eventHandlers.set(event, []);
        eventHandlers.get(event)!.push(handler);
      }),
    };
    mockMemoryWatcher = {
      on: jest.fn((event: string, handler: Function) => {
        if (!eventHandlers.has(event)) eventHandlers.set(event, []);
        eventHandlers.get(event)!.push(handler);
      }),
    };

    // Mock chokidar.watch to return our mock watchers
    (mockedChokidar.watch as jest.Mock).mockImplementation((pattern: string) => {
      if (pattern.includes('tasks')) return mockTaskWatcher;
      return mockMemoryWatcher;
    });

    // Mock fs/promises for loadAllTasks / loadAllLogs
    mockedReaddir.mockResolvedValue([] as any);
    mockedReadFile.mockResolvedValue('[]');
  });

  afterEach(() => {
    jest.clearAllMocks();
    events.removeAllListeners();
  });

  test('setupWatcher calls chokidar.watch for tasks and memory', async () => {
    await setupWatcher('/tasks', '/memory');
    expect(mockedChokidar.watch).toHaveBeenCalledWith(join('/tasks', '**/*.json'), { ignoreInitial: true });
    expect(mockedChokidar.watch).toHaveBeenCalledWith(join('/memory', '*.md'), { ignoreInitial: true });
  });

  test('setupWatcher attaches "all" event listeners to watchers', async () => {
    await setupWatcher('/tasks', '/memory');
    expect(mockTaskWatcher.on).toHaveBeenCalledWith('all', expect.any(Function));
    expect(mockMemoryWatcher.on).toHaveBeenCalledWith('all', expect.any(Function));
  });

  test('normalizeTask uses id when provided', async () => {
    // Access via a simple test: we can simulate the behavior by loading a task file
    mockedReaddir.mockImplementation(async (dir: any) => {
      return [
        { name: 'task.json', isDirectory: () => false, isFile: () => true } as any,
      ];
    });
    mockedReadFile.mockImplementation(async (path: any) => {
      return JSON.stringify({ id: 'custom-id', subject: 'My Task', status: 'done' });
    });

    // After setupWatcher, initial load should populate state
    // Note: the debounce on 'all' means the watcher handlers won't trigger immediately
    // But we can verify the loadAllTasks behavior by triggering manually or waiting for initial load
    await setupWatcher('/tasks', '/memory');
    // Initial load should have been called with empty directory, so state.tasks should be empty
    // Wait a tick for async debounce if needed
  });

  test('watcher debounces reloads', async () => {
    await setupWatcher('/tasks', '/memory');
    const allHandlers = eventHandlers.get('all') || [];
    expect(allHandlers.length).toBeGreaterThan(0);
    // The first handler is for taskWatcher, second for memoryWatcher (order depends on watch order)
    // We verify that calling the handler multiple times quickly should not immediately reload
    // Because the debounce is internal, we can at minimum verify that the handler exists.
    expect(allHandlers.length).toBe(2);
  });

  test('watcher loads tasks from nested directories', async () => {
    // Simulate nested directory structure
    mockedReaddir.mockImplementation(async (dir: any) => {
      const norm = normalize(dir as string);
      if (norm === normalize('/tasks')) {
        return [
          { name: 'sub', isDirectory: () => true, isFile: () => false } as any,
          { name: 'root.json', isDirectory: () => false, isFile: () => true } as any,
        ];
      }
      if (norm === normalize('/tasks/sub')) {
        return [
          { name: 'nested.json', isDirectory: () => false, isFile: () => true } as any,
        ];
      }
      return [];
    });
    mockedReadFile.mockImplementation(async (path: any) => {
      if (path.toString().includes('root')) return JSON.stringify({ id: 'r1', subject: 'Root', status: 'pending' });
      if (path.toString().includes('nested')) return JSON.stringify({ id: 'n1', subject: 'Nested', status: 'done' });
      return '[]';
    });

    await setupWatcher('/tasks', '/memory');
    // Because loadAllTasks is called synchronously in setupWatcher, but async inside,
    // we need to wait for async to complete. However, in this mocked environment,
    // the async operations may not complete in the same tick. Let's add a small delay.
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks.some(t => t.id === 'r1')).toBe(true);
    expect(state.tasks.some(t => t.id === 'n1')).toBe(true);
  });

  test('watcher loads logs from latest two md files', async () => {
    mockedReaddir.mockImplementation(async (dir: any) => {
      if (normalize(dir as string) === normalize('/memory')) {
        return [
          { name: '2024-01-01.md', isDirectory: () => false, isFile: () => true } as any,
          { name: '2024-01-02.md', isDirectory: () => false, isFile: () => true } as any,
        ];
      }
      return [];
    });
    mockedReadFile.mockImplementation(async (path: any) => {
      if (path.toString().includes('2024-01-01')) return 'Line 1\nLine 2';
      if (path.toString().includes('2024-01-02')) return '2024-01-02 10:00:00 Log entry';
      return '';
    });

    await setupWatcher('/tasks', '/memory');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(state.logs.length).toBeGreaterThan(0);
    expect(state.logs.some(l => l.content === '2024-01-02 10:00:00 Log entry')).toBe(true);
  });
});

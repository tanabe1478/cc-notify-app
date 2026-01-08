import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { ApprovalWebSocketServer } from './websocket.js';
import type { ApprovalRequest, ApprovalResponse } from '../shared/types.js';

const TEST_PORT = 13847;

describe('ApprovalWebSocketServer', () => {
  let server: ApprovalWebSocketServer;

  beforeEach(async () => {
    server = new ApprovalWebSocketServer(TEST_PORT);
    await server.start();
  });

  afterEach(() => {
    server.stop();
  });

  it('should accept client connections', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.close();
        resolve();
      });
      ws.on('error', reject);
    });
  });

  it('should emit approvalRequest event when receiving valid request', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    const receivedRequest = await new Promise<ApprovalRequest>((resolve, reject) => {
      server.on('approvalRequest', (request: ApprovalRequest) => {
        resolve(request);
      });

      ws.on('open', () => {
        const request: ApprovalRequest = {
          type: 'approval_request',
          requestId: 'test-uuid',
          toolName: 'Bash',
          toolInput: { command: 'ls' },
          cwd: '/home/user',
          sessionId: 'session-123',
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(request));
      });

      ws.on('error', reject);

      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    expect(receivedRequest.requestId).toBe('test-uuid');
    expect(receivedRequest.toolName).toBe('Bash');
    ws.close();
  });

  it('should send response back to client', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const requestId = 'response-test-uuid';

    const response = await new Promise<ApprovalResponse>((resolve, reject) => {
      server.on('approvalRequest', () => {
        // Simulate approval after receiving request
        setTimeout(() => {
          server.respondToRequest(requestId, 'allow');
        }, 50);
      });

      ws.on('open', () => {
        const request: ApprovalRequest = {
          type: 'approval_request',
          requestId,
          toolName: 'Bash',
          toolInput: { command: 'ls' },
          cwd: '/home/user',
          sessionId: 'session-123',
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(request));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        resolve(msg);
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    expect(response.type).toBe('approval_response');
    expect(response.requestId).toBe(requestId);
    expect(response.decision).toBe('allow');
    ws.close();
  });

  it('should return false when responding to non-existent request', () => {
    const result = server.respondToRequest('non-existent', 'allow');
    expect(result).toBe(false);
  });

  it('should track pending request count', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    await new Promise<void>((resolve, reject) => {
      server.on('approvalRequest', () => {
        expect(server.getPendingRequestCount()).toBe(1);
        server.respondToRequest('count-test-uuid', 'deny');
        setTimeout(() => {
          expect(server.getPendingRequestCount()).toBe(0);
          resolve();
        }, 50);
      });

      ws.on('open', () => {
        const request: ApprovalRequest = {
          type: 'approval_request',
          requestId: 'count-test-uuid',
          toolName: 'Edit',
          toolInput: { file_path: '/test.ts' },
          cwd: '/home/user',
          sessionId: 'session-123',
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(request));
      });

      ws.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    ws.close();
  });
});

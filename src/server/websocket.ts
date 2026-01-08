import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { ApprovalRequest, ApprovalResponse, PermissionDecision } from '../shared/types.js';
import { isApprovalRequest, isApprovalResponse } from '../shared/types.js';

interface ResponseOptions {
  updatedInput?: Record<string, unknown>;
  message?: string;
}

interface PendingRequest {
  ws: WebSocket;
  request: ApprovalRequest;
  resolve: (decision: PermissionDecision, options?: ResponseOptions) => void;
}

export class ApprovalWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();

  constructor(private port: number) {
    super();
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('listening', () => {
          console.log(`[WebSocket] Server listening on port ${this.port}`);
          resolve();
        });

        this.wss.on('connection', (ws) => {
          console.log('[WebSocket] Client connected');

          ws.on('message', (data) => {
            this.handleMessage(ws, data.toString());
          });

          ws.on('close', () => {
            console.log('[WebSocket] Client disconnected');
            // Clean up pending requests for this connection
            for (const [requestId, pending] of this.pendingRequests) {
              if (pending.ws === ws) {
                console.log(`[WebSocket] Cleaning up pending request: ${requestId}`);
                this.pendingRequests.delete(requestId);
              }
            }
          });

          ws.on('error', (error) => {
            console.error('[WebSocket] Client error:', error.message);
          });
        });

        this.wss.on('error', (error) => {
          console.error('[WebSocket] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(ws: WebSocket, data: string): void {
    try {
      const message = JSON.parse(data);

      if (isApprovalRequest(message)) {
        console.log(`[WebSocket] Received approval request: ${message.requestId}`);
        console.log(`[WebSocket]   Tool: ${message.toolName}`);

        // Store the pending request
        this.pendingRequests.set(message.requestId, {
          ws,
          request: message,
          resolve: (decision, options) => {
            this.sendResponse(ws, message.requestId, decision, options);
          },
        });

        // Emit event for Discord handler
        this.emit('approvalRequest', message);
      } else {
        console.warn('[WebSocket] Unknown message type:', message);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  respondToRequest(
    requestId: string,
    decision: PermissionDecision,
    options?: ResponseOptions
  ): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      console.warn(`[WebSocket] No pending request found: ${requestId}`);
      return false;
    }

    pending.resolve(decision, options);
    this.pendingRequests.delete(requestId);
    return true;
  }

  private sendResponse(
    ws: WebSocket,
    requestId: string,
    decision: PermissionDecision,
    options?: ResponseOptions
  ): void {
    const response: ApprovalResponse = {
      type: 'approval_response',
      requestId,
      decision,
      ...(options?.updatedInput && { updatedInput: options.updatedInput }),
      ...(options?.message && { message: options.message }),
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
      console.log(`[WebSocket] Sent response for ${requestId}: ${decision}${options?.updatedInput ? ' (with updated input)' : ''}`);
    } else {
      console.error(`[WebSocket] Cannot send response, connection not open`);
    }
  }

  getPendingRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId)?.request;
  }

  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  stop(): void {
    if (this.wss) {
      // Respond to all pending requests with 'ask' before closing
      for (const [requestId, pending] of this.pendingRequests) {
        pending.resolve('ask', { message: 'Server shutting down' });
      }
      this.pendingRequests.clear();

      this.wss.close(() => {
        console.log('[WebSocket] Server closed');
      });
      this.wss = null;
    }
  }
}

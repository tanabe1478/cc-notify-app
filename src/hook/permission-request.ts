import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { HookInput, ApprovalRequest, ApprovalResponse, HookOutput } from '../shared/types.js';
import { isHookInput, isApprovalResponse, createHookOutput } from '../shared/types.js';
import { checkPermission } from './permission-checker.js';

// Configuration
const WEBSOCKET_URL = process.env.CC_NOTIFY_WS_URL || 'ws://localhost:3847';
const REQUEST_TIMEOUT = parseInt(process.env.CC_NOTIFY_TIMEOUT || '600000', 10); // 600 seconds

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', reject);

    // Handle case where stdin is empty or closed
    setTimeout(() => {
      if (data === '') {
        resolve('');
      }
    }, 100);
  });
}

function output(result: HookOutput): void {
  console.log(JSON.stringify(result));
}

function fallbackToAsk(reason: string): void {
  console.error(`[Hook] ${reason}`);
  output(createHookOutput('ask'));
}

async function requestApproval(input: HookInput): Promise<void> {
  const requestId = randomUUID();

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = (): void => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    // Set timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        fallbackToAsk('Request timed out');
        ws.close();
        cleanup();
      }
    }, REQUEST_TIMEOUT);

    // Connect to WebSocket server
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.on('open', () => {
      // Send approval request
      const request: ApprovalRequest = {
        type: 'approval_request',
        requestId,
        toolName: input.tool_name,
        toolInput: input.tool_input,
        cwd: input.cwd,
        sessionId: input.session_id,
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (isApprovalResponse(message) && message.requestId === requestId) {
          clearTimeout(timeout);
          output(createHookOutput(message.decision, message.message));
          ws.close();
          cleanup();
        }
      } catch (error) {
        console.error('[Hook] Failed to parse response:', error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      fallbackToAsk(`WebSocket error: ${error.message}`);
      cleanup();
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (!resolved) {
        fallbackToAsk('Connection closed unexpectedly');
        cleanup();
      }
    });
  });
}

async function main(): Promise<void> {
  try {
    // Read stdin
    const stdinData = await readStdin();

    if (!stdinData.trim()) {
      fallbackToAsk('No input received');
      return;
    }

    // Parse input
    let input: unknown;
    try {
      input = JSON.parse(stdinData);
    } catch {
      fallbackToAsk('Invalid JSON input');
      return;
    }

    // Validate input
    if (!isHookInput(input)) {
      fallbackToAsk('Invalid hook input format');
      return;
    }

    // Check permission rules from settings
    const decision = checkPermission(input.tool_name, input.tool_input, input.cwd);

    if (decision === 'allow') {
      // Auto-allow based on settings or default allowed tools
      output(createHookOutput('allow'));
      return;
    }

    if (decision === 'deny') {
      // Auto-deny based on settings
      output(createHookOutput('deny', 'Denied by permission rules'));
      return;
    }

    // Ask: Request approval via Discord
    await requestApproval(input);
  } catch (error) {
    fallbackToAsk(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main();

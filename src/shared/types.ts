// Claude Code Hook Input Types
export interface HookInput {
  session_id: string;
  transcript_path?: string;
  cwd: string;
  permission_mode: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';
  hook_event_name: 'PermissionRequest' | 'PreToolUse' | 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
}

// Claude Code Hook Output Types
export type PermissionDecision = 'allow' | 'deny' | 'ask';

// PermissionRequest output format
export interface HookOutput {
  hookSpecificOutput?: {
    hookEventName: 'PermissionRequest';
    decision: {
      behavior: PermissionDecision;
      updatedInput?: Record<string, unknown>;
      message?: string;
    };
  };
}

// WebSocket Message Types
export interface ApprovalRequest {
  type: 'approval_request';
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  cwd: string;
  sessionId: string;
  timestamp: number;
}

export interface ApprovalResponse {
  type: 'approval_response';
  requestId: string;
  decision: PermissionDecision;
  message?: string;
}

export type WebSocketMessage = ApprovalRequest | ApprovalResponse;

// Type Guards
export function isHookInput(obj: unknown): obj is HookInput {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.session_id === 'string' &&
    typeof o.cwd === 'string' &&
    typeof o.hook_event_name === 'string' &&
    typeof o.tool_name === 'string' &&
    typeof o.tool_input === 'object'
  );
}

export function isApprovalRequest(msg: unknown): msg is ApprovalRequest {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === 'approval_request' && typeof m.requestId === 'string';
}

export function isApprovalResponse(msg: unknown): msg is ApprovalResponse {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'approval_response' &&
    typeof m.requestId === 'string' &&
    (m.decision === 'allow' || m.decision === 'deny' || m.decision === 'ask')
  );
}

// Utility Functions
export function createHookOutput(decision: PermissionDecision, reason?: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: decision,
        ...(reason && { message: reason }),
      },
    },
  };
}

export function formatToolDescription(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return `Bash: \`${toolInput.command || '(empty)'}\``;
    case 'Edit':
    case 'Write':
    case 'Read':
      return `${toolName}: \`${toolInput.file_path || '(unknown)'}\``;
    case 'WebFetch':
      return `WebFetch: \`${toolInput.url || '(unknown)'}\``;
    case 'Task':
      return `Task: ${toolInput.description || '(no description)'}`;
    default:
      return `${toolName}: ${JSON.stringify(toolInput).slice(0, 100)}`;
  }
}

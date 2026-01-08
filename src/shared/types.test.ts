import { describe, it, expect } from 'vitest';
import {
  isHookInput,
  isApprovalRequest,
  isApprovalResponse,
  createHookOutput,
  formatToolDescription,
} from './types.js';

describe('isHookInput', () => {
  it('should return true for valid hook input', () => {
    const input = {
      session_id: 'abc123',
      cwd: '/home/user',
      permission_mode: 'default',
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    };
    expect(isHookInput(input)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isHookInput(null)).toBe(false);
  });

  it('should return false for missing required fields', () => {
    expect(isHookInput({ session_id: 'abc' })).toBe(false);
    expect(isHookInput({ session_id: 'abc', cwd: '/home' })).toBe(false);
  });

  it('should return false for invalid types', () => {
    expect(isHookInput({ session_id: 123, cwd: '/home', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: {} })).toBe(false);
  });
});

describe('isApprovalRequest', () => {
  it('should return true for valid approval request', () => {
    const request = {
      type: 'approval_request',
      requestId: 'uuid-123',
      toolName: 'Bash',
      toolInput: { command: 'ls' },
      cwd: '/home',
      sessionId: 'session-123',
      timestamp: Date.now(),
    };
    expect(isApprovalRequest(request)).toBe(true);
  });

  it('should return false for invalid type', () => {
    expect(isApprovalRequest({ type: 'other', requestId: 'uuid-123' })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isApprovalRequest(null)).toBe(false);
  });
});

describe('isApprovalResponse', () => {
  it('should return true for valid approval response with allow', () => {
    expect(isApprovalResponse({
      type: 'approval_response',
      requestId: 'uuid-123',
      decision: 'allow',
    })).toBe(true);
  });

  it('should return true for valid approval response with deny', () => {
    expect(isApprovalResponse({
      type: 'approval_response',
      requestId: 'uuid-123',
      decision: 'deny',
    })).toBe(true);
  });

  it('should return true for valid approval response with ask', () => {
    expect(isApprovalResponse({
      type: 'approval_response',
      requestId: 'uuid-123',
      decision: 'ask',
    })).toBe(true);
  });

  it('should return false for invalid decision', () => {
    expect(isApprovalResponse({
      type: 'approval_response',
      requestId: 'uuid-123',
      decision: 'invalid',
    })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isApprovalResponse(null)).toBe(false);
  });
});

describe('createHookOutput', () => {
  it('should create output with allow decision', () => {
    const output = createHookOutput('allow');
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
        },
      },
    });
  });

  it('should create output with deny decision and message', () => {
    const output = createHookOutput('deny', 'Not allowed');
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
          message: 'Not allowed',
        },
      },
    });
  });

  it('should create output with ask decision', () => {
    const output = createHookOutput('ask');
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'ask',
        },
      },
    });
  });
});

describe('formatToolDescription', () => {
  it('should format Bash command', () => {
    expect(formatToolDescription('Bash', { command: 'npm install' }))
      .toBe('Bash: `npm install`');
  });

  it('should format empty Bash command', () => {
    expect(formatToolDescription('Bash', {}))
      .toBe('Bash: `(empty)`');
  });

  it('should format Edit with file path', () => {
    expect(formatToolDescription('Edit', { file_path: '/home/user/file.ts' }))
      .toBe('Edit: `/home/user/file.ts`');
  });

  it('should format Write with file path', () => {
    expect(formatToolDescription('Write', { file_path: '/home/user/new.ts' }))
      .toBe('Write: `/home/user/new.ts`');
  });

  it('should format Read with file path', () => {
    expect(formatToolDescription('Read', { file_path: '/home/user/read.ts' }))
      .toBe('Read: `/home/user/read.ts`');
  });

  it('should format WebFetch with url', () => {
    expect(formatToolDescription('WebFetch', { url: 'https://example.com' }))
      .toBe('WebFetch: `https://example.com`');
  });

  it('should format Task with description', () => {
    expect(formatToolDescription('Task', { description: 'Run tests' }))
      .toBe('Task: Run tests');
  });

  it('should format unknown tool with JSON', () => {
    expect(formatToolDescription('Unknown', { foo: 'bar' }))
      .toBe('Unknown: {"foo":"bar"}');
  });

  it('should truncate long JSON', () => {
    const longInput = { data: 'x'.repeat(200) };
    const result = formatToolDescription('Unknown', longInput);
    expect(result.length).toBeLessThanOrEqual(100 + 'Unknown: '.length);
  });
});

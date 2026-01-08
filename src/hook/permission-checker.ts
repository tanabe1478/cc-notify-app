import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface PermissionRules {
  allow: string[];
  deny: string[];
  ask: string[];
}

interface Settings {
  permissions?: Partial<PermissionRules>;
}

// Load settings from a file
function loadSettings(filePath: string): Settings | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Merge permission rules (later rules override earlier ones)
function mergePermissions(...settingsList: (Settings | null)[]): PermissionRules {
  const merged: PermissionRules = {
    allow: [],
    deny: [],
    ask: [],
  };

  for (const settings of settingsList) {
    if (settings?.permissions) {
      if (settings.permissions.allow) {
        merged.allow = [...merged.allow, ...settings.permissions.allow];
      }
      if (settings.permissions.deny) {
        merged.deny = [...merged.deny, ...settings.permissions.deny];
      }
      if (settings.permissions.ask) {
        merged.ask = [...merged.ask, ...settings.permissions.ask];
      }
    }
  }

  return merged;
}

// Parse a permission rule like "Bash(rm:*)" or "Read(./.env)"
function parseRule(rule: string): { tool: string; pattern: string } | null {
  const match = rule.match(/^(\w+)\((.+)\)$/);
  if (!match) {
    // Simple tool name like "WebSearch"
    return { tool: rule, pattern: '*' };
  }
  return { tool: match[1], pattern: match[2] };
}

// Check if a tool input matches a pattern
function matchesPattern(toolName: string, toolInput: Record<string, unknown>, pattern: string): boolean {
  // Wildcard matches everything
  if (pattern === '*') {
    return true;
  }

  switch (toolName) {
    case 'Bash': {
      const command = String(toolInput.command || '');
      // Pattern format: "command:*" or "command:args"
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -2);
        return command.startsWith(prefix);
      }
      return command === pattern;
    }

    case 'Read':
    case 'Write':
    case 'Edit': {
      const filePath = String(toolInput.file_path || '');
      // Pattern format: path with possible wildcards
      if (pattern.includes('**')) {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/(?<!\*)\*(?!\*)/g, '[^/]*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
      }
      if (pattern.endsWith('*')) {
        return filePath.startsWith(pattern.slice(0, -1));
      }
      return filePath === pattern;
    }

    case 'WebFetch': {
      const url = String(toolInput.url || '');
      // Pattern format: "domain:example.com"
      if (pattern.startsWith('domain:')) {
        const domain = pattern.slice(7);
        try {
          const urlObj = new URL(url);
          return urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`);
        } catch {
          return false;
        }
      }
      return url === pattern;
    }

    default:
      return false;
  }
}

// Check if a tool call matches any rule in the list
function matchesAnyRule(
  toolName: string,
  toolInput: Record<string, unknown>,
  rules: string[]
): boolean {
  for (const rule of rules) {
    const parsed = parseRule(rule);
    if (!parsed) continue;

    if (parsed.tool === toolName) {
      if (matchesPattern(toolName, toolInput, parsed.pattern)) {
        return true;
      }
    }
  }
  return false;
}

export type PermissionDecisionType = 'allow' | 'deny' | 'ask';

// Tools that are allowed by default (read-only or safe operations)
const DEFAULT_ALLOWED_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'Task',
  'WebSearch',
  'TodoRead',
  'TodoWrite',
  'AskUserQuestion',
]);

// Check if a file path is within the project directory
function isWithinProject(filePath: string, cwd: string): boolean {
  const normalizedFile = filePath.startsWith('/') ? filePath : join(cwd, filePath);
  return normalizedFile.startsWith(cwd + '/') || normalizedFile === cwd;
}

// Check if Edit/Write should be auto-allowed (within project)
function shouldAutoAllowFileOperation(
  toolName: string,
  toolInput: Record<string, unknown>,
  cwd: string
): boolean {
  if (toolName !== 'Edit' && toolName !== 'Write') {
    return false;
  }
  const filePath = String(toolInput.file_path || '');
  if (!filePath) {
    return false;
  }
  return isWithinProject(filePath, cwd);
}

// Check permissions for a tool call
export function checkPermission(
  toolName: string,
  toolInput: Record<string, unknown>,
  cwd: string
): PermissionDecisionType {
  // Load settings files in order of precedence
  const homeDir = homedir();
  const globalSettings = loadSettings(join(homeDir, '.claude', 'settings.json'));
  const globalLocalSettings = loadSettings(join(homeDir, '.claude', 'settings.local.json'));
  const projectSettings = loadSettings(join(cwd, '.claude', 'settings.json'));
  const projectLocalSettings = loadSettings(join(cwd, '.claude', 'settings.local.json'));

  // Merge all permissions
  const permissions = mergePermissions(
    globalSettings,
    globalLocalSettings,
    projectSettings,
    projectLocalSettings
  );

  // Check deny first (highest priority)
  if (matchesAnyRule(toolName, toolInput, permissions.deny)) {
    return 'deny';
  }

  // Check allow
  if (matchesAnyRule(toolName, toolInput, permissions.allow)) {
    return 'allow';
  }

  // Check ask
  if (matchesAnyRule(toolName, toolInput, permissions.ask)) {
    return 'ask';
  }

  // Check if tool is allowed by default
  if (DEFAULT_ALLOWED_TOOLS.has(toolName)) {
    return 'allow';
  }

  // Auto-allow Edit/Write for files within project
  if (shouldAutoAllowFileOperation(toolName, toolInput, cwd)) {
    return 'allow';
  }

  // Default: ask for permission (Bash, Edit/Write outside project, etc.)
  return 'ask';
}

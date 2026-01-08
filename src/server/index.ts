import 'dotenv/config';
import { ApprovalWebSocketServer } from './websocket.js';
import { DiscordBot } from './discord.js';
import type { ApprovalRequest } from '../shared/types.js';

// Load environment variables
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

const DISCORD_BOT_TOKEN = getRequiredEnv('DISCORD_BOT_TOKEN');
const DISCORD_CHANNEL_ID = getRequiredEnv('DISCORD_CHANNEL_ID');
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '3847', 10);

async function main(): Promise<void> {
  console.log('Starting Claude Code Discord Approval Server...');

  // Initialize WebSocket server
  const wsServer = new ApprovalWebSocketServer(WEBSOCKET_PORT);

  // Initialize Discord bot
  const discordBot = new DiscordBot(DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID);

  // Connect WebSocket events to Discord
  wsServer.on('approvalRequest', async (request: ApprovalRequest) => {
    try {
      await discordBot.sendApprovalRequest(request);
    } catch (error) {
      console.error('[Server] Failed to send Discord message:', error);
      // Fallback to 'ask' if Discord fails
      wsServer.respondToRequest(request.requestId, 'ask', 'Failed to send Discord notification');
    }
  });

  // Connect Discord approval callbacks to WebSocket responses
  discordBot.setApprovalCallback((requestId, decision, message) => {
    const success = wsServer.respondToRequest(requestId, decision, message);
    if (!success) {
      console.warn(`[Server] Could not respond to request ${requestId} - client may have disconnected`);
    }
  });

  // Start servers
  try {
    await wsServer.start();
    await discordBot.start();
    console.log('\n===========================================');
    console.log('Claude Code Discord Approval Server');
    console.log('===========================================');
    console.log(`WebSocket: ws://localhost:${WEBSOCKET_PORT}`);
    console.log(`Discord:   Connected`);
    console.log('===========================================\n');
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\nShutting down...');
    wsServer.stop();
    await discordBot.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Server] Unhandled error:', error);
  process.exit(1);
});

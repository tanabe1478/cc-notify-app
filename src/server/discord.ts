import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { ApprovalRequest, PermissionDecision } from '../shared/types.js';

type ApprovalCallback = (
  requestId: string,
  decision: PermissionDecision,
  options?: { updatedInput?: Record<string, unknown>; message?: string }
) => void;

// Escape backticks in content to prevent breaking Discord code blocks
function escapeCodeBlock(content: string): string {
  // Replace ``` with zero-width space between backticks to break the sequence
  return content.replace(/```/g, '`\u200B`\u200B`');
}

export class DiscordBot {
  private client: Client;
  private channel: TextChannel | null = null;
  private onApproval: ApprovalCallback | null = null;

  // Map to track which messages correspond to which requests
  private messageToRequest: Map<string, string> = new Map();
  // Store original request data for Edit modal
  private requestData: Map<string, { toolName: string; toolInput: Record<string, unknown> }> = new Map();

  constructor(
    private token: string,
    private channelId: string
  ) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      console.log(`[Discord] Bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      }
    });

    this.client.on('error', (error) => {
      console.error('[Discord] Client error:', error);
    });
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const [action, requestId] = interaction.customId.split(':');
    if (!requestId || requestId === 'disabled') return;

    console.log(`[Discord] Button clicked: ${action} for request ${requestId}`);

    if (action === 'approve') {
      await this.processDecision(interaction, requestId, 'allow', 'Approved');
    } else if (action === 'edit') {
      // Show modal to edit input
      const data = this.requestData.get(requestId);
      if (!data) {
        await interaction.reply({ content: 'Request data not found', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`edit_modal:${requestId}`)
        .setTitle('Edit & Approve');

      // Get the editable value based on tool type
      let currentValue = '';
      let label = 'Input';
      if (data.toolName === 'Bash') {
        currentValue = String(data.toolInput.command || '');
        label = 'Command';
      } else if (data.toolName === 'Edit' || data.toolName === 'Write' || data.toolName === 'Read') {
        currentValue = String(data.toolInput.file_path || '');
        label = 'File Path';
      } else if (data.toolName === 'WebFetch') {
        currentValue = String(data.toolInput.url || '');
        label = 'URL';
      } else {
        currentValue = JSON.stringify(data.toolInput, null, 2);
        label = 'Input (JSON)';
      }

      // Truncate if too long for modal (max 4000 chars)
      if (currentValue.length > 4000) {
        currentValue = currentValue.slice(0, 4000);
      }

      const inputField = new TextInputBuilder()
        .setCustomId('edited_input')
        .setLabel(label)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(currentValue)
        .setMaxLength(4000);

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(inputField);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } else if (action === 'deny') {
      // Deny directly without modal
      await this.processDecision(interaction, requestId, 'deny', 'Denied');
    }
  }

  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const [action, requestId] = interaction.customId.split(':');
    if (action !== 'edit_modal' || !requestId) return;

    const editedInput = interaction.fields.getTextInputValue('edited_input');
    const data = this.requestData.get(requestId);

    if (!data) {
      await interaction.reply({ content: 'Request data not found', ephemeral: true });
      return;
    }

    console.log(`[Discord] Edit modal submitted for ${requestId}`);

    // Build updatedInput based on tool type
    let updatedInput: Record<string, unknown>;
    if (data.toolName === 'Bash') {
      updatedInput = { ...data.toolInput, command: editedInput };
    } else if (data.toolName === 'Edit' || data.toolName === 'Write' || data.toolName === 'Read') {
      updatedInput = { ...data.toolInput, file_path: editedInput };
    } else if (data.toolName === 'WebFetch') {
      updatedInput = { ...data.toolInput, url: editedInput };
    } else {
      // Try to parse as JSON, fall back to original
      try {
        updatedInput = JSON.parse(editedInput);
      } catch {
        updatedInput = data.toolInput;
      }
    }

    await this.processDecision(interaction, requestId, 'allow', 'Edited & Approved', { updatedInput });
  }

  private async processDecision(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    requestId: string,
    decision: PermissionDecision,
    buttonText: string,
    options?: { updatedInput?: Record<string, unknown>; message?: string }
  ): Promise<void> {
    // Update the message to show the decision
    try {
      const originalMessage = interaction.isModalSubmit()
        ? interaction.message
        : interaction.message;

      if (!originalMessage) {
        throw new Error('No message found');
      }

      const embed = EmbedBuilder.from(originalMessage.embeds[0]);
      embed.setColor(decision === 'allow' ? 0x00ff00 : 0xff0000);

      const footerText = `${buttonText} by ${interaction.user.tag}`;
      embed.setFooter({ text: footerText });

      // Disable all buttons
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('approve:disabled')
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('edit:disabled')
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('deny:disabled')
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
      );

      if (interaction.isModalSubmit()) {
        await interaction.deferUpdate();
        await originalMessage.edit({
          embeds: [embed],
          components: [disabledRow],
        });
      } else {
        await interaction.update({
          embeds: [embed],
          components: [disabledRow],
        });
      }
    } catch (error) {
      console.error('[Discord] Failed to update message:', error);
      await interaction.reply({ content: `${buttonText}!`, ephemeral: true }).catch(() => {});
    }

    // Clean up stored request data
    this.requestData.delete(requestId);

    // Notify the callback
    if (this.onApproval) {
      this.onApproval(requestId, decision, options);
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.token);

    // Wait for the client to be ready
    if (!this.client.isReady()) {
      await new Promise<void>((resolve) => {
        this.client.once('ready', () => resolve());
      });
    }

    // Get the channel
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel ${this.channelId} not found or is not a text channel`);
    }
    this.channel = channel;
    console.log(`[Discord] Connected to channel: #${channel.name}`);
  }

  setApprovalCallback(callback: ApprovalCallback): void {
    this.onApproval = callback;
  }

  async sendApprovalRequest(request: ApprovalRequest): Promise<void> {
    if (!this.channel) {
      throw new Error('Discord bot not connected to a channel');
    }

    const embed = new EmbedBuilder()
      .setTitle('Permission Request')
      .setColor(0x0099ff)
      .addFields({ name: 'Tool', value: `\`${request.toolName}\``, inline: false });

    // Add tool-specific details
    const toolInput = request.toolInput;
    // Discord field value limit is 1024 chars, code block syntax uses ~8 chars
    const codeBlockMaxLen = 900;

    switch (request.toolName) {
      case 'Bash': {
        const command = String(toolInput.command || '(empty)');
        const truncated = command.length > codeBlockMaxLen ? command.slice(0, codeBlockMaxLen) + '...(truncated)' : command;
        embed.addFields({ name: 'Command', value: `\`\`\`\n${escapeCodeBlock(truncated)}\n\`\`\``, inline: false });
        break;
      }
      case 'Edit': {
        const filePath = String(toolInput.file_path || '(unknown)');
        embed.addFields({ name: 'File', value: `\`${filePath}\``, inline: false });

        // Show diff
        const oldStr = String(toolInput.old_string || '');
        const newStr = String(toolInput.new_string || '');
        const diffMaxLen = 400;

        if (oldStr || newStr) {
          // Create diff-like display
          const oldLines = oldStr.split('\n').map(line => `- ${line}`).join('\n');
          const newLines = newStr.split('\n').map(line => `+ ${line}`).join('\n');

          const oldTruncated = oldLines.length > diffMaxLen
            ? oldLines.slice(0, diffMaxLen) + '\n...(truncated)'
            : oldLines;
          const newTruncated = newLines.length > diffMaxLen
            ? newLines.slice(0, diffMaxLen) + '\n...(truncated)'
            : newLines;

          const diff = `\`\`\`diff\n${escapeCodeBlock(oldTruncated)}\n${escapeCodeBlock(newTruncated)}\n\`\`\``;
          embed.addFields({ name: 'Changes', value: diff, inline: false });
        }
        break;
      }
      case 'Write': {
        const filePath = String(toolInput.file_path || '(unknown)');
        embed.addFields({ name: 'File', value: `\`${filePath}\``, inline: false });

        // Show content preview for Write
        const content = String(toolInput.content || '');
        if (content) {
          const preview = content.length > codeBlockMaxLen ? content.slice(0, codeBlockMaxLen) + '...(truncated)' : content;
          embed.addFields({ name: 'Content', value: `\`\`\`\n${escapeCodeBlock(preview)}\n\`\`\``, inline: false });
        }
        break;
      }
      case 'Read': {
        const filePath = String(toolInput.file_path || '(unknown)');
        embed.addFields({ name: 'File', value: `\`${filePath}\``, inline: false });
        break;
      }
      case 'WebFetch': {
        const url = String(toolInput.url || '(unknown)');
        embed.addFields({ name: 'URL', value: `\`${url}\``, inline: false });
        break;
      }
      case 'Task': {
        const description = String(toolInput.description || '(no description)');
        embed.addFields({ name: 'Description', value: description, inline: false });
        break;
      }
      case 'Grep': {
        const pattern = String(toolInput.pattern || '(unknown)');
        const path = toolInput.path ? String(toolInput.path) : '(cwd)';
        embed.addFields(
          { name: 'Pattern', value: `\`${pattern}\``, inline: true },
          { name: 'Path', value: `\`${path}\``, inline: true }
        );
        break;
      }
      case 'Glob': {
        const pattern = String(toolInput.pattern || '(unknown)');
        const path = toolInput.path ? String(toolInput.path) : '(cwd)';
        embed.addFields(
          { name: 'Pattern', value: `\`${pattern}\``, inline: true },
          { name: 'Path', value: `\`${path}\``, inline: true }
        );
        break;
      }
      default: {
        const jsonStr = JSON.stringify(toolInput);
        const truncated = jsonStr.length > codeBlockMaxLen ? jsonStr.slice(0, codeBlockMaxLen) + '...(truncated)' : jsonStr;
        embed.addFields({ name: 'Input', value: `\`\`\`json\n${escapeCodeBlock(truncated)}\n\`\`\``, inline: false });
      }
    }

    embed.addFields(
      { name: 'Working Directory', value: `\`${request.cwd}\``, inline: true },
      { name: 'Session', value: request.sessionId.slice(0, 8), inline: true }
    );

    embed.setTimestamp(request.timestamp);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve:${request.requestId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`edit:${request.requestId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`deny:${request.requestId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );

    // Store request data for Edit modal
    this.requestData.set(request.requestId, {
      toolName: request.toolName,
      toolInput: request.toolInput,
    });

    const message = await this.channel.send({
      embeds: [embed],
      components: [row],
    });

    this.messageToRequest.set(message.id, request.requestId);
    console.log(`[Discord] Sent approval request: ${request.requestId}`);
  }

  async stop(): Promise<void> {
    this.client.destroy();
    console.log('[Discord] Bot disconnected');
  }
}

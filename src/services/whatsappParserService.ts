/**
 * WhatsApp Chat Parser Service
 *
 * Converts WhatsApp chat exports into clean training data format
 * Handles timestamps, system messages, and multi-line conversations
 */

export interface ParsedConversation {
  userMessage: string;
  assistantMessage: string;
  rawLines: string[];
}

export interface WhatsAppParseResult {
  conversations: ParsedConversation[];
  stats: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    audioMessages: number;
    conversationPairs: number;
  };
  warnings: string[];
  assistantName: string;
}

export class WhatsAppParserService {

  /**
   * Parse WhatsApp chat export text into training-ready conversations
   */
  static parseWhatsAppExport(
    text: string,
    assistantName?: string
  ): WhatsAppParseResult {
    const lines = text.split('\n').filter(line => line.trim());

    // Auto-detect assistant name if not provided
    const detectedAssistant = assistantName || this.detectAssistantName(lines);

    const messages: Array<{
      timestamp: string;
      sender: string;
      message: string;
      isSystem: boolean;
    }> = [];

    const stats = {
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      systemMessages: 0,
      audioMessages: 0,
      conversationPairs: 0
    };

    const warnings: string[] = [];

    // Parse each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) continue;

      // Check for system messages
      if (this.isSystemMessage(line)) {
        stats.systemMessages++;
        continue;
      }

      // Check for audio/media messages
      if (this.isMediaMessage(line)) {
        stats.audioMessages++;
        continue;
      }

      // Parse message line
      const parsed = this.parseMessageLine(line);
      if (parsed) {
        messages.push(parsed);
        stats.totalMessages++;

        if (parsed.sender === detectedAssistant) {
          stats.assistantMessages++;
        } else if (!parsed.isSystem) {
          stats.userMessages++;
        }
      }
    }

    // Group messages by sender to handle multi-line responses
    const groupedMessages = this.groupConsecutiveMessages(messages);

    // Create conversation pairs (User -> Assistant)
    const conversations = this.createConversationPairs(
      groupedMessages,
      detectedAssistant
    );

    stats.conversationPairs = conversations.length;

    // Generate warnings
    if (stats.conversationPairs === 0) {
      warnings.push('No conversation pairs found. Make sure the chat contains both user and assistant messages.');
    }
    if (stats.conversationPairs < 5) {
      warnings.push(`Only ${stats.conversationPairs} conversation pairs found. For best results, aim for at least 10-20 pairs.`);
    }
    if (stats.systemMessages > 10) {
      warnings.push(`${stats.systemMessages} system messages were filtered out.`);
    }
    if (stats.audioMessages > 0) {
      warnings.push(`${stats.audioMessages} audio/media messages were skipped.`);
    }

    return {
      conversations,
      stats,
      warnings,
      assistantName: detectedAssistant
    };
  }

  /**
   * Detect assistant name from chat history
   */
  private static detectAssistantName(lines: string[]): string {
    const senderCounts: Record<string, number> = {};

    for (const line of lines) {
      const parsed = this.parseMessageLine(line);
      if (parsed && !parsed.isSystem) {
        senderCounts[parsed.sender] = (senderCounts[parsed.sender] || 0) + 1;
      }
    }

    // Find the sender with most messages (likely the assistant)
    let maxCount = 0;
    let detectedName = 'Assistant';

    for (const [sender, count] of Object.entries(senderCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedName = sender;
      }
    }

    return detectedName;
  }

  /**
   * Check if line is a system message
   */
  private static isSystemMessage(line: string): boolean {
    const systemPatterns = [
      /Messages and calls are end-to-end encrypted/i,
      /joined using this group's invite link/i,
      /left/i,
      /was added/i,
      /changed the subject/i,
      /changed this group's icon/i,
      /created group/i,
      /You're now an admin/i,
      /security code changed/i,
      /‎.*?changed their phone number/i
    ];

    return systemPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line is a media message (audio, image, video, etc.)
   */
  private static isMediaMessage(line: string): boolean {
    const mediaPatterns = [
      /‎audio omitted/i,
      /‎video omitted/i,
      /‎image omitted/i,
      /‎sticker omitted/i,
      /‎GIF omitted/i,
      /‎document omitted/i,
      /‎Contact card omitted/i,
      /‎<Media omitted>/i
    ];

    return mediaPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Parse a single message line
   * Format: [DD/MM/YYYY, HH:MM:SS] Sender: Message
   */
  private static parseMessageLine(line: string): {
    timestamp: string;
    sender: string;
    message: string;
    isSystem: boolean;
  } | null {
    // WhatsApp format: [DD/MM/YYYY, HH:MM:SS] Sender: Message
    // Also supports: [DD/MM/YYYY, HH:MM] Sender: Message
    const whatsappPattern = /^\[([^\]]+)\]\s+([^:]+):\s*(.+)$/;
    const match = line.match(whatsappPattern);

    if (!match) {
      return null;
    }

    const [, timestamp, sender, message] = match;

    return {
      timestamp: timestamp.trim(),
      sender: sender.trim(),
      message: message.trim(),
      isSystem: false
    };
  }

  /**
   * Group consecutive messages from the same sender
   */
  private static groupConsecutiveMessages(
    messages: Array<{ timestamp: string; sender: string; message: string; isSystem: boolean }>
  ): Array<{ sender: string; message: string; timestamp: string }> {
    const grouped: Array<{ sender: string; message: string; timestamp: string }> = [];

    for (const msg of messages) {
      const lastGroup = grouped[grouped.length - 1];

      if (lastGroup && lastGroup.sender === msg.sender) {
        // Append to last message with line break
        lastGroup.message += ' ' + msg.message;
      } else {
        // New group
        grouped.push({
          sender: msg.sender,
          message: msg.message,
          timestamp: msg.timestamp
        });
      }
    }

    return grouped;
  }

  /**
   * Create User-Assistant conversation pairs
   */
  private static createConversationPairs(
    messages: Array<{ sender: string; message: string; timestamp: string }>,
    assistantName: string
  ): ParsedConversation[] {
    const conversations: ParsedConversation[] = [];

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];

      // Look for User -> Assistant pattern
      if (current.sender !== assistantName && next.sender === assistantName) {
        conversations.push({
          userMessage: current.message,
          assistantMessage: next.message,
          rawLines: [
            `[${current.timestamp}] ${current.sender}: ${current.message}`,
            `[${next.timestamp}] ${next.sender}: ${next.message}`
          ]
        });
      }
    }

    return conversations;
  }

  /**
   * Convert parsed conversations to training format
   */
  static convertToTrainingFormat(
    conversations: ParsedConversation[]
  ): string {
    return conversations.map(conv =>
      `User: ${conv.userMessage}\nAssistant: ${conv.assistantMessage}`
    ).join('\n\n');
  }

  /**
   * Validate WhatsApp export format
   */
  static isValidWhatsAppExport(text: string): boolean {
    const lines = text.split('\n').filter(line => line.trim());

    // Check if at least 10% of lines match WhatsApp format
    let validLines = 0;
    const sampleSize = Math.min(50, lines.length);

    for (let i = 0; i < sampleSize; i++) {
      if (this.parseMessageLine(lines[i])) {
        validLines++;
      }
    }

    return (validLines / sampleSize) > 0.1; // At least 10% valid
  }

  /**
   * Get quality score for parsed data
   */
  static getQualityScore(result: WhatsAppParseResult): {
    score: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 100;

    // Check conversation count
    if (result.conversations.length < 5) {
      score -= 40;
      feedback.push('Too few conversation pairs. Aim for at least 10-20 pairs.');
    } else if (result.conversations.length < 10) {
      score -= 20;
      feedback.push('Good start! More examples will improve training quality.');
    } else if (result.conversations.length >= 20) {
      feedback.push('Excellent! You have plenty of training examples.');
    }

    // Check message balance
    const balance = result.stats.userMessages / result.stats.assistantMessages;
    if (balance < 0.5 || balance > 2) {
      score -= 15;
      feedback.push('Unbalanced conversation. User and assistant message counts should be similar.');
    }

    // Check for diversity (message length variance)
    const avgLength = result.conversations.reduce((sum, c) =>
      sum + c.userMessage.length + c.assistantMessage.length, 0
    ) / (result.conversations.length * 2);

    if (avgLength < 20) {
      score -= 10;
      feedback.push('Messages are very short. Longer, more detailed conversations work better.');
    }

    // Determine rating
    let rating: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 80) rating = 'excellent';
    else if (score >= 60) rating = 'good';
    else if (score >= 40) rating = 'fair';
    else rating = 'poor';

    return { score: Math.max(0, score), rating, feedback };
  }
}

export interface Report {
  date: string;
  content: string;
  path: string;
  exists: boolean;
}

export interface ReportEntry {
  date: string;
  preview: string;
  path: string;
}

export interface SendResult {
  success: boolean;
  message_id: string | null;
  error: string | null;
}

export interface DiscordConfig {
  channel_id: string;
  has_token: boolean;
}

export interface ScheduleConfig {
  enabled: boolean;
  days: number[];
  time: string;
  auto_send: boolean;
}

export interface OpenAiConfig {
  model: string;
}

export interface DiscordReadConfig {
  enabled: boolean;
  process_all: boolean;
  channel_id: string | null;
}

export interface CliConnectorConfig {
  enabled: boolean;
  username: string | null;
  hostname: string | null;
}

export interface McpConnectorConfig {
  enabled: boolean;
  mcp_url: string;
  username: string | null;
  instance_url: string | null;
  email: string | null;
}

export interface ConnectorsConfig {
  discord_read: DiscordReadConfig;
  gitlab: CliConnectorConfig;
  jira: McpConnectorConfig;
  confluence: McpConnectorConfig;
  github: CliConnectorConfig;
}

export interface AppConfig {
  vault_path: string;
  channel_id: string;
  schedule: ScheduleConfig;
  openai: OpenAiConfig;
  connectors: ConnectorsConfig;
}

export interface PlatformSummary {
  platform: string;
  summary: string;
  tokens: number;
  cost: number;
}

export interface DigestResult {
  platform_summaries: PlatformSummary[];
  suggestions: string | null;
  total_tokens: number;
  total_cost: number;
}

export interface ConnectorsStatus {
  openai: boolean;
  discord: boolean;
  gitlab: boolean;
  jira: boolean;
  confluence: boolean;
  github: boolean;
}

export interface DetectedMcpServer {
  name: string;
  transport: "stdio" | "http";
  source: string;
  url: string | null;
  command: string | null;
  args: string[] | null;
}

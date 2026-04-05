import { invoke } from "@tauri-apps/api/core";
import type {
  Report,
  ReportEntry,
  SendResult,
  DiscordConfig,
  AppConfig,
  DigestResult,
  ConnectorsStatus,
  DetectedMcpServer,
} from "./types";

export const getTodayReport = () => invoke<Report>("get_today_report");

export const getReport = (date: string) =>
  invoke<Report>("get_report", { date });

export const saveReport = (date: string, content: string) =>
  invoke<void>("save_report", { date, content });

export const listReports = (year: number, month: number) =>
  invoke<ReportEntry[]>("list_reports", { year, month });

export const sendToDiscord = (date: string) =>
  invoke<SendResult>("send_to_discord", { date });

export const getDiscordConfig = () =>
  invoke<DiscordConfig>("get_discord_config");

export const saveDiscordToken = (token: string) =>
  invoke<void>("save_discord_token", { token });

export const getConfig = () => invoke<AppConfig>("get_config");

export const saveConfig = (configData: AppConfig) =>
  invoke<void>("save_config", { configData });

export const installLaunchAgent = () =>
  invoke<void>("install_launch_agent");

export const uninstallLaunchAgent = () =>
  invoke<void>("uninstall_launch_agent");

export const getLaunchAgentStatus = () =>
  invoke<boolean>("get_launch_agent_status");

// Digest
export const generateDigest = (date?: string) =>
  invoke<DigestResult>("generate_digest", { date: date ?? null });

export const applyDigestToReport = (
  date: string,
  yesterdayContent: string,
  todaySuggestions?: string,
) =>
  invoke<void>("apply_digest_to_report", {
    date,
    yesterdayContent,
    todaySuggestions: todaySuggestions ?? null,
  });

export const saveOpenaiKey = (key: string) =>
  invoke<void>("save_openai_key", { key });

export const saveConnectorToken = (connector: string, token: string) =>
  invoke<void>("save_connector_token", { connector, token });

export const getConnectorsStatus = () =>
  invoke<ConnectorsStatus>("get_connectors_status");

export const detectClaudeMcpServers = () =>
  invoke<DetectedMcpServer[]>("detect_claude_mcp_servers");

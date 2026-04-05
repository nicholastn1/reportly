import { useEffect, useState } from "react";
import {
  getConfig,
  saveConfig,
  getDiscordConfig,
  saveDiscordToken,
  installLaunchAgent,
  uninstallLaunchAgent,
  getLaunchAgentStatus,
  saveOpenaiKey,
  saveConnectorToken,
  getConnectorsStatus,
  detectClaudeMcpServers,
} from "../lib/tauri";
import type { AppConfig, DiscordConfig, ConnectorsStatus, DetectedMcpServer } from "../lib/types";

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [discord, setDiscord] = useState<DiscordConfig | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectorsStatus | null>(null);
  const [detectedMcp, setDetectedMcp] = useState<DetectedMcpServer[]>([]);
  const [token, setToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [connectorTokens, setConnectorTokens] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [agentInstalled, setAgentInstalled] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig);
    getDiscordConfig().then(setDiscord);
    getLaunchAgentStatus().then(setAgentInstalled);
    getConnectorsStatus().then(setConnStatus);
    detectClaudeMcpServers().then(setDetectedMcp);
  }, []);

  const handleSave = async () => {
    if (!config) return;
    try {
      await saveConfig(config);

      if (token.trim()) {
        await saveDiscordToken(token.trim());
        setToken("");
        setDiscord(await getDiscordConfig());
      }

      if (openaiKey.trim()) {
        await saveOpenaiKey(openaiKey.trim());
        setOpenaiKey("");
      }

      for (const [conn, tok] of Object.entries(connectorTokens)) {
        if (tok.trim()) {
          await saveConnectorToken(conn, tok.trim());
        }
      }
      setConnectorTokens({});

      if (config.schedule.enabled) {
        await installLaunchAgent();
        setAgentInstalled(true);
      } else if (agentInstalled) {
        await uninstallLaunchAgent();
        setAgentInstalled(false);
      }

      setConnStatus(await getConnectorsStatus());
      setToast("Configuracoes salvas!");
    } catch (e) {
      setToast(`Erro: ${e}`);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!config) {
    return <p className="text-[var(--text-secondary)]">Carregando...</p>;
  }

  const toggleDay = (day: number) => {
    const days = config.schedule.days.includes(day)
      ? config.schedule.days.filter((d) => d !== day)
      : [...config.schedule.days, day].sort();
    setConfig({ ...config, schedule: { ...config.schedule, days } });
  };

  const updateConnector = (
    name: "gitlab" | "jira" | "confluence" | "github",
    field: string,
    value: unknown,
  ) => {
    setConfig({
      ...config,
      connectors: {
        ...config.connectors,
        [name]: { ...(config.connectors[name] as unknown as Record<string, unknown>), [field]: value },
      },
    });
  };

  const TokenStatus = ({ has }: { has: boolean }) =>
    has ? (
      <span className="text-green-500 text-xs ml-1">(salvo)</span>
    ) : null;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Vault */}
      <Section title="Obsidian Vault">
        <Field label="Caminho do vault">
          <input
            type="text"
            value={config.vault_path}
            onChange={(e) =>
              setConfig({ ...config, vault_path: e.target.value })
            }
            className="input-field"
          />
        </Field>
      </Section>

      {/* Discord Send */}
      <Section title="Discord (Envio)">
        <Field label="Channel ID">
          <input
            type="text"
            value={config.channel_id}
            onChange={(e) =>
              setConfig({ ...config, channel_id: e.target.value })
            }
            className="input-field"
          />
        </Field>
        <Field
          label={
            <>
              Token <TokenStatus has={discord?.has_token ?? false} />
            </>
          }
        >
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              discord?.has_token ? "••••••• (ja configurado)" : "Cole seu token"
            }
            className="input-field"
          />
        </Field>
      </Section>

      {/* OpenAI */}
      <Section title="OpenAI">
        <Field
          label={
            <>
              API Key <TokenStatus has={connStatus?.openai ?? false} />
            </>
          }
        >
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder={
              connStatus?.openai
                ? "••••••• (ja configurado)"
                : "sk-..."
            }
            className="input-field"
          />
        </Field>
        <Field label="Modelo">
          <select
            value={config.openai.model}
            onChange={(e) =>
              setConfig({
                ...config,
                openai: { ...config.openai, model: e.target.value },
              })
            }
            className="input-field"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Detected MCP Servers from Claude Code */}
      {detectedMcp.length > 0 && (
        <Section title="MCP Servers (Claude Code)">
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Detectados automaticamente de ~/.claude/settings.json e .mcp.json
          </p>
          <div className="space-y-2">
            {detectedMcp.map((server) => {
              const isAtlassian = server.name === "atlassian" || server.name === "mcp-atlassian";
              const connectorMap: Record<string, string> = isAtlassian
                ? { jira: "Jira", confluence: "Confluence" }
                : {};
              return (
                <div
                  key={`${server.name}-${server.source}`}
                  className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{server.name}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        server.transport === "http"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-blue-900/40 text-blue-400"
                      }`}>
                        {server.transport}
                      </span>
                    </div>
                    {Object.keys(connectorMap).length > 0 && (
                      <button
                        onClick={() => {
                          if (isAtlassian && server.url) {
                            setConfig({
                              ...config!,
                              connectors: {
                                ...config!.connectors,
                                jira: { ...config!.connectors.jira, enabled: true, mcp_url: server.url! },
                                confluence: { ...config!.connectors.confluence, enabled: true, mcp_url: server.url! },
                              },
                            });
                            setToast("Jira e Confluence configurados via Atlassian MCP!");
                          }
                        }}
                        className="text-xs px-3 py-1 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        Usar para {Object.values(connectorMap).join(" + ")}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    {server.url || `${server.command} ${(server.args || []).join(" ")}`}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 opacity-60">
                    {server.source === "global" ? "~/.claude/settings.json" : server.source}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Connectors */}
      <Section title="Conectores">
        {/* Discord Read */}
        <ConnectorToggle
          label="💬 Discord (Leitura de DMs)"
          enabled={config.connectors.discord_read.enabled}
          onChange={(v) =>
            setConfig({
              ...config,
              connectors: {
                ...config.connectors,
                discord_read: {
                  ...config.connectors.discord_read,
                  enabled: v,
                },
              },
            })
          }
        >
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={config.connectors.discord_read.process_all}
              onChange={(e) =>
                setConfig({
                  ...config,
                  connectors: {
                    ...config.connectors,
                    discord_read: {
                      ...config.connectors.discord_read,
                      process_all: e.target.checked,
                    },
                  },
                })
              }
              className="accent-[var(--accent)]"
            />
            Processar todos os DMs ativos
          </label>
        </ConnectorToggle>

        {/* GitLab (CLI) */}
        <ConnectorToggle
          label="🦊 GitLab (via glab CLI)"
          enabled={config.connectors.gitlab.enabled}
          onChange={(v) => updateConnector("gitlab", "enabled", v)}
        >
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Usa o <code className="bg-[var(--bg-primary)] px-1 rounded">glab</code> CLI ja autenticado
          </p>
          <Field label="Hostname (se self-hosted)">
            <input
              type="text"
              value={config.connectors.gitlab.hostname ?? ""}
              onChange={(e) => updateConnector("gitlab", "hostname", e.target.value || null)}
              placeholder="gitlab.com"
              className="input-field"
            />
          </Field>
        </ConnectorToggle>

        {/* GitHub (CLI) */}
        <ConnectorToggle
          label="🐙 GitHub (via gh CLI)"
          enabled={config.connectors.github.enabled}
          onChange={(v) => updateConnector("github", "enabled", v)}
        >
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Usa o <code className="bg-[var(--bg-primary)] px-1 rounded">gh</code> CLI ja autenticado
          </p>
          <Field label="Username (auto-detectado se vazio)">
            <input
              type="text"
              value={config.connectors.github.username ?? ""}
              onChange={(e) => updateConnector("github", "username", e.target.value || null)}
              placeholder="auto-detect"
              className="input-field"
            />
          </Field>
        </ConnectorToggle>

        {/* Jira (MCP) */}
        <McpConnectorSection
          icon="📋"
          name="jira"
          label="Jira"
          config={config.connectors.jira}
          hasToken={connStatus?.jira ?? false}
          tokenValue={connectorTokens.jira ?? ""}
          onTokenChange={(v) =>
            setConnectorTokens({ ...connectorTokens, jira: v })
          }
          onUpdate={(f, v) => updateConnector("jira", f, v)}
        />

        {/* Confluence (MCP) */}
        <McpConnectorSection
          icon="📝"
          name="confluence"
          label="Confluence"
          config={config.connectors.confluence}
          hasToken={connStatus?.confluence ?? false}
          tokenValue={connectorTokens.confluence ?? ""}
          onTokenChange={(v) =>
            setConnectorTokens({ ...connectorTokens, confluence: v })
          }
          onUpdate={(f, v) => updateConnector("confluence", f, v)}
        />
      </Section>

      {/* Schedule */}
      <Section title="Agendamento">
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.schedule.enabled}
            onChange={(e) =>
              setConfig({
                ...config,
                schedule: { ...config.schedule, enabled: e.target.checked },
              })
            }
            className="accent-[var(--accent)]"
          />
          <span className="text-sm">Ativar envio agendado</span>
        </label>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          LaunchAgent:{" "}
          <span
            className={
              agentInstalled
                ? "text-green-500"
                : "text-[var(--text-secondary)]"
            }
          >
            {agentInstalled ? "instalado" : "nao instalado"}
          </span>
        </p>

        {config.schedule.enabled && (
          <>
            <div className="flex gap-2 mb-3">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    config.schedule.days.includes(d.value)
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Field label="Horario">
              <input
                type="time"
                value={config.schedule.time}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    schedule: { ...config.schedule, time: e.target.value },
                  })
                }
                className="input-field w-auto"
              />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.schedule.auto_send}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    schedule: {
                      ...config.schedule,
                      auto_send: e.target.checked,
                    },
                  })
                }
                className="accent-[var(--accent)]"
              />
              <span className="text-sm">
                Enviar automaticamente (sem pedir aprovacao)
              </span>
            </label>
          </>
        )}
      </Section>

      <button
        onClick={handleSave}
        className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors mb-8"
      >
        Salvar
      </button>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${
            toast.startsWith("Erro")
              ? "bg-red-900/90 text-red-200"
              : "bg-green-900/90 text-green-200"
          }`}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// --- Helper components ---

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}

function ConnectorToggle({
  label,
  enabled,
  onChange,
  children,
}: {
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
      <label className="flex items-center gap-2 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
      {enabled && <div className="pl-6 space-y-2">{children}</div>}
    </div>
  );
}

function McpConnectorSection({
  icon,
  name,
  label,
  config,
  hasToken,
  tokenValue,
  onTokenChange,
  onUpdate,
  showUsername,
}: {
  icon: string;
  name: string;
  label: string;
  config: { enabled: boolean; mcp_url: string; username: string | null };
  hasToken: boolean;
  tokenValue: string;
  onTokenChange: (v: string) => void;
  onUpdate: (field: string, value: unknown) => void;
  showUsername?: boolean;
}) {
  return (
    <ConnectorToggle
      label={`${icon} ${label}`}
      enabled={config.enabled}
      onChange={(v) => onUpdate("enabled", v)}
    >
      <Field label="MCP Server URL">
        <input
          type="text"
          value={config.mcp_url}
          onChange={(e) => onUpdate("mcp_url", e.target.value)}
          placeholder="http://localhost:3000"
          className="input-field"
        />
      </Field>
      {showUsername && (
        <Field label="Username">
          <input
            type="text"
            value={config.username ?? ""}
            onChange={(e) => onUpdate("username", e.target.value || null)}
            className="input-field"
          />
        </Field>
      )}
      <Field
        label={
          <>
            Token <span className={`text-xs ml-1 ${hasToken ? "text-green-500" : "text-[var(--text-secondary)]"}`}>
              {hasToken ? "(salvo)" : ""}
            </span>
          </>
        }
      >
        <input
          type="password"
          value={tokenValue}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder={hasToken ? "••••••• (ja configurado)" : `Token ${label}`}
          className="input-field"
        />
      </Field>
    </ConnectorToggle>
  );
}

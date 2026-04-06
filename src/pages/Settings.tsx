import { useEffect, useState } from "react";
import PlatformIcon, { PLATFORM_COLORS } from "../components/PlatformIcon";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
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

const TABS = [
  { id: "geral", label: "Geral" },
  { id: "conectores", label: "Conectores" },
  { id: "agendamento", label: "Agendamento" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  const [tab, setTab] = useState<TabId>("geral");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [discord, setDiscord] = useState<DiscordConfig | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectorsStatus | null>(null);
  const [detectedMcp, setDetectedMcp] = useState<DetectedMcpServer[]>([]);
  const [token, setToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [connectorTokens, setConnectorTokens] = useState<Record<string, string>>({});
  const { toast, showToast } = useToast(3000);
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
      showToast("Configurações salvas!");
    } catch (e) {
      showToast(`Erro: ${e}`);
    }
  };

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Salvar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Geral */}
      {tab === "geral" && (
        <div className="settings-grid">
          <div className="space-y-6">
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
                    Token{" "}
                    {discord?.has_token && (
                      <span className="text-green-500 text-xs ml-1">(salvo)</span>
                    )}
                  </>
                }
              >
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={
                    discord?.has_token ? "••••••• (já configurado)" : "Cole seu token"
                  }
                  className="input-field"
                />
              </Field>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="OpenAI">
              <Field
                label={
                  <>
                    API Key{" "}
                    {connStatus?.openai && (
                      <span className="text-green-500 text-xs ml-1">(salvo)</span>
                    )}
                  </>
                }
              >
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder={
                    connStatus?.openai ? "••••••• (já configurado)" : "sk-..."
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

            {/* MCP Servers - compact read-only list */}
            {detectedMcp.length > 0 && (
              <Section title="MCP Servers">
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  Detectados de ~/.claude/settings.json
                </p>
                <div className="space-y-1.5">
                  {detectedMcp.map((server) => (
                    <div
                      key={`${server.name}-${server.source}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-sm"
                    >
                      <span className="font-medium">{server.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        server.transport === "http"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-blue-900/40 text-blue-400"
                      }`}>
                        {server.transport}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {/* Tab: Conectores */}
      {tab === "conectores" && (
        <div className="settings-grid">
          <div className="space-y-3">
            <ConnectorToggle
              label={<span className="flex items-center gap-2" style={{ color: PLATFORM_COLORS.discord }}><PlatformIcon platform="discord" size={16} /><span className="text-[var(--text-primary)]">Discord (Leitura de DMs)</span></span>}
              enabled={config.connectors.discord_read.enabled}
              onChange={(v) =>
                setConfig({
                  ...config,
                  connectors: {
                    ...config.connectors,
                    discord_read: { ...config.connectors.discord_read, enabled: v },
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
                        discord_read: { ...config.connectors.discord_read, process_all: e.target.checked },
                      },
                    })
                  }
                  className="accent-[var(--accent)]"
                />
                Processar todos os DMs ativos
              </label>
            </ConnectorToggle>

            <ConnectorToggle
              label={<span className="flex items-center gap-2" style={{ color: PLATFORM_COLORS.gitlab }}><PlatformIcon platform="gitlab" size={16} /><span className="text-[var(--text-primary)]">GitLab (via glab CLI)</span></span>}
              enabled={config.connectors.gitlab.enabled}
              onChange={(v) => updateConnector("gitlab", "enabled", v)}
            >
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

            <ConnectorToggle
              label={<span className="flex items-center gap-2" style={{ color: PLATFORM_COLORS.github }}><PlatformIcon platform="github" size={16} /><span className="text-[var(--text-primary)]">GitHub (via gh CLI)</span></span>}
              enabled={config.connectors.github.enabled}
              onChange={(v) => updateConnector("github", "enabled", v)}
            >
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
          </div>

          <div className="space-y-3">
            {/* Unified Atlassian section — one config for both Jira + Confluence */}
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.connectors.jira.enabled || config.connectors.confluence.enabled}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setConfig({
                      ...config,
                      connectors: {
                        ...config.connectors,
                        jira: { ...config.connectors.jira, enabled: v },
                        confluence: { ...config.connectors.confluence, enabled: v },
                      },
                    });
                  }}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm font-medium flex items-center gap-2"><span style={{ color: PLATFORM_COLORS.atlassian }}><PlatformIcon platform="atlassian" size={16} /></span> Atlassian (Jira + Confluence)</span>
              </label>
              {(config.connectors.jira.enabled || config.connectors.confluence.enabled) && (
                <div className="pl-6 pt-2 space-y-2">
                  <Field label="Instance URL">
                    <input
                      type="text"
                      value={config.connectors.jira.instance_url ?? ""}
                      onChange={(e) => {
                        const url = e.target.value || null;
                        setConfig({
                          ...config,
                          connectors: {
                            ...config.connectors,
                            jira: { ...config.connectors.jira, instance_url: url },
                            confluence: { ...config.connectors.confluence, instance_url: url },
                          },
                        });
                      }}
                      placeholder="https://empresa.atlassian.net"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={config.connectors.jira.email ?? ""}
                      onChange={(e) => {
                        const email = e.target.value || null;
                        setConfig({
                          ...config,
                          connectors: {
                            ...config.connectors,
                            jira: { ...config.connectors.jira, email },
                            confluence: { ...config.connectors.confluence, email },
                          },
                        });
                      }}
                      placeholder="seu@email.com"
                      className="input-field"
                    />
                  </Field>
                  <Field
                    label={
                      <>
                        API Token{" "}
                        {(connStatus?.jira || connStatus?.confluence) && (
                          <span className="text-green-500 text-xs ml-1">(salvo)</span>
                        )}
                      </>
                    }
                  >
                    <input
                      type="password"
                      value={connectorTokens.jira ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setConnectorTokens({ ...connectorTokens, jira: v, confluence: v });
                      }}
                      placeholder={
                        connStatus?.jira
                          ? "••••••• (já configurado)"
                          : "Gere em id.atlassian.com → Security → API tokens"
                      }
                      className="input-field"
                    />
                  </Field>
                  <p className="text-xs text-[var(--text-secondary)]">
                    O mesmo token é usado para Jira e Confluence.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Agendamento */}
      {tab === "agendamento" && (
        <div className="max-w-lg">
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
            <span className="text-sm font-medium">Ativar envio agendado</span>
          </label>
          <p className="text-xs text-[var(--text-secondary)] mb-5">
            LaunchAgent:{" "}
            <span className={agentInstalled ? "text-green-500" : "text-[var(--text-secondary)]"}>
              {agentInstalled ? "instalado" : "não instalado"}
            </span>
          </p>

          {config.schedule.enabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Dias da semana</label>
                <div className="flex gap-2">
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
              </div>

              <Field label="Horário">
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
                      schedule: { ...config.schedule, auto_send: e.target.checked },
                    })
                  }
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm">Enviar automaticamente (sem pedir aprovação)</span>
              </label>
            </div>
          )}
        </div>
      )}

      <Toast message={toast} />
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
    <section>
      <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
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
  label: React.ReactNode;
  enabled: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
      {enabled && <div className="pl-6 pt-2 space-y-2">{children}</div>}
    </div>
  );
}


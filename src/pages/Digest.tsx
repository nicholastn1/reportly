import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import {
  generateDigest,
  applyDigestToReport,
  getConnectorsStatus,
} from "../lib/tauri";
import { todayFormatted, nextBusinessDay } from "../lib/dates";
import type { DigestResult, ConnectorsStatus } from "../lib/types";
import MarkdownPreview from "../components/MarkdownPreview";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

const PLATFORM_ICONS: Record<string, string> = {
  discord: "💬",
  gitlab: "🦊",
  jira: "📋",
  confluence: "📝",
  github: "🐙",
};

const STEP_LABELS: Record<string, string> = {
  collecting: "Coletando",
  summarizing: "Sumarizando",
  suggesting: "Gerando sugestões",
  done: "Concluído",
};

interface DigestProgress {
  step: string;
  detail: string;
  current: number;
  total: number;
}

export default function Digest() {
  const navigate = useNavigate();
  const defaultDate = todayFormatted();
  const [collectDate, setCollectDate] = useState(defaultDate);
  const targetDate = nextBusinessDay();

  const [status, setStatus] = useState<ConnectorsStatus | null>(null);
  const [result, setResult] = useState<DigestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const { toast, showToast } = useToast();
  const [editedSuggestions, setEditedSuggestions] = useState("");
  const [progress, setProgress] = useState<DigestProgress | null>(null);

  useEffect(() => {
    getConnectorsStatus().then(setStatus);
  }, []);

  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<DigestProgress>("digest-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (result?.suggestions) {
      setEditedSuggestions(result.suggestions);
    }
  }, [result]);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setProgress(null);
    try {
      const digest = await generateDigest(collectDate);
      setResult(digest);
    } catch (e) {
      showToast(`Erro: ${e}`);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      const yesterday = result.platform_summaries
        .map((s) => s.summary.trim())
        .filter((s) => s.length > 0)
        .join("\n");

      await applyDigestToReport(
        targetDate,
        yesterday,
        editedSuggestions || undefined,
      );
      showToast(`Digest aplicado ao report de ${targetDate}!`);
    } catch (e) {
      showToast(`Erro: ${e}`);
    } finally {
      setApplying(false);
    }
  };


  const enabledCount = status
    ? Object.entries(status).filter(
        ([k, v]) => v && k !== "openai",
      ).length
    : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Daily Digest</h1>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-[var(--text-secondary)]">
          Coletar atividade de
        </span>
        <input
          type="text"
          value={collectDate}
          onChange={(e) => setCollectDate(e.target.value)}
          placeholder="DD.MM.YY"
          className="px-3 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] w-28 text-center outline-none focus:border-[var(--accent)]"
        />
        <span className="text-sm text-[var(--text-secondary)]">
          e aplicar ao report de <strong>{targetDate}</strong>
        </span>
      </div>

      {/* Status bar */}
      {status && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {Object.entries(PLATFORM_ICONS).map(([platform, icon]) => {
            const hasToken = status[platform as keyof ConnectorsStatus];
            return (
              <span
                key={platform}
                className={`px-3 py-1 rounded-full text-xs ${
                  hasToken
                    ? "bg-green-900/40 text-green-400"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                }`}
              >
                {icon} {platform}
              </span>
            );
          })}
          <span
            className={`px-3 py-1 rounded-full text-xs ${
              status.openai
                ? "bg-green-900/40 text-green-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            🤖 OpenAI
          </span>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !status?.openai || enabledCount === 0}
        className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 mb-6"
      >
        {loading ? "Gerando digest..." : "Gerar Digest"}
      </button>

      {!status?.openai && (
        <p className="text-sm text-red-400 mb-4">
          Configure a API key da OpenAI no Settings antes de gerar.
        </p>
      )}

      {enabledCount === 0 && status?.openai && (
        <p className="text-sm text-yellow-400 mb-4">
          Nenhum conector habilitado. Configure pelo menos um no Settings.
        </p>
      )}

      {/* Progress indicator */}
      {loading && progress && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">
              {STEP_LABELS[progress.step] || progress.step}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {progress.current}/{progress.total}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] pl-7">
            {progress.detail}
          </p>
          {progress.total > 1 && (
            <div className="mt-2 ml-7 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Platform summaries */}
          {result.platform_summaries.map((s) => (
            <div
              key={s.platform}
              className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">
                  {PLATFORM_ICONS[s.platform] || ""}{" "}
                  {s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  {s.tokens} tokens | ${s.cost.toFixed(4)}
                </span>
              </div>
              <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border)]">
                <MarkdownPreview content={s.summary} />
              </div>
            </div>
          ))}

          {/* Suggestions */}
          {result.suggestions && (
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4">
              <h3 className="font-semibold mb-2">
                💡 Sugestoes para hoje
              </h3>
              <textarea
                value={editedSuggestions}
                onChange={(e) => setEditedSuggestions(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] font-mono resize-y outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {/* Totals + Apply */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-[var(--text-secondary)]">
              Total: {result.total_tokens} tokens | $
              {result.total_cost.toFixed(4)}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/editor/${targetDate}`)}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
              >
                Ver Report
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {applying ? "Aplicando..." : `Aplicar ao Report ${targetDate}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}

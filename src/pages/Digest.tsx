import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import Lottie from "lottie-react";
import loaderAnimation from "../assets/loader.json";
import {
  generateDigest,
  applyDigestToReport,
  getConnectorsStatus,
} from "../lib/tauri";
import { todayFormatted, nextBusinessDay } from "../lib/dates";
import type { DigestResult, ConnectorsStatus } from "../lib/types";
import MarkdownPreview from "../components/MarkdownPreview";
import PlatformIcon, { PLATFORM_COLORS } from "../components/PlatformIcon";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

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
    <div className="max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Daily Digest</h1>
          <div className="flex items-center gap-3">
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
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleGenerate}
            disabled={loading || !status?.openai || enabledCount === 0}
            className="px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
          >
            {loading ? "Gerando..." : result ? "Gerar Novamente" : "Gerar Digest"}
          </button>
          {result && !loading && (
            <button
              onClick={() => {
                setResult(null);
                setEditedSuggestions("");
                setProgress(null);
              }}
              className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors text-sm"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["discord", "gitlab", "jira", "confluence", "github"] as const).map((platform) => {
            const hasToken = status[platform as keyof ConnectorsStatus];
            const color = PLATFORM_COLORS[platform];
            return (
              <span
                key={platform}
                className="connector-badge"
                style={{
                  borderColor: hasToken ? color : "var(--border)",
                  color: hasToken ? color : "var(--text-secondary)",
                }}
              >
                <PlatformIcon platform={platform} size={14} />
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </span>
            );
          })}
          <span
            className="connector-badge"
            style={{
              borderColor: status.openai ? PLATFORM_COLORS.openai : "var(--border)",
              color: status.openai ? PLATFORM_COLORS.openai : "var(--text-secondary)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" /></svg>
            OpenAI
          </span>
        </div>
      )}


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
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Lottie
            animationData={loaderAnimation}
            loop
            autoPlay
            style={{ width: 120, height: 120 }}
          />
          {progress && (
            <div className="text-center mt-4">
              <p className="text-sm font-medium">
                {STEP_LABELS[progress.step] || progress.step}
                <span className="text-[var(--text-secondary)] ml-2 text-xs">
                  {progress.current}/{progress.total}
                </span>
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {progress.detail}
              </p>
              {progress.total > 1 && (
                <div className="mt-3 mx-auto w-48 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}
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
                <h3 className="font-semibold flex items-center gap-2" style={{ color: PLATFORM_COLORS[s.platform] || "var(--text-primary)" }}>
                  <PlatformIcon platform={s.platform} size={18} />
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

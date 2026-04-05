import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayReport, sendToDiscord } from "../lib/tauri";
import { todayFormatted, formatDateLabel } from "../lib/dates";
import type { Report } from "../lib/types";
import StatusBadge from "../components/StatusBadge";
import ApprovalDialog from "../components/ApprovalDialog";
import MarkdownPreview from "../components/MarkdownPreview";

export default function Dashboard() {
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const today = todayFormatted();

  useEffect(() => {
    getTodayReport()
      .then(setReport)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const status = !report?.exists
    ? "empty"
    : report.content.trim().length > 0
      ? "ready"
      : "draft";

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendToDiscord(today);
      if (result.success) {
        setToast("Report enviado com sucesso!");
        setShowDialog(false);
      } else {
        setToast(`Erro: ${result.error}`);
      }
    } catch (e) {
      setToast(`Erro: ${e}`);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="text-[var(--text-secondary)]">Carregando...</div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {formatDateLabel(today)}
      </p>

      {/* Today's report card */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Daily Report - {today}</h2>
          <StatusBadge status={status} />
        </div>

        {report?.exists ? (
          <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border)] max-h-80 overflow-auto">
            <MarkdownPreview content={report.content} />
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
            Nenhum report para hoje ainda.
          </p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => navigate(`/editor/${today}`)}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
          >
            Editar
          </button>
          {report?.exists && (
            <button
              onClick={() => setShowDialog(true)}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Enviar pro Discord
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm shadow-lg ${
            toast.startsWith("Erro")
              ? "bg-red-900/90 text-red-200"
              : "bg-green-900/90 text-green-200"
          }`}
        >
          {toast}
        </div>
      )}

      <ApprovalDialog
        open={showDialog}
        date={today}
        onSend={handleSend}
        onEdit={() => {
          setShowDialog(false);
          navigate(`/editor/${today}`);
        }}
        onCancel={() => setShowDialog(false)}
        sending={sending}
      />
    </div>
  );
}

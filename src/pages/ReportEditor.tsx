import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getReport, saveReport, sendToDiscord } from "../lib/tauri";
import { todayFormatted, formatDateLabel } from "../lib/dates";
import type { Report } from "../lib/types";
import MarkdownEditor from "../components/MarkdownEditor";
import MarkdownPreview from "../components/MarkdownPreview";
import ApprovalDialog from "../components/ApprovalDialog";

export default function ReportEditor() {
  const { date: paramDate } = useParams<{ date: string }>();
  const date = paramDate || todayFormatted();

  const [report, setReport] = useState<Report | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getReport(date).then((r) => {
      setReport(r);
      setContent(r.content);
      setDirty(false);
    });
  }, [date]);

  const handleChange = (value: string) => {
    setContent(value);
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveReport(date, content);
      setDirty(false);
      setToast("Salvo!");
    } catch (e) {
      setToast(`Erro ao salvar: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [date, content]);

  const handleSend = async () => {
    if (dirty) await handleSave();
    setSending(true);
    try {
      const result = await sendToDiscord(date);
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
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">
            Daily Report - {date}
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {formatDateLabel(date)}
            {dirty && " — alteracoes nao salvas"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            onClick={() => setShowDialog(true)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 rounded-xl border border-[var(--border)] overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={handleChange}
            onSave={handleSave}
          />
        </div>
        <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <MarkdownPreview content={content} />
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
        date={date}
        onSend={handleSend}
        onEdit={() => setShowDialog(false)}
        onCancel={() => setShowDialog(false)}
        sending={sending}
      />
    </div>
  );
}

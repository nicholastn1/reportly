import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getReport, saveReport, sendToDiscord } from "../lib/tauri";
import { todayFormatted, formatDateLabel } from "../lib/dates";
import MarkdownEditor from "../components/MarkdownEditor";
import MarkdownPreview from "../components/MarkdownPreview";
import ApprovalDialog from "../components/ApprovalDialog";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

export default function ReportEditor() {
  const { date: paramDate } = useParams<{ date: string }>();
  const date = paramDate || todayFormatted();

  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast, showToast } = useToast(3000);

  useEffect(() => {
    getReport(date).then((r) => {
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
      showToast("Salvo!");
    } catch (e) {
      showToast(`Erro ao salvar: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [date, content, showToast]);

  const handleSend = async () => {
    if (dirty) await handleSave();
    setSending(true);
    try {
      const result = await sendToDiscord(date);
      if (result.success) {
        showToast("Report enviado com sucesso!");
        setShowDialog(false);
      } else {
        showToast(`Erro: ${result.error}`);
      }
    } catch (e) {
      showToast(`Erro: ${e}`);
    } finally {
      setSending(false);
    }
  };

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

      <Toast message={toast} />

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

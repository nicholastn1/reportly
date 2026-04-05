interface Props {
  open: boolean;
  date: string;
  onSend: () => void;
  onEdit: () => void;
  onCancel: () => void;
  sending?: boolean;
}

export default function ApprovalDialog({
  open,
  date,
  onSend,
  onEdit,
  onCancel,
  sending,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-6 w-96 shadow-2xl">
        <h3 className="text-lg font-semibold mb-2">Enviar Daily Report?</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Report de <strong>{date}</strong> sera enviado para o Discord.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            Editar
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

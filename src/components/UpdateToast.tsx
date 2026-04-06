import type { UpdateState } from "../lib/updater";

interface Props {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function UpdateToast({ state, onInstall, onDismiss }: Props) {
  if (state.status === "idle" || state.status === "checking") return null;

  if (state.status === "error") {
    return (
      <div className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg bg-red-900/90 text-red-200 max-w-sm">
        Erro ao verificar atualizações: {state.message}
      </div>
    );
  }

  if (state.status === "downloading") {
    return (
      <div className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg bg-[var(--bg-tertiary)] border border-[var(--border)] max-w-sm">
        <p className="text-[var(--text-primary)] mb-2">Baixando atualização...</p>
        <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <p className="text-[var(--text-secondary)] text-xs mt-1">{state.progress}%</p>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg bg-green-900/90 text-green-200 max-w-sm">
        Atualização instalada! Reiniciando...
      </div>
    );
  }

  // status === "available"
  return (
    <div className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg bg-[var(--bg-tertiary)] border border-[var(--border)] max-w-sm">
      <p className="text-[var(--text-primary)] font-medium mb-1">
        Nova versão disponível: v{state.info.version}
      </p>
      {state.info.body && (
        <p className="text-[var(--text-secondary)] text-xs mb-3 line-clamp-3">
          {state.info.body}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onInstall}
          className="px-3 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          Atualizar
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)] text-xs hover:text-[var(--text-primary)] transition-colors"
        >
          Depois
        </button>
      </div>
    </div>
  );
}

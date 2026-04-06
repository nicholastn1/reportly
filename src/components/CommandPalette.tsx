import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { todayFormatted } from "../lib/dates";

interface PaletteAction {
  id: string;
  label: string;
  section: string;
  icon: string;
  keywords?: string[];
  path?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const today = todayFormatted();

  const actions: PaletteAction[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        section: "Navegação",
        icon: "◉",
        keywords: ["home", "início"],
        path: "/",
      },
      {
        id: "editor-today",
        label: "Editar Report de Hoje",
        section: "Navegação",
        icon: "✎",
        keywords: ["editor", "escrever", "report"],
        path: `/editor/${today}`,
      },
      {
        id: "editor",
        label: "Editor",
        section: "Navegação",
        icon: "✎",
        keywords: ["editar", "escrever"],
        path: "/editor",
      },
      {
        id: "digest",
        label: "Gerar Digest",
        section: "Navegação",
        icon: "↯",
        keywords: ["ai", "resumo", "digest"],
        path: "/digest",
      },
      {
        id: "history",
        label: "Histórico",
        section: "Navegação",
        icon: "☰",
        keywords: ["reports", "passados", "lista"],
        path: "/history",
      },
      {
        id: "settings",
        label: "Configurações",
        section: "Navegação",
        icon: "⚙",
        keywords: ["config", "opções", "preferências"],
        path: "/settings",
      },
    ],
    [today],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.keywords?.some((k) => k.includes(q)),
    );
  }, [query, actions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const execute = (action: PaletteAction) => {
    onClose();
    if (action.path) {
      navigate(action.path);
    } else if (action.action) {
      action.action();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      execute(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector(".palette-item.selected");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  // Group by section
  const sections = new Map<string, { action: PaletteAction; index: number }[]>();
  filtered.forEach((action, index) => {
    const group = sections.get(action.section) ?? [];
    group.push({ action, index });
    sections.set(action.section, group);
  });

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="palette-container"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Buscar páginas e ações..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">Nenhum resultado encontrado</div>
          ) : (
            Array.from(sections.entries()).map(([section, items]) => (
              <div key={section}>
                <div className="palette-section-title">{section}</div>
                {items.map(({ action, index }) => (
                  <div
                    key={action.id}
                    className={`palette-item ${index === selectedIndex ? "selected" : ""}`}
                    onClick={() => execute(action)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="palette-item-icon">{action.icon}</span>
                    {action.label}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

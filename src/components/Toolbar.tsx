import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import { useNavigate, useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/editor": "Editor",
  "/digest": "Digest",
  "/history": "Histórico",
  "/settings": "Configurações",
};

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2.5 6.5L7.5 2.5L12.5 6.5V12C12.5 12.2761 12.2761 12.5 12 12.5H3C2.72386 12.5 2.5 12.2761 2.5 12V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 12.5V8.5H9.5V12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SidebarToggle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5.5" y1="2" x2="5.5" y2="13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

interface ToolbarProps {
  onOpenPalette: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export default function Toolbar({ onOpenPalette, onToggleSidebar, sidebarCollapsed }: ToolbarProps) {
  const { canGoBack, canGoForward, goBack, goForward } =
    useNavigationHistory();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const title =
    PAGE_TITLES[currentPath] ??
    (currentPath.startsWith("/editor/") ? "Editor" : "Reportly");

  return (
    <header
      data-tauri-drag-region
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        e.preventDefault();
        getCurrentWindow().startDragging();
      }}
      className={`toolbar ${sidebarCollapsed ? "toolbar-no-sidebar" : ""}`}
    >
      {/* Left: sidebar toggle + nav buttons */}
      <div className="toolbar-left">
        <button
          onClick={onToggleSidebar}
          className="toolbar-btn"
          title="Mostrar/esconder sidebar"
        >
          <SidebarToggle />
        </button>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="toolbar-btn"
          title="Voltar"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="toolbar-btn"
          title="Avançar"
        >
          <ChevronRight />
        </button>
        <button
          onClick={() => navigate("/")}
          className="toolbar-btn"
          title="Dashboard"
          style={{ marginLeft: 2 }}
        >
          <HomeIcon />
        </button>
      </div>

      {/* Center: page title */}
      <div className="toolbar-title" data-tauri-drag-region>
        {title}
      </div>

      {/* Right: search */}
      <div className="toolbar-right">
        <button onClick={onOpenPalette} className="toolbar-search">
          <SearchIcon />
          <span className="toolbar-search-text">Buscar</span>
          <kbd className="toolbar-kbd">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}

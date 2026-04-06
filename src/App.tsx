import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import CommandPalette from "./components/CommandPalette";
import Toast from "./components/Toast";
import UpdateToast from "./components/UpdateToast";
import Dashboard from "./pages/Dashboard";
import ReportEditor from "./pages/ReportEditor";
import ReportHistory from "./pages/ReportHistory";
import Digest from "./pages/Digest";
import Settings from "./pages/Settings";
import ApprovalDialog from "./components/ApprovalDialog";
import { useToast } from "./hooks/useToast";
import { sendToDiscord, getTodayReport } from "./lib/tauri";
import { todayFormatted } from "./lib/dates";
import { checkForUpdate, downloadAndInstall, type UpdateState } from "./lib/updater";
import type { Update } from "@tauri-apps/plugin-updater";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [digestMounted, setDigestMounted] = useState(false);
  const [showScheduledDialog, setShowScheduledDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast, showToast } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("reportly-sidebar-collapsed") === "true",
  );
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  const today = todayFormatted();

  // Keep Digest mounted once visited so it doesn't lose state
  useEffect(() => {
    if (location.pathname === "/digest") setDigestMounted(true);
  }, [location.pathname]);

  // Cmd+K to open Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for scheduled send events from Rust backend
  useEffect(() => {
    const unlisten1 = listen("trigger-send", () => {
      setShowScheduledDialog(true);
    });

    const unlisten2 = listen("auto-send", async () => {
      try {
        const report = await getTodayReport();
        if (!report.exists) return;
        const result = await sendToDiscord(today);
        if (!result.success) {
          console.error("Auto-send failed:", result.error);
        }
      } catch (e) {
        console.error("Auto-send error:", e);
      }
    });

    return () => {
      unlisten1.then((fn) => fn());
      unlisten2.then((fn) => fn());
    };
  }, [today]);

  // Check for updates 3s after mount
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setUpdateState({ status: "checking" });
        const result = await checkForUpdate();
        if (result) {
          setPendingUpdate(result.update);
          setUpdateState({ status: "available", info: result.info, update: result.update });
        } else {
          setUpdateState({ status: "idle" });
        }
      } catch {
        // Silently ignore update check errors (offline, etc.)
        setUpdateState({ status: "idle" });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    try {
      setUpdateState({ status: "downloading", progress: 0 });
      await downloadAndInstall(pendingUpdate, (progress) => {
        setUpdateState({ status: "downloading", progress });
      });
      setUpdateState({ status: "ready" });
    } catch (e) {
      setUpdateState({ status: "error", message: String(e) });
    }
  }, [pendingUpdate]);

  const handleScheduledSend = async () => {
    setSending(true);
    try {
      const result = await sendToDiscord(today);
      if (result.success) {
        showToast("Report enviado com sucesso!");
        setShowScheduledDialog(false);
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
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="app-main">
        <Toolbar
          sidebarCollapsed={sidebarCollapsed}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleSidebar={() => {
            setSidebarCollapsed((v) => {
              localStorage.setItem("reportly-sidebar-collapsed", String(!v));
              return !v;
            });
          }}
        />
        <main className="app-content">
          <div className="p-6">
            {/* Digest stays mounted once visited to preserve state */}
            {digestMounted && (
              <div style={{ display: location.pathname === "/digest" ? "block" : "none" }}>
                <Digest />
              </div>
            )}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/editor" element={<ReportEditor />} />
              <Route path="/editor/:date" element={<ReportEditor />} />
              <Route path="/digest" element={null} />
              <Route path="/history" element={<ReportHistory />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Global scheduled send dialog */}
      <ApprovalDialog
        open={showScheduledDialog}
        date={today}
        onSend={handleScheduledSend}
        onEdit={() => {
          setShowScheduledDialog(false);
          navigate(`/editor/${today}`);
        }}
        onCancel={() => setShowScheduledDialog(false)}
        sending={sending}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toast message={toast} />
      <UpdateToast
        state={updateState}
        onInstall={handleInstallUpdate}
        onDismiss={() => setUpdateState({ status: "idle" })}
      />
    </div>
  );
}

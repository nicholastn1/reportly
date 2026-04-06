import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import ReportEditor from "./pages/ReportEditor";
import ReportHistory from "./pages/ReportHistory";
import Digest from "./pages/Digest";
import Settings from "./pages/Settings";
import ApprovalDialog from "./components/ApprovalDialog";
import { useToast } from "./hooks/useToast";
import { sendToDiscord, getTodayReport } from "./lib/tauri";
import { todayFormatted } from "./lib/dates";

export default function App() {
  const navigate = useNavigate();
  const [showScheduledDialog, setShowScheduledDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast, showToast } = useToast();

  const today = todayFormatted();

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* macOS titlebar */}
      <header
        data-tauri-drag-region
        onMouseDown={(e) => {
          e.preventDefault();
          getCurrentWindow().startDragging();
        }}
        className="h-12 shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-center relative select-none"
      >
        <span className="text-sm font-semibold text-[var(--text-secondary)] pointer-events-none absolute top-[16px] left-1/2 -translate-x-1/2 leading-none">
          Reportly
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-[var(--bg-primary)]">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/editor" element={<ReportEditor />} />
              <Route path="/editor/:date" element={<ReportEditor />} />
              <Route path="/digest" element={<Digest />} />
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

      <Toast message={toast} />
    </div>
  );
}

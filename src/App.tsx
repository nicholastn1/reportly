import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import ReportEditor from "./pages/ReportEditor";
import ReportHistory from "./pages/ReportHistory";
import Digest from "./pages/Digest";
import Settings from "./pages/Settings";
import ApprovalDialog from "./components/ApprovalDialog";
import { sendToDiscord, getTodayReport } from "./lib/tauri";
import { todayFormatted } from "./lib/dates";

export default function App() {
  const navigate = useNavigate();
  const [showScheduledDialog, setShowScheduledDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        setToast("Report enviado com sucesso!");
        setShowScheduledDialog(false);
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* macOS titlebar */}
      <header
        data-tauri-drag-region
        className="titlebar-drag h-12 shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-center relative"
      >
        <span className="text-sm font-semibold text-[var(--text-secondary)] select-none pointer-events-none">
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

      {/* Global toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${
            toast.startsWith("Erro")
              ? "bg-red-900/90 text-red-200"
              : "bg-green-900/90 text-green-200"
          }`}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

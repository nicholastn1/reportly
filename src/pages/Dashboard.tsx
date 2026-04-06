import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTodayReport, sendToDiscord, listRecentReports } from "../lib/tauri";
import { todayFormatted, formatDateLabel } from "../lib/dates";
import type { Report, ReportEntry } from "../lib/types";
import StatusBadge from "../components/StatusBadge";
import ApprovalDialog from "../components/ApprovalDialog";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [recentReports, setRecentReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast, showToast } = useToast();

  const today = todayFormatted();

  useEffect(() => {
    Promise.all([
      getTodayReport(),
      listRecentReports(7).catch(() => [] as ReportEntry[]),
    ])
      .then(([todayReport, recent]) => {
        setReport(todayReport);
        setRecentReports(recent);
      })
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

  if (loading) {
    return (
      <div className="text-[var(--text-secondary)]">Carregando...</div>
    );
  }

  return (
    <div className="max-w-full">
      {/* Hero */}
      <div className="dashboard-hero">
        <h1 className="dashboard-greeting">{getGreeting()} 👋</h1>
        <p className="dashboard-date">{formatDateLabel(today)}</p>
        <div className="dashboard-today-status">
          <span>Report de hoje:</span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <div
          className="dashboard-action-card"
          onClick={() => navigate(`/editor/${today}`)}
        >
          <div className="dashboard-action-icon">✎</div>
          <div className="dashboard-action-title">Editar Report</div>
          <div className="dashboard-action-desc">
            Escrever ou editar o report de hoje
          </div>
        </div>
        <div
          className="dashboard-action-card"
          onClick={() => navigate("/digest")}
        >
          <div className="dashboard-action-icon">↯</div>
          <div className="dashboard-action-title">Gerar Digest</div>
          <div className="dashboard-action-desc">
            Resumo automático das atividades
          </div>
        </div>
        <div
          className="dashboard-action-card"
          onClick={() => {
            if (report?.exists) {
              setShowDialog(true);
            } else {
              showToast("Crie um report primeiro");
            }
          }}
        >
          <div className="dashboard-action-icon">💬</div>
          <div className="dashboard-action-title">Enviar ao Discord</div>
          <div className="dashboard-action-desc">
            Publicar o report no canal
          </div>
        </div>
      </div>

      {/* Recent Timeline */}
      <div className="dashboard-timeline">
        <div className="dashboard-timeline-header">Reports Recentes</div>
        {recentReports.length === 0 ? (
          <div className="dashboard-timeline-empty">
            Nenhum report encontrado no vault
          </div>
        ) : (
          recentReports.map((entry) => (
            <div
              key={entry.date}
              className="dashboard-timeline-item"
              onClick={() => navigate(`/editor/${entry.date}`)}
            >
              <div className="dashboard-timeline-date">{entry.date}</div>
              <div className="dashboard-timeline-preview">
                {entry.preview.split("\n")[0] || "Sem conteúdo"}
              </div>
            </div>
          ))
        )}
      </div>

      <Toast message={toast} />

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

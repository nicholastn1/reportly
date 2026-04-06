import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listReports } from "../lib/tauri";
import { MONTH_NAMES } from "../lib/dates";
import type { ReportEntry } from "../lib/types";

export default function ReportHistory() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listReports(year, month)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Histórico</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={prevMonth}
          className="px-3 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          &larr;
        </button>
        <span className="text-base font-medium">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="px-3 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          &rarr;
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--text-secondary)]">Carregando...</p>
      ) : reports.length === 0 ? (
        <p className="text-[var(--text-secondary)]">
          Nenhum report em {MONTH_NAMES[month]} {year}.
        </p>
      ) : (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] overflow-hidden">
          {reports.map((r, i) => (
            <button
              key={r.date}
              onClick={() => navigate(`/editor/${r.date}`)}
              className={`w-full text-left flex items-center gap-4 px-5 py-3 hover:bg-[var(--bg-tertiary)] transition-colors ${
                i > 0 ? "border-t border-[var(--border)]" : ""
              }`}
            >
              <span className="text-sm font-semibold min-w-[70px]">{r.date}</span>
              <span className="text-sm text-[var(--text-secondary)] truncate">
                {r.preview.split("\n")[0] || "Sem conteúdo"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

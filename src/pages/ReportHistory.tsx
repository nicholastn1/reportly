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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Historico</h1>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-6">
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
        <div className="space-y-3">
          {reports.map((r) => (
            <button
              key={r.date}
              onClick={() => navigate(`/editor/${r.date}`)}
              className="w-full text-left bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Daily Report - {r.date}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2 whitespace-pre-line">
                {r.preview}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

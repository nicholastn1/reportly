import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard", icon: "◉" },
  { to: "/editor", label: "Editor", icon: "✎" },
  { to: "/digest", label: "Digest", icon: "↯" },
  { to: "/history", label: "History", icon: "☰" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col overflow-y-auto">
      <nav className="flex-1 px-2 py-3 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              }`
            }
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

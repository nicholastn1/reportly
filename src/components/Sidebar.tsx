import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";

interface SidebarLink {
  to: string;
  label: string;
  icon: string;
}

interface SidebarSection {
  title: string;
  key: string;
  defaultOpen: boolean;
  links: SidebarLink[];
}

const SECTIONS: SidebarSection[] = [
  {
    title: "Relatórios",
    key: "reports",
    defaultOpen: true,
    links: [
      { to: "/", label: "Dashboard", icon: "◉" },
      { to: "/editor", label: "Editor", icon: "✎" },
      { to: "/history", label: "Histórico", icon: "☰" },
    ],
  },
  {
    title: "Ferramentas",
    key: "tools",
    defaultOpen: true,
    links: [{ to: "/digest", label: "Digest", icon: "↯" }],
  },
  {
    title: "Configuração",
    key: "config",
    defaultOpen: true,
    links: [{ to: "/settings", label: "Configurações", icon: "⚙" }],
  },
];

const STORAGE_KEY = "reportly-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return Object.fromEntries(SECTIONS.map((s) => [s.key, s.defaultOpen]));
}

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const [openSections, setOpenSections] = useState(loadSectionState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openSections));
  }, [openSections]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <nav>
        {SECTIONS.map((section) => {
          const isOpen = openSections[section.key] ?? section.defaultOpen;
          return (
            <div key={section.key} className="sidebar-section">
              <button
                className="sidebar-section-header"
                onClick={() => toggleSection(section.key)}
              >
                <span className={`sidebar-chevron ${isOpen ? "open" : ""}`}>
                  ›
                </span>
                <span className="sidebar-section-title">{section.title}</span>
              </button>
              <div
                className={`sidebar-links ${isOpen ? "expanded" : "collapsed"}`}
              >
                {section.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-link-icon">{link.icon}</span>
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

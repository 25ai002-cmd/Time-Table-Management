import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import SetupWizard from "./SetupWizard";
import { loadInstitutionData, saveInstitutionData } from "./db";
import SubjectsSetup from "./SubjectsSetup";
import TeachersSetup from "./TeachersSetup";
import TimetableEditor from "./TimetableEditor";
import AIAssistant from "./AIAssistant";
import { generateTimetable, computePeriods, DAYS, PERIOD_COLORS, migrateData, getPeriodsCountForDay } from "./timetableEngine";
import { parseExcelFile, parseTSVData, FIELD_DEFINITIONS, autoMapFields } from "./importHelper";

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  // Sidebar palette — original blue theme
  sidebarBg: "#1a4b8c",
  sidebarBorder: "rgba(255,255,255,0.1)",
  sidebarText: "rgba(255,255,255,0.65)",
  sidebarActive: "rgba(255,255,255,0.15)",
  sidebarActiveText: "#ffffff",
  // Brand
  accent: "#2563eb",
  accentLight: "#eff6ff",
  accentGlow: "rgba(37,99,235,0.25)",
  primary: "#1a4b8c",
  // Semantic
  success: "#10b981",
  successLight: "#d1fae5",
  danger: "#ef4444",
  dangerLight: "#fee2e2",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  // Neutrals
  bg: "#f0f4ff",
  white: "#ffffff",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
  gray900: "#0f172a",
};

const SUBJECT_TYPES = ["Theory", "Practical", "Lab", "Sports", "Library", "Activity"];
const ROOM_TYPES = ["Classroom", "Computer Lab", "Science Lab", "Library", "Sports Ground", "Auditorium"];

const EMPTY_INSTITUTE = {
  name: "", type: "School", academicYear: "2025-2026",
  workingDays: 5, periodsPerDay: 8, periodDuration: 45,
  startTime: "08:00", endTime: "15:30",
  breakStart: "10:30", breakEnd: "10:45",
  lunchStart: "13:00", lunchEnd: "13:45",
};

const INITIAL_RULES = [
  { id: "teacher-double", icon: "ti-user-x", label: "No teacher double-booking", desc: "A teacher cannot be assigned to two classes simultaneously.", enabled: true },
  { id: "class-double", icon: "ti-books", label: "No class double-booking", desc: "A class cannot have two subjects at the same period.", enabled: true },
  { id: "room-conflicts", icon: "ti-door", label: "No room conflicts", desc: "A room cannot be assigned to two classes at the same time.", enabled: true },
  { id: "weekly-targets", icon: "ti-chart-bar", label: "Weekly period targets", desc: "Total periods per subject must match the required weekly count.", enabled: true },
  { id: "teacher-limits", icon: "ti-clock", label: "Teacher workload limits", desc: "Daily and weekly period limits for teachers must not be exceeded.", enabled: true },
  { id: "lab-continuity", icon: "ti-layout-rows", label: "Lab continuity", desc: "Lab and practical subjects should get consecutive periods where possible.", enabled: true },
  { id: "fixed-breaks", icon: "ti-coffee", label: "Fixed break times", desc: "Break and lunch periods remain fixed and are never overridden.", enabled: true },
  { id: "subject-dist", icon: "ti-calendar-repeat", label: "Subject distribution", desc: "Avoid scheduling the same subject more than twice on a single day.", enabled: true },
  { id: "balanced-workload", icon: "ti-scale", label: "Balanced workload", desc: "Distribute teacher workload evenly across the week.", enabled: true },
  { id: "core-priority", icon: "ti-trending-up", label: "Core subject priority", desc: "Schedule Mathematics, Science, and English in morning slots when possible.", enabled: false },
];

function generateId() { return Math.random().toString(36).substr(2, 9); }

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "9px 12px",
  border: `1.5px solid ${C.gray200}`, borderRadius: 8,
  fontSize: 13, color: C.gray800, background: C.white,
  outline: "none", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
};

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
  color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px",
  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  boxShadow: `0 2px 10px ${C.accentGlow}`,
};
const btnSecondary = {
  display: "inline-flex", alignItems: "center", gap: 6, background: C.white,
  color: C.gray600, border: `1.5px solid ${C.gray200}`, borderRadius: 8,
  padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
const btnDanger = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "#fef2f2",
  color: C.danger, border: `1.5px solid #fecaca`, borderRadius: 8,
  padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

// ─── Shared Components ─────────────────────────────────────────────────────────

function Card({ title, subtitle, icon, children, style = {}, actions }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 1px 6px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)",
      ...style,
    }}>
      {(title || actions) && (
        <div style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.gray100}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {icon && (
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${C.accent}14`, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${icon}`} style={{ fontSize: 16, color: C.accent }} />
              </div>
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.gray800 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>{subtitle}</div>}
            </div>
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

function FormRow({ label, children, hint, style = {} }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.gray500, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Badge({ children, color = C.accent, bg }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: bg || (color + "18"), color,
    }}>{children}</span>
  );
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{
      textAlign: "center", padding: "48px 24px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `${C.accent}10`, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 28, color: C.accent, opacity: 0.6 }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.gray700, marginBottom: 4 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.gray400 }}>{subtitle}</div>}
      </div>
      {action && action}
    </div>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────────────────────
function LoadingScreen({ message = "Loading your dashboard…" }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, #1a4b8c 0%, #2563eb 100%)`, gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 30px ${C.accentGlow}` }}>
        <i className="ti ti-calendar-stats" style={{ fontSize: 30, color: "#fff" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>TimeTable Pro</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{message}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: `pulse 1.2s ease-in-out ${i * 0.25}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { user, authLoading, signOut } = useAuth();

  const [institute, setInstitute] = useState(EMPTY_INSTITUTE);
  
  const getMaxPeriods = (inst) => {
    const normal = parseInt(inst.periodsPerDay) || 8;
    const sat = inst.workingDays === 6 ? (parseInt(inst.saturdayPeriodsCount) ?? 6) : 0;
    return Math.max(normal, sat);
  };

  useEffect(() => {
    if (institute?.customPeriods && institute.customPeriods.length > 0) {
      const maxP = getMaxPeriods(institute);
      if (institute.customPeriods.length !== maxP) {
        const current = [...institute.customPeriods];
        if (current.length < maxP) {
          const autoP = computePeriods({ ...institute, customPeriods: null }).filter(p => p.type === "period");
          for (let n = current.length + 1; n <= maxP; n++) {
            const defaultP = autoP.find(p => p.num === n) || { num: n, start: "08:00", end: "08:45" };
            current.push({ num: n, start: defaultP.start, end: defaultP.end });
          }
        } else {
          current.splice(maxP);
        }
        setInstitute(p => ({ ...p, customPeriods: current }));
      }
    }
  }, [institute?.periodsPerDay, institute?.saturdayPeriodsCount, institute?.workingDays]);
  const [standards, setStandards] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [rules, setRules] = useState(INITIAL_RULES);
  const [setupComplete, setSetupComplete] = useState(false);

  const [page, setPage] = useState("dashboard");
  const [generatedTT, setGeneratedTT] = useState(null);
  const [activeView, setActiveView] = useState({ type: "class", stdId: null, secId: null });
  const [toast, setToast] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [excelWizardOpen, setExcelWizardOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!user) {
      setInstitute(EMPTY_INSTITUTE); setStandards([]); setSubjects([]);
      setTeachers([]); setRooms([]); setRules(INITIAL_RULES); setSetupComplete(false);
      setGeneratedTT(null); setDataLoading(false);
      return;
    }
    setDataLoading(true);
    loadInstitutionData(user.uid).then(raw => {
      if (raw) {
        const data = migrateData(raw);
        setInstitute(data.institute || EMPTY_INSTITUTE);
        setStandards(data.standards || []);
        setSubjects(data.subjects || []);
        setTeachers(data.teachers || []);
        setRooms(data.rooms || []);
        if (data.rules && Array.isArray(data.rules)) {
          setRules(INITIAL_RULES.map(initRule => {
            const saved = data.rules.find(r => r.id === initRule.id);
            return saved ? { ...initRule, enabled: saved.enabled } : initRule;
          }));
        } else {
          setRules(INITIAL_RULES);
        }
        setSetupComplete(data.setupCompleted ?? false);
      } else {
        setSetupComplete(false);
      }
      setDataLoading(false);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user || dataLoading || !setupComplete) return;
    setSaving(true); setSaveError(false);
    const timer = setTimeout(() => {
      saveInstitutionData(user.uid, { institute, standards, subjects, teachers, rooms, rules, setupComplete })
        .then(() => setSaving(false))
        .catch(() => { setSaving(false); setSaveError(true); });
    }, 500);
    return () => clearTimeout(timer);
  }, [institute, standards, subjects, teachers, rooms, rules, setupComplete, user?.uid, dataLoading]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const handleGenerate = () => {
    const result = generateTimetable(institute, standards, subjects, teachers, rooms);
    setGeneratedTT(result);
    setActiveView({ type: "class", stdId: standards[0]?.id, secId: standards[0]?.sections[0]?.id });
    setPage("timetable");
    showToast("Timetable generated successfully! 🎉");
  };

  const handleSetupComplete = (savedInstitute) => {
    setInstitute(savedInstitute);
    setSetupComplete(true);
    setPage("dashboard");
    showToast(`Welcome to TimeTable Pro, ${savedInstitute.name}! 🎓`);
  };

  const totalPeriods = subjects.reduce((a, s) => a + (parseInt(s.periodsPerWeek) || 0) + (s.hasLab ? (parseInt(s.labPeriodsPerWeek) || 0) : 0), 0);

  if (authLoading) return <LoadingScreen message="Authenticating…" />;
  if (!user) return <AuthPage />;
  if (dataLoading) return <LoadingScreen message="Loading your institution data…" />;
  if (!setupComplete) return <SetupWizard onComplete={handleSetupComplete} />;

  const navGroups = [
    {
      label: "Overview",
      items: [
        { id: "dashboard", icon: "ti-layout-dashboard", label: "Dashboard" },
      ]
    },
    {
      label: "Setup",
      items: [
        { id: "institute", icon: "ti-building-school", label: "Institute" },
        { id: "standards", icon: "ti-books", label: "Classes & Sections" },
        { id: "subjects", icon: "ti-notebook", label: "Subjects" },
        { id: "teachers", icon: "ti-users", label: "Teachers" },
        { id: "rooms", icon: "ti-door", label: "Rooms" },
      ]
    },
    {
      label: "Timetable",
      items: [
        { id: "rules", icon: "ti-list-check", label: "Rules" },
        { id: "timetable", icon: "ti-calendar", label: "View Timetable" },
        { id: "export", icon: "ti-file-export", label: "Export" },
      ]
    },
  ];

  const userInitials = user.displayName
    ? user.displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : (user.email?.[0] || "U").toUpperCase();

  const currentPageLabel = navGroups.flatMap(g => g.items).find(n => n.id === page)?.label || "";

  const setupProgress = [
    { done: !!institute.name },
    { done: standards.length > 0 },
    { done: subjects.length > 0 },
    { done: teachers.length > 0 },
    { done: rooms.length > 0 },
    { done: !!generatedTT },
  ];
  const progressPct = Math.round((setupProgress.filter(s => s.done).length / setupProgress.length) * 100);

  return (
    <div className="app-container" style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      {mobileSidebarOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 95,
            animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`sidebar-aside ${mobileSidebarOpen ? "open" : ""}`} style={{
        width: sidebarCollapsed ? 64 : 240,
        background: C.sidebarBg,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
        overflowY: "auto", overflowX: "hidden",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.sidebarBorder}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px ${C.accentGlow}`,
            }}>
              <i className="ti ti-calendar-stats" style={{ color: "#fff", fontSize: 18 }} />
            </div>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.2, whiteSpace: "nowrap" }}>TimeTable Pro</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, whiteSpace: "nowrap" }}>Schedule Management</div>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {!sidebarCollapsed && (
          <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Setup Progress</span>
              <span style={{ fontSize: 10, color: progressPct === 100 ? C.success : C.accent, fontWeight: 700 }}>{progressPct}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progressPct}%`,
                background: progressPct === 100
                  ? `linear-gradient(90deg, ${C.success}, #34d399)`
                  : `linear-gradient(90deg, ${C.accent}, #60a5fa)`,
                borderRadius: 2, transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflow: "hidden" }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              {!sidebarCollapsed && (
                <div style={{ padding: "6px 8px 4px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => {
                const isActive = page === item.id;
                return (
                  <button key={item.id} onClick={() => { setPage(item.id); setMobileSidebarOpen(false); }}
                    title={sidebarCollapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center",
                      gap: sidebarCollapsed ? 0 : 10,
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      width: "100%", padding: sidebarCollapsed ? "10px" : "9px 10px",
                      borderRadius: 8, border: "none", cursor: "pointer",
                      marginBottom: 2,
                      background: isActive ? C.sidebarActive : "transparent",
                      color: isActive ? C.sidebarActiveText : C.sidebarText,
                      fontSize: 13, fontWeight: isActive ? 600 : 400,
                      textAlign: "left", fontFamily: "inherit",
                      boxShadow: isActive ? `inset 3px 0 0 ${C.accent}` : "none",
                      overflow: "hidden",
                    }}>
                    <i className={`ti ${item.icon}`} style={{ fontSize: 17, flexShrink: 0, color: isActive ? "#fff" : "rgba(255,255,255,0.45)" }} />
                    {!sidebarCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
                    {isActive && !sidebarCollapsed && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User & collapse */}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.sidebarBorder}`, flexShrink: 0 }}>
          {!sidebarCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${C.accent}, #7c3aed)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {userInitials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {institute.name || "My Institution"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{ flex: sidebarCollapsed ? 1 : "none", padding: "7px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className={`ti ${sidebarCollapsed ? "ti-layout-sidebar-right" : "ti-layout-sidebar"}`} style={{ fontSize: 15 }} />
            </button>
            {!sidebarCollapsed && (
              <button onClick={async () => {
                try {
                  await saveInstitutionData(user.uid, { institute, standards, subjects, teachers, rooms, setupComplete });
                } catch (e) {
                  console.error("Failed to save data on signout:", e);
                }
                await signOut();
              }}
                style={{ flex: 1, padding: "7px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-logout" style={{ fontSize: 14 }} />
                Sign Out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="main-content" style={{ marginLeft: sidebarCollapsed ? 64 : 240, flex: 1, overflowY: "auto", transition: "margin-left 0.25s cubic-bezier(0.4,0,0.2,1)", minHeight: "100vh" }}>

        {/* Header */}
        <header className="app-header" style={{
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.gray200}`,
          padding: "0 28px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 50,
          boxShadow: "0 1px 12px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button 
              className="mobile-toggle-btn"
              onClick={() => setMobileSidebarOpen(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.gray800,
                fontSize: 20,
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
              }}
            >
              <i className="ti ti-menu-2" />
            </button>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900 }}>{currentPageLabel}</div>
              <div className="header-sub" style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>
                {institute.name} · {institute.academicYear}
              </div>
            </div>
          </div>
          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Save indicator */}
            <div className="save-indicator" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: saveError ? C.danger : saving ? C.gray400 : C.success, padding: "4px 10px", borderRadius: 20, background: saveError ? C.dangerLight : saving ? C.gray100 : C.successLight }}>
              {saving && <><i className="ti ti-loader-2" style={{ fontSize: 12, animation: "spin 1s linear infinite" }} /> <span className="save-text">Saving…</span></>}
              {!saving && !saveError && <><i className="ti ti-cloud-check" style={{ fontSize: 12 }} /> <span className="save-text">Saved</span></>}
              {saveError && <><i className="ti ti-cloud-x" style={{ fontSize: 12 }} /> <span className="save-text">Save failed</span></>}
            </div>
            <button className="header-btn secondary-btn" onClick={() => setExcelWizardOpen(true)}
              style={{
                background: "#eff6ff",
                color: C.accent,
                border: `1.5px solid ${C.gray200}`, borderRadius: 8, padding: "8px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "#dbeafe"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = "#eff6ff"; }}>
              <i className="ti ti-file-spreadsheet" style={{ fontSize: 15 }} />
              <span className="btn-text">Import from Excel</span>
            </button>
            <button className="header-btn ai-btn" onClick={() => setAiOpen(v => !v)}
              style={{
                background: aiOpen ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#ede9fe",
                color: aiOpen ? "#fff" : "#7c3aed",
                border: "none", borderRadius: 8, padding: "8px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                boxShadow: aiOpen ? "0 2px 10px rgba(124,58,237,0.35)" : "none",
              }}>
              <i className="ti ti-robot" style={{ fontSize: 15 }} />
              <span className="btn-text">AI Assistant</span>
            </button>
            <button className="header-btn primary-btn" onClick={handleGenerate}
              style={{
                background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
                color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                boxShadow: `0 2px 12px ${C.accentGlow}`,
              }}>
              <i className="ti ti-wand" style={{ fontSize: 15 }} />
              <span className="btn-text">Generate Timetable</span>
            </button>
          </div>
        </header>

        <div className="page-content" style={{ padding: "24px 28px", animation: "fadeIn 0.2s ease" }}>
          {page === "dashboard" && <Dashboard standards={standards} subjects={subjects} teachers={teachers} rooms={rooms} totalPeriods={totalPeriods} generatedTT={generatedTT} setPage={setPage} handleGenerate={handleGenerate} institute={institute} progressPct={progressPct} />}
          {page === "institute" && <InstituteSetup institute={institute} setInstitute={setInstitute} showToast={showToast} />}
          {page === "standards" && <StandardsSetup standards={standards} setStandards={setStandards} teachers={teachers} subjects={subjects} showToast={showToast} institute={institute} />}
          {page === "subjects" && <SubjectsSetup subjects={subjects} setSubjects={setSubjects} standards={standards} showToast={showToast} />}
          {page === "teachers" && <TeachersSetup teachers={teachers} setTeachers={setTeachers} subjects={subjects} standards={standards} showToast={showToast} generatedTT={generatedTT} setGeneratedTT={setGeneratedTT} />}
          {page === "rooms" && <RoomsSetup rooms={rooms} setRooms={setRooms} showToast={showToast} />}
          {page === "rules" && <RulesPage rules={rules} setRules={setRules} />}
          {page === "timetable" && (
            <TimetableEditor
              generatedTT={generatedTT} setGeneratedTT={setGeneratedTT}
              standards={standards} subjects={subjects} teachers={teachers}
              rooms={rooms} institute={institute}
              activeView={activeView} setActiveView={setActiveView}
              handleGenerate={handleGenerate} showToast={showToast}
              rules={rules}
            />
          )}
          {page === "export" && <ExportPage generatedTT={generatedTT} standards={standards} subjects={subjects} teachers={teachers} showToast={showToast} />}
        </div>
      </main>

      {/* AI Assistant Panel */}
      <AIAssistant
        isOpen={aiOpen} onClose={() => setAiOpen(false)}
        data={{ standards, subjects, teachers, rooms, generatedTT, institute }}
        onAction={(key) => { if (key === "generate") { handleGenerate(); setAiOpen(false); } }}
      />

      {/* Excel Import Wizard */}
      <ExcelImportWizard
        isOpen={excelWizardOpen}
        onClose={() => setExcelWizardOpen(false)}
        standards={standards}
        setStandards={setStandards}
        subjects={subjects}
        setSubjects={setSubjects}
        teachers={teachers}
        setTeachers={setTeachers}
        rooms={rooms}
        setRooms={setRooms}
        showToast={showToast}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 20px", borderRadius: 12, fontSize: 13, fontWeight: 500,
          background: toast.type === "success" ? "#0f172a" : "#7f1d1d",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          animation: "toastSlide 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
          maxWidth: 380,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: toast.type === "success" ? C.success : C.danger,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ti ${toast.type === "success" ? "ti-check" : "ti-x"}`} style={{ fontSize: 14 }} />
          </div>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0, display: "flex" }}>
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ standards, subjects, teachers, rooms, totalPeriods, generatedTT, setPage, handleGenerate, institute, progressPct }) {
  const stats = [
    { label: "Classes", value: standards.length, icon: "ti-books", color: "#2563eb", bg: "#eff6ff" },
    { label: "Sections", value: standards.reduce((a, s) => a + s.sections.length, 0), icon: "ti-layout-grid", color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Subjects", value: subjects.length, icon: "ti-notebook", color: "#0891b2", bg: "#ecfeff" },
    { label: "Teachers", value: teachers.length, icon: "ti-users", color: "#059669", bg: "#f0fdf4" },
    { label: "Rooms", value: rooms.length, icon: "ti-door", color: "#d97706", bg: "#fffbeb" },
    { label: "Weekly Periods", value: totalPeriods, icon: "ti-clock", color: "#dc2626", bg: "#fef2f2" },
  ];

  const steps = [
    { label: "Institute Setup", icon: "ti-building-school", done: !!institute.name, page: "institute", desc: "Set your institution name and schedule" },
    { label: "Classes & Sections", icon: "ti-books", done: standards.length > 0, page: "standards", desc: `${standards.length} class${standards.length !== 1 ? "es" : ""} added` },
    { label: "Subject Setup", icon: "ti-notebook", done: subjects.length > 0, page: "subjects", desc: `${subjects.length} subject${subjects.length !== 1 ? "s" : ""} configured` },
    { label: "Teacher Setup", icon: "ti-users", done: teachers.length > 0, page: "teachers", desc: `${teachers.length} teacher${teachers.length !== 1 ? "s" : ""} registered` },
    { label: "Room Setup", icon: "ti-door", done: rooms.length > 0, page: "rooms", desc: `${rooms.length} room${rooms.length !== 1 ? "s" : ""} added` },
    { label: "Generate Timetable", icon: "ti-wand", done: !!generatedTT, page: null, desc: generatedTT ? "Timetable ready!" : "All set? Click to generate" },
  ];

  const nextStep = steps.find(s => !s.done);

  return (
    <div className="dashboard-container" style={{ maxWidth: 1100 }}>
      {/* Hero Banner */}
      <div className="dashboard-hero" style={{
        background: `linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%)`,
        borderRadius: 18, padding: "28px 32px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(26,75,140,0.25)",
        overflow: "hidden", position: "relative",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 60, bottom: -60, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

        <div className="hero-text" style={{ zIndex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            Welcome back, {institute.name}! 🎓
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
            {institute.type} · {institute.academicYear} · Private & Secure
          </div>
          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ height: 6, width: 200, background: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct === 100 ? "#10b981" : "#60a5fa", borderRadius: 3, transition: "width 0.5s ease" }} />
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{progressPct}% setup complete</span>
          </div>
        </div>

        <div className="dashboard-hero-actions" style={{ display: "flex", gap: 10, zIndex: 1, flexShrink: 0 }}>
          {nextStep && nextStep.page && (
            <button onClick={() => setPage(nextStep.page)} style={{
              background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", borderRadius: 10, padding: "10px 18px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <i className={`ti ${nextStep.icon}`} style={{ fontSize: 16 }} />
              Next: {nextStep.label}
            </button>
          )}
          <button onClick={handleGenerate} style={{
            background: "#fff", color: C.accent,
            border: "none", borderRadius: 10, padding: "10px 20px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 7,
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          }}>
            <i className="ti ti-wand" style={{ fontSize: 16 }} />
            Generate Timetable
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(0,0,0,0.08)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 18, color: s.color }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.gray900, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.gray400, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Setup Steps & Quick Actions */}
      <div className="dashboard-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Setup Progress Cards */}
        <Card title="Setup Checklist" icon="ti-circle-check" subtitle="Complete these steps to generate your timetable">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 14px", borderRadius: 10,
                background: step.done ? "#f0fdf4" : C.gray50,
                border: `1px solid ${step.done ? "#bbf7d0" : C.gray200}`,
                transition: "all 0.15s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: step.done ? C.success : C.gray200,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {step.done
                    ? <i className="ti ti-check" style={{ fontSize: 18, color: "#fff" }} />
                    : <i className={`ti ${step.icon}`} style={{ fontSize: 18, color: C.gray400 }} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: step.done ? "#065f46" : C.gray700 }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: step.done ? "#059669" : C.gray400, marginTop: 1 }}>{step.desc}</div>
                </div>
                {!step.done && step.page && (
                  <button onClick={() => setPage(step.page)} style={{
                    padding: "6px 14px", borderRadius: 7,
                    background: C.accentLight, color: C.accent,
                    border: `1px solid ${C.accent}30`, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <i className="ti ti-arrow-right" style={{ fontSize: 12 }} /> Go
                  </button>
                )}
                {!step.done && !step.page && (
                  <button onClick={handleGenerate} style={{
                    padding: "6px 14px", borderRadius: 7,
                    background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, color: "#fff",
                    border: "none", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <i className="ti ti-wand" style={{ fontSize: 12 }} /> Generate
                  </button>
                )}
                {step.done && step.page && (
                  <button onClick={() => setPage(step.page)} style={{
                    padding: "5px 12px", borderRadius: 6,
                    background: "none", color: C.gray400,
                    border: `1px solid ${C.gray200}`, fontSize: 11,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>Edit</button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Quick Actions" icon="ti-bolt">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Add classes & sections", icon: "ti-books", page: "standards", color: C.accent },
                { label: "Configure subjects", icon: "ti-notebook", page: "subjects", color: "#0891b2" },
                { label: "Add teachers", icon: "ti-user-plus", page: "teachers", color: "#7c3aed" },
                { label: "Manage rooms", icon: "ti-door", page: "rooms", color: "#d97706" },
                { label: "View timetable", icon: "ti-calendar", page: "timetable", color: "#059669" },
                { label: "Export schedules", icon: "ti-file-export", page: "export", color: "#dc2626" },
              ].map((a, i) => (
                <button key={i} onClick={() => setPage(a.page)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 12px",
                  background: C.gray50, border: `1px solid ${C.gray200}`,
                  borderRadius: 9, cursor: "pointer",
                  fontSize: 12, color: C.gray700, textAlign: "left", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = a.color + "08"; e.currentTarget.style.borderColor = a.color + "30"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.gray50; e.currentTarget.style.borderColor = C.gray200; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: a.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={`ti ${a.icon}`} style={{ fontSize: 14, color: a.color }} />
                  </div>
                  <span style={{ fontWeight: 500 }}>{a.label}</span>
                  <i className="ti ti-chevron-right" style={{ fontSize: 12, color: C.gray300, marginLeft: "auto" }} />
                </button>
              ))}
            </div>
          </Card>

          {generatedTT && (
            <Card title="Timetable Ready!" icon="ti-circle-check">
              <div style={{ fontSize: 12, color: C.gray500, marginBottom: 12, lineHeight: 1.6 }}>
                Your timetable has been generated. View it or export to share with your team.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={() => setPage("timetable")} style={{ ...btnPrimary, width: "100%", justifyContent: "center", fontSize: 12 }}>
                  <i className="ti ti-calendar" style={{ fontSize: 14 }} /> View Timetable
                </button>
                <button onClick={() => setPage("export")} style={{ ...btnSecondary, width: "100%", justifyContent: "center", fontSize: 12 }}>
                  <i className="ti ti-file-export" style={{ fontSize: 14 }} /> Export
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── INSTITUTE SETUP ──────────────────────────────────────────────────────────
function InstituteSetup({ institute, setInstitute, showToast }) {
  const upd = (k, v) => setInstitute(p => ({ ...p, [k]: v }));
  return (
    <div style={{ maxWidth: 760 }}>
      <Card title="Institution Information" icon="ti-building-school" subtitle="Basic details about your institution" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          <FormRow label="Institution Name" style={{ gridColumn: "1 / -1" }}>
            <input value={institute.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. St. Mary's High School" style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.gray200} />
          </FormRow>
          <FormRow label="Institution Type">
            <select value={institute.type} onChange={e => upd("type", e.target.value)} style={inputStyle}>
              {["School", "College", "Coaching Institute", "University", "Polytechnic"].map(t => <option key={t}>{t}</option>)}
            </select>
          </FormRow>
          <FormRow label="Academic Year">
            <select value={institute.academicYear} onChange={e => upd("academicYear", e.target.value)} style={inputStyle}>
              {["2024-2025", "2025-2026", "2026-2027", "2027-2028"].map(y => <option key={y}>{y}</option>)}
            </select>
          </FormRow>
        </div>
      </Card>

      <Card title="Schedule Configuration" icon="ti-clock" subtitle="Working days, periods, and timing" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 24px" }}>
          <FormRow label="Working Days / Week">
            <select value={institute.workingDays} onChange={e => upd("workingDays", parseInt(e.target.value))} style={inputStyle}>
              {[5, 6].map(d => <option key={d} value={d}>{d} Days</option>)}
            </select>
          </FormRow>
          
          {institute.workingDays === 6 ? (
            <>
              <FormRow label="Mon-Fri Periods">
                <select value={institute.periodsPerDay} onChange={e => upd("periodsPerDay", parseInt(e.target.value))} style={inputStyle}>
                  {[6, 7, 8, 9, 10].map(d => <option key={d} value={d}>{d} Periods</option>)}
                </select>
              </FormRow>
              <FormRow label="Saturday Periods">
                <select value={institute.saturdayPeriodsCount !== undefined ? institute.saturdayPeriodsCount : 6} onChange={e => upd("saturdayPeriodsCount", parseInt(e.target.value))} style={inputStyle}>
                  {[4, 5, 6, 7, 8, 9, 10].map(d => <option key={d} value={d}>{d} Periods</option>)}
                </select>
              </FormRow>
            </>
          ) : (
            <FormRow label="Periods per Day">
              <select value={institute.periodsPerDay} onChange={e => upd("periodsPerDay", parseInt(e.target.value))} style={inputStyle}>
                {[6, 7, 8, 9, 10].map(d => <option key={d} value={d}>{d} Periods</option>)}
              </select>
            </FormRow>
          )}
          
          <FormRow label="Period Duration">
            <select value={institute.periodDuration} onChange={e => upd("periodDuration", parseInt(e.target.value))} style={inputStyle}>
              {[35, 40, 45, 50, 55, 60].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </FormRow>
          
          <FormRow label="School Start Time">
            <input type="time" value={institute.startTime} onChange={e => upd("startTime", e.target.value)} style={inputStyle} />
          </FormRow>
          <FormRow label={
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Short Break</span>
              <input type="checkbox" checked={institute.hasShortBreak !== false} onChange={e => upd("hasShortBreak", e.target.checked)} />
            </div>
          }>
            {institute.hasShortBreak !== false ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="time" value={institute.breakStart} onChange={e => upd("breakStart", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: C.gray400, fontSize: 12 }}>to</span>
                <input type="time" value={institute.breakEnd} onChange={e => upd("breakEnd", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.gray400, fontStyle: "italic", height: 38, display: "flex", alignItems: "center" }}>Disabled</div>
            )}
          </FormRow>
          <FormRow label={
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Lunch Break</span>
              <input type="checkbox" checked={institute.hasLunchBreak !== false} onChange={e => upd("hasLunchBreak", e.target.checked)} />
            </div>
          }>
            {institute.hasLunchBreak !== false ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="time" value={institute.lunchStart} onChange={e => upd("lunchStart", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: C.gray400, fontSize: 12 }}>to</span>
                <input type="time" value={institute.lunchEnd} onChange={e => upd("lunchEnd", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.gray400, fontStyle: "italic", height: 38, display: "flex", alignItems: "center" }}>Disabled</div>
            )}
          </FormRow>
        </div>
        <div style={{ marginTop: 16, padding: "10px 14px", background: C.successLight, border: `1px solid #bbf7d0`, borderRadius: 8, fontSize: 12, color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-cloud-check" style={{ fontSize: 15 }} />
          Changes are automatically saved to your private account in real time.
        </div>
      </Card>

      {/* Period Time Customization Card */}
      <Card title="Period Timing Customization" icon="ti-clock-record" subtitle="Customize start and end times for each period individually">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => {
                if (institute.customPeriods && institute.customPeriods.length > 0) {
                  upd("customPeriods", null);
                  showToast("Switched to auto-calculated period timings");
                } else {
                  const autoP = computePeriods({ ...institute, customPeriods: null }).filter(p => p.type === "period");
                  const customP = autoP.map(p => ({ num: p.num, start: p.start, end: p.end }));
                  upd("customPeriods", customP);
                  showToast("Period timing customization enabled!");
                }
              }}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: institute.customPeriods ? C.danger : C.accent,
                color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12,
                fontFamily: "inherit"
              }}
            >
              {institute.customPeriods ? "Disable Custom Timings (Use Auto)" : "Enable Custom Period Timings"}
            </button>
          </div>

          {institute.customPeriods && institute.customPeriods.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {institute.customPeriods.map((cp, idx) => {
                const getDuration = (start, end) => {
                  if (!start || !end) return "0";
                  const [sH, sM] = start.split(":").map(Number);
                  const [eH, eM] = end.split(":").map(Number);
                  const diff = (eH * 60 + eM) - (sH * 60 + sM);
                  return diff > 0 ? `${diff} min` : "Invalid";
                };

                return (
                  <div key={cp.num} style={{ background: C.gray50, border: `1.5px solid ${C.gray200}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.gray800, marginBottom: 8 }}>Period {cp.num}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.gray500, width: 40 }}>Start:</span>
                        <input
                          type="time"
                          value={cp.start}
                          onChange={e => {
                            const newP = institute.customPeriods.map(p => p.num === cp.num ? { ...p, start: e.target.value } : p);
                            upd("customPeriods", newP);
                          }}
                          style={{ ...inputStyle, padding: "4px 8px", fontSize: 12, width: "100%" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.gray500, width: 40 }}>End:</span>
                        <input
                          type="time"
                          value={cp.end}
                          onChange={e => {
                            const newP = institute.customPeriods.map(p => p.num === cp.num ? { ...p, end: e.target.value } : p);
                            upd("customPeriods", newP);
                          }}
                          style={{ ...inputStyle, padding: "4px 8px", fontSize: 12, width: "100%" }}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: C.gray500, marginTop: 4, textAlign: "right", fontWeight: 600 }}>
                        Duration: <span style={{ color: C.accent }}>{getDuration(cp.start, cp.end)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.gray500, background: C.gray50, padding: 12, borderRadius: 8 }}>
              💡 Period times are currently automatically calculated using <strong>School Start Time</strong> ({institute.startTime}) and <strong>Period Duration</strong> ({institute.periodDuration} min). Enable customization to override times for each period.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── STANDARDS SETUP ──────────────────────────────────────────────────────────
const getStandardOptions = (type) => {
  switch (type) {
    case "School":
      return ["Junior KG", "Senior KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11 Science", "Class 11 Commerce", "Class 11 Arts", "Class 12 Science", "Class 12 Commerce", "Class 12 Arts"];
    case "College":
    case "University":
      return ["FYBA", "SYBA", "TYBA", "FYBCom", "SYBCom", "TYBCom", "FYBSc", "SYBSc", "TYBSc", "FYBBA", "SYBBA", "TYBBA", "FYBCA", "SYBCA", "TYBCA", "B.Tech Year 1", "B.Tech Year 2", "B.Tech Year 3", "B.Tech Year 4", "M.Tech Year 1", "M.Tech Year 2", "MBA Year 1", "MBA Year 2", "MCA Year 1", "MCA Year 2"];
    case "Polytechnic":
      return ["Diploma Year 1", "Diploma Year 2", "Diploma Year 3"];
    case "Coaching Institute":
      return ["8th Grade Foundation", "9th Grade Foundation", "10th Grade Board", "11th IIT-JEE", "12th IIT-JEE", "11th NEET", "12th NEET", "CAT Prep", "GATE Prep", "UPSC Prep"];
    default:
      return ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
  }
};

function StandardsSetup({ standards, setStandards, teachers, subjects, showToast, institute }) {
  const allOptions = getStandardOptions(institute?.type || "School");
  const addedNames = standards.map(s => s.name.toLowerCase());
  const remaining = allOptions.filter(o => !addedNames.includes(o.toLowerCase()));

  // Multi-select state
  const [checked, setChecked] = useState({});
  const [customValue, setCustomValue] = useState("");
  const [selectedStd, setSelectedStd] = useState(standards[0]?.id || "");
  const [newSecName, setNewSecName] = useState("");
  const [secCount, setSecCount] = useState(3);
  const [selectedOtherClasses, setSelectedOtherClasses] = useState([]);
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  // Clear other selection and close dropdown when changing selected standard
  useEffect(() => {
    setSelectedOtherClasses([]);
    setTargetDropdownOpen(false);
    setTargetSearch("");
  }, [selectedStd]);

  // When standards change, reset checked for items that were added
  useEffect(() => {
    setChecked(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (standards.some(s => s.name === k)) delete next[k];
      });
      return next;
    });
    if (!standards.find(s => s.id === selectedStd) && standards.length > 0) {
      setSelectedStd(standards[0].id);
    }
  }, [standards]);

  const toggleCheck = (name) => setChecked(prev => ({ ...prev, [name]: !prev[name] }));
  const checkedList = Object.keys(checked).filter(k => checked[k]);

  const addSelected = () => {
    if (!checkedList.length) return;
    const toAdd = checkedList.filter(n => !standards.some(s => s.name.toLowerCase() === n.toLowerCase()));
    if (!toAdd.length) { showToast("All selected classes already added", "error"); return; }
    const newStds = toAdd.map(name => ({ id: generateId(), name, sections: [] }));
    setStandards(p => [...p, ...newStds]);
    setChecked({});
    setSelectedStd(newStds[newStds.length - 1].id);
    showToast(`${toAdd.length} class${toAdd.length > 1 ? "es" : ""} added!`);
  };

  const addCustom = () => {
    const name = customValue.trim();
    if (!name) return;
    if (standards.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      showToast(`"${name}" already exists`, "error"); return;
    }
    const ns = { id: generateId(), name, sections: [] };
    setStandards(p => [...p, ns]);
    setCustomValue("");
    setSelectedStd(ns.id);
    showToast(`Class "${name}" added`);
  };

  const removeStandard = (id) => {
    setStandards(p => p.filter(s => s.id !== id));
    if (selectedStd === id) setSelectedStd(standards.find(s => s.id !== id)?.id || "");
  };

  const addSection = () => {
    if (!newSecName.trim() || !selectedStd) return;
    setStandards(p => p.map(s => s.id === selectedStd ? { ...s, sections: [...s.sections, { id: generateId(), name: newSecName.trim() }] } : s));
    setNewSecName(""); showToast("Section added");
  };

  const generateSections = () => {
    if (!selectedStd) return;
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").slice(0, secCount);
    const curStd = standards.find(s => s.id === selectedStd);
    const existingNames = curStd?.sections.map(s => s.name) || [];
    const toAdd = letters.filter(l => !existingNames.includes(l));
    if (!toAdd.length) { showToast("Sections already exist", "error"); return; }
    setStandards(p => p.map(s => s.id === selectedStd ? {
      ...s,
      sections: [...s.sections, ...toAdd.map(name => ({ id: generateId(), name }))]
    } : s));
    showToast(`${toAdd.length} sections generated (${toAdd.join(", ")})`);
  };

  const removeSection = (stdId, secId) => setStandards(p => p.map(s => s.id === stdId ? { ...s, sections: s.sections.filter(sec => sec.id !== secId) } : s));
  const curStd = standards.find(s => s.id === selectedStd);
  const otherStandards = standards.filter(s => s.id !== selectedStd);

  const applySectionsToOthers = () => {
    if (!selectedOtherClasses.length || !curStd?.sections.length) return;
    const currentSections = curStd.sections;
    setStandards(p => p.map(s => {
      if (selectedOtherClasses.includes(s.id)) {
        return {
          ...s,
          sections: currentSections.map(sec => ({ id: generateId(), name: sec.name }))
        };
      }
      return s;
    }));
    showToast(`Sections copied to ${selectedOtherClasses.length} class${selectedOtherClasses.length > 1 ? "es" : ""}`);
    setSelectedOtherClasses([]);
    setTargetDropdownOpen(false);
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Add Classes */}
        <Card title="Add Classes" icon="ti-books" subtitle="Select from the list or add custom">
          {remaining.length > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: C.gray500 }}>
                  Select one or more classes to add:
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.gray600, fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" 
                    checked={remaining.length > 0 && remaining.every(o => !!checked[o])} 
                    onChange={e => {
                      const allChecked = e.target.checked;
                      setChecked(prev => {
                        const next = { ...prev };
                        remaining.forEach(o => {
                          if (allChecked) next[o] = true;
                          else delete next[o];
                        });
                        return next;
                      });
                    }} 
                    style={{ width: 14, height: 14, accentColor: C.accent, cursor: "pointer" }} />
                  Select All
                </label>
              </div>
              <div style={{
                maxHeight: 260, overflowY: "auto", display: "grid",
                gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14,
                paddingRight: 4,
              }}>
                {remaining.map(opt => (
                  <label key={opt} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                    border: `1.5px solid ${checked[opt] ? C.accent : C.gray200}`,
                    background: checked[opt] ? C.accentLight : C.gray50,
                    transition: "all 0.12s",
                    userSelect: "none",
                  }}>
                    <input type="checkbox" checked={!!checked[opt]} onChange={() => toggleCheck(opt)}
                      style={{ width: 15, height: 15, accentColor: C.accent, cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: checked[opt] ? 600 : 400, color: checked[opt] ? C.accent : C.gray700 }}>{opt}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addSelected} disabled={!checkedList.length}
                  style={{
                    ...btnPrimary, flex: 1, justifyContent: "center",
                    opacity: checkedList.length ? 1 : 0.4,
                    cursor: checkedList.length ? "pointer" : "not-allowed",
                  }}>
                  <i className="ti ti-plus" style={{ fontSize: 14 }} />
                  Add {checkedList.length > 0 ? `${checkedList.length} Selected` : "Selected"}
                </button>
                {checkedList.length > 0 && (
                  <button onClick={() => setChecked({})} style={{ ...btnSecondary, padding: "9px 12px" }}>
                    <i className="ti ti-x" style={{ fontSize: 14 }} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0 8px", color: C.gray400, fontSize: 13, marginBottom: 12 }}>
              <i className="ti ti-check" style={{ fontSize: 24, display: "block", marginBottom: 6, color: C.success }} />
              All standard classes have been added!
            </div>
          )}

          <div style={{ borderTop: `1px solid ${C.gray100}`, paddingTop: 14, marginTop: remaining.length > 0 ? 8 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Custom Class Name</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                placeholder="e.g. Pre-Primary, Advance Maths..."
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && addCustom()}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.gray200}
              />
              <button onClick={addCustom} disabled={!customValue.trim()} style={{
                ...btnPrimary, padding: "9px 14px",
                opacity: customValue.trim() ? 1 : 0.4,
                cursor: customValue.trim() ? "pointer" : "not-allowed",
              }}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>
        </Card>

        {/* Current Classes */}
        <Card title="Added Classes" icon="ti-list-check" subtitle={`${standards.length} class${standards.length !== 1 ? "es" : ""} configured`}>
          {standards.length === 0 ? (
            <EmptyState icon="ti-books" title="No classes yet" subtitle="Add classes from the list on the left" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: C.gray500 }}>
                Select a class to configure its sections:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select value={selectedStd} onChange={e => setSelectedStd(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="" disabled>Choose a class...</option>
                  {standards.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.sections.length} section{s.sections.length !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
                {selectedStd && (
                  <button onClick={() => {
                    const stdToRemove = standards.find(s => s.id === selectedStd);
                    if (window.confirm(`Are you sure you want to remove "${stdToRemove?.name}"?`)) {
                      removeStandard(selectedStd);
                      showToast(`Removed class "${stdToRemove?.name}"`);
                    }
                  }} style={{ ...btnDanger, padding: "9px 12px" }} title="Remove this class">
                    <i className="ti ti-trash" style={{ fontSize: 14 }} />
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Sections Management */}
      {selectedStd && (
        <Card title={`Sections for ${curStd?.name || "selected class"}`} icon="ti-layout-grid" subtitle="Add and manage sections for this class" style={{ animation: "scaleIn 0.2s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Manual add */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 10 }}>Add Section Manually</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newSecName}
                  onChange={e => setNewSecName(e.target.value)}
                  placeholder="e.g. A, B, C or Science, Commerce..."
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => e.key === "Enter" && addSection()}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.gray200}
                />
                <button onClick={addSection} disabled={!newSecName.trim()} style={{
                  ...btnPrimary, padding: "9px 14px",
                  opacity: newSecName.trim() ? 1 : 0.4,
                  cursor: newSecName.trim() ? "pointer" : "not-allowed",
                }}>
                  <i className="ti ti-plus" style={{ fontSize: 14 }} />
                </button>
              </div>
            </div>

            {/* Auto-generate A, B, C */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 10 }}>Auto-Generate Sections (A, B, C…)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={secCount} onChange={e => setSecCount(parseInt(e.target.value))} style={{ ...inputStyle, width: 100 }}>
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} section{n > 1 ? "s" : ""}</option>)}
                </select>
                <button onClick={generateSections} style={{ ...btnPrimary, whiteSpace: "nowrap" }}>
                  <i className="ti ti-wand" style={{ fontSize: 14 }} />
                  Generate A–{String.fromCharCode(64 + secCount)}
                </button>
              </div>
            </div>
          </div>

          {/* Section chips / Class Teacher selectors */}
          <div style={{ marginTop: 16 }}>
            {(!curStd || curStd.sections.length === 0) ? (
              <div style={{ padding: "16px", textAlign: "center", color: C.gray400, fontSize: 12, background: C.gray50, borderRadius: 8 }}>
                No sections added yet. Use the tools above to add sections.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {curStd?.sections.map(sec => {
                  const classTeacher = teachers.find(t => t.id === sec.classTeacherId);
                  const ctSubjects = classTeacher ? subjects.filter(sub => {
                    if (sub.standardId !== curStd.id) return false;
                    if (classTeacher.assignments?.length) {
                      return classTeacher.assignments.some(a =>
                        a.standardId === curStd.id &&
                        a.subjectIds?.includes(sub.id) &&
                        (a.sectionIds?.length === 0 || !a.sectionIds || a.sectionIds.includes(sec.id))
                      );
                    }
                    return classTeacher.subjects?.includes(sub.id) || false;
                  }) : [];

                  const specialDay = sec.classTeacherSpecialDay || "Friday";

                  return (
                    <div key={sec.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                      padding: "12px 16px",
                      background: C.white,
                      border: `1px solid ${C.gray200}`,
                      borderRadius: 12,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      flexWrap: "wrap"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `${C.accent}14`, display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <i className="ti ti-layout-grid" style={{ fontSize: 15, color: C.accent }} />
                        </div>
                        <div>
                          <span style={{ fontSize: 13, color: C.gray800, fontWeight: 700 }}>{curStd.name} – {sec.name}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        {/* Class Teacher Select */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase" }}>Class Teacher:</span>
                          <select
                            value={sec.classTeacherId || ""}
                            onChange={e => {
                              const teacherId = e.target.value || null;
                              setStandards(p => p.map(s => s.id === curStd.id ? {
                                ...s,
                                sections: s.sections.map(se => se.id === sec.id ? { ...se, classTeacherId: teacherId, classTeacherSubjectId: null } : se)
                              } : s));
                              showToast("Class teacher updated");
                            }}
                            style={{
                              padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                              fontSize: 12, outline: "none", background: C.white, fontFamily: "inherit"
                            }}
                          >
                            <option value="">— Unassigned —</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>

                        {/* Class Teacher Subject Select */}
                        {sec.classTeacherId && ctSubjects.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase" }}>CT Subject:</span>
                            <select
                              value={sec.classTeacherSubjectId || ""}
                              onChange={e => {
                                const val = e.target.value || null;
                                setStandards(p => p.map(s => s.id === curStd.id ? {
                                  ...s,
                                  sections: s.sections.map(se => se.id === sec.id ? { ...se, classTeacherSubjectId: val } : se)
                                } : s));
                                showToast("Class teacher subject updated");
                              }}
                              style={{
                                padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                                fontSize: 12, outline: "none", background: C.white, fontFamily: "inherit"
                              }}
                            >
                              <option value="">— Any Subject —</option>
                              {ctSubjects.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {sec.classTeacherId && ctSubjects.length === 0 && (
                          <span style={{ fontSize: 11, color: C.warning, fontWeight: 600 }} title="This teacher is not assigned to teach any subjects in this class. Set assignments in Teachers setup first.">
                            ⚠️ No subjects assigned
                          </span>
                        )}

                        {/* CT Period Normal */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase" }}>CT Period (Other Days):</span>
                          <select
                            value={sec.classTeacherPeriodNormal !== undefined ? (sec.classTeacherPeriodNormal === null ? "none" : sec.classTeacherPeriodNormal) : 1}
                            onChange={e => {
                              const val = e.target.value === "none" ? null : parseInt(e.target.value);
                              setStandards(p => p.map(s => s.id === curStd.id ? {
                                ...s,
                                sections: s.sections.map(se => se.id === sec.id ? { ...se, classTeacherPeriodNormal: val } : se)
                              } : s));
                              showToast("Normal days period updated");
                            }}
                            style={{
                              padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                              fontSize: 12, outline: "none", background: C.white, fontFamily: "inherit"
                            }}
                          >
                            <option value="none">None</option>
                            {Array.from({ length: parseInt(institute?.periodsPerDay) || 8 }, (_, i) => i + 1).map(n => (
                              <option key={n} value={n}>Period {n}</option>
                            ))}
                          </select>
                        </div>

                        {/* Special Day Select */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase" }}>Special Day:</span>
                          <select
                            value={sec.classTeacherSpecialDay || "Friday"}
                            onChange={e => {
                              const val = e.target.value;
                              setStandards(p => p.map(s => s.id === curStd.id ? {
                                ...s,
                                sections: s.sections.map(se => se.id === sec.id ? { ...se, classTeacherSpecialDay: val } : se)
                              } : s));
                              showToast("Special day updated");
                            }}
                            style={{
                              padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                              fontSize: 12, outline: "none", background: C.white, fontFamily: "inherit"
                            }}
                          >
                            {DAYS.slice(0, institute?.workingDays || 5).map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                        </div>

                        {/* CT Period Special Day */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, textTransform: "uppercase" }}>{specialDay} Period:</span>
                          <select
                            value={sec.classTeacherPeriodFriday !== undefined ? (sec.classTeacherPeriodFriday === null ? "none" : sec.classTeacherPeriodFriday) : 2}
                            onChange={e => {
                              const val = e.target.value === "none" ? null : parseInt(e.target.value);
                              setStandards(p => p.map(s => s.id === curStd.id ? {
                                ...s,
                                sections: s.sections.map(se => se.id === sec.id ? { ...se, classTeacherPeriodFriday: val } : se)
                              } : s));
                              showToast(`${specialDay} period updated`);
                            }}
                            style={{
                              padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.gray200}`,
                              fontSize: 12, outline: "none", background: C.white, fontFamily: "inherit"
                            }}
                          >
                            <option value="none">None</option>
                            {Array.from({ length: parseInt(institute?.periodsPerDay) || 8 }, (_, i) => i + 1).map(n => (
                              <option key={n} value={n}>Period {n}</option>
                            ))}
                          </select>
                        </div>

                        <button onClick={() => removeSection(curStd.id, sec.id)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: C.danger, padding: "6px 8px", borderRadius: 6, display: "flex",
                            alignItems: "center", justifyContent: "center", background: "#fef2f2"
                          }}
                          title="Remove Section">
                          <i className="ti ti-trash" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {curStd && curStd.sections.length > 0 && otherStandards.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.gray100}`, paddingTop: 16, marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Copy these sections to other classes
                </span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setSelectedOtherClasses(otherStandards.map(s => s.id))}
                    style={{ fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                    Select All
                  </button>
                  <span style={{ color: C.gray300, fontSize: 11 }}>|</span>
                  <button onClick={() => setSelectedOtherClasses([])}
                    style={{ fontSize: 11, color: C.gray400, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Search filter row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 8, padding: "5px 10px", width: "100%", maxWidth: 260 }}>
                  <i className="ti ti-search" style={{ color: C.gray400, fontSize: 13 }} />
                  <input
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    placeholder="Search target classes..."
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      width: "100%",
                      fontSize: 12,
                      fontFamily: "inherit",
                      color: C.gray800
                    }}
                  />
                  {targetSearch && (
                    <button onClick={() => setTargetSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.gray400, padding: 0 }}>
                      <i className="ti ti-x" style={{ fontSize: 11 }} />
                    </button>
                  )}
                </div>
                {selectedOtherClasses.length > 0 && (
                  <span style={{ fontSize: 11, color: C.gray400, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    Selected: {selectedOtherClasses.length} class{selectedOtherClasses.length !== 1 ? "es" : ""}
                  </span>
                )}
              </div>
              
              {/* Scrollable Checkbox Grid */}
              <div style={{
                maxHeight: 160,
                overflowY: "auto",
                border: `1.5px solid ${C.gray200}`,
                borderRadius: 10,
                padding: 10,
                background: C.gray50,
                marginBottom: 12
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
                  {otherStandards
                    .filter(s => s.name.toLowerCase().includes(targetSearch.toLowerCase()))
                    .map(s => {
                      const isSel = selectedOtherClasses.includes(s.id);
                      return (
                        <label key={s.id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                          border: `1.5px solid ${isSel ? C.accent : C.white}`,
                          background: isSel ? C.accentLight : C.white,
                          fontSize: 12, color: isSel ? C.accent : C.gray700,
                          userSelect: "none", transition: "all 0.12s",
                          boxShadow: isSel ? `0 2px 6px ${C.accent}15` : "0 1px 3px rgba(0,0,0,0.02)"
                        }}>
                          <input type="checkbox"
                            checked={isSel}
                            onChange={() => {
                              setSelectedOtherClasses(prev => 
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }}
                            style={{ width: 14, height: 14, accentColor: C.accent, cursor: "pointer" }}
                          />
                          <span style={{ fontWeight: isSel ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                        </label>
                      );
                    })}
                  {otherStandards.filter(s => s.name.toLowerCase().includes(targetSearch.toLowerCase())).length === 0 && (
                    <div style={{ fontSize: 11, color: C.gray400, textAlign: "center", padding: "12px 0", gridColumn: "1 / -1" }}>No classes found</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 11, color: C.danger, display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="ti ti-alert-triangle" />
                  Overwrites sections on selected classes.
                </span>
                <button onClick={applySectionsToOthers} disabled={selectedOtherClasses.length === 0}
                  style={{
                    ...btnSecondary,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderColor: selectedOtherClasses.length ? C.accent : C.gray200,
                    color: selectedOtherClasses.length ? C.accent : C.gray400,
                    background: selectedOtherClasses.length ? C.accentLight : C.white,
                    opacity: selectedOtherClasses.length ? 1 : 0.5,
                    cursor: selectedOtherClasses.length ? "pointer" : "not-allowed"
                  }}>
                  <i className="ti ti-copy" style={{ fontSize: 14 }} />
                  Apply to {selectedOtherClasses.length} Class{selectedOtherClasses.length !== 1 ? "es" : ""}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// SubjectsSetup — imported from ./SubjectsSetup.jsx

// TeachersSetup — imported from ./TeachersSetup.jsx

const FLOORS = [
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "3rd Floor",
  "4th Floor",
  "5th Floor",
  "6th Floor",
  "7th Floor",
  "8th Floor",
  "9th Floor",
  "10th Floor",
  "Basement",
  "Unassigned"
];

function getOrdinalSuffix(i) {
  const j = i % 10, k = i % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function detectFloor(name) {
  const normalized = name.trim().toLowerCase();
  if (
    normalized.includes("ground") || 
    (normalized.startsWith("g") && normalized.match(/^g\d+/)) || 
    normalized.startsWith("g-") ||
    normalized.includes("g0") || 
    normalized.includes("g1") || 
    normalized.includes("g2") ||
    normalized.match(/\b(g\d+|g-\d+)\b/)
  ) {
    return "Ground Floor";
  }
  if (
    normalized.includes("basement") || 
    normalized.includes("base") || 
    (normalized.startsWith("b") && normalized.match(/^b\d+/)) || 
    normalized.startsWith("b-")
  ) {
    return "Basement";
  }
  
  const numMatch = name.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0]);
    if (num >= 100 && num < 10000) {
      const floorNum = Math.floor(num / 100);
      return `${floorNum}${getOrdinalSuffix(floorNum)} Floor`;
    }
  }
  return null;
}

function floorOrder(floorName) {
  if (!floorName || floorName === "Unassigned") return 999;
  if (floorName.toLowerCase().includes("ground")) return 0;
  if (floorName.toLowerCase().includes("basement")) return -1;
  const match = floorName.match(/\d+/);
  return match ? parseInt(match[0]) : 900;
}

// ─── ROOMS SETUP ──────────────────────────────────────────────────────────────
function RoomsSetup({ rooms, setRooms, showToast }) {
  const [form, setForm] = useState({ name: "", type: "Classroom", capacity: 40, floor: "Ground Floor" });
  const [editId, setEditId] = useState(null);
  const [selType, setSelType] = useState("All");
  const [selFloor, setSelFloor] = useState("All");
  const [addTab, setAddTab] = useState("floors");

  // Multi-floor generator state
  const [multiFloorPrefix, setMultiFloorPrefix] = useState("Room");
  const [multiFloorGround, setMultiFloorGround] = useState(true);
  const [multiFloorGroundRooms, setMultiFloorGroundRooms] = useState(10);
  const [multiFloorCount, setMultiFloorCount] = useState(3);
  const [multiFloorRoomsPerFloor, setMultiFloorRoomsPerFloor] = useState(15);
  const [multiFloorType, setMultiFloorType] = useState("Classroom");
  const [multiFloorCapacity, setMultiFloorCapacity] = useState(40);
  const [multiFloorPattern, setMultiFloorPattern] = useState("3digit");

  const [rangePrefix, setRangePrefix] = useState("Room");
  const [rangeStart, setRangeStart] = useState(101);
  const [rangeEnd, setRangeEnd] = useState(110);
  const [rangeType, setRangeType] = useState("Classroom");
  const [rangeCapacity, setRangeCapacity] = useState(40);
  const [rangePadding, setRangePadding] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState("Classroom");
  const [bulkCapacity, setBulkCapacity] = useState(40);
  const [bulkDefaultFloor, setBulkDefaultFloor] = useState("Ground Floor");
  const [bulkAutoDetect, setBulkAutoDetect] = useState(true);

  const TYPE_COLORS = { "Classroom": "#2563eb", "Computer Lab": "#7c3aed", "Science Lab": "#0891b2", "Library": "#d97706", "Sports Ground": "#059669", "Auditorium": "#dc2626" };
  const TYPE_ICONS  = { "Classroom": "ti-door", "Computer Lab": "ti-device-desktop", "Science Lab": "ti-flask", "Library": "ti-books", "Sports Ground": "ti-ball-football", "Auditorium": "ti-theater" };
  const uniqueFloors = ["All", ...Array.from(new Set(rooms.map(r => r.floor || "Unassigned"))).sort((a,b) => floorOrder(a) - floorOrder(b))];
  
  const filtered = rooms.filter(r => {
    const typeMatch = selType === "All" || r.type === selType;
    const floorMatch = selFloor === "All" || (r.floor || "Unassigned") === selFloor;
    return typeMatch && floorMatch;
  });

  const groupedRooms = {};
  filtered.forEach(r => {
    const f = r.floor || "Unassigned";
    if (!groupedRooms[f]) groupedRooms[f] = [];
    groupedRooms[f].push(r);
  });
  
  const sortedFloors = Object.keys(groupedRooms).sort((a, b) => floorOrder(a) - floorOrder(b));

  const generateMultiFloorPreview = () => {
    const list = [];
    
    // Ground floor
    if (multiFloorGround && multiFloorGroundRooms > 0) {
      const gRooms = Math.min(100, parseInt(multiFloorGroundRooms) || 0);
      for (let i = 1; i <= gRooms; i++) {
        const numStr = String(i).padStart(2, "0");
        let name = "";
        if (multiFloorPattern === "hyphen") {
          name = multiFloorPrefix.trim() ? `${multiFloorPrefix.trim()} G-${i}` : `G-${i}`;
        } else {
          name = multiFloorPrefix.trim() ? `${multiFloorPrefix.trim()} G${numStr}` : `G${numStr}`;
        }
        list.push({ name, floor: "Ground Floor" });
      }
    }
    
    // Upper floors
    const floorsCount = Math.min(20, parseInt(multiFloorCount) || 0);
    const roomsPerFloor = Math.min(100, parseInt(multiFloorRoomsPerFloor) || 0);
    
    for (let f = 1; f <= floorsCount; f++) {
      const floorName = `${f}${getOrdinalSuffix(f)} Floor`;
      for (let r = 1; r <= roomsPerFloor; r++) {
        const rStr = String(r).padStart(2, "0");
        let name = "";
        if (multiFloorPattern === "hyphen") {
          name = multiFloorPrefix.trim() ? `${multiFloorPrefix.trim()} ${f}-${r}` : `${f}-${r}`;
        } else if (multiFloorPattern === "4digit") {
          const fStr = String(f);
          const numStr = String(r).padStart(3, "0");
          name = multiFloorPrefix.trim() ? `${multiFloorPrefix.trim()} ${fStr}${numStr}` : `${fStr}${numStr}`;
        } else {
          // '3digit'
          name = multiFloorPrefix.trim() ? `${multiFloorPrefix.trim()} ${f}${rStr}` : `${f}${rStr}`;
        }
        list.push({ name, floor: floorName });
      }
    }
    
    return list;
  };

  const addMultiFloor = () => {
    const list = generateMultiFloorPreview();
    if (!list.length) { showToast("No rooms to add", "error"); return; }
    const existing = rooms.map(r => r.name.toLowerCase());
    const toAdd = list.filter(item => !existing.includes(item.name.toLowerCase()));
    if (!toAdd.length) { showToast("All rooms in this floor plan already exist", "error"); return; }
    
    setRooms(p => [
      ...p,
      ...toAdd.map(item => ({
        id: generateId(),
        name: item.name,
        type: multiFloorType,
        capacity: multiFloorCapacity,
        floor: item.floor
      }))
    ]);
    showToast(`Added ${toAdd.length} rooms across ${multiFloorGround ? (parseInt(multiFloorCount) || 0) + 1 : (parseInt(multiFloorCount) || 0)} floors`);
  };

  const rangePreview = () => {
    const count = Math.max(0, rangeEnd - rangeStart + 1);
    if (count <= 0 || count > 500) return [];
    return Array.from({ length: count }, (_, i) => {
      const num = rangeStart + i;
      const numStr = rangePadding ? String(num).padStart(3, "0") : String(num);
      return rangePrefix.trim() ? `${rangePrefix.trim()} ${numStr}` : numStr;
    });
  };

  const addRange = () => {
    const names = rangePreview();
    if (!names.length) { showToast("Invalid range", "error"); return; }
    const existing = rooms.map(r => r.name.toLowerCase());
    const toAdd = names.filter(n => !existing.includes(n.toLowerCase()));
    if (!toAdd.length) { showToast("All rooms in this range already exist", "error"); return; }
    setRooms(p => [...p, ...toAdd.map(name => {
      const detected = detectFloor(name);
      return { 
        id: generateId(), 
        name, 
        type: rangeType, 
        capacity: rangeCapacity,
        floor: detected || "Unassigned"
      };
    })]);
    showToast(`Added ${toAdd.length} rooms (${names[0]} to ${names[names.length - 1]})`);
  };

  const bulkNames = bulkText.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const addBulk = () => {
    if (!bulkNames.length) return;
    const existing = rooms.map(r => r.name.toLowerCase());
    const toAdd = bulkNames.filter(n => !existing.includes(n.toLowerCase()));
    if (!toAdd.length) { showToast("All entered rooms already exist", "error"); return; }
    setRooms(p => [...p, ...toAdd.map(name => {
      let floor = bulkDefaultFloor;
      if (bulkAutoDetect) {
        const detected = detectFloor(name);
        if (detected) floor = detected;
      }
      return { 
        id: generateId(), 
        name, 
        type: bulkType, 
        capacity: bulkCapacity,
        floor: floor || "Unassigned"
      };
    })]);
    setBulkText("");
    showToast(`Added ${toAdd.length} rooms`);
  };

  const saveSingle = () => {
    if (!form.name.trim()) return;
    if (editId) { setRooms(p => p.map(r => r.id === editId ? { ...r, ...form } : r)); setEditId(null); }
    else setRooms(p => [...p, { id: generateId(), ...form }]);
    setForm({ name: "", type: "Classroom", capacity: 40, floor: "Ground Floor" });
    showToast("Room saved");
  };

  const preview = rangePreview();
  const multiPreview = generateMultiFloorPreview();

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: "grid", gridTemplateColumns: "390px 1fr", gap: 24, alignItems: "start" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title={editId ? "Edit Room" : "Add Rooms"} icon={editId ? "ti-edit" : "ti-door"} subtitle={editId ? "Update room details" : "Add rooms by floors, ranges, bulk, or single"}>

            {!editId && (
              <div style={{ display: "flex", gap: 3, marginBottom: 18, background: C.gray50, padding: 3, borderRadius: 10 }}>
                {[["floors","ti-layers","Floors"], ["range","ti-sort-ascending-numbers","Range"], ["bulk","ti-list","Bulk"], ["single","ti-plus","Single"]].map(([tab, icon, label]) => (
                  <button key={tab} onClick={() => setAddTab(tab)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 4px", borderRadius: 8,
                    background: addTab === tab ? C.white : "transparent",
                    border: addTab === tab ? `1px solid ${C.gray200}` : "none",
                    color: addTab === tab ? C.gray800 : C.gray400,
                    fontSize: 12, fontWeight: addTab === tab ? 700 : 500,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: addTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 14 }} /> {label}
                  </button>
                ))}
              </div>
            )}

            {addTab === "floors" && !editId && (
              <div>
                <div style={{ background: C.accentLight, border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: C.primary, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <i className="ti ti-bolt" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                  <span>Configure a <strong>multi-floor building</strong> in one click. Room numbers are generated automatically.</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormRow label="Room Prefix">
                    <input value={multiFloorPrefix} onChange={e => setMultiFloorPrefix(e.target.value)}
                      placeholder="e.g. Room, Class, Lab"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </FormRow>
                  
                  <FormRow label="Numbering Pattern">
                    <select value={multiFloorPattern} onChange={e => setMultiFloorPattern(e.target.value)} style={inputStyle}>
                      <option value="3digit">Floor + 2-digit (e.g. G01, 101)</option>
                      <option value="4digit">Floor + 3-digit (e.g. G001, 1001)</option>
                      <option value="hyphen">Hyphenated (e.g. G-1, 1-1)</option>
                    </select>
                  </FormRow>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: `1px dashed ${C.gray200}`, paddingTop: 12, marginTop: 12 }}>
                  <FormRow label="No. of Upper Floors">
                    <input type="number" min={0} max={20} value={multiFloorCount}
                      onChange={e => setMultiFloorCount(Math.max(0, parseInt(e.target.value) || 0))} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </FormRow>
                  
                  <FormRow label="Rooms per Upper Floor">
                    <input type="number" min={1} max={100} value={multiFloorRoomsPerFloor}
                      onChange={e => setMultiFloorRoomsPerFloor(Math.max(1, parseInt(e.target.value) || 1))} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </FormRow>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: C.gray50, padding: 10, borderRadius: 8, marginBottom: 12, marginTop: 4 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.gray700, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={multiFloorGround} onChange={e => setMultiFloorGround(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: C.accent, cursor: "pointer" }} />
                    Include Ground Floor (Floor 0)
                  </label>

                  {multiFloorGround && (
                    <div style={{ paddingLeft: 23 }}>
                      <FormRow label="Rooms on Ground Floor" style={{ marginBottom: 0 }}>
                        <input type="number" min={1} max={100} value={multiFloorGroundRooms}
                          onChange={e => setMultiFloorGroundRooms(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, padding: "6px 10px" }}
                          onFocus={e => e.target.style.borderColor = C.accent}
                          onBlur={e => e.target.style.borderColor = C.gray200} />
                      </FormRow>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <FormRow label="Default Room Type">
                    <select value={multiFloorType} onChange={e => setMultiFloorType(e.target.value)} style={inputStyle}>
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Default Capacity">
                    <select value={multiFloorCapacity} onChange={e => setMultiFloorCapacity(parseInt(e.target.value))} style={inputStyle}>
                      {[20,25,30,35,40,45,50,60,80,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </FormRow>
                </div>

                {multiPreview.length > 0 && (
                  <div style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      Preview — {multiPreview.length} room{multiPreview.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {multiPreview.slice(0, 8).map((item, idx) => (
                        <span key={idx} style={{ padding: "3px 9px", background: C.accentLight, color: C.accent, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{item.name}</span>
                      ))}
                      {multiPreview.length > 8 && (
                        <span style={{ padding: "3px 9px", background: C.gray100, color: C.gray400, borderRadius: 6, fontSize: 11 }}>+{multiPreview.length - 8} more</span>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={addMultiFloor} disabled={!multiPreview.length}
                  style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: multiPreview.length ? 1 : 0.4, cursor: multiPreview.length ? "pointer" : "not-allowed" }}>
                  <i className="ti ti-bolt" style={{ fontSize: 15 }} />
                  Generate {multiPreview.length > 0 ? `${multiPreview.length} Rooms` : "Rooms"}
                </button>
              </div>
            )}

            {addTab === "range" && !editId && (
              <div>
                <div style={{ background: C.accentLight, border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: C.primary, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <i className="ti ti-bolt" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                  <span>Add <strong>100+ rooms instantly</strong>. Set a prefix and number range — done in seconds.</span>
                </div>

                <FormRow label="Room Name Prefix">
                  <input value={rangePrefix} onChange={e => setRangePrefix(e.target.value)}
                    placeholder="e.g. Room, Lab, Hall, Block-A"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.gray200} />
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 3 }}>Leave blank for numbers only (101, 102…)</div>
                </FormRow>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormRow label="Start No.">
                    <input type="number" min={1} max={9999} value={rangeStart}
                      onChange={e => setRangeStart(parseInt(e.target.value) || 1)} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </FormRow>
                  <FormRow label="End No.">
                    <input type="number" min={1} max={9999} value={rangeEnd}
                      onChange={e => setRangeEnd(parseInt(e.target.value) || 1)} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = C.accent}
                      onBlur={e => e.target.style.borderColor = C.gray200} />
                  </FormRow>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormRow label="Room Type">
                    <select value={rangeType} onChange={e => setRangeType(e.target.value)} style={inputStyle}>
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Capacity">
                    <select value={rangeCapacity} onChange={e => setRangeCapacity(parseInt(e.target.value))} style={inputStyle}>
                      {[20,25,30,35,40,45,50,60,80,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </FormRow>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.gray600, cursor: "pointer", marginBottom: 14, userSelect: "none" }}>
                  <input type="checkbox" checked={rangePadding} onChange={e => setRangePadding(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: C.accent, cursor: "pointer" }} />
                  Zero-pad numbers <span style={{ color: C.gray400 }}>(001, 002…)</span>
                </label>

                {preview.length > 0 && (
                  <div style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      Preview — {preview.length} room{preview.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {preview.slice(0, 6).map(n => (
                        <span key={n} style={{ padding: "3px 9px", background: C.accentLight, color: C.accent, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{n}</span>
                      ))}
                      {preview.length > 6 && (
                        <span style={{ padding: "3px 9px", background: C.gray100, color: C.gray400, borderRadius: 6, fontSize: 11 }}>+{preview.length - 6} more</span>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={addRange} disabled={!preview.length || preview.length > 500}
                  style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: preview.length && preview.length <= 500 ? 1 : 0.4, cursor: preview.length && preview.length <= 500 ? "pointer" : "not-allowed" }}>
                  <i className="ti ti-bolt" style={{ fontSize: 15 }} />
                  Add {preview.length > 0 ? `${preview.length} Rooms` : "Rooms"}
                </button>
              </div>
            )}

            {addTab === "bulk" && !editId && (
              <div>
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#92400e", display: "flex", gap: 8 }}>
                  <i className="ti ti-list" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                  <span>Paste names separated by <strong>commas or new lines</strong>. Great for copying from Excel/spreadsheets.</span>
                </div>

                <FormRow label="Room Names" hint="One per line, or comma-separated">
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                    placeholder={"Lab A, Lab B, Lab C\nRoom 201, Room 202\nAuditorium 1"}
                    rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.gray200} />
                  {bulkNames.length > 0 && (
                    <div style={{ fontSize: 11, color: C.accent, marginTop: 4, fontWeight: 600 }}>
                      {bulkNames.length} room{bulkNames.length !== 1 ? "s" : ""} detected
                    </div>
                  )}
                </FormRow>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
                  <FormRow label="Default Floor">
                    <select value={bulkDefaultFloor} onChange={e => setBulkDefaultFloor(e.target.value)} style={inputStyle}>
                      {FLOORS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </FormRow>
                  <div style={{ display: "flex", alignItems: "center", height: "100%", paddingTop: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.gray700, cursor: "pointer", userSelect: "none" }}>
                      <input type="checkbox" checked={bulkAutoDetect} onChange={e => setBulkAutoDetect(e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: C.accent, cursor: "pointer" }} />
                      Auto-detect floor from names
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FormRow label="Type (all)">
                    <select value={bulkType} onChange={e => setBulkType(e.target.value)} style={inputStyle}>
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Capacity (all)">
                    <select value={bulkCapacity} onChange={e => setBulkCapacity(parseInt(e.target.value))} style={inputStyle}>
                      {[20,25,30,35,40,45,50,60,80,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </FormRow>
                </div>

                <button onClick={addBulk} disabled={!bulkNames.length}
                  style={{ ...btnPrimary, width: "100%", justifyContent: "center", marginTop: 12, opacity: bulkNames.length ? 1 : 0.4, cursor: bulkNames.length ? "pointer" : "not-allowed" }}>
                  <i className="ti ti-plus" style={{ fontSize: 15 }} />
                  Add {bulkNames.length > 0 ? `${bulkNames.length} Rooms` : "Rooms"}
                </button>
              </div>
            )}

            {(addTab === "single" || editId) && (
              <div>
                {editId && (
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#92400e", display: "flex", gap: 7, alignItems: "center" }}>
                    <i className="ti ti-edit" style={{ fontSize: 14 }} /> Editing existing room
                  </div>
                )}
                <FormRow label="Room Name / Number">
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Room 201, Lab A"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.gray200}
                    onKeyDown={e => e.key === "Enter" && saveSingle()} />
                </FormRow>
                <FormRow label="Room Type">
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                    {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Floor">
                  <select value={form.floor || "Ground Floor"} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} style={inputStyle}>
                    {FLOORS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Capacity (Students)">
                  <select value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) }))} style={inputStyle}>
                    {[20,25,30,35,40,45,50,60,80,100,200].map(n => <option key={n} value={n}>{n} students</option>)}
                  </select>
                </FormRow>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={saveSingle} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>
                    <i className={`ti ${editId ? "ti-check" : "ti-plus"}`} style={{ fontSize: 14 }} />
                    {editId ? "Update Room" : "Add Room"}
                  </button>
                  {editId && (
                    <button onClick={() => { setEditId(null); setForm({ name: "", type: "Classroom", capacity: 40, floor: "Ground Floor" }); }} style={btnSecondary}>Cancel</button>
                  )}
                </div>
              </div>
            )}
          </Card>

          {!editId && addTab === "range" && (
            <Card title="Quick Templates" icon="ti-template" subtitle="Click to pre-fill the form above">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Classrooms 101-130",  prefix: "Room",         start: 101, end: 130, type: "Classroom",    cap: 40 },
                  { label: "Computer Labs 1-10",   prefix: "Computer Lab", start: 1,   end: 10,  type: "Computer Lab", cap: 30 },
                  { label: "Science Labs 1-5",     prefix: "Science Lab",  start: 1,   end: 5,   type: "Science Lab",  cap: 25 },
                  { label: "Lecture Halls 1-8",    prefix: "Hall",         start: 1,   end: 8,   type: "Classroom",    cap: 80 },
                  { label: "Seminar Rooms 1-6",    prefix: "Seminar Room", start: 1,   end: 6,   type: "Classroom",    cap: 50 },
                ].map((t, i) => (
                  <button key={i} onClick={() => { setRangePrefix(t.prefix); setRangeStart(t.start); setRangeEnd(t.end); setRangeType(t.type); setRangeCapacity(t.cap); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, cursor: "pointer", fontSize: 12, color: C.gray700, textAlign: "left", fontFamily: "inherit", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.borderColor = C.accent + "40"; e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.gray50; e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.color = C.gray700; }}>
                    <i className={`ti ${TYPE_ICONS[t.type]}`} style={{ fontSize: 14, color: TYPE_COLORS[t.type] }} />
                    <span style={{ fontWeight: 500 }}>{t.label}</span>
                    <i className="ti ti-chevron-right" style={{ fontSize: 11, color: C.gray300, marginLeft: "auto" }} />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card title="Room List" icon="ti-layout-grid"
          subtitle={`${rooms.length} room${rooms.length !== 1 ? "s" : ""} configured`}
          actions={rooms.length > 0 && (
            <button onClick={() => { if (window.confirm(`Remove all ${rooms.length} rooms?`)) { setRooms([]); showToast("All rooms cleared"); } }}
              style={{ fontSize: 11, color: C.danger, background: "#fef2f2", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              Clear All
            </button>
          )}>
          {/* Filters Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {/* Type Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", width: 50 }}>Type:</span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {["All", ...ROOM_TYPES].map(t => {
                  const count = t === "All" ? rooms.length : rooms.filter(r => r.type === t).length;
                  return (
                    <button key={t} onClick={() => setSelType(t)} style={{
                      padding: "4px 10px", borderRadius: 20,
                      border: `1.5px solid ${selType === t ? C.accent : C.gray200}`,
                      background: selType === t ? C.accentLight : "none",
                      color: selType === t ? C.accent : C.gray500,
                      fontSize: 11, fontWeight: selType === t ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {t}
                      {count > 0 && (
                        <span style={{ background: selType === t ? C.accent : C.gray200, color: selType === t ? "#fff" : C.gray500, borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px" }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floor Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${C.gray100}`, paddingTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", width: 50 }}>Floor:</span>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {uniqueFloors.map(f => {
                  const count = f === "All" ? rooms.length : rooms.filter(r => (r.floor || "Unassigned") === f).length;
                  if (count === 0 && f !== "All") return null; // Only show floors that have rooms
                  return (
                    <button key={f} onClick={() => setSelFloor(f)} style={{
                      padding: "4px 10px", borderRadius: 20,
                      border: `1.5px solid ${selFloor === f ? C.accent : C.gray200}`,
                      background: selFloor === f ? C.accentLight : "none",
                      color: selFloor === f ? C.accent : C.gray500,
                      fontSize: 11, fontWeight: selFloor === f ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      {f}
                      {count > 0 && (
                        <span style={{ background: selFloor === f ? C.accent : C.gray200, color: selFloor === f ? "#fff" : C.gray500, borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px" }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {rooms.length === 0 ? (
            <EmptyState icon="ti-door" title="No rooms yet" subtitle="Use the Floor Generator on the left to add 100 rooms in seconds!" />
          ) : filtered.length === 0 ? (
            <EmptyState icon="ti-search" title="No matching rooms" subtitle="No rooms match the selected Type and Floor filters." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {sortedFloors.map(floorName => {
                const floorRooms = groupedRooms[floorName] || [];
                return (
                  <div key={floorName} style={{ borderBottom: `1px dashed ${C.gray100}`, paddingBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.gray700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="ti ti-layers" style={{ color: C.accent, fontSize: 14 }} />
                      {floorName}
                      <span style={{ fontSize: 11, color: C.gray400, fontWeight: 500 }}>({floorRooms.length} room{floorRooms.length !== 1 ? "s" : ""})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
                      {floorRooms.map(r => {
                        const color = TYPE_COLORS[r.type] || C.gray500;
                        return (
                          <div key={r.id} style={{ background: C.white, border: `1.5px solid ${color}22`, borderRadius: 11, padding: "12px 14px", transition: "transform 0.15s, box-shadow 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                              <div style={{ width: 26, height: 26, borderRadius: 7, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <i className={`ti ${TYPE_ICONS[r.type] || "ti-door"}`} style={{ color, fontSize: 13 }} />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 12, color: C.gray800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</span>
                            </div>
                            <div style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 1 }}>{r.type}</div>
                            <div style={{ fontSize: 10, color: C.gray400, marginBottom: 8 }}>Capacity: {r.capacity}</div>
                            <div style={{ display: "flex", gap: 5 }}>
                              <button onClick={() => { setForm({ name: r.name, type: r.type, capacity: r.capacity, floor: r.floor || "Unassigned" }); setEditId(r.id); setAddTab("single"); }}
                                style={{ flex: 1, fontSize: 10, color: C.accent, background: C.accentLight, border: "none", borderRadius: 5, padding: "4px 0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                                Edit
                              </button>
                              <button onClick={() => { setRooms(p => p.filter(x => x.id !== r.id)); showToast("Room removed"); }}
                                style={{ flex: 1, fontSize: 10, color: C.danger, background: "#fef2f2", border: "none", borderRadius: 5, padding: "4px 0", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
// ─── RULES PAGE ───────────────────────────────────────────────────────────────
function RulesPage({ rules, setRules }) {
  const toggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };
  return (
    <div style={{ maxWidth: 760 }}>
      <Card title="Scheduling Rules" icon="ti-list-check" subtitle="Configure constraints for automatic timetable generation">
        {rules.map((r, i) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            padding: "14px 0",
            borderBottom: i < rules.length - 1 ? `1px solid ${C.gray100}` : "none",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: r.enabled ? C.accentLight : C.gray100,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`ti ${r.icon}`} style={{ fontSize: 18, color: r.enabled ? C.accent : C.gray400 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.gray800, marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.gray400 }}>{r.desc}</div>
            </div>
            <button onClick={() => toggleRule(r.id)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: r.enabled ? C.accent : C.gray200,
                border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
                transition: "all 0.2s", marginTop: 8,
              }}>
              <div style={{
                position: "absolute", top: 3, left: r.enabled ? 22 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── EXPORT PAGE ──────────────────────────────────────────────────────────────
function ExportPage({ generatedTT, standards, subjects, teachers, showToast }) {
  const [exportType, setExportType] = useState("class");
  const [selId, setSelId] = useState("");
  useEffect(() => {
    if (exportType === "class" && standards.length > 0) setSelId(`${standards[0].id}_${standards[0].sections[0]?.id}`);
    else if (exportType === "teacher" && teachers.length > 0) setSelId(teachers[0].id);
  }, [exportType]);

  const handleCSV = () => {
    if (!generatedTT) { showToast("Generate a timetable first", "error"); return; }
    const { timetable, teacherSchedule, days, periods } = generatedTT;
    let csv = "";
    if (exportType === "class" && selId) {
      const tt = timetable[selId]; if (!tt) return;
      csv = ["Period", "Time", ...days].join(",") + "\n";
      periods.forEach(p => { const row = [`Period ${p.num}`, `${p.start}-${p.end}`]; days.forEach(d => { const cell = tt[d]?.[p.num]; row.push(cell ? `${cell.subject.name} (${cell.teacher?.name || ""})` : "Free"); }); csv += row.map(v => `"${v}"`).join(",") + "\n"; });
    } else if (exportType === "teacher" && selId) {
      const ts = teacherSchedule[selId]; if (!ts) return;
      csv = ["Period", ...days].join(",") + "\n";
      periods.forEach(p => { const row = [`Period ${p.num}`]; days.forEach(d => { const cell = ts[d]?.[p.num]; const sub = subjects.find(s => s.id === cell?.subject?.id) || cell?.subject; row.push(cell ? `${sub?.name || ""} (${cell.class?.name}-${cell.section?.name})` : "Free"); }); csv += row.map(v => `"${v}"`).join(",") + "\n"; });
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "timetable.csv"; a.click();
    showToast("CSV exported successfully!");
  };

  const classTabs = []; standards.forEach(std => std.sections.forEach(sec => classTabs.push({ id: `${std.id}_${sec.id}`, label: `${std.name} – ${sec.name}` })));

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="Export Timetable" icon="ti-file-export" subtitle="Download or print your generated schedules" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: C.gray50, padding: 4, borderRadius: 10, width: "fit-content" }}>
          {[["class", "Class-wise"], ["teacher", "Teacher-wise"]].map(([v, l]) => (
            <button key={v} onClick={() => setExportType(v)} style={{
              padding: "7px 18px", borderRadius: 7,
              background: exportType === v ? C.white : "transparent",
              border: exportType === v ? `1px solid ${C.gray200}` : "none",
              color: exportType === v ? C.gray800 : C.gray500,
              fontSize: 13, fontWeight: exportType === v ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: exportType === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>{l}</button>
          ))}
        </div>
        <FormRow label={exportType === "class" ? "Select Class & Section" : "Select Teacher"}>
          <select value={selId} onChange={e => setSelId(e.target.value)} style={inputStyle}>
            {exportType === "class" ? classTabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>) : teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormRow>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={handleCSV} style={btnPrimary}>
            <i className="ti ti-file-text" style={{ fontSize: 15 }} /> Export as CSV
          </button>
          <button onClick={() => { window.print(); showToast("Print dialog opened"); }} style={btnSecondary}>
            <i className="ti ti-printer" style={{ fontSize: 15 }} /> Print / PDF
          </button>
        </div>
      </Card>

      {generatedTT && (
        <Card title="Summary Statistics" icon="ti-chart-bar">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[
              ["Total Classes", standards.reduce((a, s) => a + s.sections.length, 0)],
              ["Total Teachers", teachers.length],
              ["Total Subjects", subjects.length],
              ["Working Days", generatedTT.days.length],
              ["Periods per Day", generatedTT.periods.length],
              ["Weekly Periods", subjects.reduce((a, s) => a + (parseInt(s.periodsPerWeek) || 0), 0)],
            ].map(([k, v]) => (
              <div key={k} style={{ background: C.gray50, borderRadius: 10, padding: "16px 18px", border: `1px solid ${C.gray200}` }}>
                <div style={{ fontSize: 11, color: C.gray400, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.gray900 }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!generatedTT && (
        <EmptyState icon="ti-file-off" title="No timetable generated yet" subtitle="Go to the dashboard and click 'Generate Timetable' first." />
      )}
    </div>
  );
}

function ExcelImportWizard({ isOpen, onClose, standards, setStandards, subjects, setSubjects, teachers, setTeachers, rooms, setRooms, showToast }) {
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState("standards"); // "standards" | "subjects" | "teachers" | "rooms"
  const [activeInputTab, setActiveInputTab] = useState("file"); // "file" | "paste"
  const [pastedText, setPastedText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedData, setParsedData] = useState({ headers: [], rows: [] });
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fields = FIELD_DEFINITIONS[importType] || [];

  const resetWizard = () => {
    setStep(1);
    setPastedText("");
    setFileName("");
    setParsedData({ headers: [], rows: [] });
    setMapping({});
    setErrorMsg("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg("");
    try {
      const res = await parseExcelFile(file);
      setParsedData(res);
      const autoMap = autoMapFields(res.headers, importType);
      setMapping(autoMap);
      setStep(3); // proceed to mapping
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to parse Excel/CSV file: " + err.message);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg("Please paste some data first.");
      return;
    }
    setErrorMsg("");
    try {
      const res = parseTSVData(pastedText);
      if (!res.headers.length) {
        setErrorMsg("Failed to parse data. Make sure it contains header columns.");
        return;
      }
      setParsedData(res);
      const autoMap = autoMapFields(res.headers, importType);
      setMapping(autoMap);
      setStep(3); // proceed to mapping
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to parse pasted text: " + err.message);
    }
  };

  const executeImport = () => {
    setImporting(true);
    try {
      const rows = parsedData.rows;
      let addedCount = 0;
      let skipCount = 0;

      if (importType === "standards") {
        const existingNames = standards.map(s => s.name.toLowerCase());
        const newStandards = [];

        rows.forEach(row => {
          const rawName = row[mapping.name] || "";
          if (!rawName.trim()) return;

          const name = rawName.trim();
          if (existingNames.includes(name.toLowerCase())) {
            skipCount++;
            return;
          }

          const rawSections = row[mapping.sections] || "";
          const sectionsList = rawSections
            ? rawSections.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
            : ["A"];

          const sectionObjects = sectionsList.map(secName => ({
            id: generateId(),
            name: secName
          }));

          newStandards.push({
            id: generateId(),
            name,
            sections: sectionObjects
          });
          existingNames.push(name.toLowerCase());
          addedCount++;
        });

        if (newStandards.length > 0) {
          setStandards(prev => [...prev, ...newStandards]);
        }

      } else if (importType === "teachers") {
        const existingNames = teachers.map(t => t.name.toLowerCase());
        const newTeachers = [];

        rows.forEach(row => {
          const rawName = row[mapping.name] || "";
          if (!rawName.trim()) return;

          const name = rawName.trim();
          if (existingNames.includes(name.toLowerCase())) {
            skipCount++;
            return;
          }

          const code = (row[mapping.code] || "").trim();
          const dailyLimit = (row[mapping.dailyLimit] || "6").trim();
          const weeklyLimit = (row[mapping.weeklyLimit] || "30").trim();

          newTeachers.push({
            id: generateId(),
            name,
            code,
            dailyLimit: String(parseInt(dailyLimit) || 6),
            weeklyLimit: String(parseInt(weeklyLimit) || 30),
            assignments: []
          });
          existingNames.push(name.toLowerCase());
          addedCount++;
        });

        if (newTeachers.length > 0) {
          setTeachers(prev => [...prev, ...newTeachers]);
        }

      } else if (importType === "rooms") {
        const existingNames = rooms.map(r => r.name.toLowerCase());
        const newRooms = [];

        rows.forEach(row => {
          const rawName = row[mapping.name] || "";
          if (!rawName.trim()) return;

          const name = rawName.trim();
          if (existingNames.includes(name.toLowerCase())) {
            skipCount++;
            return;
          }

          const type = (row[mapping.type] || "Classroom").trim();
          const capacity = parseInt(row[mapping.capacity]) || 40;
          const rawFloor = (row[mapping.floor] || "").trim();
          
          let floor = rawFloor || "Ground Floor";
          const detected = detectFloor(name);
          if (!rawFloor && detected) floor = detected;

          newRooms.push({
            id: generateId(),
            name,
            type: ROOM_TYPES.includes(type) ? type : "Classroom",
            capacity,
            floor
          });
          existingNames.push(name.toLowerCase());
          addedCount++;
        });

        if (newRooms.length > 0) {
          setRooms(prev => [...prev, ...newRooms]);
        }

      } else if (importType === "subjects") {
        const newSubjects = [];
        const currentStandards = [...standards];

        rows.forEach(row => {
          const rawStdName = row[mapping.standardName] || "";
          const rawSubjName = row[mapping.name] || "";
          if (!rawStdName.trim() || !rawSubjName.trim()) return;

          const stdName = rawStdName.trim();
          const subjName = rawSubjName.trim();

          // Find or create standard
          let std = currentStandards.find(s => s.name.toLowerCase() === stdName.toLowerCase());
          if (!std) {
            std = {
              id: generateId(),
              name: stdName,
              sections: [{ id: generateId(), name: "A" }]
            };
            currentStandards.push(std);
          }

          const type = (row[mapping.type] || "Theory").trim();
          const periodsPerWeek = parseInt(row[mapping.periodsPerWeek]) || 4;
          const roomType = (row[mapping.roomType] || "Classroom").trim();
          const rawHasLab = (row[mapping.hasLab] || "").toLowerCase();
          const hasLab = rawHasLab === "yes" || rawHasLab === "true" || rawHasLab === "y" || rawHasLab === "1";
          const labPeriodsPerWeek = parseInt(row[mapping.labPeriodsPerWeek]) || 2;
          const labRoomType = (row[mapping.labRoomType] || "Science Lab").trim();

          newSubjects.push({
            id: generateId(),
            standardId: std.id,
            name: subjName,
            type: SUBJECT_TYPES.includes(type) ? type : "Theory",
            periodsPerWeek,
            roomType: ROOM_TYPES.includes(roomType) ? roomType : "Classroom",
            hasLab,
            labPeriodsPerWeek,
            labRoomType: ROOM_TYPES.includes(labRoomType) ? labRoomType : "Science Lab"
          });
          addedCount++;
        });

        // Save auto-created standards if any
        if (currentStandards.length > standards.length) {
          setStandards(currentStandards);
        }

        if (newSubjects.length > 0) {
          setSubjects(prev => [...prev, ...newSubjects]);
        }
      }

      showToast(`🎉 Imported ${addedCount} items successfully! (${skipCount} duplicates skipped)`);
      onClose();
      resetWizard();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed during import insertion: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9990 }}>
      <div style={{ background:C.white, borderRadius:16, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
        
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.gray100}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h3 style={{ fontSize:15, fontWeight:800, color:C.gray900, display:"flex", alignItems:"center", gap:8 }}>
              <i className="ti ti-file-spreadsheet" style={{ fontSize:18, color:C.accent }} /> Excel / CSV Import Wizard
            </h3>
            <p style={{ fontSize:11, color:C.gray400, marginTop:2 }}>Import bulk school schedule data from spreadsheet files</p>
          </div>
          <button onClick={() => { onClose(); resetWizard(); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.gray400, fontSize:18 }}>✕</button>
        </div>

        {/* Steps indicator */}
        <div style={{ background:C.gray50, padding:"12px 24px", borderBottom:`1px solid ${C.gray100}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          {[
            { num:1, label:"Data Type" },
            { num:2, label:"Upload/Paste" },
            { num:3, label:"Map Columns" },
            { num:4, label:"Preview" }
          ].map(s => {
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <div key={s.num} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{
                  width:22, height:22, borderRadius:"50%",
                  background: isCompleted ? C.success : isActive ? C.accent : C.gray200,
                  color:"#fff", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {isCompleted ? "✓" : s.num}
                </div>
                <span style={{ fontSize:11, fontWeight: isActive ? 700 : 500, color: isActive ? C.gray800 : C.gray400 }}>{s.label}</span>
                {s.num < 4 && <div style={{ width:30, height:1, background:C.gray200, marginLeft:6 }} />}
              </div>
            );
          })}
        </div>

        {/* Body Container */}
        <div style={{ padding:24, flex:1, overflowY:"auto" }}>
          {errorMsg && (
            <div style={{ padding:"10px 14px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, color:C.danger, fontSize:12, marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
              <i className="ti ti-alert-triangle" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Choose Import Type */}
          {step === 1 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.gray500, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.04em" }}>Select what you want to import:</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { id:"standards", icon:"ti-books", title:"Classes & Sections", desc:"Import standards name and their division list (e.g. Class 10: A, B, C)" },
                  { id:"teachers", icon:"ti-users", title:"Teachers List", desc:"Import teacher names, employee codes, and daily/weekly workload limits" },
                  { id:"rooms", icon:"ti-door", title:"Rooms & Labs", desc:"Import room names, room types (e.g. Science Lab), capacity, and floors" },
                  { id:"subjects", icon:"ti-notebook", title:"Subjects List", desc:"Import standard-wise subjects, class names, periods/week, and lab components" }
                ].map(opt => {
                  const isSelected = importType === opt.id;
                  return (
                    <div key={opt.id} onClick={() => setImportType(opt.id)} style={{
                      padding:16, borderRadius:12, border: `2px solid ${isSelected ? C.accent : C.gray200}`,
                      background: isSelected ? C.accentLight : C.white, cursor:"pointer",
                      transition:"all 0.12s"
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <div style={{
                          width:32, height:32, borderRadius:8,
                          background: isSelected ? C.accent : C.gray100,
                          color: isSelected ? "#fff" : C.gray500,
                          display:"flex", alignItems:"center", justifyContent:"center"
                        }}>
                          <i className={`ti ${opt.icon}`} style={{ fontSize:16 }} />
                        </div>
                        <span style={{ fontSize:13, fontWeight:700, color: isSelected ? C.accent : C.gray800 }}>{opt.title}</span>
                      </div>
                      <p style={{ fontSize:11, color:C.gray400, lineHeight:1.4 }}>{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: File Upload or Paste */}
          {step === 2 && (
            <div>
              {/* Tab selector */}
              <div style={{ display:"flex", gap:4, background:C.gray50, padding:3, borderRadius:9, width:"fit-content", marginBottom:16 }}>
                {[["file", "ti-upload", "Upload Spreadsheet"], ["paste", "ti-copy", "Copy & Paste Cells"]].map(([tab, icon, label]) => (
                  <button key={tab} onClick={() => setActiveInputTab(tab)} style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"6px 14px", borderRadius:7,
                    background: activeInputTab === tab ? C.white : "transparent",
                    border: activeInputTab === tab ? `1px solid ${C.gray200}` : "none",
                    color: activeInputTab === tab ? C.gray800 : C.gray500,
                    fontSize:12, fontWeight: activeInputTab === tab ? 600 : 400,
                    cursor:"pointer", fontFamily:"inherit"
                  }}>
                    <i className={`ti ${icon}`} style={{ fontSize:13 }} /> {label}
                  </button>
                ))}
              </div>

              {activeInputTab === "file" ? (
                // File Upload panel
                <div style={{
                  border:`2px dashed ${C.gray200}`, borderRadius:12,
                  padding:"40px 20px", textAlign:"center", background:C.gray50,
                  position:"relative", cursor:"pointer"
                }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{
                    position:"absolute", inset:0, opacity:0, cursor:"pointer"
                  }} />
                  <i className="ti ti-cloud-upload" style={{ fontSize:36, color:C.gray300, display:"block", marginBottom:10 }} />
                  <span style={{ fontSize:13, fontWeight:700, color:C.gray700, display:"block" }}>Upload an Excel or CSV file</span>
                  <span style={{ fontSize:11, color:C.gray400, marginTop:4, display:"block" }}>Supports .xlsx, .xls, and .csv files</span>
                </div>
              ) : (
                // Copy Paste panel
                <div>
                  <div style={{ fontSize:11, color:C.gray400, marginBottom:8 }}>
                    💡 Select and copy cells from Excel or Google Sheets (including headers), then paste them below:
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Class Name&#9;Sections&#10;Class 11 Science&#9;A,B,C&#10;Class 11 Commerce&#9;A,B"
                    style={{
                      width:"100%", height:160, padding:12, border:`1.5px solid ${C.gray200}`,
                      borderRadius:10, fontSize:12, fontFamily:"monospace", outline:"none",
                      background:C.white, color:C.gray800
                    }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.gray200}
                  />
                  <button onClick={handlePasteSubmit} style={{ ...btnPrimary, marginTop:12, width:"100%", justifyContent:"center" }}>
                    Continue to Column Mapping
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Column Mapping */}
          {step === 3 && (
            <div>
              <div style={{ fontSize:11, color:C.gray400, marginBottom:14 }}>
                Map the required fields of <strong>{importType.toUpperCase()}</strong> to the columns detected in your Excel sheet.
              </div>
              <div style={{ display:"grid", gap:12, background:C.gray50, border:`1px solid ${C.gray200}`, borderRadius:12, padding:16 }}>
                {fields.map(field => (
                  <div key={field.key} style={{ display:"grid", gridTemplateColumns:"2fr 3fr", gap:16, alignItems:"center" }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.gray700 }}>
                      {field.label} {field.required && <span style={{ color:C.danger }}>*</span>}
                    </div>
                    <select
                      value={mapping[field.key] || ""}
                      onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ ...inp, fontSize:12 }}
                    >
                      <option value="">-- Choose Excel Column --</option>
                      {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  // Verify required mapping fields are mapped
                  const missing = fields.filter(f => f.required && !mapping[f.key]);
                  if (missing.length > 0) {
                    setErrorMsg(`Please map the required field: ${missing[0].label}`);
                    return;
                  }
                  setErrorMsg("");
                  setStep(4); // proceed to preview
                }}
                style={{ ...btnPrimary, marginTop:16, width:"100%", justifyContent:"center" }}
              >
                Preview Mapped Data
              </button>
            </div>
          )}

          {/* STEP 4: Preview & Confirm */}
          {step === 4 && (
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:C.gray700, marginBottom:10 }}>
                Parsed Rows Preview (First 5 records):
              </div>
              
              <div style={{ overflowX:"auto", border:`1px solid ${C.gray200}`, borderRadius:10, marginBottom:16 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr style={{ background:C.gray50, borderBottom:`1px solid ${C.gray200}` }}>
                      {fields.map(f => (
                        <th key={f.key} style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, color:C.gray600 }}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom:`1px solid ${C.gray100}` }}>
                        {fields.map(f => {
                          const colName = mapping[f.key];
                          return (
                            <td key={f.key} style={{ padding:"8px 12px", color:C.gray800 }}>
                              {colName ? row[colName] : <em style={{ color:C.gray300 }}>[unmapped]</em>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background:C.accentLight, borderRadius:10, padding:"12px 16px", marginBottom:20, border:`1px solid ${C.accent}20` }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.primary, display:"flex", alignItems:"center", gap:8 }}>
                  <i className="ti ti-info-circle" /> Ready to Import
                </div>
                <p style={{ fontSize:11, color:C.primary, marginTop:4, lineHeight:1.4 }}>
                  The spreadsheet contains <strong>{parsedData.rows.length} rows</strong>. Existing duplicates in your current list will be automatically skipped to prevent conflicts.
                </p>
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setStep(3)} style={btnSecondary}>Back</button>
                <button onClick={executeImport} disabled={importing} style={{ ...btnPrimary, flex:1, justifyContent:"center" }}>
                  {importing ? "Importing..." : `Confirm & Import ${parsedData.rows.length} Records`}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {step > 1 && (
          <div style={{ padding:"14px 24px", borderTop:`1px solid ${C.gray100}`, background:C.gray50, display:"flex", justifyContent:"flex-end" }}>
            <button onClick={() => {
              setErrorMsg("");
              if (step === 3) setStep(2);
              else if (step === 4) setStep(3);
            }} style={{ ...btnSecondary, padding:"6px 14px", fontSize:11 }}>Back to Step {step - 1}</button>
          </div>
        )}

      </div>
    </div>
  );
}

import { useState } from "react";
import { completeSetup } from "./db";
import { useAuth } from "./AuthContext";

const C = {
  primary: "#1a4b8c",
  primaryLight: "#e8f0fc",
  accent: "#2563eb",
  success: "#16a34a",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray300: "#cbd5e1",
  gray400: "#94a3b8",
  gray500: "#64748b",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1e293b",
  white: "#ffffff",
};

const inp = {
  width: "100%",
  padding: "10px 14px",
  border: `1.5px solid ${C.gray200}`,
  borderRadius: 8,
  fontSize: 14,
  color: C.gray800,
  background: C.white,
  outline: "none",
  fontFamily: "inherit",
};

const initialInstitute = {
  name: "",
  type: "School",
  academicYear: "2025-2026",
  workingDays: 5,
  periodsPerDay: 8,
  periodDuration: 45,
  startTime: "08:00",
  endTime: "15:30",
  breakStart: "10:30",
  breakEnd: "10:45",
  lunchStart: "13:00",
  lunchEnd: "13:45",
};

export default function SetupWizard({ onComplete }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [institute, setInstitute] = useState({ ...initialInstitute });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upd = (k, v) => setInstitute(p => ({ ...p, [k]: v }));

  const steps = [
    { num: 1, label: "Institution Details" },
    { num: 2, label: "Schedule Config" },
    { num: 3, label: "All Set!" },
  ];

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    try {
      await completeSetup(user.uid, institute);
      onComplete(institute);
    } catch (e) {
      setError("Failed to save. Please check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fc 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Inter', sans-serif",
    }}>
      <div className="setup-inner" style={{ width: "100%", maxWidth: 620 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
              <i className="ti ti-calendar-stats" style={{ fontSize: 22, color: "#fff" }} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.gray800 }}>TimeTable Pro</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.gray800, marginBottom: 6 }}>
            {step < 3 ? "Set up your institution" : "You're all set! 🎉"}
          </div>
          <div style={{ fontSize: 14, color: C.gray500 }}>
            {step < 3
              ? "This only takes a minute. Your private dashboard will be ready instantly."
              : "Your private institution dashboard has been created."}
          </div>
        </div>

        {/* Step indicator */}
        <div className="stepper-indicator" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 32 }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: step > s.num ? C.success : step === s.num ? C.accent : C.gray200,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s",
                  boxShadow: step === s.num ? "0 0 0 4px rgba(37,99,235,0.18)" : "none",
                }}>
                  {step > s.num
                    ? <i className="ti ti-check" style={{ fontSize: 16, color: "#fff" }} />
                    : <span style={{ fontSize: 13, fontWeight: 700, color: step === s.num ? "#fff" : C.gray400 }}>{s.num}</span>}
                </div>
                <span style={{ fontSize: 11, color: step === s.num ? C.accent : C.gray400, fontWeight: step === s.num ? 600 : 400, whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="stepper-line" style={{ width: 80, height: 2, background: step > s.num ? C.success : C.gray200, margin: "0 4px", marginBottom: 20, transition: "all 0.3s" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="setup-card" style={{ background: C.white, borderRadius: 16, padding: "32px 36px", boxShadow: "0 8px 30px rgba(0,0,0,0.08)", border: `1px solid ${C.gray200}` }}>

          {/* STEP 1 — Institution Details */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gray800, marginBottom: 20 }}>
                <i className="ti ti-building-school" style={{ marginRight: 8, color: C.accent }} />
                Institution Details
              </div>
              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 6 }}>Institution Name *</label>
                  <input value={institute.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. St. Mary's High School" style={inp} />
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 4 }}>This will appear on all your timetables and reports.</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 6 }}>Institution Type *</label>
                    <select value={institute.type} onChange={e => upd("type", e.target.value)} style={inp}>
                      {["School", "College", "Coaching Institute", "University", "Polytechnic"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 6 }}>Academic Year *</label>
                    <select value={institute.academicYear} onChange={e => upd("academicYear", e.target.value)} style={inp}>
                      {["2024-2025", "2025-2026", "2026-2027", "2027-2028"].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Schedule Config */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gray800, marginBottom: 20 }}>
                <i className="ti ti-clock" style={{ marginRight: 8, color: C.accent }} />
                Schedule Configuration
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "Working Days / Week", key: "workingDays", opts: [5, 6].map(d => ({ v: d, l: `${d} Days` })), type: "select" },
                  { label: "Periods per Day", key: "periodsPerDay", opts: [6,7,8,9,10].map(d => ({ v: d, l: `${d} Periods` })), type: "select" },
                  { label: "Period Duration", key: "periodDuration", opts: [35,40,45,50,55,60].map(d => ({ v: d, l: `${d} min` })), type: "select" },
                  { label: "School Start Time", key: "startTime", type: "time" },
                  { label: "Short Break Start", key: "breakStart", type: "time" },
                  { label: "Short Break End", key: "breakEnd", type: "time" },
                  { label: "Lunch Break Start", key: "lunchStart", type: "time" },
                  { label: "Lunch Break End", key: "lunchEnd", type: "time" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray600, marginBottom: 6 }}>{f.label}</label>
                    {f.type === "select" ? (
                      <select value={institute[f.key]} onChange={e => upd(f.key, parseInt(e.target.value) || e.target.value)} style={inp}>
                        {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : (
                      <input type="time" value={institute[f.key]} onChange={e => upd(f.key, e.target.value)} style={inp} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 — Done */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎓</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.gray800, marginBottom: 10 }}>
                Welcome, {institute.name}!
              </div>
              <div style={{ fontSize: 14, color: C.gray500, lineHeight: 1.7, marginBottom: 28 }}>
                Your private institution dashboard is ready. Start by adding your classes, subjects, and teachers. Then generate your first timetable in seconds.
              </div>

              {/* Summary */}
              <div style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 10, padding: "16px 20px", textAlign: "left", marginBottom: 20 }}>
                {[
                  ["Institution", institute.name],
                  ["Type", institute.type],
                  ["Academic Year", institute.academicYear],
                  ["Working Days", `${institute.workingDays} days/week`],
                  ["Periods/Day", `${institute.periodsPerDay} × ${institute.periodDuration} min`],
                  ["School Hours", `${institute.startTime} – ${institute.endTime || "—"}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <span style={{ color: C.gray500 }}>{k}</span>
                    <span style={{ color: C.gray800, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#15803d" }}>
                <i className="ti ti-shield-check" style={{ fontSize: 16 }} />
                Data saved privately to your account. Only you can access this dashboard.
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", display: "flex", gap: 8 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 16 }} />
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || saving}
              style={{
                padding: "10px 20px", border: `1px solid ${C.gray200}`, borderRadius: 9,
                background: "none", color: C.gray600, fontSize: 13, fontWeight: 500, cursor: step === 1 ? "not-allowed" : "pointer",
                fontFamily: "inherit", opacity: step === 1 ? 0.4 : 1, display: "flex", alignItems: "center", gap: 6,
              }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Back
            </button>

            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1 && !institute.name.trim()) { setError("Please enter your institution name."); return; }
                  setError("");
                  setStep(s => s + 1);
                }}
                style={{
                  padding: "10px 28px", border: "none", borderRadius: 9, background: C.accent, color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 2px 10px rgba(37,99,235,0.3)", display: "flex", alignItems: "center", gap: 6,
                }}>
                Continue <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                style={{
                  padding: "11px 32px", border: "none", borderRadius: 9, background: C.success, color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                  boxShadow: "0 2px 10px rgba(22,163,74,0.3)", display: "flex", alignItems: "center", gap: 6,
                  opacity: saving ? 0.75 : 1,
                }}>
                {saving
                  ? <><i className="ti ti-loader-2" style={{ fontSize: 15 }} /> Saving…</>
                  : <><i className="ti ti-rocket" style={{ fontSize: 15 }} /> Launch My Dashboard</>
                }
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "rgba(100,116,139,0.7)" }}>
          Logged in as <strong>{user?.email}</strong> · Your data is private and secure.
        </div>
      </div>
    </div>
  );
}

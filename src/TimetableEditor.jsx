import { useState, useRef, useCallback } from "react";
import { computePeriods, DAYS, PERIOD_COLORS, validateDrop, applySwap, validateFullTimetable, resolveTimetableConflicts } from "./timetableEngine";

const C = {
  accent:"#2563eb", primary:"#1a4b8c", success:"#16a34a", danger:"#dc2626",
  warning:"#d97706", gray50:"#f8fafc", gray100:"#f1f5f9", gray200:"#e2e8f0",
  gray300:"#cbd5e1", gray400:"#94a3b8", gray500:"#64748b", gray600:"#475569",
  gray700:"#334155", gray800:"#1e293b", white:"#ffffff",
};

function subjectColor(subjectId, subjects) {
  const idx = subjects.findIndex(s => s.id === subjectId);
  return PERIOD_COLORS[idx % PERIOD_COLORS.length] || "#f1f5f9";
}

export default function TimetableEditor({
  generatedTT, setGeneratedTT, standards, subjects, teachers, rooms, institute,
  handleGenerate, showToast, activeView, setActiveView, rules,
}) {
  const [ttHistory, setTtHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dropError, setDropError] = useState(null);
  const [editCell, setEditCell] = useState(null); // { classKey, day, periodNum, cell }
  const [validation, setValidation] = useState(null);
  const [viewMode, setViewMode] = useState("class"); // "class" | "teacher"
  const [selTeacherId, setSelTeacherId] = useState(teachers[0]?.id || "");
  const dragRef = useRef(null);

  if (!generatedTT) {
    return (
      <div style={{ textAlign:"center", padding:60 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📅</div>
        <div style={{ fontSize:18, fontWeight:700, color:C.gray700, marginBottom:8 }}>No Timetable Generated Yet</div>
        <div style={{ fontSize:14, color:C.gray400, marginBottom:24 }}>Generate a timetable first to view and edit it.</div>
        <button onClick={handleGenerate}
          style={{ padding:"12px 28px", borderRadius:10, border:"none", background:C.accent, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:14, boxShadow:"0 4px 12px rgba(37,99,235,0.3)" }}>
          <i className="ti ti-wand" style={{ marginRight:8 }} />Generate Timetable
        </button>
      </div>
    );
  }

  const days = DAYS.slice(0, institute.workingDays);
  const allPeriods = computePeriods(institute);
  const periodSlots = allPeriods.filter(p => p.type === "period");

  const selStdId = activeView.stdId;
  const selSecId = activeView.secId;
  const classKey = selStdId && selSecId ? `${selStdId}_${selSecId}` : null;
  const classTT = classKey ? generatedTT.timetable[classKey] : null;
  const selStd = standards.find(s => s.id === selStdId);
  const selSec = selStd?.sections.find(s => s.id === selSecId);
  const selTeacher = teachers.find(t => t.id === selTeacherId);

  // ── History helpers ──────────────────────────────────────────────────────
  const pushHistory = useCallback((newState) => {
    const base = ttHistory.slice(0, historyIdx + 1);
    const next = [...base, newState].slice(-20);
    setTtHistory(next);
    setHistoryIdx(next.length - 1);
    setGeneratedTT(newState);
  }, [ttHistory, historyIdx]);

  const undo = () => {
    if (historyIdx <= 0) return;
    const prev = ttHistory[historyIdx - 1];
    setHistoryIdx(h => h - 1);
    setGeneratedTT(prev);
    showToast("Undo successful", "info");
  };
  const redo = () => {
    if (historyIdx >= ttHistory.length - 1) return;
    const next = ttHistory[historyIdx + 1];
    setHistoryIdx(h => h + 1);
    setGeneratedTT(next);
    showToast("Redo successful", "info");
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragStart = (e, ck, day, periodNum) => {
    dragRef.current = { classKey: ck, day, periodNum };
    setDragSrc({ classKey: ck, day, periodNum });
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", "");
    } catch (err) {}
  };
  const handleDragOver = (e, ck, day, periodNum) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver({ classKey: ck, day, periodNum });
  };
  const handleDragLeave = () => setDragOver(null);
  const handleDragEnd = () => {
    setDragSrc(null);
    setDragOver(null);
    setTimeout(() => {
      dragRef.current = null;
    }, 100);
  };

  const handleDrop = (e, tgtKey, tgtDay, tgtPeriod) => {
    e.preventDefault();
    const src = dragRef.current;
    setDragSrc(null); setDragOver(null); dragRef.current = null;
    if (!src) return;
    if (src.classKey === tgtKey && src.day === tgtDay && src.periodNum === tgtPeriod) return;

    let newState = applySwap(generatedTT, src, { classKey: tgtKey, day: tgtDay, periodNum: tgtPeriod });
    
    // Automatically adjust conflicts
    const lockedKey = `${tgtKey}_${tgtDay}_${tgtPeriod}`;
    newState = resolveTimetableConflicts(newState, standards, lockedKey);

    pushHistory(newState);
    showToast("Period moved and timetable adjusted successfully ✓");
  };

  // ── Validate full timetable ──────────────────────────────────────────────
  const runValidation = () => {
    const result = validateFullTimetable(generatedTT, standards, subjects, teachers, rules);
    setValidation(result);
  };

  // ── Edit cell ────────────────────────────────────────────────────────────
  const openEditCell = (ck, day, periodNum) => {
    const cell = generatedTT.timetable[ck]?.[day]?.[periodNum];
    setEditCell({ classKey: ck, day, periodNum, cell: cell ? { ...cell } : null });
  };

  const saveEditCell = (newSubject, newTeacher) => {
    if (!editCell) return;
    const { classKey: ck, day, periodNum } = editCell;
    let newState = JSON.parse(JSON.stringify(generatedTT));
    const oldCell = newState.timetable[ck]?.[day]?.[periodNum];

    // Clear old teacher slot
    if (oldCell?.teacher && newState.teacherSchedule[oldCell.teacher.id]) {
      delete newState.teacherSchedule[oldCell.teacher.id]?.[day]?.[periodNum];
    }

    if (newSubject) {
      const [stdId, secId] = ck.split("_");
      const std = standards.find(s => s.id === stdId);
      const sec = std?.sections.find(s => s.id === secId);
      newState.timetable[ck][day][periodNum] = { subject: newSubject, teacher: newTeacher || null, room: oldCell?.room || null };
      if (newTeacher) {
        if (!newState.teacherSchedule[newTeacher.id]) newState.teacherSchedule[newTeacher.id] = {};
        if (!newState.teacherSchedule[newTeacher.id][day]) newState.teacherSchedule[newTeacher.id][day] = {};
        newState.teacherSchedule[newTeacher.id][day][periodNum] = { subject: newSubject, class: std, section: sec };
      }
    } else {
      newState.timetable[ck][day][periodNum] = null;
    }

    // Automatically adjust conflicts
    const lockedKey = `${ck}_${day}_${periodNum}`;
    newState = resolveTimetableConflicts(newState, standards, lockedKey);

    pushHistory(newState);
    setEditCell(null);
    showToast("Period updated and timetable adjusted successfully ✓");
  };

  // ── Period cell component ────────────────────────────────────────────────
  function PeriodCell({ ck, day, periodNum, cell }) {
    const isDragSrc = dragSrc?.classKey === ck && dragSrc.day === day && dragSrc.periodNum === periodNum;
    const isDragOver = dragOver?.classKey === ck && dragOver.day === day && dragOver.periodNum === periodNum;
    const bg = cell?.subject ? subjectColor(cell.subject.id, subjects) : C.gray50;

    return (
      <div
        draggable={!!cell}
        onDragStart={e => cell && handleDragStart(e, ck, day, periodNum)}
        onDragOver={e => handleDragOver(e, ck, day, periodNum)}
        onDragLeave={handleDragLeave}
        onDrop={e => handleDrop(e, ck, day, periodNum)}
        onDragEnd={handleDragEnd}
        onClick={() => openEditCell(ck, day, periodNum)}
        style={{
          minHeight:70, padding:"6px 8px", borderRadius:8, border:`1.5px solid`,
          borderColor: isDragOver ? C.accent : isDragSrc ? C.warning : cell ? bg+"cc" : C.gray200,
          background: isDragOver ? "#dbeafe" : isDragSrc ? "#fef3c7" : bg,
          cursor: cell ? "grab" : "pointer",
          opacity: isDragSrc ? 0.5 : 1,
          transition:"all 0.12s",
          position:"relative",
          overflow:"hidden",
        }}
      >
        {cell ? (
          <>
            <div style={{ fontSize:11, fontWeight:800, color:C.gray800, marginBottom:2, lineHeight:1.2 }}>
              {cell.subject?.name}
            </div>
            <div style={{ fontSize:10, color:C.gray600, display:"flex", alignItems:"center", gap:3 }}>
              <i className="ti ti-user" style={{ fontSize:10 }} />
              {cell.teacher?.name || "No teacher"}
            </div>
            {cell.room && (
              <div style={{ fontSize:10, color:C.gray400, marginTop:1 }}>
                <i className="ti ti-door" style={{ fontSize:10 }} /> {cell.room.name}
              </div>
            )}
            {/* Drag handle hint */}
            <div style={{ position:"absolute", top:4, right:4, opacity:0.3, fontSize:10 }}>⠿</div>
          </>
        ) : (
          <div style={{ textAlign:"center", color:C.gray300, fontSize:10, paddingTop:16 }}>
            <i className="ti ti-plus" style={{ fontSize:16, display:"block" }} />free
          </div>
        )}
        {isDragOver && (
          <div style={{ position:"absolute", inset:0, border:`2px dashed ${C.accent}`, borderRadius:8, pointerEvents:"none" }} />
        )}
      </div>
    );
  }

  // ── Class view grid ──────────────────────────────────────────────────────
  function ClassGrid() {
    if (!classTT || !selStd) return null;
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"separate", borderSpacing:4, minWidth:700 }}>
          <thead>
            <tr>
              <th style={{ width:90, padding:"8px 10px", textAlign:"left", fontSize:11, color:C.gray500, fontWeight:600 }}>Time</th>
              {days.map(d => (
                <th key={d} style={{ padding:"8px 6px", textAlign:"center", fontSize:12, fontWeight:700, color:C.gray700, minWidth:110 }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPeriods.map((slot, si) => (
              <tr key={si}>
                <td style={{ padding:"4px 8px", fontSize:10, color:C.gray500, verticalAlign:"top", paddingTop:8, whiteSpace:"nowrap" }}>
                  <div style={{ fontWeight:700, color:C.gray700 }}>{slot.label}</div>
                  <div>{slot.start} – {slot.end}</div>
                </td>
                {slot.type === "break" ? (
                  <td colSpan={days.length} style={{ padding:"4px 6px" }}>
                    <div style={{ background:`linear-gradient(90deg,${C.warning}22,${C.warning}11)`, border:`1px solid ${C.warning}40`, borderRadius:8, padding:"6px 14px", textAlign:"center", fontSize:11, fontWeight:700, color:C.warning }}>
                      <i className="ti ti-coffee" style={{ marginRight:5 }} />{slot.label} · {slot.start}–{slot.end}
                    </div>
                  </td>
                ) : (
                  days.map(d => (
                    <td key={d} style={{ padding:"4px 6px", verticalAlign:"top" }}>
                      <PeriodCell ck={classKey} day={d} periodNum={slot.num} cell={classTT[d]?.[slot.num]} />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Teacher view grid ────────────────────────────────────────────────────
  function TeacherGrid() {
    if (!selTeacher) return null;
    const ts = generatedTT.teacherSchedule[selTeacher.id];
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ borderCollapse:"separate", borderSpacing:4, minWidth:700 }}>
          <thead>
            <tr>
              <th style={{ width:90, padding:"8px 10px", textAlign:"left", fontSize:11, color:C.gray500, fontWeight:600 }}>Period</th>
              {days.map(d => (
                <th key={d} style={{ padding:"8px 6px", textAlign:"center", fontSize:12, fontWeight:700, color:C.gray700, minWidth:110 }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPeriods.map((slot, si) => (
              <tr key={si}>
                <td style={{ padding:"4px 8px", fontSize:10, color:C.gray500, verticalAlign:"top", paddingTop:8 }}>
                  <div style={{ fontWeight:700, color:C.gray700 }}>{slot.label}</div>
                  <div>{slot.start}–{slot.end}</div>
                </td>
                {slot.type === "break" ? (
                  <td colSpan={days.length} style={{ padding:"4px 6px" }}>
                    <div style={{ background:`${C.warning}15`, border:`1px solid ${C.warning}30`, borderRadius:8, padding:"6px 14px", textAlign:"center", fontSize:11, fontWeight:700, color:C.warning }}>
                      <i className="ti ti-coffee" style={{ marginRight:5 }} />{slot.label}
                    </div>
                  </td>
                ) : (
                  days.map(d => {
                    const entry = ts?.[d]?.[slot.num];
                    return (
                      <td key={d} style={{ padding:"4px 6px" }}>
                        {entry ? (
                          <div style={{ minHeight:70, padding:"8px 10px", borderRadius:8, background:subjectColor(entry.subject?.id, subjects), border:`1.5px solid #0002` }}>
                            <div style={{ fontSize:11, fontWeight:800, color:C.gray800 }}>{entry.subject?.name}</div>
                            <div style={{ fontSize:10, color:C.gray600, marginTop:2 }}>
                              {entry.class?.name} – {entry.section?.name}
                            </div>
                          </div>
                        ) : (
                          <div style={{ minHeight:70, borderRadius:8, background:C.gray50, border:`1px dashed ${C.gray200}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <span style={{ fontSize:10, color:C.gray300 }}>Free</span>
                          </div>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Edit Cell Modal ──────────────────────────────────────────────────────
  function EditCellModal() {
    if (!editCell) return null;
    const { classKey: ck, day, periodNum } = editCell;
    const [stdId] = ck.split("_");
    const stdSubjects = subjects.filter(s => s.standardId === stdId);
    const [newSubjId, setNewSubjId] = useState(editCell.cell?.subject?.id || "");
    const [newTeacherId, setNewTeacherId] = useState(editCell.cell?.teacher?.id || "");

    const eligibleTeachers = newSubjId
      ? teachers.filter(t => {
          if (!t.assignments?.length) return t.subjects?.includes(newSubjId);
          return t.assignments.some(a => a.standardId === stdId && a.subjectIds?.includes(newSubjId));
        })
      : teachers;

    const newSubjObj = subjects.find(s => s.id === newSubjId) || null;
    const newTeacherObj = teachers.find(t => t.id === newTeacherId) || null;

    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9998 }}
        onClick={() => setEditCell(null)}>
        <div className="editor-modal" style={{ background:C.white, borderRadius:16, padding:"24px 28px", width:400, boxShadow:"0 20px 50px rgba(0,0,0,0.3)" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize:15, fontWeight:800, color:C.gray800, marginBottom:4 }}>Edit Period</div>
          <div style={{ fontSize:12, color:C.gray400, marginBottom:18 }}>{day} · Period {periodNum}</div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.gray600, marginBottom:5, textTransform:"uppercase" }}>Subject</label>
            <select value={newSubjId} onChange={e => { setNewSubjId(e.target.value); setNewTeacherId(""); }}
              style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.gray200}`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", background:C.white }}>
              <option value="">— Free Period —</option>
              {stdSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {newSubjId && (
            <div style={{ marginBottom:18 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:C.gray600, marginBottom:5, textTransform:"uppercase" }}>Teacher</label>
              <select value={newTeacherId} onChange={e => setNewTeacherId(e.target.value)}
                style={{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.gray200}`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", background:C.white }}>
                <option value="">— No Teacher —</option>
                {eligibleTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {eligibleTeachers.length === 0 && (
                <div style={{ fontSize:11, color:C.warning, marginTop:4 }}>No teachers assigned to this subject for this class.</div>
              )}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => saveEditCell(newSubjObj, newTeacherObj)}
              style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:C.accent, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
              <i className="ti ti-check" style={{ marginRight:6 }} />Save
            </button>
            <button onClick={() => setEditCell(null)}
              style={{ padding:"10px 16px", borderRadius:9, border:`1px solid ${C.gray200}`, background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Validation panel ─────────────────────────────────────────────────────
  function ValidationPanel() {
    if (!validation) return null;
    return (
      <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"16px 20px", marginTop:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.gray800 }}>Validation Report</div>
          <div style={{ display:"flex", gap:12, fontSize:13 }}>
            <span style={{ color:C.success, fontWeight:700 }}><i className="ti ti-chart-pie" style={{ marginRight:4 }} />{validation.score}% filled</span>
            <span style={{ color:C.gray500 }}>{validation.filledSlots}/{validation.totalSlots} slots</span>
          </div>
          <button onClick={() => setValidation(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.gray400, fontSize:16 }}>✕</button>
        </div>
        {validation.warnings.length === 0 ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:"#f0fdf4", borderRadius:8, border:"1px solid #bbf7d0" }}>
            <i className="ti ti-circle-check-filled" style={{ color:C.success, fontSize:18 }} />
            <span style={{ fontSize:13, color:C.success, fontWeight:600 }}>All checks passed! Timetable looks great.</span>
          </div>
        ) : (
          <div style={{ maxHeight:260, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
            {validation.warnings.map((w, i) => (
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"8px 12px", background: w.type==="overload"?"#fff8f3":"#fff8f8", border:`1px solid ${w.type==="overload"?C.warning+"40":C.danger+"30"}`, borderRadius:7, fontSize:12, color:C.gray700 }}>
                <i className={`ti ${w.type==="overload"?"ti-alert-triangle":"ti-info-circle"}`} style={{ color:w.type==="overload"?C.warning:C.danger, fontSize:14, flexShrink:0, marginTop:1 }} />
                {w.text}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="editor-toolbar" style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"12px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>

        {/* View mode toggle */}
        <div style={{ display:"flex", gap:4, background:C.gray100, borderRadius:8, padding:3 }}>
          {["class","teacher"].map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ padding:"6px 16px", borderRadius:6, border:"none", background:viewMode===m?C.white:"transparent", color:viewMode===m?C.accent:C.gray500, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", boxShadow:viewMode===m?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
              <i className={`ti ${m==="class"?"ti-books":"ti-user"}`} style={{ marginRight:4 }} />{m==="class"?"Class View":"Teacher View"}
            </button>
          ))}
        </div>

        {/* Class selector */}
        {viewMode === "class" && (
          <>
            <select value={selStdId||""} onChange={e => {
              const std = standards.find(s => s.id === e.target.value);
              setActiveView({ type:"class", stdId: e.target.value, secId: std?.sections[0]?.id || null });
            }} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.gray200}`, fontSize:12, fontFamily:"inherit", outline:"none" }}>
              <option value="">Select Class…</option>
              {standards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {selStd && (
              <div style={{ display:"flex", gap:5 }}>
                {selStd.sections.map(sec => (
                  <button key={sec.id} onClick={() => setActiveView(v => ({ ...v, secId: sec.id }))}
                    style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${selSecId===sec.id?C.accent:C.gray200}`, background:selSecId===sec.id?"#dbeafe":C.white, color:selSecId===sec.id?C.accent:C.gray600, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {sec.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Teacher selector */}
        {viewMode === "teacher" && (
          <select value={selTeacherId} onChange={e => setSelTeacherId(e.target.value)}
            style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.gray200}`, fontSize:12, fontFamily:"inherit", outline:"none" }}>
            <option value="">Select Teacher…</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <div style={{ flex:1 }} />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={historyIdx <= 0}
          style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.gray200}`, background:"none", cursor:historyIdx>0?"pointer":"not-allowed", color:historyIdx>0?C.gray700:C.gray300, fontFamily:"inherit", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
          <i className="ti ti-arrow-back-up" /> Undo
        </button>
        <button onClick={redo} disabled={historyIdx >= ttHistory.length - 1}
          style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${C.gray200}`, background:"none", cursor:historyIdx<ttHistory.length-1?"pointer":"not-allowed", color:historyIdx<ttHistory.length-1?C.gray700:C.gray300, fontFamily:"inherit", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
          <i className="ti ti-arrow-forward-up" /> Redo
        </button>

        {/* Validate */}
        <button onClick={runValidation}
          style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.gray200}`, background:C.white, cursor:"pointer", color:C.gray700, fontFamily:"inherit", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
          <i className="ti ti-shield-check" style={{ color:C.success }} /> Validate
        </button>

        {/* Regenerate */}
        <button onClick={handleGenerate}
          style={{ padding:"7px 14px", borderRadius:8, border:"none", background:C.accent, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
          <i className="ti ti-refresh" /> Regenerate
        </button>
      </div>

      {/* ── Drag hint ────────────────────────────────────────────────────── */}
      <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"8px 14px", marginBottom:12, fontSize:11, color:"#0369a1", display:"flex", alignItems:"center", gap:8 }}>
        <i className="ti ti-drag-drop" style={{ fontSize:14 }} />
        <strong>Drag &amp; Drop:</strong> Drag any period to swap it with another slot. Click a cell to edit its subject or teacher. Conflicts are validated automatically.
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"16px 14px", overflowX:"auto" }}>
        {viewMode === "class" ? (
          selStd && selSec ? <ClassGrid /> : (
            <div style={{ textAlign:"center", padding:40, color:C.gray400, fontSize:13 }}>Select a class and section above to view timetable</div>
          )
        ) : (
          selTeacher ? <TeacherGrid /> : (
            <div style={{ textAlign:"center", padding:40, color:C.gray400, fontSize:13 }}>Select a teacher above to view their schedule</div>
          )
        )}
      </div>

      {/* ── Validation panel ─────────────────────────────────────────────── */}
      <ValidationPanel />

      {/* ── Drop error toast ──────────────────────────────────────────────── */}
      {dropError && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:C.danger, color:"#fff", padding:"12px 22px", borderRadius:12, fontSize:13, fontWeight:600, zIndex:9999, boxShadow:"0 6px 20px rgba(220,38,38,0.4)", display:"flex", alignItems:"center", gap:10, maxWidth:440, textAlign:"center", animation:"slideUp 0.2s ease" }}>
          <i className="ti ti-alert-triangle" style={{ fontSize:18, flexShrink:0 }} />
          <div>
            <div style={{ fontWeight:800, marginBottom:2 }}>Move Not Allowed</div>
            <div style={{ fontSize:12, opacity:0.9 }}>{dropError}</div>
          </div>
          <button onClick={() => setDropError(null)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:6, color:"#fff", width:24, height:24, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>✕</button>
        </div>
      )}

      {/* ── Edit cell modal ───────────────────────────────────────────────── */}
      <EditCellModal />

      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
  );
}

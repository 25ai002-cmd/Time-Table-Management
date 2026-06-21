import { useState } from "react";
import { generateId } from "./timetableEngine";

const C = {
  accent:"#2563eb", primary:"#1a4b8c", success:"#16a34a", danger:"#dc2626",
  gray50:"#f8fafc", gray100:"#f1f5f9", gray200:"#e2e8f0", gray300:"#cbd5e1",
  gray400:"#94a3b8", gray500:"#64748b", gray600:"#475569", gray700:"#334155",
  gray800:"#1e293b", white:"#ffffff",
};
const inp = {
  width:"100%", padding:"9px 12px", border:`1.5px solid ${C.gray200}`,
  borderRadius:8, fontSize:13, color:C.gray800, background:C.white,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s",
};

export default function TeachersSetup({ teachers, setTeachers, subjects, standards, showToast, generatedTT, setGeneratedTT }) {
  const [selId, setSelId] = useState(teachers[0]?.id || "");
  const [form, setForm] = useState({ name:"", code:"", dailyLimit:"6", weeklyLimit:"30", stdId: "", subjectIds: [] });
  const [addingTeacher, setAddingTeacher] = useState(false);

  // Assignment form state
  const [asgStdId, setAsgStdId] = useState("");
  const [asgSubjectIds, setAsgSubjectIds] = useState([]);
  const [asgSectionIds, setAsgSectionIds] = useState([]);
  const [addingAssignment, setAddingAssignment] = useState(false);

  const selTeacher = teachers.find(t => t.id === selId);
  const selStd = standards.find(s => s.id === asgStdId);
  const stdSubjects = subjects.filter(s => s.standardId === asgStdId);

  // Toggle multi-select helpers
  const toggleId = (list, setList, id) =>
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const syncAssignmentToTimetable = (timetableState, setTimetableState, teacher, standardId, subjectIds, action, standardsList) => {
    if (!timetableState) return;
    
    const newState = JSON.parse(JSON.stringify(timetableState));
    const std = standardsList.find(s => s.id === standardId);
    if (!std) return;

    std.sections.forEach(sec => {
      const classKey = `${standardId}_${sec.id}`;
      const classTT = newState.timetable[classKey];
      if (!classTT) return;

      Object.keys(classTT).forEach(day => {
        Object.keys(classTT[day]).forEach(periodNum => {
          const cell = classTT[day][periodNum];
          if (cell && cell.subject && subjectIds.includes(cell.subject.id)) {
            if (action === "add") {
              // Remove from old teacher schedule if any
              if (cell.teacher && newState.teacherSchedule[cell.teacher.id]) {
                delete newState.teacherSchedule[cell.teacher.id]?.[day]?.[periodNum];
              }
              // Update cell teacher
              cell.teacher = { id: teacher.id, name: teacher.name, code: teacher.code || "" };
              // Add to new teacher schedule
              if (!newState.teacherSchedule[teacher.id]) newState.teacherSchedule[teacher.id] = {};
              if (!newState.teacherSchedule[teacher.id][day]) newState.teacherSchedule[teacher.id][day] = {};
              newState.teacherSchedule[teacher.id][day][periodNum] = { subject: cell.subject, class: std, section: sec };
            } else if (action === "remove") {
              // If this teacher was the one assigned, clear it
              if (cell.teacher && cell.teacher.id === teacher.id) {
                cell.teacher = null;
                if (newState.teacherSchedule[teacher.id]) {
                  delete newState.teacherSchedule[teacher.id]?.[day]?.[periodNum];
                }
              }
            }
          }
        });
      });
    });

    setTimetableState(newState);
  };

  const addTeacher = () => {
    if (!form.name.trim()) return;
    const exists = teachers.some(t => t.name.toLowerCase() === form.name.trim().toLowerCase());
    if (exists) { showToast("Teacher with this name already exists", "error"); return; }
    
    const assignments = [];
    if (form.stdId && form.subjectIds?.length) {
      assignments.push({
        id: generateId(),
        standardId: form.stdId,
        subjectIds: form.subjectIds,
        sectionIds: [] // all sections by default
      });
    }

    const t = { 
      id: generateId(), 
      name: form.name.trim(), 
      code: form.code, 
      dailyLimit: form.dailyLimit, 
      weeklyLimit: form.weeklyLimit, 
      assignments 
    };

    setTeachers(p => [...p, t]);
    setSelId(t.id);
    setForm({ name:"", code:"", dailyLimit:"6", weeklyLimit:"30", stdId: "", subjectIds: [] });
    setAddingTeacher(false);
    showToast(`${t.name} added`);

    if (assignments.length > 0) {
      syncAssignmentToTimetable(generatedTT, setGeneratedTT, t, form.stdId, form.subjectIds, "add", standards);
    }
  };

  const deleteTeacher = (id) => {
    if (generatedTT) {
      const newState = JSON.parse(JSON.stringify(generatedTT));
      delete newState.teacherSchedule[id];
      Object.keys(newState.timetable).forEach(classKey => {
        const classTT = newState.timetable[classKey];
        if (classTT) {
          Object.keys(classTT).forEach(day => {
            Object.keys(classTT[day]).forEach(periodNum => {
              const cell = classTT[day][periodNum];
              if (cell && cell.teacher && cell.teacher.id === id) {
                cell.teacher = null;
              }
            });
          });
        }
      });
      setGeneratedTT(newState);
    }

    setTeachers(p => p.filter(t => t.id !== id));
    if (selId === id) setSelId(teachers.filter(t => t.id !== id)[0]?.id || "");
    showToast("Teacher removed");
  };

  const addAssignment = () => {
    if (!asgStdId || !asgSubjectIds.length) { showToast("Select at least one subject", "error"); return; }
    const newAsg = { id: generateId(), standardId: asgStdId, subjectIds: asgSubjectIds, sectionIds: asgSectionIds };
    const alreadyHas = selTeacher.assignments?.some(a => a.standardId === asgStdId);
    if (alreadyHas) {
      setTeachers(p => p.map(t => t.id === selId ? {
        ...t,
        assignments: t.assignments.map(a => a.standardId === asgStdId
          ? { ...a, subjectIds: [...new Set([...a.subjectIds, ...asgSubjectIds])], sectionIds: asgSectionIds.length ? asgSectionIds : a.sectionIds }
          : a
        )
      } : t));
    } else {
      setTeachers(p => p.map(t => t.id === selId ? { ...t, assignments: [...(t.assignments||[]), newAsg] } : t));
    }

    syncAssignmentToTimetable(generatedTT, setGeneratedTT, selTeacher, asgStdId, asgSubjectIds, "add", standards);

    setAsgStdId(""); setAsgSubjectIds([]); setAsgSectionIds([]); setAddingAssignment(false);
    showToast("Assignment added");
  };

  const removeAssignment = (teacherId, asgId) => {
    const teacherObj = teachers.find(t => t.id === teacherId);
    const asgObj = teacherObj?.assignments?.find(a => a.id === asgId);
    if (teacherObj && asgObj) {
      syncAssignmentToTimetable(generatedTT, setGeneratedTT, teacherObj, asgObj.standardId, asgObj.subjectIds, "remove", standards);
    }

    setTeachers(p => p.map(t => t.id === teacherId ? { ...t, assignments: t.assignments.filter(a => a.id !== asgId) } : t));
    showToast("Assignment removed");
  };

  const updateTeacherField = (field, value) => {
    setTeachers(p => p.map(t => t.id === selId ? { ...t, [field]: value } : t));
  };

  // Assignment card helper
  function AssignmentCard({ asg, teacherId }) {
    const std = standards.find(s => s.id === asg.standardId);
    const asgSubs = subjects.filter(s => asg.subjectIds?.includes(s.id));
    const asgSecs = std?.sections.filter(sec => asg.sectionIds?.includes(sec.id)) || [];
    return (
      <div style={{ background:C.gray50, border:`1px solid ${C.gray200}`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.accent }}>
            <i className="ti ti-books" style={{ marginRight:6 }} />{std?.name || "Unknown Class"}
          </div>
          <button onClick={() => removeAssignment(teacherId, asg.id)}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, fontSize:13 }}>
            <i className="ti ti-trash" />
          </button>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
          {asgSubs.map(s => (
            <span key={s.id} style={{ padding:"2px 9px", background:"#dbeafe", borderRadius:20, fontSize:11, fontWeight:600, color:"#1e40af" }}>{s.name}</span>
          ))}
          {!asgSubs.length && <span style={{ fontSize:12, color:C.gray400 }}>No subjects</span>}
        </div>
        <div style={{ fontSize:11, color:C.gray500 }}>
          {asgSecs.length > 0
            ? `Sections: ${asgSecs.map(s=>s.name).join(", ")}`
            : `All sections of ${std?.name}`}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", gap:20, maxWidth:1100, alignItems:"flex-start" }}>

      {/* Left — teacher list */}
      <div style={{ width:240, flexShrink:0 }}>
        <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.gray100}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.gray700 }}>Teachers ({teachers.length})</span>
            <button onClick={() => setAddingTeacher(true)}
              style={{ background:C.accent, border:"none", borderRadius:6, color:"#fff", width:26, height:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <i className="ti ti-plus" style={{ fontSize:14 }} />
            </button>
          </div>
          {teachers.length === 0 && (
            <div style={{ padding:20, textAlign:"center", color:C.gray400, fontSize:12 }}>No teachers yet</div>
          )}
          {teachers.map(t => {
            const asgCount = t.assignments?.length || 0;
            return (
              <div key={t.id} onClick={() => { setSelId(t.id); setAddingAssignment(false); }}
                style={{
                  padding:"11px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10,
                  background: selId===t.id ? "#eff6ff" : C.white,
                  borderLeft: selId===t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                  borderBottom:`1px solid ${C.gray100}`,
                }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background: selId===t.id ? C.accent : C.gray200, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:13, fontWeight:800, color: selId===t.id?"#fff":C.gray500 }}>
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: selId===t.id?C.accent:C.gray700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</div>
                  <div style={{ fontSize:11, color:C.gray400 }}>{asgCount} assignment{asgCount!==1?"s":""}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteTeacher(t.id); }}
                  style={{ background:"none", border:"none", cursor:"pointer", color:C.gray300, fontSize:13, padding:2 }}
                  onMouseEnter={e=>(e.currentTarget.style.color=C.danger)}
                  onMouseLeave={e=>(e.currentTarget.style.color=C.gray300)}>
                  <i className="ti ti-trash" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right — teacher detail + assignments */}
      <div style={{ flex:1 }}>

        {/* Add new teacher form */}
        {addingTeacher && (
          <div style={{ background:C.white, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.gray800, marginBottom:14 }}>
              <i className="ti ti-user-plus" style={{ marginRight:8, color:C.accent }} />Add New Teacher
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:4 }}>Full Name *</div>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                  placeholder="e.g. Mr. Rajesh Shah" style={inp}
                  onKeyDown={e=>e.key==="Enter"&&addTeacher()}
                  onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.gray200)}/>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:4 }}>Code / ID</div>
                <input value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))}
                  placeholder="e.g. RS01" style={inp}
                  onFocus={e=>(e.target.style.borderColor=C.accent)} onBlur={e=>(e.target.style.borderColor=C.gray200)}/>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:4 }}>Daily Limit</div>
                <select value={form.dailyLimit} onChange={e=>setForm(p=>({...p,dailyLimit:e.target.value}))} style={inp}>
                  {[4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n} periods</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:4 }}>Weekly Limit</div>
                <select value={form.weeklyLimit} onChange={e=>setForm(p=>({...p,weeklyLimit:e.target.value}))} style={inp}>
                  {[20,24,25,28,30,32,35,40].map(n=><option key={n} value={n}>{n} periods</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:16, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:6 }}>Class / Standard to Teach</div>
                <select 
                  value={form.stdId || ""} 
                  onChange={e => {
                    const stdId = e.target.value;
                    setForm(p => ({ ...p, stdId, subjectIds: [] }));
                  }} 
                  style={inp}
                >
                  <option value="">-- Select Class --</option>
                  {standards.map(std => <option key={std.id} value={std.id}>{std.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:C.gray600, marginBottom:6 }}>Subjects to Teach</div>
                {form.stdId ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 38, padding: "6px 10px", border: `1.5px solid ${C.gray200}`, borderRadius: 8, background: C.gray50 }}>
                    {subjects.filter(s => s.standardId === form.stdId).length === 0 ? (
                      <span style={{ fontSize: 12, color: C.danger }}>No subjects added to this class yet.</span>
                    ) : (
                      subjects.filter(s => s.standardId === form.stdId).map(sub => {
                        const isSelected = form.subjectIds?.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setForm(p => ({
                                ...p,
                                subjectIds: isSelected 
                                  ? p.subjectIds.filter(x => x !== sub.id) 
                                  : [...(p.subjectIds || []), sub.id]
                              }));
                            }}
                            type="button"
                            style={{
                              padding: "4px 10px",
                              borderRadius: 16,
                              border: `1.5px solid ${isSelected ? C.success : C.gray300}`,
                              background: isSelected ? "#dcfce7" : C.white,
                              color: isSelected ? C.success : C.gray600,
                              fontWeight: 600,
                              fontSize: 11,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontFamily: "inherit"
                            }}
                          >
                            {isSelected && <i className="ti ti-check" style={{ fontSize: 9 }} />}
                            {sub.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.gray400, fontStyle: "italic", paddingTop: 8 }}>Select a class first to display its subjects</div>
                )}
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={addTeacher} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:C.accent, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>
                <i className="ti ti-check" style={{ marginRight:6 }} />Add Teacher
              </button>
              <button onClick={() => setAddingTeacher(false)} style={{ padding:"9px 16px", borderRadius:8, border:`1px solid ${C.gray200}`, background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
            </div>
          </div>
        )}

        {!selTeacher && !addingTeacher ? (
          <div style={{ textAlign:"center", padding:60, color:C.gray400 }}>
            <i className="ti ti-users" style={{ fontSize:40, display:"block", marginBottom:10 }} />
            Select a teacher or add a new one
          </div>
        ) : selTeacher && (
          <>
            {/* Teacher info bar */}
            <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"16px 20px", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,${C.primary},${C.accent})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:20, fontWeight:900, color:"#fff" }}>{selTeacher.name.charAt(0)}</span>
                </div>
                <div style={{ flex:1 }}>
                  <input value={selTeacher.name}
                    onChange={e => updateTeacherField("name", e.target.value)}
                    style={{ ...inp, width:"auto", minWidth:200, fontSize:15, fontWeight:700, border:"none", padding:"2px 0", background:"transparent" }}
                  />
                  <div style={{ display:"flex", gap:12, marginTop:4 }}>
                    <span style={{ fontSize:12, color:C.gray500 }}>Code:
                      <input value={selTeacher.code||""}
                        onChange={e=>updateTeacherField("code",e.target.value)}
                        placeholder="e.g. RS01"
                        style={{ ...inp, display:"inline", width:80, marginLeft:6, fontSize:12, padding:"2px 6px" }} />
                    </span>
                    <span style={{ fontSize:12, color:C.gray500 }}>Daily max:
                      <select value={selTeacher.dailyLimit||6} onChange={e=>updateTeacherField("dailyLimit",e.target.value)}
                        style={{ ...inp, display:"inline", width:100, marginLeft:6, fontSize:12, padding:"2px 6px" }}>
                        {[4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n} periods</option>)}
                      </select>
                    </span>
                    <span style={{ fontSize:12, color:C.gray500 }}>Weekly max:
                      <select value={selTeacher.weeklyLimit||30} onChange={e=>updateTeacherField("weeklyLimit",e.target.value)}
                        style={{ ...inp, display:"inline", width:110, marginLeft:6, fontSize:12, padding:"2px 6px" }}>
                        {[20,24,25,28,30,32,35,40].map(n=><option key={n} value={n}>{n} periods</option>)}
                      </select>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignments section */}
            <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"16px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.gray800 }}>Class Assignments</div>
                  <div style={{ fontSize:12, color:C.gray400, marginTop:2 }}>Which classes, subjects, and sections does this teacher handle?</div>
                </div>
                <button onClick={() => setAddingAssignment(true)}
                  style={{ padding:"8px 16px", borderRadius:8, border:"none", background:C.accent, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                  <i className="ti ti-plus" />Add Assignment
                </button>
              </div>

              {/* Add assignment form */}
              {addingAssignment && (
                <div style={{ background:"#f0f5ff", border:`1.5px solid ${C.accent}40`, borderRadius:10, padding:"16px", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.accent, marginBottom:12 }}>
                    <i className="ti ti-plus-circle" style={{ marginRight:6 }} />New Assignment for {selTeacher.name}
                  </div>

                  {/* Step 1: Select standard */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.gray600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>Step 1 — Select Class / Standard</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {standards.map(std => (
                        <button key={std.id} onClick={() => { setAsgStdId(std.id); setAsgSubjectIds([]); setAsgSectionIds([]); }}
                          style={{
                            padding:"6px 14px", borderRadius:20, border:`1.5px solid ${asgStdId===std.id?C.accent:C.gray200}`,
                            background:asgStdId===std.id?"#dbeafe":C.white, color:asgStdId===std.id?C.accent:C.gray600,
                            fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                          }}>
                          {std.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Select subjects (filtered to chosen standard) */}
                  {asgStdId && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.gray600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                        Step 2 — Select Subjects for {selStd?.name}
                      </div>
                      {stdSubjects.length === 0 ? (
                        <div style={{ fontSize:12, color:C.danger, padding:"8px 12px", background:"#fff8f8", borderRadius:7, border:`1px solid ${C.danger}30` }}>
                          No subjects found for {selStd?.name}. Add subjects first.
                        </div>
                      ) : (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {stdSubjects.map(sub => (
                            <button key={sub.id} onClick={() => toggleId(asgSubjectIds, setAsgSubjectIds, sub.id)}
                              style={{
                                padding:"6px 14px", borderRadius:20, border:`1.5px solid ${asgSubjectIds.includes(sub.id)?C.success:C.gray200}`,
                                background:asgSubjectIds.includes(sub.id)?"#dcfce7":C.white,
                                color:asgSubjectIds.includes(sub.id)?C.success:C.gray600,
                                fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                                display:"flex", alignItems:"center", gap:5,
                              }}>
                              {asgSubjectIds.includes(sub.id) && <i className="ti ti-check" style={{ fontSize:11 }} />}
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Select sections */}
                  {asgStdId && asgSubjectIds.length > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.gray600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                        Step 3 — Select Sections (leave empty = all sections)
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {selStd?.sections.map(sec => (
                          <button key={sec.id} onClick={() => toggleId(asgSectionIds, setAsgSectionIds, sec.id)}
                            style={{
                              padding:"6px 14px", borderRadius:20, border:`1.5px solid ${asgSectionIds.includes(sec.id)?"#7c3aed":C.gray200}`,
                              background:asgSectionIds.includes(sec.id)?"#ede9fe":C.white,
                              color:asgSectionIds.includes(sec.id)?"#7c3aed":C.gray600,
                              fontWeight:600, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                              display:"flex", alignItems:"center", gap:5,
                            }}>
                            {asgSectionIds.includes(sec.id) && <i className="ti ti-check" style={{ fontSize:11 }} />}
                            Section {sec.name}
                          </button>
                        ))}
                        {selStd?.sections.length === 0 && <span style={{ fontSize:12, color:C.gray400 }}>No sections for this class</span>}
                      </div>
                      {asgSectionIds.length === 0 && selStd?.sections.length > 0 && (
                        <div style={{ fontSize:11, color:C.gray500, marginTop:5 }}>
                          ✓ No sections selected = teacher will be assigned to all sections of {selStd?.name}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={addAssignment} disabled={!asgStdId||!asgSubjectIds.length}
                      style={{ padding:"9px 20px", borderRadius:8, border:"none", background:asgStdId&&asgSubjectIds.length?C.accent:C.gray200, color:asgStdId&&asgSubjectIds.length?"#fff":C.gray400, fontWeight:700, cursor:asgStdId&&asgSubjectIds.length?"pointer":"not-allowed", fontFamily:"inherit", fontSize:13 }}>
                      <i className="ti ti-check" style={{ marginRight:6 }} />Confirm Assignment
                    </button>
                    <button onClick={() => { setAddingAssignment(false); setAsgStdId(""); setAsgSubjectIds([]); setAsgSectionIds([]); }}
                      style={{ padding:"9px 16px", borderRadius:8, border:`1px solid ${C.gray200}`, background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Existing assignments */}
              {(!selTeacher.assignments || selTeacher.assignments.length === 0) && !addingAssignment ? (
                <div style={{ textAlign:"center", padding:"24px", color:C.gray400, border:`1px dashed ${C.gray300}`, borderRadius:10 }}>
                  <i className="ti ti-link" style={{ fontSize:28, display:"block", marginBottom:8 }} />
                  No assignments yet. Click "Add Assignment" to assign classes and subjects.
                </div>
              ) : (
                (selTeacher.assignments || []).map(asg => (
                  <AssignmentCard key={asg.id} asg={asg} teacherId={selTeacher.id} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  function AssignmentCard({ asg, teacherId }) {
    const std = standards.find(s => s.id === asg.standardId);
    const asgSubs = subjects.filter(s => asg.subjectIds?.includes(s.id));
    const asgSecs = std?.sections.filter(sec => asg.sectionIds?.includes(sec.id)) || [];
    return (
      <div style={{ background:C.gray50, border:`1px solid ${C.gray200}`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.accent }}>
            <i className="ti ti-books" style={{ marginRight:6 }} />{std?.name || "Unknown Class"}
          </div>
          <button onClick={() => removeAssignment(teacherId, asg.id)}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.danger, fontSize:13, padding:2 }}>
            <i className="ti ti-trash" />
          </button>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
          {asgSubs.map(s => (
            <span key={s.id} style={{ padding:"2px 9px", background:"#dbeafe", borderRadius:20, fontSize:11, fontWeight:600, color:"#1e40af" }}>{s.name}</span>
          ))}
          {!asgSubs.length && <span style={{ fontSize:12, color:C.gray400 }}>No subjects linked</span>}
        </div>
        <div style={{ fontSize:11, color:C.gray500 }}>
          <i className="ti ti-layout-grid" style={{ marginRight:4 }} />
          {asgSecs.length > 0 ? `Sections: ${asgSecs.map(s=>s.name).join(", ")}` : `All sections of ${std?.name || "this class"}`}
        </div>
      </div>
    );
  }
}

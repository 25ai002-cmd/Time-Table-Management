import { useState, useEffect } from "react";
import { generateId, SUBJECT_TYPES, ROOM_TYPES } from "./timetableEngine";
import { getSubjectSuggestions } from "./subjectSuggestions";

const C = {
  accent:"#2563eb", accentLight:"#eff6ff", primary:"#1a4b8c",
  success:"#10b981", successLight:"#d1fae5",
  danger:"#ef4444", dangerLight:"#fee2e2",
  warning:"#f59e0b", warningLight:"#fef3c7",
  gray50:"#f8fafc", gray100:"#f1f5f9", gray200:"#e2e8f0",
  gray300:"#cbd5e1", gray400:"#94a3b8", gray500:"#64748b",
  gray600:"#475569", gray700:"#334155", gray800:"#1e293b", gray900:"#0f172a",
  white:"#ffffff",
};

const inp = {
  width:"100%", padding:"9px 12px", border:`1.5px solid ${C.gray200}`,
  borderRadius:8, fontSize:13, color:C.gray800, background:C.white,
  outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s, box-shadow 0.15s",
};

const TYPE_COLORS = {
  Theory: { bg:"#eff6ff", text:"#1d4ed8", dot:"#2563eb" },
  Practical: { bg:"#f0fdf4", text:"#15803d", dot:"#16a34a" },
  Lab: { bg:"#fefce8", text:"#a16207", dot:"#ca8a04" },
  Sports: { bg:"#fdf2f8", text:"#9d174d", dot:"#be185d" },
  Library: { bg:"#f5f3ff", text:"#5b21b6", dot:"#7c3aed" },
  Activity: { bg:"#ecfeff", text:"#0e7490", dot:"#0891b2" },
};

export { getSubjectSuggestions };


export default function SubjectsSetup({ subjects, setSubjects, standards, showToast }) {
  const [selStdId, setSelStdId] = useState(standards[0]?.id || "");
  const [newSubj, setNewSubj] = useState({ name:"", type:"Theory", periodsPerWeek:4, roomType:"Classroom", hasLab:false, labPeriodsPerWeek:2, labRoomType:"Science Lab" });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [subjSelectVal, setSubjSelectVal] = useState("");
  const [subjCustomVal, setSubjCustomVal] = useState("");
  const [isSubjCustom, setIsSubjCustom] = useState(false);
  const [activeTab, setActiveTab] = useState("quick"); // "quick" | "single"
  const [addingAll, setAddingAll] = useState(false);
  const [streamOverride, setStreamOverride] = useState("auto");
  const [classSearchQuery, setClassSearchQuery] = useState("");

  const selStd = standards.find(s => s.id === selStdId);
  const stdSubjects = subjects.filter(s => s.standardId === selStdId);
  
  const filteredStandards = standards.filter(std =>
    std.name.toLowerCase().includes(classSearchQuery.toLowerCase())
  );

  const isSenior = (name = "") => {
    const n = name.toLowerCase();
    return (
      n.includes("11") || n.includes("12") || 
      n.includes("xi") || n.includes("xii") || 
      n.includes("senior") || n.includes("college") || 
      n.includes("jc") || n.includes("university") ||
      n.includes("b.sc") || n.includes("bsc") ||
      n.includes("b.com") || n.includes("bcom") ||
      n.includes("ba") || n.includes("b.a") ||
      n.includes("bca") || n.includes("bba")
    );
  };

  const allSubjOptions = getSubjectSuggestions(selStd?.name, streamOverride);
  const existingSubjNames = stdSubjects.map(s => s.name.toLowerCase());
  const subjOptions = allSubjOptions.filter(o => !existingSubjNames.includes(o.toLowerCase()));

  useEffect(() => {
    setStreamOverride("auto");
  }, [selStdId]);

  useEffect(() => {
    const opts = getSubjectSuggestions(selStd?.name, streamOverride).filter(
      o => !stdSubjects.some(s => s.name.toLowerCase() === o.toLowerCase())
    );
    if (opts.length === 0) {
      setIsSubjCustom(true);
    } else {
      setIsSubjCustom(false);
      setSubjSelectVal(opts[0]);
    }
  }, [selStdId, subjects, streamOverride]);

  // Add ALL suggested subjects at once
  const addAllSuggested = () => {
    if (!selStdId || !subjOptions.length) return;
    setAddingAll(true);
    const newItems = subjOptions.map(name => ({
      id: generateId(), standardId: selStdId, name,
      type: "Theory", periodsPerWeek: 4, roomType: "Classroom",
      hasLab: false, labPeriodsPerWeek: 2, labRoomType: "Science Lab",
    }));
    setSubjects(p => [...p, ...newItems]);
    setTimeout(() => setAddingAll(false), 600);
    showToast(`✅ ${newItems.length} subjects added to ${selStd?.name}`);
  };

  const addSingle = () => {
    const nameToAdd = isSubjCustom ? subjCustomVal.trim() : subjSelectVal;
    if (!selStdId || !nameToAdd) {
      showToast("Please select or enter a subject name", "error"); return;
    }
    if (stdSubjects.some(s => s.name.toLowerCase() === nameToAdd.toLowerCase())) {
      showToast("Subject already exists for this class", "error"); return;
    }
    const item = { id: generateId(), standardId: selStdId, ...newSubj, name: nameToAdd };
    setSubjects(p => [...p, item]);
    if (isSubjCustom) setSubjCustomVal("");
    setNewSubj({ name:"", type:"Theory", periodsPerWeek:4, roomType:"Classroom", hasLab:false, labPeriodsPerWeek:2, labRoomType:"Science Lab" });
    showToast(`"${item.name}" added to ${selStd?.name}`);
  };

  const deleteSubj = (id) => { setSubjects(p => p.filter(s => s.id !== id)); showToast("Subject removed"); };
  const startEdit = (s) => { setEditId(s.id); setEditData({ ...s }); };
  const saveEdit = () => {
    setSubjects(p => p.map(s => s.id === editId ? { ...s, ...editData } : s));
    setEditId(null); showToast("Subject updated");
  };

  const [copyToStdId, setCopyToStdId] = useState("");
  const copySubjectsTo = () => {
    if (!copyToStdId || copyToStdId === selStdId) return;
    const targetStd = standards.find(s => s.id === copyToStdId);
    const existing = subjects.filter(s => s.standardId === copyToStdId).map(s => s.name.toLowerCase());
    const copies = stdSubjects.filter(s => !existing.includes(s.name.toLowerCase())).map(s => ({ ...s, id: generateId(), standardId: copyToStdId }));
    if (!copies.length) { showToast("All subjects already exist in target class", "error"); return; }
    setSubjects(p => [...p, ...copies]);
    setCopyToStdId("");
    showToast(`${copies.length} subjects copied to ${targetStd?.name}`);
  };

  return (
    <div className="setup-layout" style={{ display:"flex", gap:20, maxWidth:1100, alignItems:"flex-start" }}>

      {/* Left — Class selector */}
      <div className="setup-sidebar" style={{ width:220, flexShrink:0, display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.gray100}`, display:"flex", alignItems:"center", gap:8 }}>
            <i className="ti ti-books" style={{ fontSize:16, color:C.accent }} />
            <span style={{ fontSize:13, fontWeight:700, color:C.gray800 }}>Classes</span>
          </div>
          {standards.length === 0 ? (
            <div style={{ padding:20, textAlign:"center", color:C.gray400, fontSize:12 }}>
              <i className="ti ti-books" style={{ fontSize:24, display:"block", marginBottom:8, opacity:0.4 }} />
              No classes yet. Add classes first.
            </div>
          ) : (
            <>
              {/* Search Bar for Classes */}
              <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.gray100}` }}>
                <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                  <i className="ti ti-search" style={{ position:"absolute", left:10, fontSize:13, color:C.gray400 }} />
                  <input
                    type="text"
                    placeholder="Search classes..."
                    value={classSearchQuery}
                    onChange={e => setClassSearchQuery(e.target.value)}
                    style={{
                      width:"100%",
                      padding:"6px 8px 6px 30px",
                      border:`1.5px solid ${C.gray200}`,
                      borderRadius:8,
                      fontSize:12,
                      color:C.gray800,
                      outline:"none",
                      fontFamily:"inherit",
                      boxSizing:"border-box"
                    }}
                    onFocus={e => e.target.style.borderColor = C.accent}
                    onBlur={e => e.target.style.borderColor = C.gray200}
                  />
                  {classSearchQuery && (
                    <button
                      onClick={() => setClassSearchQuery("")}
                      style={{
                        position:"absolute",
                        right:8,
                        background:"none",
                        border:"none",
                        cursor:"pointer",
                        padding:0,
                        display:"flex",
                        alignItems:"center"
                      }}
                    >
                      <i className="ti ti-x" style={{ fontSize:12, color:C.gray400 }} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ maxHeight:400, overflowY:"auto" }}>
                {filteredStandards.length === 0 ? (
                  <div style={{ padding:20, textAlign:"center", color:C.gray400, fontSize:12 }}>
                    No classes match search.
                  </div>
                ) : (
                  filteredStandards.map(std => {
                    const count = subjects.filter(s => s.standardId === std.id).length;
                    const isSelected = selStdId === std.id;
                    return (
                      <div key={std.id} onClick={() => setSelStdId(std.id)} style={{
                        padding:"11px 16px", cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        background: isSelected ? C.accentLight : C.white,
                        borderLeft: isSelected ? `3px solid ${C.accent}` : "3px solid transparent",
                        borderBottom:`1px solid ${C.gray100}`,
                        transition:"all 0.12s",
                      }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:isSelected ? C.accent : C.gray700 }}>{std.name}</div>
                          <div style={{ fontSize:10, color:C.gray400, marginTop:1 }}>{std.sections.length} section{std.sections.length !== 1 ? "s" : ""}</div>
                        </div>
                        <span style={{
                          background: count > 0 ? C.accent : C.gray200,
                          color: count > 0 ? "#fff" : C.gray400,
                          borderRadius:10, fontSize:10, fontWeight:700, padding:"2px 7px",
                        }}>{count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Copy subjects panel */}
        {stdSubjects.length > 0 && standards.length > 1 && (
          <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.gray500, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.04em", display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-copy" style={{ fontSize:12 }} /> Copy to class
            </div>
            <select value={copyToStdId} onChange={e => setCopyToStdId(e.target.value)} style={{ ...inp, marginBottom:8, fontSize:12 }}>
              <option value="">Select class…</option>
              {standards.filter(s => s.id !== selStdId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={copySubjectsTo} disabled={!copyToStdId} style={{
              width:"100%", padding:"8px", borderRadius:8, border:"none",
              background:copyToStdId ? C.accent : C.gray200,
              color:copyToStdId ? "#fff" : C.gray400,
              fontSize:12, fontWeight:600, cursor:copyToStdId ? "pointer" : "not-allowed",
              fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}>
              <i className="ti ti-copy" style={{ fontSize:13 }} /> Copy Subjects
            </button>
          </div>
        )}
      </div>

      {/* Right — Subject management */}
      <div className="setup-content" style={{ flex:1 }}>
        {!selStd ? (
          <div style={{ textAlign:"center", padding:"60px 20px", background:C.white, borderRadius:16, border:`1px solid ${C.gray200}` }}>
            <i className="ti ti-hand-click" style={{ fontSize:40, color:C.gray300, display:"block", marginBottom:12 }} />
            <div style={{ fontSize:14, color:C.gray500 }}>Select a class on the left to manage its subjects</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              background:`linear-gradient(135deg, #1a4b8c, #2563eb)`,
              borderRadius:14, padding:"18px 22px", marginBottom:16,
              display:"flex", alignItems:"center", justifyContent:"space-between",
              boxShadow:"0 4px 20px rgba(26,75,140,0.25)",
            }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#fff" }}>{selStd.name}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginTop:3 }}>
                  {selStd.sections.length} section{selStd.sections.length !== 1 ? "s" : ""}{selStd.sections.length > 0 ? ` · ${selStd.sections.map(s => s.name).join(", ")}` : ""} · Subjects apply to all sections
                </div>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, color:"#fff", backdropFilter:"blur(4px)" }}>
                  {stdSubjects.length} subjects
                </div>
                {subjOptions.length > 0 && (
                  <button onClick={addAllSuggested} style={{
                    background:"#fff", color:C.accent,
                    border:"none", borderRadius:10, padding:"8px 16px",
                    fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                    display:"flex", alignItems:"center", gap:6,
                    boxShadow:"0 2px 8px rgba(0,0,0,0.15)",
                    opacity: addingAll ? 0.7 : 1,
                    transition:"all 0.2s",
                  }}>
                    {addingAll
                      ? <><i className="ti ti-loader-2" style={{ fontSize:14, animation:"spin 1s linear infinite" }} /> Adding…</>
                      : <><i className="ti ti-bolt" style={{ fontSize:14 }} /> Add All {subjOptions.length} Subjects</>
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Add Subjects Panel */}
            <div style={{ background:C.white, border:`1px solid ${C.gray200}`, borderRadius:14, padding:"18px 20px", marginBottom:16, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
              {/* Tab switcher */}
              <div style={{ display:"flex", gap:4, marginBottom:16, background:C.gray50, padding:3, borderRadius:9, width:"fit-content" }}>
                {[["quick", "ti-bolt", "Quick Add"], ["single", "ti-settings", "Custom Add"]].map(([tab, icon, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"6px 14px", borderRadius:7,
                    background: activeTab === tab ? C.white : "transparent",
                    border: activeTab === tab ? `1px solid ${C.gray200}` : "none",
                    color: activeTab === tab ? C.gray800 : C.gray500,
                    fontSize:12, fontWeight: activeTab === tab ? 600 : 400,
                    cursor:"pointer", fontFamily:"inherit",
                    boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}>
                    <i className={`ti ${icon}`} style={{ fontSize:13 }} /> {label}
                  </button>
                ))}
              </div>

              {/* Stream Selector for Senior Classes */}
              {isSenior(selStd.name) && (
                <div style={{
                  display:"flex",
                  alignItems:"center",
                  gap:10,
                  marginBottom:16,
                  paddingBottom:12,
                  borderBottom:`1.5px dashed ${C.gray200}`,
                  flexWrap:"wrap"
                }}>
                  <span style={{ fontSize:12, fontWeight:600, color:C.gray500, display:"flex", alignItems:"center", gap:4 }}>
                    <i className="ti ti-git-branch" style={{ fontSize:14, color:C.accent }} /> Suggestion Stream:
                  </span>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {[
                      { value: "auto", label: "Auto-detect" },
                      { value: "science", label: "Science" },
                      { value: "commerce", label: "Commerce" },
                      { value: "arts", label: "Arts / Humanities" }
                    ].map(opt => {
                      const isSelected = streamOverride === opt.value;
                      return (
                        <button key={opt.value} onClick={() => setStreamOverride(opt.value)} style={{
                          padding:"6px 12px", borderRadius:20,
                          border: isSelected ? `1.5px solid ${C.accent}` : `1.5px solid ${C.gray200}`,
                          background: isSelected ? C.accentLight : C.white,
                          color: isSelected ? C.accent : C.gray600,
                          fontSize:11, fontWeight: isSelected ? 700 : 500,
                          cursor:"pointer", fontFamily:"inherit",
                          transition:"all 0.12s",
                        }}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "quick" ? (
                // Quick Add — suggested subject chips
                <>
                  {subjOptions.length > 0 ? (
                    <>
                      <div style={{ fontSize:12, color:C.gray500, marginBottom:12 }}>
                        💡 Suggested subjects for <strong>{selStd.name}</strong>. Click any to add individually, or use "Add All" above.
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {subjOptions.map(o => (
                          <button key={o} onClick={() => {
                            const item = { id: generateId(), standardId: selStdId, name: o, type:"Theory", periodsPerWeek:4, roomType:"Classroom", hasLab:false, labPeriodsPerWeek:2, labRoomType:"Science Lab" };
                            setSubjects(p => [...p, item]);
                            showToast(`"${o}" added`);
                          }} style={{
                            display:"inline-flex", alignItems:"center", gap:5,
                            padding:"7px 14px", borderRadius:20,
                            background:C.accentLight, border:`1.5px solid ${C.accent}30`,
                            color:C.accent, fontSize:12, fontWeight:600,
                            cursor:"pointer", fontFamily:"inherit",
                            transition:"all 0.12s",
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.accent; }}
                          >
                            <i className="ti ti-plus" style={{ fontSize:11 }} /> {o}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign:"center", padding:"20px 0", color:C.success, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <i className="ti ti-circle-check-filled" style={{ fontSize:32 }} />
                      <div style={{ fontSize:13, fontWeight:600 }}>All suggested subjects have been added!</div>
                      <div style={{ fontSize:11, color:C.gray400 }}>Switch to "Custom Add" to add more subjects manually.</div>
                    </div>
                  )}
                </>
              ) : (
                // Single Add — name + settings
                <div style={{ background:C.gray50, border:`1px solid ${C.gray200}`, borderRadius:10, padding:16 }}>
                  <div className="setup-row-grid subject-add-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:10, alignItems:"end", marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>Subject Name</div>
                      {subjOptions.length > 0 && !isSubjCustom ? (
                        <div style={{ display:"flex", gap:4 }}>
                          <select value={subjSelectVal} onChange={e => { if (e.target.value === "custom") { setIsSubjCustom(true); } else { setSubjSelectVal(e.target.value); } }} style={inp}>
                            {subjOptions.map(o => <option key={o} value={o}>{o}</option>)}
                            <option value="custom">✍️ Custom / Other...</option>
                          </select>
                        </div>
                      ) : (
                        <div style={{ display:"flex", gap:4 }}>
                          <input value={subjCustomVal} onChange={e => setSubjCustomVal(e.target.value)} placeholder="e.g. Mathematics" style={{ ...inp, flex:1 }}
                            onKeyDown={e => e.key === "Enter" && addSingle()}
                            onFocus={e => e.target.style.borderColor = C.accent}
                            onBlur={e => e.target.style.borderColor = C.gray200}
                            autoFocus={isSubjCustom && subjOptions.length > 0} />
                          {subjOptions.length > 0 && (
                            <button onClick={() => setIsSubjCustom(false)} title="Back to list" style={{
                              display:"inline-flex", alignItems:"center", justifyContent:"center",
                              background:"none", border:`1.5px solid ${C.gray200}`, borderRadius:8,
                              width:38, height:38, cursor:"pointer",
                            }}>
                              <i className="ti ti-arrow-back" style={{ fontSize:14, color:C.gray400 }} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>Type</div>
                      <select value={newSubj.type} onChange={e => setNewSubj(p => ({...p, type:e.target.value}))} style={inp}>
                        {SUBJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>Periods/Wk</div>
                      <select value={newSubj.periodsPerWeek} onChange={e => setNewSubj(p => ({...p, periodsPerWeek:parseInt(e.target.value)}))} style={inp}>
                        {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>Room</div>
                      <select value={newSubj.roomType} onChange={e => setNewSubj(p => ({...p, roomType:e.target.value}))} style={inp}>
                        {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <button onClick={addSingle} style={{
                      width:38, height:38, borderRadius:8, border:"none",
                      background:C.accent, color:"#fff", cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, boxShadow:`0 2px 8px rgba(37,99,235,0.3)`,
                    }}>
                      <i className="ti ti-plus" style={{ fontSize:16 }} />
                    </button>
                  </div>

                  {/* Lab toggle */}
                  <div style={{ borderTop:`1px solid ${C.gray200}`, paddingTop:12 }}>
                    <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, fontWeight:600, color:C.gray700, cursor:"pointer", userSelect:"none" }}>
                      <input type="checkbox" checked={newSubj.hasLab || false} onChange={e => setNewSubj(p => ({...p, hasLab:e.target.checked}))}
                        style={{ width:16, height:16, accentColor:C.accent, cursor:"pointer" }} />
                      🔬 This subject has a separate Lab / Practical component
                    </label>
                    {newSubj.hasLab && (
                      <div className="setup-row-grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:10, background:C.white, border:`1px solid ${C.gray200}`, borderRadius:8, padding:12 }}>
                        <div>
                          <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4 }}>Lab Periods / Week</label>
                          <select value={newSubj.labPeriodsPerWeek || 2} onChange={e => setNewSubj(p => ({...p, labPeriodsPerWeek:parseInt(e.target.value)}))} style={inp}>
                            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} periods</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display:"block", fontSize:11, fontWeight:600, color:C.gray500, marginBottom:4 }}>Lab Room Type</label>
                          <select value={newSubj.labRoomType || "Science Lab"} onChange={e => setNewSubj(p => ({...p, labRoomType:e.target.value}))} style={inp}>
                            {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Subject list */}
            {stdSubjects.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 20px", background:C.white, border:`2px dashed ${C.gray200}`, borderRadius:14, color:C.gray400 }}>
                <i className="ti ti-notebook" style={{ fontSize:36, display:"block", marginBottom:10, opacity:0.4 }} />
                <div style={{ fontSize:14, fontWeight:600, color:C.gray500, marginBottom:4 }}>No subjects added yet</div>
                <div style={{ fontSize:12 }}>Use the buttons above to quickly add subjects for {selStd.name}</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {stdSubjects.map(s => {
                  const tc = TYPE_COLORS[s.type] || { bg:C.gray50, text:C.gray700, dot:C.gray400 };
                  return (
                    <div key={s.id} style={{
                      background:C.white, border:`1px solid ${C.gray200}`,
                      borderRadius:12, overflow:"hidden",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
                      transition:"box-shadow 0.15s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"}
                    >
                      {editId === s.id ? (
                        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                            <input value={editData.name} onChange={e => setEditData(p => ({...p, name:e.target.value}))}
                              style={{ ...inp, flex:"1 1 200px" }}
                              onFocus={e => e.target.style.borderColor = C.accent}
                              onBlur={e => e.target.style.borderColor = C.gray200} />
                            <select value={editData.type} onChange={e => setEditData(p => ({...p, type:e.target.value}))} style={{ ...inp, flex:"0 0 120px" }}>
                              {SUBJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <select value={editData.periodsPerWeek} onChange={e => setEditData(p => ({...p, periodsPerWeek:parseInt(e.target.value)}))} style={{ ...inp, flex:"0 0 100px" }}>
                              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} pw</option>)}
                            </select>
                            <select value={editData.roomType} onChange={e => setEditData(p => ({...p, roomType:e.target.value}))} style={{ ...inp, flex:"0 0 150px" }}>
                              {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.gray700, cursor:"pointer", marginBottom: editData.hasLab ? 10 : 0 }}>
                              <input type="checkbox" checked={editData.hasLab || false} onChange={e => setEditData(p => ({...p, hasLab:e.target.checked}))} style={{ accentColor:C.accent }} />
                              🔬 Include Lab / Practical component
                            </label>
                            {editData.hasLab && (
                              <div className="setup-row-grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:C.gray50, border:`1px solid ${C.gray200}`, borderRadius:8, padding:10 }}>
                                <div>
                                  <label style={{ display:"block", fontSize:10, color:C.gray500, marginBottom:2 }}>Lab Periods / Week</label>
                                  <select value={editData.labPeriodsPerWeek || 2} onChange={e => setEditData(p => ({...p, labPeriodsPerWeek:parseInt(e.target.value)}))} style={inp}>
                                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} periods</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ display:"block", fontSize:10, color:C.gray500, marginBottom:2 }}>Lab Room Type</label>
                                  <select value={editData.labRoomType || "Science Lab"} onChange={e => setEditData(p => ({...p, labRoomType:e.target.value}))} style={inp}>
                                    {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                            <button onClick={saveEdit} style={{ padding:"7px 16px", borderRadius:7, border:"none", background:C.success, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                              <i className="ti ti-check" style={{ fontSize:13 }} /> Save
                            </button>
                            <button onClick={() => setEditId(null)} style={{ padding:"7px 14px", borderRadius:7, border:`1px solid ${C.gray200}`, background:"none", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", padding:"12px 16px", gap:12 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:tc.dot, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.gray800, marginBottom:2 }}>{s.name}</div>
                            {s.hasLab ? (
                              <div style={{ fontSize:11, color:C.gray400 }}>
                                Theory: {s.periodsPerWeek} periods/wk ({s.roomType}) &nbsp;·&nbsp;
                                <span style={{ color:"#0891b2", fontWeight:500 }}>Lab: {s.labPeriodsPerWeek} periods/wk ({s.labRoomType || "Science Lab"})</span>
                              </div>
                            ) : (
                              <div style={{ fontSize:11, color:C.gray400 }}>{s.periodsPerWeek} periods/wk · {s.roomType}</div>
                            )}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:tc.bg, color:tc.text }}>{s.type}</span>
                            {s.hasLab && (
                              <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:"#ecfeff", color:"#0e7490" }}>🔬 Lab</span>
                            )}
                            <button onClick={() => startEdit(s)} style={{ background:"none", border:`1.5px solid ${C.gray200}`, borderRadius:7, padding:"5px 9px", cursor:"pointer", color:C.gray500, fontSize:12, display:"flex", alignItems:"center" }}>
                              <i className="ti ti-edit" style={{ fontSize:13 }} />
                            </button>
                            <button onClick={() => deleteSubj(s.id)} style={{ background:"none", border:`1.5px solid ${C.gray200}`, borderRadius:7, padding:"5px 9px", cursor:"pointer", color:C.danger, fontSize:12, display:"flex", alignItems:"center" }}>
                              <i className="ti ti-trash" style={{ fontSize:13 }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontSize:11, color:C.gray400, textAlign:"right", marginTop:4, padding:"4px 8px" }}>
                  Total: {stdSubjects.reduce((sum, s) => sum + (parseInt(s.periodsPerWeek)||0) + (s.hasLab ? (parseInt(s.labPeriodsPerWeek)||0) : 0), 0)} periods/week for {selStd.name}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

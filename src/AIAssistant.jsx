import { useState, useRef, useEffect } from "react";
import { DAYS } from "./timetableEngine";

const C = {
  accent:"#2563eb", primary:"#1a4b8c", success:"#16a34a", danger:"#dc2626",
  warning:"#d97706", gray100:"#f1f5f9", gray200:"#e2e8f0", gray300:"#cbd5e1",
  gray400:"#94a3b8", gray500:"#64748b", gray600:"#475569", gray700:"#334155",
  gray800:"#1e293b", white:"#ffffff",
};

// ─── NLP command processor ────────────────────────────────────────────────────
function processCommand(input, { standards, subjects, teachers, generatedTT, institute }) {
  const text = input.toLowerCase().trim();

  // Help
  if (/^help|what can you|commands|how to/.test(text)) {
    return {
      type:"list",
      icon:"ti-help-circle",
      iconColor:C.accent,
      title:"Available Commands",
      items:[
        "📊 'Show summary' — overall timetable statistics",
        "⚠️ 'Show conflicts' — list all detected conflicts",
        "👩‍🏫 'Show overloaded teachers' — teachers exceeding their limits",
        "🕐 'Who is free on [Day] Period [N]?' — find available teachers",
        "📚 'Incomplete subjects' — subjects with missing periods",
        "⏩ 'Back-to-back periods' — find consecutive same-teacher periods",
        "📋 'Free periods for Class [X]' — show empty slots",
        "⚖️ 'Teacher workload' — weekly period count for all teachers",
        "🔄 'Generate timetable' — regenerate the full timetable",
      ]
    };
  }

  if (!generatedTT) {
    return { type:"error", icon:"ti-alert-circle", text:"No timetable generated yet. Please generate a timetable first." };
  }

  const { timetable, teacherSchedule } = generatedTT;
  const days = DAYS.slice(0, institute.workingDays);

  // ── Summary ────────────────────────────────────────────────────────────
  if (/summary|overview|report|status/.test(text)) {
    let totalSlots = 0, filled = 0;
    Object.values(timetable).forEach(ct => Object.values(ct).forEach(dt => Object.values(dt).forEach(cell => { totalSlots++; if (cell) filled++; })));
    const freeTeachers = teachers.filter(t => {
      const ts = teacherSchedule[t.id];
      let count = 0;
      if (ts) Object.values(ts).forEach(d => { count += Object.values(d).filter(Boolean).length; });
      return count === 0;
    });
    return {
      type:"stats",
      title:"Timetable Summary",
      stats:[
        { label:"Fill rate", value:`${Math.round((filled/totalSlots)*100)}%`, color:C.success },
        { label:"Filled slots", value:`${filled}/${totalSlots}`, color:C.accent },
        { label:"Classes", value:standards.length, color:C.primary },
        { label:"Total teachers", value:teachers.length, color:"#7c3aed" },
        { label:"Unassigned teachers", value:freeTeachers.length, color:C.warning },
        { label:"Working days", value:institute.workingDays, color:C.gray600 },
      ]
    };
  }

  // ── Conflicts ──────────────────────────────────────────────────────────
  if (/conflict/.test(text)) {
    const conflicts = [];
    // Teacher double-bookings
    teachers.forEach(t => {
      const ts = teacherSchedule[t.id];
      if (!ts) return;
      days.forEach(d => {
        const slots = Object.entries(ts[d]||{}).filter(([,v])=>v);
        if (slots.length > 1) {
          // Check if scheduled >1 at same period (shouldn't happen but validate)
        }
      });
      // Check daily limit
      days.forEach(d => {
        const count = Object.values(ts[d]||{}).filter(Boolean).length;
        if (t.dailyLimit && count > parseInt(t.dailyLimit)) {
          conflicts.push(`⚠️ ${t.name} has ${count} periods on ${d} (limit: ${t.dailyLimit})`);
        }
      });
    });
    // Coverage gaps
    standards.forEach(std => std.sections.forEach(sec => {
      const key = `${std.id}_${sec.id}`;
      subjects.filter(s => s.standardId === std.id).forEach(sub => {
        const req = parseInt(sub.periodsPerWeek)||0;
        let got = 0;
        Object.values(timetable[key]||{}).forEach(d => Object.values(d).forEach(c => { if (c?.subject?.id===sub.id) got++; }));
        if (got < req) conflicts.push(`📉 ${std.name}-${sec.name}: ${sub.name} ${got}/${req} periods`);
      });
    }));

    if (!conflicts.length) return { type:"success", icon:"ti-circle-check-filled", text:"No conflicts detected! Your timetable looks great." };
    return { type:"list", icon:"ti-alert-triangle", iconColor:C.danger, title:`${conflicts.length} Issues Found`, items:conflicts };
  }

  // ── Overloaded teachers ────────────────────────────────────────────────
  if (/overload|overwork|too many period/.test(text)) {
    const overloaded = [];
    teachers.forEach(t => {
      const ts = teacherSchedule[t.id];
      let weekly = 0;
      days.forEach(d => {
        const dayCount = Object.values(ts?.[d]||{}).filter(Boolean).length;
        weekly += dayCount;
        if (t.dailyLimit && dayCount > parseInt(t.dailyLimit))
          overloaded.push(`${t.name}: ${dayCount} periods on ${d} (daily limit: ${t.dailyLimit})`);
      });
      if (t.weeklyLimit && weekly > parseInt(t.weeklyLimit))
        overloaded.push(`${t.name}: ${weekly} periods/week (weekly limit: ${t.weeklyLimit})`);
    });
    if (!overloaded.length) return { type:"success", icon:"ti-circle-check-filled", text:"No overloaded teachers found. Workload looks balanced!" };
    return { type:"list", icon:"ti-alert-triangle", iconColor:C.danger, title:`${overloaded.length} Overloaded Teacher${overloaded.length>1?"s":""}`, items:overloaded };
  }

  // ── Who is free on Day Period N ─────────────────────────────────────────
  if (/free on|available on|who.*free|free.*period/.test(text)) {
    // Extract day
    let foundDay = days.find(d => text.includes(d.toLowerCase()));
    // Extract period number
    const pMatch = text.match(/period\s*(\d+)|p(\d+)/i);
    const pNum = pMatch ? parseInt(pMatch[1]||pMatch[2]) : null;

    if (!foundDay || !pNum) {
      return { type:"text", icon:"ti-info-circle", text:`Please specify a day and period. Example: "Who is free on Monday Period 3?"` };
    }

    const freeTeachers = teachers.filter(t => {
      const ts = teacherSchedule[t.id];
      return !ts?.[foundDay]?.[pNum];
    });
    const busyTeachers = teachers.filter(t => teacherSchedule[t.id]?.[foundDay]?.[pNum]);

    return {
      type:"list",
      icon:"ti-calendar-check",
      iconColor:C.success,
      title:`${foundDay} – Period ${pNum}`,
      items:[
        ...freeTeachers.length ? [`✅ Free (${freeTeachers.length}): ${freeTeachers.map(t=>t.name).join(", ")}`] : ["No teachers are free at this slot."],
        ...busyTeachers.length ? [`🔴 Busy (${busyTeachers.length}): ${busyTeachers.map(t=>{const e=teacherSchedule[t.id][foundDay][pNum]; return `${t.name} (${e.class?.name||""}-${e.section?.name||""})`; }).join(", ")}`] : [],
      ]
    };
  }

  // ── Incomplete subjects ───────────────────────────────────────────────
  if (/incomplete|missing|not enough|short/.test(text)) {
    const issues = [];
    standards.forEach(std => std.sections.forEach(sec => {
      const key = `${std.id}_${sec.id}`;
      subjects.filter(s => s.standardId === std.id).forEach(sub => {
        const req = parseInt(sub.periodsPerWeek)||0;
        let got = 0;
        Object.values(timetable[key]||{}).forEach(d => Object.values(d).forEach(c => { if (c?.subject?.id===sub.id) got++; }));
        if (got < req) issues.push(`${std.name}-${sec.name}: ${sub.name} — ${got}/${req} periods (${req-got} missing)`);
      });
    }));
    if (!issues.length) return { type:"success", icon:"ti-circle-check-filled", text:"All subjects meet their required period counts!" };
    return { type:"list", icon:"ti-book-off", iconColor:C.warning, title:`${issues.length} Subject${issues.length>1?"s":""} with Incomplete Coverage`, items:issues };
  }

  // ── Back-to-back periods ──────────────────────────────────────────────
  if (/back.to.back|consecutive|back2back/.test(text)) {
    const btb = [];
    teachers.forEach(t => {
      const ts = teacherSchedule[t.id];
      days.forEach(d => {
        const daySlots = ts?.[d] || {};
        const nums = Object.keys(daySlots).map(Number).sort((a,b)=>a-b);
        for (let i = 0; i < nums.length - 1; i++) {
          if (daySlots[nums[i]] && daySlots[nums[i+1]] && nums[i+1]===nums[i]+1) {
            const a = daySlots[nums[i]], b = daySlots[nums[i+1]];
            btb.push(`${t.name}: Back-to-back on ${d} P${nums[i]}(${a.class?.name||""}) + P${nums[i+1]}(${b.class?.name||""})`);
          }
        }
      });
    });
    if (!btb.length) return { type:"success", icon:"ti-circle-check-filled", text:"No back-to-back periods found." };
    return { type:"list", icon:"ti-clock-2", iconColor:C.warning, title:`${btb.length} Back-to-Back Instance${btb.length>1?"s":""}`, items:btb };
  }

  // ── Free periods for class ────────────────────────────────────────────
  if (/free period.*class|empty.*class|class.*free|unassigned.*class/.test(text)) {
    const classMatch = standards.find(s => text.includes(s.name.toLowerCase()));
    if (!classMatch) {
      return { type:"text", icon:"ti-info-circle", text:`Please specify a class name. Example: "Free periods for Class 8A"` };
    }
    const items = [];
    classMatch.sections.forEach(sec => {
      const key = `${classMatch.id}_${sec.id}`;
      const freeSlots = [];
      days.forEach(d => {
        Object.entries(timetable[key]?.[d]||{}).forEach(([pNum, cell]) => {
          if (!cell) freeSlots.push(`${d} P${pNum}`);
        });
      });
      if (freeSlots.length) items.push(`${classMatch.name}-${sec.name}: ${freeSlots.join(", ")}`);
      else items.push(`${classMatch.name}-${sec.name}: No free periods`);
    });
    return { type:"list", icon:"ti-calendar-off", iconColor:C.accent, title:`Free Periods — ${classMatch.name}`, items };
  }

  // ── Teacher workload ──────────────────────────────────────────────────
  if (/workload|period count|weekly|how many period/.test(text)) {
    const items = teachers.map(t => {
      const ts = teacherSchedule[t.id];
      let weekly = 0;
      days.forEach(d => { weekly += Object.values(ts?.[d]||{}).filter(Boolean).length; });
      const status = t.weeklyLimit && weekly > parseInt(t.weeklyLimit) ? "⚠️ OVER" :
                     t.weeklyLimit && weekly >= parseInt(t.weeklyLimit)*0.9 ? "🟡 Near" : "✅";
      return `${status} ${t.name}: ${weekly} periods/week${t.weeklyLimit?` (limit: ${t.weeklyLimit})`:""}`;
    }).sort();
    return { type:"list", icon:"ti-chart-bar", iconColor:C.accent, title:"Weekly Teacher Workload", items };
  }

  // ── Generate ──────────────────────────────────────────────────────────
  if (/generate|create|regenerate/.test(text)) {
    return { type:"action", icon:"ti-wand", text:"This will regenerate the entire timetable. Any manual edits will be lost.", actionLabel:"Generate Now", actionKey:"generate" };
  }

  // Fallback
  return {
    type:"text", icon:"ti-message-question", iconColor:C.gray400,
    text:`I didn't understand that command. Type "help" to see what I can do.`
  };
}

// ─── AI Assistant panel ───────────────────────────────────────────────────────
export default function AIAssistant({ isOpen, onClose, data, onAction }) {
  const [messages, setMessages] = useState([
    {
      id: 1, role:"assistant",
      result: { type:"text", icon:"ti-sparkles", iconColor:C.accent, text:"Hi! I'm your timetable assistant. Ask me anything about your schedule — or type 'help' to see all commands." }
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const quickChips = [
    "Show summary",
    "Show conflicts",
    "Overloaded teachers",
    "Teacher workload",
    "Incomplete subjects",
    "Back-to-back periods",
  ];

  const send = (text) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), role:"user", text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const result = processCommand(text, data);
      const assistantMsg = { id: Date.now()+1, role:"assistant", result };
      setMessages(prev => [...prev, assistantMsg]);
      setLoading(false);
      if (result.type === "action") setPendingAction(result);
    }, 300);
  };

  const confirmAction = () => {
    if (pendingAction?.actionKey === "generate") onAction("generate");
    setPendingAction(null);
  };

  function ResultBlock({ result }) {
    if (!result) return null;
    const iconEl = result.icon && <i className={`ti ${result.icon}`} style={{ fontSize:16, color:result.iconColor||C.accent, flexShrink:0, marginTop:1 }} />;

    if (result.type === "success") return (
      <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 12px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10 }}>
        <i className="ti ti-circle-check-filled" style={{ fontSize:16, color:C.success, flexShrink:0, marginTop:1 }} />
        <span style={{ fontSize:13, color:"#166534" }}>{result.text}</span>
      </div>
    );

    if (result.type === "error") return (
      <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 12px", background:"#fff8f8", border:"1px solid #fecaca", borderRadius:10 }}>
        {iconEl}<span style={{ fontSize:13, color:"#7f1d1d" }}>{result.text}</span>
      </div>
    );

    if (result.type === "text") return (
      <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10 }}>
        {iconEl}<span style={{ fontSize:13, color:C.gray700, lineHeight:1.6 }}>{result.text}</span>
      </div>
    );

    if (result.type === "list") return (
      <div style={{ padding:"10px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10 }}>
        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8, fontSize:13, fontWeight:700, color:C.gray800 }}>
          {iconEl}{result.title}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {result.items.map((item, i) => (
            <div key={i} style={{ fontSize:12, color:C.gray700, lineHeight:1.5, paddingLeft:4 }}>{item}</div>
          ))}
        </div>
      </div>
    );

    if (result.type === "stats") return (
      <div style={{ padding:"10px 12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.gray800, marginBottom:10 }}>{result.title}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {result.stats.map((s, i) => (
            <div key={i} style={{ background:C.white, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:C.gray400 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );

    if (result.type === "action") return (
      <div style={{ padding:"10px 12px", background:"#fff8f3", border:`1px solid ${C.warning}40`, borderRadius:10 }}>
        <div style={{ display:"flex", gap:6, alignItems:"flex-start", marginBottom:10 }}>
          {iconEl}<span style={{ fontSize:13, color:C.gray700 }}>{result.text}</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={confirmAction}
            style={{ padding:"7px 16px", borderRadius:8, border:"none", background:C.accent, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
            <i className="ti ti-check" style={{ marginRight:5 }} />{result.actionLabel}
          </button>
          <button onClick={() => setPendingAction(null)}
            style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.gray200}`, background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>Cancel</button>
        </div>
      </div>
    );

    return null;
  }

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        .ai-panel { animation: slideInRight 0.2s ease; }
      `}</style>
      {/* Backdrop */}
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.15)", zIndex:9000 }} onClick={onClose} />

      {/* Panel */}
      <div className="ai-panel" style={{
        position:"fixed", top:0, right:0, bottom:0, width:360,
        background:C.white, borderLeft:`1px solid ${C.gray200}`,
        boxShadow:"-8px 0 32px rgba(0,0,0,0.12)", zIndex:9001,
        display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{ padding:"16px 18px", borderBottom:`1px solid ${C.gray200}`, background:`linear-gradient(135deg,${C.primary},${C.accent})`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <i className="ti ti-robot" style={{ fontSize:18, color:"#fff" }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>AI Assistant</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)" }}>Smart timetable insights & actions</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:7, color:"#fff", width:30, height:30, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✕</button>
          </div>
        </div>

        {/* Quick chips */}
        <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.gray100}`, display:"flex", gap:5, flexWrap:"wrap", flexShrink:0 }}>
          {quickChips.map(chip => (
            <button key={chip} onClick={() => send(chip)}
              style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${C.gray200}`, background:C.gray100, color:C.gray700, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {chip}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px", display:"flex", flexDirection:"column", gap:12 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display:"flex", flexDirection:"column", gap:4, alignItems: msg.role==="user"?"flex-end":"flex-start" }}>
              {msg.role === "user" ? (
                <div style={{ background:C.accent, color:"#fff", borderRadius:"12px 12px 4px 12px", padding:"9px 14px", fontSize:13, maxWidth:"85%", lineHeight:1.5 }}>
                  {msg.text}
                </div>
              ) : (
                <div style={{ maxWidth:"98%" }}>
                  <ResultBlock result={msg.result} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:6, alignItems:"center", padding:"10px 12px", background:C.gray100, borderRadius:10, width:"fit-content" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.accent, animation:`bounce 1s ${i*0.2}s infinite ease-in-out` }} />
              ))}
              <style>{`@keyframes bounce{0%,100%{transform:scale(0.6);opacity:0.4}50%{transform:scale(1);opacity:1}}`}</style>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.gray200}`, flexShrink:0 }}>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask me about your timetable…"
              rows={2}
              style={{
                flex:1, padding:"9px 12px", border:`1.5px solid ${C.gray200}`, borderRadius:9,
                fontSize:13, fontFamily:"inherit", outline:"none", resize:"none",
                color:C.gray800, background:"#fff", lineHeight:1.5,
              }}
              onFocus={e=>(e.target.style.borderColor=C.accent)}
              onBlur={e=>(e.target.style.borderColor=C.gray200)}
            />
            <button onClick={() => send(input)} disabled={!input.trim()||loading}
              style={{ padding:"10px 14px", borderRadius:9, border:"none", background:input.trim()&&!loading?C.accent:C.gray200, color:input.trim()&&!loading?"#fff":C.gray400, cursor:input.trim()&&!loading?"pointer":"not-allowed", fontFamily:"inherit", flexShrink:0 }}>
              <i className="ti ti-send" style={{ fontSize:16 }} />
            </button>
          </div>
          <div style={{ fontSize:10, color:C.gray400, marginTop:5 }}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>
    </>
  );
}

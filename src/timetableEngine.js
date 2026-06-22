
// ─── Core timetable logic ─────────────────────────────────────────────────────

export const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const PERIOD_COLORS = ["#dbeafe","#dcfce7","#fef3c7","#fce7f3","#ede9fe","#ccfbf1","#fee2e2","#fff7ed"];
export const SUBJECT_TYPES = ["Theory","Practical","Lab","Sports","Library","Activity"];
export const ROOM_TYPES = ["Classroom","Computer Lab","Science Lab","Library","Sports Ground","Auditorium"];

export function generateId() {
  return Math.random().toString(36).substr(2,9);
}

// Compute all time slots (periods + breaks) for a day
export function computePeriods(institute) {
  const periods = [];
  const [sh, sm] = institute.startTime.split(":").map(Number);
  let current = sh * 60 + sm;
  let periodNum = 1;
  for (let i = 0; i < institute.periodsPerDay; i++) {
    const end = current + parseInt(institute.periodDuration);
    const toTime = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
    const startStr = toTime(current);
    const endStr = toTime(end);
    const breakMin = institute.breakStart.split(":").map(Number).reduce((a,b)=>a*60+b);
    const lunchMin = institute.lunchStart.split(":").map(Number).reduce((a,b)=>a*60+b);
    if (current === breakMin) {
      periods.push({ type:"break", label:"Short Break", start:startStr, end:institute.breakEnd });
      current = institute.breakEnd.split(":").map(Number).reduce((a,b)=>a*60+b);
      i--; continue;
    }
    if (current === lunchMin) {
      periods.push({ type:"break", label:"Lunch Break", start:startStr, end:institute.lunchEnd });
      current = institute.lunchEnd.split(":").map(Number).reduce((a,b)=>a*60+b);
      i--; continue;
    }
    periods.push({ type:"period", label:`Period ${periodNum}`, num:periodNum, start:startStr, end:endStr });
    periodNum++;
    current = end;
  }
  return periods;
}

// Check if a teacher can teach a subject for a given standard/section (new assignment model)
export function teacherCanTeach(teacher, subjectId, standardId, sectionId) {
  // New model: assignments array
  if (teacher.assignments?.length) {
    return teacher.assignments.some(a =>
      a.standardId === standardId &&
      a.subjectIds?.includes(subjectId) &&
      (a.sectionIds?.length === 0 || !a.sectionIds || a.sectionIds.includes(sectionId))
    );
  }
  // Backward compat: old flat subjects array
  return teacher.subjects?.includes(subjectId) || false;
}

// Generate timetable (standard-wise subjects — same subjects applied to all sections)
export function generateTimetable(institute, standards, subjects, teachers, rooms) {
  const days = DAYS.slice(0, institute.workingDays);
  const periods = computePeriods(institute).filter(p => p.type === "period");
  const timetable = {};
  const teacherSchedule = {};
  const roomSchedule = {};

  teachers.forEach(t => {
    teacherSchedule[t.id] = {};
    days.forEach(d => { teacherSchedule[t.id][d] = {}; });
  });
  rooms.forEach(r => {
    roomSchedule[r.id] = {};
    days.forEach(d => { roomSchedule[r.id][d] = {}; });
  });

  standards.forEach(std => {
    // ── Standard-wise: same subjects for ALL sections of this standard ──
    const stdSubjects = subjects.filter(s => s.standardId === std.id);

    std.sections.forEach(sec => {
      const key = `${std.id}_${sec.id}`;
      timetable[key] = {};
      days.forEach(d => {
        timetable[key][d] = {};
        periods.forEach(p => { timetable[key][d][p.num] = null; });
      });

      // Build period slot queue from periodsPerWeek
      const slots = [];
      stdSubjects.forEach(sub => {
        const theoryPeriods = parseInt(sub.periodsPerWeek) || 0;
        for (let i = 0; i < theoryPeriods; i++) {
          slots.push(sub);
        }
        if (sub.hasLab) {
          const labPeriods = parseInt(sub.labPeriodsPerWeek) || 0;
          const labRoom = sub.labRoomType || "Science Lab";
          for (let i = 0; i < labPeriods; i++) {
            slots.push({
              ...sub,
              name: sub.name + " (Lab)",
              roomType: labRoom,
              isLabCell: true
            });
          }
        }
      });
      slots.sort(() => Math.random() - 0.5);

      // ── Pre-schedule Class Teacher's Periods ──
      if (sec.classTeacherId) {
        const classTeacher = teachers.find(t => t.id === sec.classTeacherId);
        if (classTeacher) {
          days.forEach(d => {
            // Resolve the target period number
            const targetPeriodNum = d === "Friday"
              ? (sec.classTeacherPeriodFriday !== undefined && sec.classTeacherPeriodFriday !== null ? sec.classTeacherPeriodFriday : 2)
              : (sec.classTeacherPeriodNormal !== undefined && sec.classTeacherPeriodNormal !== null ? sec.classTeacherPeriodNormal : 1);

            if (targetPeriodNum === "none" || targetPeriodNum === null) return;

            const targetPeriod = periods.find(p => p.num === targetPeriodNum);
            if (!targetPeriod) return;

            // Find a subject slot for the class teacher
            const slotIndex = slots.findIndex(sub => {
              if (sec.classTeacherSubjectId && sub.id !== sec.classTeacherSubjectId) return false;
              if (!teacherCanTeach(classTeacher, sub.id, std.id, sec.id)) return false;
              if (teacherSchedule[classTeacher.id][d][targetPeriodNum]) return false;
              const dailyCount = Object.values(teacherSchedule[classTeacher.id][d]).filter(Boolean).length;
              if (classTeacher.dailyLimit && dailyCount >= parseInt(classTeacher.dailyLimit)) return false;
              return true;
            });

            if (slotIndex !== -1) {
              const sub = slots[slotIndex];
              const eligibleRooms = rooms.filter(r =>
                (!sub.roomType || r.type === sub.roomType) && !roomSchedule[r.id][d][targetPeriodNum]
              );
              const room = eligibleRooms[0] || null;

              // Assign
              timetable[key][d][targetPeriodNum] = { subject: sub, teacher: classTeacher, room };
              teacherSchedule[classTeacher.id][d][targetPeriodNum] = { subject: sub, class: std, section: sec };
              if (room) roomSchedule[room.id][d][targetPeriodNum] = { subject: sub, class: std, section: sec };

              // Remove from slots queue
              slots.splice(slotIndex, 1);
            }
          });
        }
      }

      const order = [];
      days.forEach(d => periods.forEach(p => order.push({ d, p })));
      order.sort(() => Math.random() - 0.5);

      // Helper to count periods of a subject on a day
      const getSubjectDailyCount = (day, subjectId) => {
        return Object.values(timetable[key][day] || {}).filter(cell => cell && cell.subject?.id === subjectId).length;
      };

      order.forEach(({ d, p }) => {
        // Skip if this slot was already pre-scheduled (e.g. by Class Teacher)
        if (timetable[key][d][p.num]) return;

        if (!slots.length) return;

        // Try to find a subject that satisfies the distribution rule
        let chosenIdx = -1;
        let chosenTeacher = null;
        let chosenRoom = null;

        for (let i = 0; i < slots.length; i++) {
          const sub = slots[i];
          const weeklyCount = parseInt(sub.periodsPerWeek) || 0;
          const dailyCount = getSubjectDailyCount(d, sub.id);

          // Rule check: if <= working days, no doubling. If > working days, at most 2 per day.
          if (weeklyCount <= days.length && dailyCount >= 1) continue;
          if (weeklyCount > days.length && dailyCount >= 2) continue;

          // Teacher check
          const eligible = teachers.filter(t => {
            if (!teacherCanTeach(t, sub.id, std.id, sec.id)) return false;
            if (teacherSchedule[t.id][d][p.num]) return false;
            const dailyCountTeacher = Object.values(teacherSchedule[t.id][d]).filter(Boolean).length;
            if (t.dailyLimit && dailyCountTeacher >= parseInt(t.dailyLimit)) return false;
            return true;
          });

          if (!eligible.length) continue;

          // Room check
          const eligibleRooms = rooms.filter(r =>
            (!sub.roomType || r.type === sub.roomType) && !roomSchedule[r.id][d][p.num]
          );
          if (!eligibleRooms.length && sub.roomType) continue;

          chosenIdx = i;
          chosenTeacher = eligible[Math.floor(Math.random() * eligible.length)];
          chosenRoom = eligibleRooms[0] || null;
          break;
        }

        // Fallback: If no subject fits the strict distribution rule, pick first that can be scheduled at all
        if (chosenIdx === -1) {
          for (let i = 0; i < slots.length; i++) {
            const sub = slots[i];
            const eligible = teachers.filter(t => {
              if (!teacherCanTeach(t, sub.id, std.id, sec.id)) return false;
              if (teacherSchedule[t.id][d][p.num]) return false;
              const dailyCountTeacher = Object.values(teacherSchedule[t.id][d]).filter(Boolean).length;
              if (t.dailyLimit && dailyCountTeacher >= parseInt(t.dailyLimit)) return false;
              return true;
            });

            if (!eligible.length) continue;

            const eligibleRooms = rooms.filter(r =>
              (!sub.roomType || r.type === sub.roomType) && !roomSchedule[r.id][d][p.num]
            );
            if (!eligibleRooms.length && sub.roomType) continue;

            chosenIdx = i;
            chosenTeacher = eligible[Math.floor(Math.random() * eligible.length)];
            chosenRoom = eligibleRooms[0] || null;
            break;
          }
        }

        // If we found a slot, assign it
        if (chosenIdx !== -1) {
          const sub = slots[chosenIdx];
          timetable[key][d][p.num] = { subject: sub, teacher: chosenTeacher, room: chosenRoom };
          teacherSchedule[chosenTeacher.id][d][p.num] = { subject: sub, class: std, section: sec };
          if (chosenRoom) roomSchedule[chosenRoom.id][d][p.num] = { subject: sub, class: std, section: sec };

          // Remove the scheduled slot
          slots.splice(chosenIdx, 1);
        }
      });
    });
  });

  return { timetable, teacherSchedule, roomSchedule, periods, days };
}

// Validate a drag-and-drop swap for conflicts
export function validateDrop(timetable, teacherSchedule, src, tgt) {
  // Same cell
  if (src.classKey === tgt.classKey && src.day === tgt.day && src.periodNum === tgt.periodNum)
    return { valid: true };

  const srcCell = timetable[src.classKey]?.[src.day]?.[src.periodNum];
  const tgtCell = timetable[tgt.classKey]?.[tgt.day]?.[tgt.periodNum];

  if (!srcCell && !tgtCell) return { valid: true };

  // Check: source teacher busy at target slot in a DIFFERENT class?
  if (srcCell?.teacher) {
    const busyAt = teacherSchedule[srcCell.teacher.id]?.[tgt.day]?.[tgt.periodNum];
    if (busyAt) {
      // It's OK if it's the target cell itself (we're swapping it)
      const isSameClassEntry = tgt.classKey === src.classKey;
      const isTargetCellEntry =
        busyAt.class?.id === tgt.classKey.split("_")[0] &&
        busyAt.section?.id === tgt.classKey.split("_")[1];
      if (!isSameClassEntry && !isTargetCellEntry) {
        return {
          valid: false,
          reason: `${srcCell.teacher.name} is already teaching ${busyAt.class?.name || "another class"} – ${busyAt.section?.name || ""} on ${tgt.day} Period ${tgt.periodNum}.`
        };
      }
    }
  }

  // Check: target teacher busy at source slot in a DIFFERENT class?
  if (tgtCell?.teacher) {
    const busyAt = teacherSchedule[tgtCell.teacher.id]?.[src.day]?.[src.periodNum];
    if (busyAt) {
      const isSameClassEntry = src.classKey === tgt.classKey;
      const isSourceCellEntry =
        busyAt.class?.id === src.classKey.split("_")[0] &&
        busyAt.section?.id === src.classKey.split("_")[1];
      if (!isSameClassEntry && !isSourceCellEntry) {
        return {
          valid: false,
          reason: `${tgtCell.teacher.name} is already teaching ${busyAt.class?.name || "another class"} – ${busyAt.section?.name || ""} on ${src.day} Period ${src.periodNum}.`
        };
      }
    }
  }

  return { valid: true };
}

// Apply a validated swap and return new timetable state
export function applySwap(generatedTT, src, tgt) {
  const newState = JSON.parse(JSON.stringify(generatedTT));
  const { timetable, teacherSchedule } = newState;

  const srcCell = timetable[src.classKey]?.[src.day]?.[src.periodNum] || null;
  const tgtCell = timetable[tgt.classKey]?.[tgt.day]?.[tgt.periodNum] || null;

  // Swap cells
  if (!timetable[src.classKey][src.day]) timetable[src.classKey][src.day] = {};
  if (!timetable[tgt.classKey][tgt.day]) timetable[tgt.classKey][tgt.day] = {};
  timetable[src.classKey][src.day][src.periodNum] = tgtCell;
  timetable[tgt.classKey][tgt.day][tgt.periodNum] = srcCell;

  // Update teacher schedules
  const [srcStdId, srcSecId] = src.classKey.split("_");
  const [tgtStdId, tgtSecId] = tgt.classKey.split("_");

  if (srcCell?.teacher) {
    if (teacherSchedule[srcCell.teacher.id]?.[src.day])
      delete teacherSchedule[srcCell.teacher.id][src.day][src.periodNum];
    if (!teacherSchedule[srcCell.teacher.id][tgt.day]) teacherSchedule[srcCell.teacher.id][tgt.day] = {};
    teacherSchedule[srcCell.teacher.id][tgt.day][tgt.periodNum] = {
      subject: srcCell.subject,
      class: { id: tgtStdId },
      section: { id: tgtSecId }
    };
  }
  if (tgtCell?.teacher) {
    if (teacherSchedule[tgtCell.teacher.id]?.[tgt.day])
      delete teacherSchedule[tgtCell.teacher.id][tgt.day][tgt.periodNum];
    if (!teacherSchedule[tgtCell.teacher.id][src.day]) teacherSchedule[tgtCell.teacher.id][src.day] = {};
    teacherSchedule[tgtCell.teacher.id][src.day][src.periodNum] = {
      subject: tgtCell.subject,
      class: { id: srcStdId },
      section: { id: srcSecId }
    };
  }

  return newState;
}

// Full timetable validation — returns { warnings, score }
export function validateFullTimetable(generatedTT, standards, subjects, teachers, rules = []) {
  if (!generatedTT) return { warnings: [], score: 0, filledSlots: 0, totalSlots: 0 };
  const { timetable, teacherSchedule } = generatedTT;
  const warnings = [];

  const isRuleEnabled = (ruleId) => {
    const rule = rules.find(r => r.id === ruleId);
    return rule ? rule.enabled : true;
  };

  // Teacher daily/weekly overload
  if (isRuleEnabled("teacher-limits")) {
    teachers.forEach(t => {
      if (!teacherSchedule[t.id]) return;
      let weeklyTotal = 0;
      Object.entries(teacherSchedule[t.id]).forEach(([day, dayMap]) => {
        const count = Object.values(dayMap).filter(Boolean).length;
        weeklyTotal += count;
        if (t.dailyLimit && count > parseInt(t.dailyLimit))
          warnings.push({ type:"overload", text:`${t.name} has ${count} periods on ${day}, exceeding daily limit of ${t.dailyLimit}.` });
      });
      if (t.weeklyLimit && weeklyTotal > parseInt(t.weeklyLimit))
        warnings.push({ type:"overload", text:`${t.name} has ${weeklyTotal} periods/week, exceeding weekly limit of ${t.weeklyLimit}.` });
    });
  }

  // Subject period coverage
  if (isRuleEnabled("weekly-targets")) {
    standards.forEach(std => {
      std.sections.forEach(sec => {
        const key = `${std.id}_${sec.id}`;
        subjects.filter(s => s.standardId === std.id).forEach(sub => {
          const required = (parseInt(sub.periodsPerWeek) || 0) + (sub.hasLab ? (parseInt(sub.labPeriodsPerWeek) || 0) : 0);
          let assigned = 0;
          Object.values(timetable[key] || {}).forEach(dayMap =>
            Object.values(dayMap).forEach(cell => { if (cell?.subject?.id === sub.id) assigned++; })
          );
          if (assigned < required)
            warnings.push({ type:"coverage", text:`${std.name}-${sec.name}: ${sub.name} has only ${assigned}/${required} periods.` });
        });
      });
    });
  }

  // Count fill rate
  let totalSlots = 0, filledSlots = 0;
  Object.values(timetable).forEach(ct =>
    Object.values(ct).forEach(dt =>
      Object.values(dt).forEach(cell => { totalSlots++; if (cell) filledSlots++; })
    )
  );
  const score = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  return { warnings, score, filledSlots, totalSlots };
}

// Migrate old data formats to new
export function migrateData(data) {
  if (!data) return data;
  return {
    ...data,
    // Strip sectionId from subjects (now standard-wise)
    subjects: (data.subjects || []).map(s => {
      const { sectionId, ...rest } = s;
      return rest;
    }),
    // Convert old teachers.subjects[] to new assignments format
    teachers: (data.teachers || []).map(t => {
      if (t.assignments) return t;
      return { ...t, assignments: [], subjects: undefined };
    }),
  };
}

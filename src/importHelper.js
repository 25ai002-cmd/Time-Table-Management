/**
 * Utility functions for loading SheetJS (XLSX) from CDN
 * and parsing Excel files / TSV copy-pasted text.
 */

// Load SheetJS dynamically from CDN
export function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.onload = () => {
      if (window.XLSX) resolve(window.XLSX);
      else reject(new Error("SheetJS failed to initialize."));
    };
    script.onerror = () => reject(new Error("Failed to load SheetJS CDN."));
    document.head.appendChild(script);
  });
}

// Convert a File object (.xlsx, .xls, .csv) into JSON rows
export async function parseExcelFile(file) {
  const XLSX = await loadXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Header: 1 gets raw rows, let's parse using defval to keep empty columns aligned
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (!rows.length) {
          reject(new Error("The selected sheet is empty."));
          return;
        }

        const headers = rows[0].map(h => String(h || "").trim());
        const dataRows = rows.slice(1).map(row => {
          const item = {};
          headers.forEach((header, index) => {
            if (header) {
              item[header] = row[index] !== undefined ? String(row[index]).trim() : "";
            }
          });
          return item;
        }).filter(item => Object.values(item).some(v => v !== "")); // filter out completely empty rows

        resolve({ headers, rows: dataRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error."));
    reader.readAsArrayBuffer(file);
  });
}

// Parse copy-pasted Tab-Separated Values (TSV) from Excel/Google Sheets
export function parseTSVData(text) {
  if (!text || !text.trim()) return { headers: [], rows: [] };
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  // Parse headers from the first line
  const headers = lines[0].split("\t").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split("\t");
    const item = {};
    headers.forEach((header, index) => {
      if (header) {
        item[header] = cols[index] !== undefined ? cols[index].trim() : "";
      }
    });
    return item;
  }).filter(item => Object.values(item).some(v => v !== ""));

  return { headers, rows };
}

// Target fields required by each setup model
export const FIELD_DEFINITIONS = {
  standards: [
    { key: "name", label: "Class / Standard Name", required: true, keywords: ["class", "standard", "grade", "name"] },
    { key: "sections", label: "Sections (comma-separated)", required: false, keywords: ["section", "sections", "division", "div"] }
  ],
  teachers: [
    { key: "name", label: "Full Name", required: true, keywords: ["name", "teacher", "full name", "fullname", "instructor"] },
    { key: "code", label: "Teacher Code / ID", required: false, keywords: ["code", "id", "teacher code", "teacher id", "emp id"] },
    { key: "dailyLimit", label: "Daily Limit (Periods)", required: false, keywords: ["daily", "daily limit", "limit daily", "max daily"] },
    { key: "weeklyLimit", label: "Weekly Limit (Periods)", required: false, keywords: ["weekly", "weekly limit", "limit weekly", "max weekly"] }
  ],
  rooms: [
    { key: "name", label: "Room Name", required: true, keywords: ["room", "name", "room name", "classroom", "number"] },
    { key: "type", label: "Room Type", required: false, keywords: ["type", "room type", "category"] },
    { key: "capacity", label: "Capacity", required: false, keywords: ["capacity", "size", "seats", "capacity size"] },
    { key: "floor", label: "Floor", required: false, keywords: ["floor", "level", "block"] }
  ],
  subjects: [
    { key: "standardName", label: "Class / Standard Name", required: true, keywords: ["class", "standard", "grade", "class name", "std"] },
    { key: "name", label: "Subject Name", required: true, keywords: ["subject", "name", "subject name", "course"] },
    { key: "type", label: "Subject Type", required: false, keywords: ["type", "subject type", "category"] },
    { key: "periodsPerWeek", label: "Periods per Week", required: false, keywords: ["periods", "weekly periods", "periods/week", "count", "frequency"] },
    { key: "roomType", label: "Preferred Room Type", required: false, keywords: ["room", "room type", "preferred room"] },
    { key: "hasLab", label: "Has Lab Component? (Yes/No)", required: false, keywords: ["lab", "has lab", "lab component"] },
    { key: "labPeriodsPerWeek", label: "Lab Periods per Week", required: false, keywords: ["lab periods", "lab count", "lab periods/week"] },
    { key: "labRoomType", label: "Lab Room Type", required: false, keywords: ["lab room", "lab room type"] }
  ]
};

// Auto-maps file headers to target fields based on keywords matching
export function autoMapFields(headers, type) {
  const definitions = FIELD_DEFINITIONS[type] || [];
  const mapping = {};
  
  definitions.forEach(def => {
    // Try to find a matching header
    const matchedHeader = headers.find(h => {
      const normalized = h.toLowerCase();
      return def.keywords.some(kw => normalized === kw || normalized.includes(kw));
    });
    mapping[def.key] = matchedHeader || "";
  });
  
  return mapping;
}

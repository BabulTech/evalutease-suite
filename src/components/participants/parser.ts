import { emptyDraft, type ParticipantDraft } from "./types";

/**
 * Parse a CSV/TSV string into ParticipantDraft[].
 *
 * Expected header row (case-insensitive, any subset, any order). Recognised columns:
 *   name (required), email, mobile/phone, roll_number/roll, seat_number/seat,
 *   class/grade, organization/school, address, notes
 *
 * Lines without a name are skipped silently. Comma OR tab separated; quoted strings honoured.
 */
export function parseParticipantsCsv(input: string): ParticipantDraft[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const lines = splitCsvLines(trimmed);
  if (lines.length < 1) return [];

  const headerCells = parseCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = headerCells.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const cols = {
    name: idx("name", "full name", "fullname", "student name"),
    email: idx("email", "email address", "e-mail"),
    mobile: idx("mobile", "phone", "phone number", "contact", "cell"),
    roll: idx("roll_number", "roll", "roll no", "roll #", "rollno"),
    seat: idx("seat_number", "seat", "seat no", "seatno"),
    class: idx("class", "grade", "year", "section"),
    org: idx("organization", "school", "institution", "company"),
    address: idx("address"),
    notes: idx("notes", "remarks", "comment", "comments"),
  };

  if (cols.name === -1) {
    // No "name" column — assume the first column is name.
    cols.name = 0;
  }

  const drafts: ParticipantDraft[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length === 0) continue;
    const name = (cells[cols.name] ?? "").trim();
    if (!name) continue;
    const d = emptyDraft();
    d.name = name;
    if (cols.email >= 0) d.email = (cells[cols.email] ?? "").trim();
    if (cols.mobile >= 0) d.mobile = (cells[cols.mobile] ?? "").trim();
    if (cols.roll >= 0) d.roll_number = (cells[cols.roll] ?? "").trim();
    if (cols.seat >= 0) d.seat_number = (cells[cols.seat] ?? "").trim();
    if (cols.class >= 0) d.class = (cells[cols.class] ?? "").trim();
    if (cols.org >= 0) d.organization = (cells[cols.org] ?? "").trim();
    if (cols.address >= 0) d.address = (cells[cols.address] ?? "").trim();
    if (cols.notes >= 0) d.notes = (cells[cols.notes] ?? "").trim();
    drafts.push(d);
  }
  return drafts;
}

function splitCsvLines(input: string): string[] {
  // Split on newlines but respect quoted strings spanning multiple lines.
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (const ch of input.replace(/\r\n/g, "\n")) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      buf += ch;
    } else if (ch === "\n" && !inQuotes) {
      if (buf.trim()) out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function parseCsvLine(line: string): string[] {
  // Auto-detect delimiter: tab if any tabs, otherwise comma.
  const delim = line.includes("\t") ? "\t" : ",";
  const cells: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      cells.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  cells.push(buf);
  return cells.map((c) => c.trim());
}

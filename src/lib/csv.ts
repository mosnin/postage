/**
 * Simple RFC-4180-compatible CSV parser.
 * Handles quoted fields with embedded commas and newlines.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = splitCSVLines(text.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map((h) => h.trim().toLowerCase());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    results.push(row);
  }

  return results;
}

/**
 * Split CSV text into logical rows, respecting quoted fields that may
 * contain embedded newlines.
 */
function splitCSVLines(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++; // CRLF
      rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) rows.push(current);
  return rows;
}

/**
 * Parse a single CSV row into fields.
 */
function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    const next = row[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Generate a CSV template string for bulk scheduling.
 */
export function generateBulkTemplate(): string {
  const headers = [
    "platforms",
    "scheduled_at",
    "content",
    "media_url",
    "first_comment",
    "labels",
  ];
  const example = [
    "TWITTER;LINKEDIN",
    "2025-06-15T09:00:00Z",
    "Your post content goes here",
    "https://example.com/image.jpg",
    "First comment text",
    "campaign-name;marketing",
  ];
  return [headers.join(","), example.join(",")].join("\n");
}

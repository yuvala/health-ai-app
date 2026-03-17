export type ParsedLabResult = {
  testName: string;
  testCode: string;
  value: number;
  unit: string;
  confidence: number;
};

export type ParsedDocumentData = {
  documentDate: string | null;
  dateConfidence: number;
  results: ParsedLabResult[];
};

type AliasConfig = {
  testCode: string;
  displayName: string;
  aliases: string[];
};

const TEST_ALIASES: AliasConfig[] = [
  { testCode: "glucose", displayName: "Glucose", aliases: ["glucose"] },
  { testCode: "hba1c", displayName: "HbA1C", aliases: ["hba1c", "hba1c%"] },
  { testCode: "urea", displayName: "Urea", aliases: ["urea"] },
  { testCode: "creatinine", displayName: "Creatinine", aliases: ["creatinine"] },
  { testCode: "egfr", displayName: "eGFR", aliases: ["egfr"] },
  { testCode: "potassium", displayName: "Potassium", aliases: ["potassium", "k+"] },
  { testCode: "sodium", displayName: "Sodium", aliases: ["sodium", "na-"] },
  { testCode: "calcium", displayName: "Calcium", aliases: ["calcium", "ca-"] },
  { testCode: "cholesterol", displayName: "Cholesterol", aliases: ["cholesterol"] },
  { testCode: "triglycerides", displayName: "Triglycerides", aliases: ["triglycerides"] },
  { testCode: "hdl", displayName: "HDL-Cholesterol", aliases: ["hdl-cholesterol", "hdl"] }
];

const UNIT_REGEX = /(?:mg\/?d[lL]|mmol\/?l|ml\/?min\/?1\.73m2|%)/i;

function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIsoDate(dateText: string): string | null {
  const parts = dateText.split("/").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return null;
  }

  const [day, month, yearRaw] = parts;
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(asDate.getTime())) {
    return null;
  }

  return asDate.toISOString().slice(0, 10);
}

function extractClosestValue(snippet: string): { value: number | null; unit: string | null } {
  const numericMatches = [...snippet.matchAll(/-?\d+(?:\.\d+)?/g)];
  if (numericMatches.length === 0) {
    return { value: null, unit: null };
  }

  const valueMatch = numericMatches[numericMatches.length - 1];
  const value = Number(valueMatch[0]);
  if (Number.isNaN(value)) {
    return { value: null, unit: null };
  }

  const tail = snippet.slice(valueMatch.index ?? 0, (valueMatch.index ?? 0) + 24);
  const unitMatch = tail.match(UNIT_REGEX);
  return { value, unit: unitMatch?.[0] ?? null };
}

export function parseLabPdfText(rawText: string): ParsedDocumentData {
  const normalized = rawText.replace(/\s+/g, " ").trim();

  const specificDateMatch = normalized.match(/(?:test\s*date|date)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  const fallbackDateMatch = normalized.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const dateText = specificDateMatch?.[1] ?? fallbackDateMatch?.[1] ?? null;
  const documentDate = dateText ? toIsoDate(dateText) : null;
  const dateConfidence = specificDateMatch ? 0.95 : documentDate ? 0.65 : 0;

  const results: ParsedLabResult[] = [];
  for (const config of TEST_ALIASES) {
    const aliasPattern = config.aliases.map((alias) => escapeRegex(alias)).join("|");
    const regex = new RegExp(`(${aliasPattern})`, "i");
    const aliasMatch = normalized.match(regex);
    if (!aliasMatch || typeof aliasMatch.index !== "number") {
      continue;
    }

    const start = Math.max(0, aliasMatch.index - 80);
    const end = Math.min(normalized.length, aliasMatch.index + 120);
    const snippet = normalized.slice(start, end);
    const { value, unit } = extractClosestValue(snippet);

    if (value === null) {
      continue;
    }

    results.push({
      testName: config.displayName,
      testCode: config.testCode,
      value,
      unit: unit ?? "",
      confidence: unit ? 0.8 : 0.65
    });
  }

  return {
    documentDate,
    dateConfidence,
    results
  };
}

import { Injectable } from "@nestjs/common";
import * as pdfParse from "pdf-parse";

// --- BEGIN TYPE DEFINITIONS FOR PDF.JS INTERNALS ---
interface PdfJsTextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
  width: number;
  height: number;
  fontName: string; // Often available, good for debugging or advanced logic
}

interface PdfJsTextContent {
  items: PdfJsTextItem[];
  styles: any; // We are not using styles in this renderer
}

interface PdfJsPageProxy {
  getTextContent(options?: any): Promise<PdfJsTextContent>; // options can be pdfParse.RenderParameters
  // Other pageData properties and methods exist but are not used directly in customPageRenderer
  // e.g., pageNumber, rotate, view, viewport, etc.
}
// --- END TYPE DEFINITIONS ---

// --- BEGIN TYPE DEFINITION FOR PDFPARSE RESULT ---
interface ParsedPdfData {
  numpages: number;
  numrender: number;
  info: Record<string, any>;
  metadata: Record<string, any> | null;
  text: string;
  version: string;
}
// --- END TYPE DEFINITION FOR PDFPARSE RESULT ---

async function customPageRenderer(pageData: PdfJsPageProxy): Promise<string> {
  const renderOptions = {
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  };

  const textContent: PdfJsTextContent =
    await pageData.getTextContent(renderOptions);
  const items: PdfJsTextItem[] = textContent.items;

  if (!items || items.length === 0) {
    return "";
  }

  items.sort((a: PdfJsTextItem, b: PdfJsTextItem) => {
    if (a.transform[5] < b.transform[5]) return -1;
    if (a.transform[5] > b.transform[5]) return 1;
    if (a.transform[4] < b.transform[4]) return -1;
    if (a.transform[4] > b.transform[4]) return 1;
    return 0;
  });

  let S = "";
  let lastY = -1;
  let lastX = -1;
  let lastWidth = 0;

  const yHeightFractionForNewLine = 0.5; // Consider new line if Y diff > 0.5 * item height
  const xWidthFractionForSpace = 0.35; // Min horizontal gap (as fraction of item width) to insert a space. Was 0.2, 0.01, 0.1, originally 0.3

  for (const item of items) {
    if (item.str.trim().length === 0) {
      // Handle purely whitespace items that might represent actual spaces
      if (
        item.str.includes(" ") &&
        lastY !== -1 &&
        Math.abs(item.transform[5] - lastY) <
          item.height * yHeightFractionForNewLine &&
        item.width > (item.width * xWidthFractionForSpace) / 2
      ) {
        if (
          S.length > 0 &&
          S[S.length - 1] !== " " &&
          S[S.length - 1] !== "\n"
        ) {
          S += " ";
        }
      }
      continue;
    }

    const currentY = item.transform[5];
    const currentX = item.transform[4];

    if (lastY === -1) {
      S = item.str;
    } else {
      if (
        Math.abs(currentY - lastY) >
        item.height * yHeightFractionForNewLine
      ) {
        S += "\n" + item.str;
      } else {
        const neededSpace = currentX - (lastX + lastWidth);
        const minSpaceToInsertChar = item.width * xWidthFractionForSpace;
        if (neededSpace > minSpaceToInsertChar) {
          S += " " + item.str;
        } else {
          S += item.str;
        }
      }
    }
    lastY = currentY;
    lastX = currentX;
    lastWidth = item.width;
  }
  return S;
}

interface TableData {
  headers: string[];
  rows: string[][];
  startLine: number;
}

interface TransporterRecord {
  transporterId: string;
  delivered: number | null;
  dcr: number | null;
  dnrDpmo: number | null;
  lorDpmo: number | null;
  pod: number | null;
  cc: number | null;
  ce: number | null;
  cdf: number | null;
}

@Injectable()
export class PdfService {
  async extractTextFromPdf(buffer: Buffer): Promise<any> {
    try {
      // Configure pdf-parse options
      const options = {
        pagerender: customPageRenderer, // Use the custom page renderer
        max: 0, // Process all pages
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const data = (await pdfParse(buffer, options)) as ParsedPdfData;

      console.log("PDF text extracted, length:", data.text.length);
      console.log("First 500 characters:", data.text.substring(0, 500));

      return {
        text: data.text,
        info: data.info,
        metadata: data.metadata,
        numPages: data.numpages,
        version: data.version,
        wordCount: data.text.split(/\s+/).filter((word) => word.length > 0)
          .length,
        characterCount: data.text.length,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("PDF parsing error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
    }
  }

  analyzePdfContent(text: string): any {
    console.log("Analyzing PDF content, text length:", text.length);

    // Basic content analysis
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const sentences = text
      .split(/[.!?]+/)
      .filter((sentence) => sentence.trim().length > 0);

    // Extract potential emails, phone numbers, and URLs
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex =
      /(\+?1[-.\s]?)?(\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
    const urlRegex =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

    const emails = text.match(emailRegex) || [];
    const phoneNumbers = text.match(phoneRegex) || [];
    const urls = text.match(urlRegex) || [];

    // Extract tabular data
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const tableData = this.extractTableData(text);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const dspSummaryData = this.extractDSPSummaryData(text);

    console.log("DSP Summary Data:", JSON.stringify(dspSummaryData, null, 2));

    return {
      lineCount: lines.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      extractedData: {
        emails: [...new Set(emails)], // Remove duplicates
        phoneNumbers: [...new Set(phoneNumbers)],
        urls: [...new Set(urls)],
      },
      topWords: this.getTopWords(words, 10),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      tableData: tableData,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      dspSummaryData: dspSummaryData,
    };
  }

  private extractTableData(text: string): any {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const tables: TableData[] = [];
    let currentTable: TableData | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect potential table headers (lines with multiple separated values)
      const potentialColumns = line
        .split(/\s{2,}|\t/)
        .filter((col) => col.trim().length > 0);

      if (potentialColumns.length >= 3) {
        // Check if this could be a header row
        const hasNumericPattern = potentialColumns.some((col) =>
          /\d/.test(col)
        );
        const hasHeaderPattern = potentialColumns.some(
          (col) =>
            /^[A-Z][A-Z\s]+$/i.test(col.trim()) ||
            col.includes("ID") ||
            col.includes("DCR") ||
            col.includes("POD") ||
            col.includes("%")
        );

        if (hasHeaderPattern || (currentTable && hasNumericPattern)) {
          if (!currentTable) {
            currentTable = {
              headers: potentialColumns,
              rows: [],
              startLine: i + 1,
            };
          } else {
            currentTable.rows.push(potentialColumns);
          }
        } else if (currentTable && currentTable.rows.length > 0) {
          // End current table
          tables.push(currentTable);
          currentTable = null;
        }
      } else if (currentTable && currentTable.rows.length > 0) {
        // End current table if we hit a line that doesn't match
        tables.push(currentTable);
        currentTable = null;
      }
    }

    // Add the last table if exists
    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }

    return {
      tablesFound: tables.length,
      tables: tables.map((table) => ({
        headers: table.headers,
        rowCount: table.rows.length,
        data: table.rows,
      })),
    };
  }

  private extractDSPSummaryData(text: string): any {
    console.log("Extracting DSP Summary Data...");
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const transporterData: TransporterRecord[] = [];
    let detectedHeaders: string[] = []; // Store detected headers

    // Look for DSP Weekly Summary with more flexible patterns (existing logic)
    const isDSPSummary =
      text.toLowerCase().includes("dsp weekly summary") ||
      text.toLowerCase().includes("transporter id") ||
      (text.toLowerCase().includes("dcr") &&
        text.toLowerCase().includes("pod")) ||
      text.includes("Contact Compliance") ||
      /A[0-9A-Z]{10,}/.test(text); // Pattern for transporter IDs

    console.log("Is DSP Summary:", isDSPSummary);
    console.log("Text includes checks:", {
      dspWeeklySummary: text.toLowerCase().includes("dsp weekly summary"),
      transporterId: text.toLowerCase().includes("transporter id"),
      dcrAndPod:
        text.toLowerCase().includes("dcr") &&
        text.toLowerCase().includes("pod"),
      contactCompliance: text.includes("Contact Compliance"),
      transporterIdPattern: /A[0-9A-Z]{10,}/.test(text),
    });

    if (!isDSPSummary) {
      // Return early if basic DSP summary indicators are not present.
      // Consider if this check is too broad or should be refined.
      // For now, if these keywords are missing, assume it's not the target content.
      return { isDSPSummary: false, transporters: [] };
    }

    // Expected column patterns for DSP summary (remains useful for return structure)
    const expectedColumns = [
      "Transporter ID",
      "Delivered",
      "DCR",
      "DNR DPMO",
      "LoR DPMO",
      "POD",
      "CC",
      "CE",
      "CDF",
    ];
    // let headerFound = false; // This flag is no longer the primary gate for data parsing

    console.log("Processing lines for DSP data...");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and known non-data headers more robustly (existing logic)
      if (
        !line ||
        line.toLowerCase().includes("dsp weekly summary") ||
        line.toLowerCase().includes("dsp weekly scorecard") ||
        line.toLowerCase().includes("scorecard metric definitions") ||
        line.toLowerCase().includes("metricsresource links") ||
        line.toLowerCase().includes("announcements") ||
        line.toLowerCase().includes("resources") ||
        line.toLowerCase().includes("overall standingkey focus areas") ||
        line.toLowerCase().includes("questions?") ||
        (line.toLowerCase().includes("contact compliance") &&
          !line.toLowerCase().startsWith("a") &&
          !line.match(/^([A-Z][A-Z0-9]{10}|[A-Z][A-Z0-9]{13})\s/) && // Make sure it's not a data line starting with A* ID
          !line.match(/^(\d+(?:\.\d+)?%)/)) ||
        (line.toLowerCase().includes("photo on delivery") &&
          !line.toLowerCase().startsWith("a") &&
          !line.match(/^([A-Z][A-Z0-9]{10}|[A-Z][A-Z0-9]{13})\s/) &&
          !line.match(/^(\d+(?:\.\d+)?%)/)) ||
        (line.toLowerCase().includes("customer escalations") &&
          !line.toLowerCase().startsWith("a") &&
          !line.match(/^([A-Z][A-Z0-9]{10}|[A-Z][A-Z0-9]{13})\s/) &&
          !line.match(/^(\d+(?:\.\d+)?%)/)) ||
        (line.toLowerCase().includes("customer delivery feedback") &&
          !line.toLowerCase().startsWith("a") &&
          !line.match(/^([A-Z][A-Z0-9]{10}|[A-Z][A-Z0-9]{13})\s/) &&
          !line.match(/^(\d+(?:\.\d+)?%)/)) ||
        line.toLowerCase().includes("positive delivery experience rate") ||
        line.startsWith("Page ") ||
        line.startsWith("*") || // Comments or notes
        line.startsWith("- Discuss with") ||
        line.startsWith("#Transporter IDDaily Limit")
      ) {
        // console.log(`Skipping explicitly ignored line ${i}: "${line}"`);
        continue;
      }

      // Check for header row - store if found, but it no longer gates data parsing
      if (
        detectedHeaders.length === 0 && // Only capture the first header like this
        line.toLowerCase().includes("transporter id") &&
        line.toLowerCase().includes("delivered") &&
        line.toLowerCase().includes("dcr") &&
        !/^[A-Z]([A-Z0-9]{10}|[A-Z0-9]{13})\s/.test(line) // Make sure it's not a data line itself that happens to contain these words
      ) {
        detectedHeaders = [...expectedColumns]; // Use predefined, or could parse `line` for actuals
        console.log(
          `Actual DSP Table Header DETECTED on line ${i}: "${line}". Using predefined expectedHeaders.`
        );
        // Do not 'continue' here, as a line could theoretically be a header AND data (unlikely)
        // or data lines might appear before this specific header instance.
      }

      // --- Data Line Parsing Attempt ---
      const idRegex14 = /^[A-Z][A-Z0-9]{13}/; // Total 14
      const idRegex13 = /^[A-Z][A-Z0-9]{12}/; // Total 13
      const idRegex11 = /^[A-Z][A-Z0-9]{10}/; // Total 11

      const startsWithCapLetter = /^[A-Z]/.test(line);

      let idMatchResult: RegExpExecArray | null = null;
      if (startsWithCapLetter) {
        idMatchResult = idRegex14.exec(line);
        if (!idMatchResult) {
          idMatchResult = idRegex13.exec(line);
        }
        if (!idMatchResult) {
          idMatchResult = idRegex11.exec(line);
        }
      }

      const hasIDPattern = idMatchResult !== null;
      if (hasIDPattern && idMatchResult) {
        const idPart = idMatchResult[0];
        const lineForParsing = line;

        // Check if the line consists only of the ID, which is not a valid data line for further parsing
        if (lineForParsing.trim() === idPart.trim()) {
          console.log(
            `extractDSPSummaryData: SKIPPING line (index ${i}) - ID is entire line. Line content: "${line}"`
          );
          continue;
        }

        console.log(
          `extractDSPSummaryData: Potential data line (line ${i}): "${lineForParsing}" (ID detected: "${idPart}")`
        );
        const transporterRecord = this.parseTransporterLine(lineForParsing);

        if (transporterRecord) {
          transporterData.push(transporterRecord);
        } else {
          console.warn(
            `extractDSPSummaryData: Failed to parse potential transporter line ${i} (parseTransporterLine returned null): "${lineForParsing}"`
          );
        }
      } else {
        // This block is for lines that were not caught by the explicit skip logic above,
        // and also do not match the (startsWithCapLetter && ID pattern).
        if (line.trim().length > 0) {
          let reason = "";
          if (!startsWithCapLetter)
            reason += "Does not start with a capital letter. ";
          // If it starts with a capital letter, but hasIDPattern is false (from the two-step check), then it failed both 14 and 11 char ID patterns.
          else if (startsWithCapLetter && !hasIDPattern)
            reason +=
              "Fails ID pattern (not 11 or 14 chars starting with A-Z). ";

          if (reason) {
            if (
              !(
                line.toLowerCase().includes("transporter id") &&
                line.toLowerCase().includes("delivered") &&
                line.toLowerCase().includes("dcr")
              )
            ) {
              console.log(
                `extractDSPSummaryData: SKIPPING line (index ${i}) not matching data pattern. Reason: ${reason}Line content: "${line.substring(0, 100)}"...`
              );
            }
          }
        }
      }
    }

    console.log("Total transporters found:", transporterData.length);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const summary = this.calculateDSPSummary(transporterData);

    return {
      isDSPSummary: true,
      headers: detectedHeaders.length > 0 ? detectedHeaders : expectedColumns,
      totalTransporters: transporterData.length,
      transporters: transporterData,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      summary: summary,
    };
  }

  // Helper function to parse numeric values, handling placeholders
  private _parseNumeric(value: string | undefined): number | null {
    if (
      value === undefined ||
      value === null ||
      value.trim() === "" ||
      value.trim() === "--" ||
      value.trim() === "-"
    ) {
      return null;
    }
    const num = parseInt(value.trim(), 10);
    return isNaN(num) ? null : num;
  }

  // Helper function to parse percentage values, handling placeholders
  private _parsePercentage(value: string | undefined): number | null {
    if (
      value === undefined ||
      value === null ||
      value.trim() === "" ||
      value.trim() === "--" ||
      value.trim() === "-"
    ) {
      return null;
    }
    const cleanedValue = value.trim().replace("%", "");
    const num = parseFloat(cleanedValue);
    return isNaN(num) ? null : num;
  }

  private parseTransporterLine(line: string): TransporterRecord | null {
    const parts = line.split(/\s+/).filter((p) => p.trim().length > 0); // Split by space and remove empty parts

    // Expecting 9 columns for the main data part
    // Transporter ID, Delivered, DCR, DNR DPMO, LoR DPMO, POD, CC, CE, CDF
    if (parts.length < 9) {
      console.log(
        `parseTransporterLine: Line has fewer than 9 parts after split: ${parts.length} parts. Line: "${line}"`
      );
      return null;
    }

    // If parts.length > 9, it might be due to spaces in transporter names if that ever happens,
    // or extra data. For now, we assume the first 9 are the critical ones.
    // A more robust solution might rejoin parts if transporter ID itself has spaces, but IDs are fixed length.

    const transporterId = parts[0];

    // Validate Transporter ID format (first part) - accepts 11-char, 13-char, or 14-char IDs
    if (
      !/^[A-Z]([A-Z0-9]{10}|[A-Z0-9]{11}|[A-Z0-9]{12}|[A-Z0-9]{13})$/.test(
        transporterId
      )
    ) {
      console.log(
        `parseTransporterLine: Invalid Transporter ID format in the first part: "${transporterId}" (length ${transporterId.length}) from line "${line}"`
      );
      return null;
    }

    // Defensive parsing for each field
    try {
      const record: TransporterRecord = {
        transporterId: transporterId,
        delivered: this._parseNumeric(parts[1]),
        dcr: this._parsePercentage(parts[2]),
        dnrDpmo: this._parseNumeric(parts[3]),
        lorDpmo: this._parseNumeric(parts[4]),
        pod: this._parsePercentage(parts[5]),
        cc: this._parsePercentage(parts[6]),
        ce: this._parseNumeric(parts[7]),
        cdf: this._parsePercentage(parts[8]),
      };

      // Basic validation: at least ID and one other metric should ideally be present
      // This is a soft check; more stringent checks can be added.
      if (
        record.delivered === null &&
        record.dcr === null &&
        record.pod === null
      ) {
        // console.log(`parseTransporterLine: Record for "${transporterId}" has no key metrics, might be a misparsed line.`);
        // Decide if this should be a failure or not. For now, allow it if ID is valid.
      }

      console.log(
        `parseTransporterLine: Successfully parsed: ID=${record.transporterId}, Delivered=${record.delivered}, DCR=${record.dcr}%, LoR=${record.lorDpmo}`
      );
      return record;
    } catch (error) {
      console.error(
        `parseTransporterLine: EXCEPTION during field assignment for line: "${line}"`,
        error
      );
      return null;
    }
  }

  private parseNumericValue(value: string): number | null {
    if (!value || value === "-" || value === "0%") return 0;
    const cleaned = value.replace(/[,%]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private parsePercentageValue(value: string): number | null {
    if (!value || value === "-") return null;
    if (value.includes("%")) {
      const num = parseFloat(value.replace("%", ""));
      return isNaN(num) ? null : num;
    }
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private calculateDSPSummary(transporters: TransporterRecord[]): any {
    if (transporters.length === 0) return null;

    const validTransporters = transporters.filter((t) => t.delivered !== null);

    const totalDelivered = validTransporters.reduce(
      (sum, t) => sum + (t.delivered || 0),
      0
    );
    const avgDCR = this.calculateAverage(validTransporters.map((t) => t.dcr));
    const avgPOD = this.calculateAverage(validTransporters.map((t) => t.pod));
    const avgCC = this.calculateAverage(validTransporters.map((t) => t.cc));
    const avgCDF = this.calculateAverage(validTransporters.map((t) => t.cdf));

    // Performance categories
    const highPerformers = transporters.filter(
      (t) => (t.dcr || 0) >= 95 && (t.pod || 0) >= 95
    );
    const lowPerformers = transporters.filter(
      (t) => (t.dcr || 0) < 90 || (t.pod || 0) < 90
    );

    return {
      totalDelivered,
      averages: {
        dcr: avgDCR,
        pod: avgPOD,
        cc: avgCC,
        cdf: avgCDF,
      },
      performance: {
        highPerformers: highPerformers.length,
        lowPerformers: lowPerformers.length,
        topTransporters: transporters
          .sort((a, b) => (b.dcr || 0) - (a.dcr || 0))
          .slice(0, 5)
          .map((t) => ({ id: t.transporterId, dcr: t.dcr, pod: t.pod })),
      },
    };
  }

  private calculateAverage(values: (number | null)[]): number | null {
    const validValues = values.filter(
      (v): v is number => v !== null && v !== undefined
    );
    if (validValues.length === 0) return null;
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }

  private getTopWords(
    words: string[],
    limit: number
  ): Array<{ word: string; count: number }> {
    const wordCount: Record<string, number> = {};
    const commonWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
    ]);

    words.forEach((word) => {
      const cleanWord = word.toLowerCase().replace(/[^\\w]/g, "");
      if (cleanWord.length > 2 && !commonWords.has(cleanWord)) {
        wordCount[cleanWord] = (wordCount[cleanWord] || 0) + 1;
      }
    });

    return Object.entries(wordCount)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}

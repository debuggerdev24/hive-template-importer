import * as zlib from "zlib";
import { RawSpectoraSheet, RawSpectoraRow } from "../types";

/**
 * Low-level Workbook Reader
 * Extracts structured tabular rows from Spectora exports:
 * 1. OpenXML Spreadsheet (ZIP containing xl/worksheets/sheet1.xml & xl/sharedStrings.xml)
 * 2. HTML Table Spreadsheet (HTML markup containing <table><tr><th>/<td>)
 */
export class WorkbookReader {
  /**
   * Reads a buffer or string into a normalized RawSpectoraSheet
   */
  read(input: Buffer | string): RawSpectoraSheet {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");

    // 0. Detect empty file (0 bytes)
    if (buffer.length === 0) {
      throw new Error(
        "Empty file: The uploaded file contains 0 bytes. Please select a valid Spectora spreadsheet (.xls/.xlsx) or provide HTML table markup."
      );
    }

    // 1. Detect if OpenXML PKZip container (magic bytes: 0x50 0x4B 0x03 0x04)
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
      return this.readOpenXmlZip(buffer);
    }

    // 2. Check if HTML table spreadsheet
    const textSnippet = buffer.subarray(0, 2000).toString("utf-8").toLowerCase();
    if (textSnippet.includes("<table") || textSnippet.includes("<tr") || textSnippet.includes("<html")) {
      return this.readHtmlTable(buffer.toString("utf-8"));
    }

    // 3. Informative error for wrong file type
    throw new Error(
      "Unsupported file format: The provided file is neither a valid OpenXML spreadsheet (.xls, .xlsx) nor an HTML table export. Please export your template directly from Spectora (Settings > Templates > Export) and try uploading again."
    );
  }

  /**
   * Parses OpenXML ZIP archive directly without external native dependencies
   */
  private readOpenXmlZip(buf: Buffer): RawSpectoraSheet {
    const entries = this.extractZipEntries(buf);
    const entryKeys = Object.keys(entries);

    if (entryKeys.length === 0) {
      throw new Error(
        "Corrupted spreadsheet archive: The ZIP archive could not be decompressed or contains damaged file records. Please re-export your template from Spectora."
      );
    }

    // 1. Extract shared strings
    const sharedStrings: string[] = [];
    if (entries["xl/sharedStrings.xml"]) {
      const ssXml = entries["xl/sharedStrings.xml"];
      const siRegex = /<si>([\s\S]*?)<\/si>/g;
      let match: RegExpExecArray | null;
      while ((match = siRegex.exec(ssXml)) !== null) {
        const siContent = match[1];
        const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        let text = "";
        while ((tMatch = tRegex.exec(siContent)) !== null) {
          text += this.decodeXmlEntities(tMatch[1]);
        }
        sharedStrings.push(text);
      }
    }

    // 2. Identify first worksheet (typically xl/worksheets/sheet1.xml)
    let sheetXmlKey = "xl/worksheets/sheet1.xml";
    if (!entries[sheetXmlKey]) {
      const sheetKey = Object.keys(entries).find((k) =>
        k.startsWith("xl/worksheets/sheet") && k.endsWith(".xml")
      );
      if (sheetKey) sheetXmlKey = sheetKey;
    }

    if (!entries[sheetXmlKey]) {
      throw new Error(
        "Invalid spreadsheet structure: No worksheet data found inside the workbook archive. Please verify this is a valid Spectora export."
      );
    }

    const sheetXml = entries[sheetXmlKey];
    const rawRows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];

    const rowRegex = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowNumber = parseInt(rowMatch[1], 10);
      const rowContent = rowMatch[2];
      const cellRegex = /<c[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
      let cellMatch: RegExpExecArray | null;
      const cells: Record<string, string> = {};

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const colLetter = cellMatch[1];
        const type = cellMatch[2];
        const rawVal = cellMatch[3] !== undefined ? cellMatch[3] : "";
        let val = rawVal;
        if (type === "s") {
          const stringIndex = parseInt(rawVal, 10);
          val = sharedStrings[stringIndex] !== undefined ? sharedStrings[stringIndex] : "";
        } else {
          val = this.decodeXmlEntities(rawVal);
        }
        cells[colLetter] = val;
      }
      rawRows.push({ rowNumber, cells });
    }

    if (rawRows.length === 0) {
      return { sheetName: "Sheet1", headers: [], rows: [] };
    }

    // First row contains the headers
    const headerRow = rawRows[0];
    const colLetters = Object.keys(headerRow.cells).sort(
      (a, b) => this.colLetterToIndex(a) - this.colLetterToIndex(b)
    );
    const headers = colLetters.map((l) => headerRow.cells[l].trim());

    // Map data rows
    const dataRows: RawSpectoraRow[] = rawRows.slice(1).map((r) => {
      const namedCells: Record<string, string> = {};
      const rawValues: string[] = [];

      colLetters.forEach((letter, index) => {
        const headerName = headers[index];
        const val = r.cells[letter] !== undefined ? r.cells[letter] : "";
        namedCells[headerName] = val;
        rawValues.push(val);
      });

      return {
        rowNumber: r.rowNumber,
        cells: namedCells,
        rawValues,
      };
    });

    return {
      sheetName: "Sheet1",
      headers,
      rows: dataRows,
    };
  }

  /**
   * Parses HTML table markup
   */
  private readHtmlTable(html: string): RawSpectoraSheet {
    const rows: RawSpectoraRow[] = [];
    const headers: string[] = [];

    // Simple robust regex extraction of table rows
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    let rowNum = 1;

    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[1];
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch: RegExpExecArray | null;
      const cellValues: string[] = [];

      while ((cellMatch = cellRegex.exec(trContent)) !== null) {
        let content = cellMatch[1].trim();
        content = this.decodeHtmlEntities(content);
        cellValues.push(content);
      }

      if (cellValues.length === 0) continue;

      if (headers.length === 0) {
        // First non-empty row is treated as headers
        headers.push(...cellValues.map((h) => this.stripHtmlTags(h).trim()));
      } else {
        const namedCells: Record<string, string> = {};
        headers.forEach((h, idx) => {
          namedCells[h] = cellValues[idx] || "";
        });

        rows.push({
          rowNumber: rowNum,
          cells: namedCells,
          rawValues: cellValues,
        });
      }
      rowNum++;
    }

    return {
      sheetName: "HTML_Export",
      headers,
      rows,
    };
  }

  private extractZipEntries(buf: Buffer): Record<string, string> {
    const entries: Record<string, string> = {};

    // 1. Try Central Directory (standard ZIP specification for streaming OpenXML files)
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }

    if (eocd !== -1) {
      const cdOffset = buf.readUInt32LE(eocd + 16);
      const cdCount = buf.readUInt16LE(eocd + 10);
      let ptr = cdOffset;

      for (let j = 0; j < cdCount && ptr < eocd; j++) {
        if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) break;
        const method = buf.readUInt16LE(ptr + 10);
        const compSize = buf.readUInt32LE(ptr + 20);
        const fnLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const localOffset = buf.readUInt32LE(ptr + 42);
        const fileName = buf.subarray(ptr + 46, ptr + 46 + fnLen).toString("utf8");

        if (localOffset + 30 <= buf.length && buf.readUInt32LE(localOffset) === 0x04034b50) {
          const locFnLen = buf.readUInt16LE(localOffset + 26);
          const locExtraLen = buf.readUInt16LE(localOffset + 28);
          const dataStart = localOffset + 30 + locFnLen + locExtraLen;
          const compData = buf.subarray(dataStart, dataStart + compSize);

          let data: Buffer | null = null;
          try {
            if (method === 0) {
              data = compData;
            } else if (method === 8) {
              data = zlib.inflateRawSync(compData);
            }
          } catch {
            // ignore entry decompression errors
          }

          if (data) {
            const str = data.toString("utf8");
            entries[fileName] = str;
            entries[fileName.toLowerCase()] = str;
          }
        }

        ptr += 46 + fnLen + extraLen + commentLen;
      }
    }

    // 2. Fallback to Local File Header scan if Central Directory was missing
    if (Object.keys(entries).length === 0) {
      let i = 0;
      while (i < buf.length - 4) {
        if (buf.readUInt32LE(i) === 0x04034b50) {
          const compMethod = buf.readUInt16LE(i + 8);
          const compSize = buf.readUInt32LE(i + 18);
          const fnLen = buf.readUInt16LE(i + 26);
          const extraLen = buf.readUInt16LE(i + 28);
          const fileName = buf.subarray(i + 30, i + 30 + fnLen).toString("utf8");
          const dataStart = i + 30 + fnLen + extraLen;
          const compData = buf.subarray(dataStart, dataStart + compSize);

          let data: Buffer | null = null;
          try {
            if (compMethod === 0) {
              data = compData;
            } else if (compMethod === 8) {
              data = zlib.inflateRawSync(compData);
            }
          } catch {
            // ignore corrupted sub-entries
          }

          if (data) {
            const str = data.toString("utf8");
            entries[fileName] = str;
            entries[fileName.toLowerCase()] = str;
          }
          i = dataStart + (compSize > 0 ? compSize : 1);
        } else {
          i++;
        }
      }
    }

    return entries;
  }

  private colLetterToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  private decodeXmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  private stripHtmlTags(str: string): string {
    return str.replace(/<\/?[^>]+(>|$)/g, "");
  }
}

export const workbookReader = new WorkbookReader();

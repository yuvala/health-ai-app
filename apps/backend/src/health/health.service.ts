import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import type { CreateLabResultDto } from "./dto/create-lab-result.dto";
import { parseLabPdfText } from "./lab-pdf.parser";

type ExtractionStatus = "queued" | "extracting" | "parsing" | "review_needed" | "completed" | "failed";

type ParsedRow = {
  testName: string;
  testCode: string;
  value: number;
  unit: string;
  confidence: number;
};

type ParsedDocumentData = {
  documentDate: string | null;
  dateConfidence: number;
  results: ParsedRow[];
};

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private isWorkerRunning = false;
  private readonly openai: OpenAI | null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    this.openai = apiKey && apiKey !== "YOUR_OPENAI_API_KEY" ? new OpenAI({ apiKey }) : null;
  }

  onModuleInit() {
    if (!this.hasValidSupabaseConfig()) {
      this.logger.warn(
        "Background document extraction worker is disabled due to invalid Supabase config. Set real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/backend/.env."
      );
      return;
    }

    this.workerTimer = setInterval(() => {
      void this.processQueueTick();
    }, 10_000);
    void this.processQueueTick();
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private client() {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key || this.isPlaceholderValue(url) || this.isPlaceholderValue(key)) {
      throw new InternalServerErrorException(
        "Invalid Supabase configuration. Update SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/backend/.env."
      );
    }
    return createClient(url, key);
  }

  private hasValidSupabaseConfig(): boolean {
    const url = this.config.get<string>("SUPABASE_URL");
    const key = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    return Boolean(url && key && !this.isPlaceholderValue(url) && !this.isPlaceholderValue(key));
  }

  private isPlaceholderValue(value: string): boolean {
    const normalized = value.toLowerCase();
    return normalized.includes("your_project_ref") || normalized.includes("your_supabase_service_role_key");
  }

  private isMockModeEnabled(): boolean {
    const raw = this.config.get<string>("AI_MOCK_MODE", "false");
    return raw.toLowerCase() === "true";
  }

  private normalizeIsoDate(input: unknown): string | null {
    if (typeof input !== "string") {
      return null;
    }

    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!slash) {
      return null;
    }

    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const yearRaw = Number(slash[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

    if (!Number.isFinite(day) || !Number.isFinite(month) || day < 1 || day > 31 || month < 1 || month > 12) {
      return null;
    }

    const asDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(asDate.getTime())) {
      return null;
    }

    return asDate.toISOString().slice(0, 10);
  }

  private normalizeAiParsed(raw: unknown): ParsedDocumentData | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const payload = raw as {
      document_date?: unknown;
      date_confidence?: unknown;
      results?: unknown;
    };

    const documentDate = this.normalizeIsoDate(payload.document_date);
    const dateConfidence = Number(payload.date_confidence ?? 0);

    const rows = Array.isArray(payload.results)
      ? payload.results
          .map((item) => {
            const row = item as {
              test_name?: unknown;
              test_code?: unknown;
              value?: unknown;
              unit?: unknown;
              confidence?: unknown;
            };

            const value = Number(row.value);
            const confidence = Number(row.confidence ?? 0.6);

            return {
              testName: typeof row.test_name === "string" ? row.test_name.trim() : "",
              testCode: typeof row.test_code === "string" ? row.test_code.trim() : "",
              value,
              unit: typeof row.unit === "string" ? row.unit.trim() : "",
              confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.6
            };
          })
          .filter((row) => row.testName && row.testCode && Number.isFinite(row.value))
      : [];

    if (rows.length === 0 && !documentDate) {
      return null;
    }

    return {
      documentDate,
      dateConfidence: Number.isFinite(dateConfidence) ? Math.max(0, Math.min(1, dateConfidence)) : 0,
      results: rows
    };
  }

  private async extractWithAi(extractedText: string): Promise<ParsedDocumentData | null> {
    if (!this.openai || this.isMockModeEnabled()) {
      return null;
    }

    const model = this.config.get<string>("OPENAI_MODEL", "gpt-4.1-mini");

    const completion = await this.openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lab_document_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              document_date: {
                anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }]
              },
              date_confidence: { type: "number", minimum: 0, maximum: 1 },
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    test_name: { type: "string" },
                    test_code: { type: "string" },
                    value: { type: "number" },
                    unit: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 }
                  },
                  required: ["test_name", "test_code", "value", "unit", "confidence"]
                }
              }
            },
            required: ["document_date", "date_confidence", "results"]
          }
        }
      } as any,
      messages: [
        {
          role: "system",
          content:
            "Extract lab results from medical report text. Return only valid JSON per schema. Do not invent values. Use lowercase snake_case test_code."
        },
        {
          role: "user",
          content: [
            "Extract document date and lab results.",
            "If date not found, return null for document_date and low date_confidence.",
            "If a row is unclear, skip it.",
            "Text:",
            extractedText.slice(0, 16000)
          ].join("\n")
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      return this.normalizeAiParsed(parsed);
    } catch {
      return null;
    }
  }

  private collectNvidiaText(node: unknown, sink: string[]) {
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        this.collectNvidiaText(item, sink);
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const obj = node as Record<string, unknown>;
    const preferredKeys = ["text", "label", "content", "transcription", "value"];

    for (const key of preferredKeys) {
      const value = obj[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          sink.push(trimmed);
        }
      }
    }

    for (const value of Object.values(obj)) {
      this.collectNvidiaText(value, sink);
    }
  }

  private async extractWithNvidiaOcr(parser: PDFParse): Promise<string | null> {
    const url = this.config.get<string>("NVIDIA_OCR_URL");
    const apiKey = this.config.get<string>("NVIDIA_API_KEY");

    if (!url || !apiKey || this.isPlaceholderValue(url) || this.isPlaceholderValue(apiKey)) {
      return null;
    }

    try {
      const screenshots = await parser.getScreenshot({ scale: 2 });
      const pages = screenshots.pages.slice(0, 2);
      if (pages.length === 0) {
        return null;
      }

      const payload = {
        input: pages.map((page) => ({
          type: "image_url",
          url: page.dataUrl
        }))
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(`NVIDIA OCR request failed (${response.status}): ${body.slice(0, 200)}`);
        return null;
      }

      const raw = (await response.json()) as unknown;
      const textSegments: string[] = [];
      this.collectNvidiaText(raw, textSegments);
      const merged = textSegments.join("\n").trim();
      return merged.length > 0 ? merged : null;
    } catch (error) {
      this.logger.warn(`NVIDIA OCR fallback failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    }
  }

  private hasUsableExtractedText(text: string): boolean {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length < 140) {
      return false;
    }

    const nonMarkerText = normalized.replace(/-+\s*\d+\s+of\s+\d+\s*-+/gi, "").trim();
    if (nonMarkerText.length < 80) {
      return false;
    }

    const words = normalized.match(/[A-Za-z\u0590-\u05FF]{2,}/g) ?? [];
    if (words.length < 20) {
      return false;
    }

    const hasLabHints = /(glucose|hba1c|creatinine|cholesterol|triglycerides|hdl|mg\/d[lL]|mmol\/l|\d{1,2}\/\d{1,2}\/\d{2,4})/i.test(
      normalized
    );

    return hasLabHints;
  }

  private getParsedScore(data: ParsedDocumentData): number {
    const avgConfidence =
      data.results.length > 0 ? data.results.reduce((sum, row) => sum + row.confidence, 0) / data.results.length : 0;
    return data.results.length * 100 + (data.documentDate ? 30 : 0) + data.dateConfidence * 20 + avgConfidence * 10;
  }
  async listLabResults(userId: string) {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
  }

  async createLabResult(userId: string, dto: CreateLabResultDto) {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("lab_results")
      .insert({ ...dto, user_id: userId })
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async enqueueDocumentExtraction(userId: string, documentId: string) {
    const supabase = this.client();

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id,user_id")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      throw new NotFoundException("Document not found");
    }

    if (document.user_id !== userId) {
      throw new ForbiddenException("Document does not belong to current user");
    }

    const { data, error } = await supabase
      .from("document_extractions")
      .upsert(
        {
          document_id: documentId,
          user_id: userId,
          status: "queued",
          used_ocr: false,
          error_message: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "document_id" }
      )
      .select("id,document_id,status,updated_at")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  async listDocumentExtractions(userId: string) {
    const supabase = this.client();
    const { data, error } = await supabase
      .from("document_extractions")
      .select("id,document_id,status,document_date,date_confidence,error_message,parser_version,used_ocr,parsed_results,extracted_text,updated_at,created_at,documents!inner(file_name,file_type,uploaded_at)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const rows = (data ?? []).map((row) => {
      const extracted = typeof row.extracted_text === "string" ? row.extracted_text.trim() : "";
      return {
        ...row,
        extracted_text_preview: extracted.slice(0, 600),
        parsed_results_count: Array.isArray(row.parsed_results) ? row.parsed_results.length : 0
      };
    });

    return rows;
  }

  async approveParsedExtraction(userId: string, documentId: string) {
    const supabase = this.client();
    const { data: extraction, error: extractionError } = await supabase
      .from("document_extractions")
      .select("id,document_id,user_id,status,document_date,parsed_results,documents!inner(uploaded_at)")
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .maybeSingle();

    if (extractionError) {
      throw new InternalServerErrorException(extractionError.message);
    }

    if (!extraction) {
      throw new NotFoundException("No extraction found for this document");
    }

    const documentRecord = Array.isArray(extraction.documents) ? extraction.documents[0] : extraction.documents;
    const fallbackDate = documentRecord?.uploaded_at ? String(documentRecord.uploaded_at).slice(0, 10) : null;
    const effectiveDocumentDate = extraction.document_date ?? fallbackDate;

    if (!effectiveDocumentDate) {
      throw new BadRequestException("Cannot approve extraction without a document date");
    }

    const parsedResults = Array.isArray(extraction.parsed_results)
      ? (extraction.parsed_results as Array<{
          testName?: string;
          testCode?: string;
          value?: number | string;
          unit?: string;
          confidence?: number | string;
        }>)
      : [];

    if (parsedResults.length === 0) {
      throw new BadRequestException("Cannot approve extraction with empty parsed results");
    }

    const normalizedResults = parsedResults
      .map((row) => {
        const value = Number(row.value);
        const confidence = Number(row.confidence ?? 0.5);
        return {
          testName: (row.testName ?? "").trim(),
          testCode: (row.testCode ?? "").trim(),
          value,
          unit: (row.unit ?? "").trim(),
          confidence
        };
      })
      .filter((row) => row.testName && row.testCode && Number.isFinite(row.value));

    if (normalizedResults.length === 0) {
      throw new BadRequestException("No valid parsed rows found to approve");
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("lab_results")
      .select("test_code")
      .eq("source_document_id", extraction.document_id);

    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    const existingCodes = new Set((existingRows ?? []).map((row) => row.test_code).filter(Boolean));
    const measuredAt = `${effectiveDocumentDate}T00:00:00.000Z`;

    const rowsToInsert = normalizedResults
      .filter((row) => !existingCodes.has(row.testCode))
      .map((row) => ({
        user_id: userId,
        test_name: row.testName,
        test_code: row.testCode,
        value: row.value,
        unit: row.unit,
        reference_range: null,
        measured_at: measuredAt,
        notes: extraction.document_date
          ? "Approved from document extraction"
          : "Approved from extraction (fallback to upload date)",
        source_document_id: extraction.document_id,
        confidence: row.confidence,
        is_verified: true
      }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("lab_results").insert(rowsToInsert);
      if (insertError) {
        throw new InternalServerErrorException(insertError.message);
      }
    }

    const { error: updateError } = await supabase
      .from("document_extractions")
      .update({
        status: "completed",
        document_date: effectiveDocumentDate,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", extraction.id);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return {
      documentId,
      inserted: rowsToInsert.length,
      status: "completed",
      documentDate: effectiveDocumentDate,
      usedFallbackDate: !extraction.document_date
    };
  }

  private async processQueueTick() {
    if (this.isWorkerRunning) {
      return;
    }

    this.isWorkerRunning = true;
    try {
      const supabase = this.client();
      const { data: queuedItem, error } = await supabase
        .from("document_extractions")
        .select("id")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        this.logger.error(`Failed reading extraction queue: ${error.message}`);
        return;
      }

      if (!queuedItem) {
        return;
      }

      this.logger.log(
        JSON.stringify({
          type: "extraction_pick",
          extractionId: queuedItem.id,
          timestamp: new Date().toISOString()
        })
      );

      await this.processSingleExtraction(queuedItem.id);
    } finally {
      this.isWorkerRunning = false;
    }
  }

  private async processSingleExtraction(extractionId: string) {
    const supabase = this.client();

    const setStatus = async (status: ExtractionStatus, extra: Record<string, unknown> = {}) => {
      const { error } = await supabase
        .from("document_extractions")
        .update({ status, updated_at: new Date().toISOString(), ...extra })
        .eq("id", extractionId);

      if (error) {
        this.logger.error(`Failed updating extraction ${extractionId} to ${status}: ${error.message}`);
      } else {
        this.logger.log(
          JSON.stringify({
            type: "extraction_status",
            extractionId,
            status,
            timestamp: new Date().toISOString()
          })
        );
      }
    };

    await setStatus("extracting", { error_message: null });

    const { data: extraction, error: extractionError } = await supabase
      .from("document_extractions")
      .select("id,document_id,user_id,documents!inner(id,file_path)")
      .eq("id", extractionId)
      .single();

    if (extractionError || !extraction) {
      this.logger.error(`Extraction record not found: ${extractionId}`);
      return;
    }

    this.logger.log(
      JSON.stringify({
        type: "extraction_start",
        extractionId,
        documentId: extraction.document_id,
        timestamp: new Date().toISOString()
      })
    );

    const document = Array.isArray(extraction.documents) ? extraction.documents[0] : extraction.documents;
    if (!document?.file_path) {
      await setStatus("failed", { error_message: "Document file path is missing" });
      return;
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.file_path);

    if (downloadError || !fileBlob) {
      await setStatus("failed", { error_message: downloadError?.message ?? "Failed to download document" });
      return;
    }

    let extractedText = "";
    let usedOcr = false;
    let parser: PDFParse | null = null;
    try {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      extractedText = (parsed.text ?? "").trim();

      if (!this.hasUsableExtractedText(extractedText)) {
        const ocrText = await this.extractWithNvidiaOcr(parser);
        if (ocrText && this.hasUsableExtractedText(ocrText)) {
          extractedText = ocrText;
          usedOcr = true;
        }
      }
    } catch (error) {
      if (parser) {
        await parser.destroy().catch(() => undefined);
      }
      await setStatus("failed", { error_message: error instanceof Error ? error.message : "PDF parsing failed" });
      return;
    }

    if (!extractedText) {
      if (parser) {
        await parser.destroy().catch(() => undefined);
      }

      this.logger.warn(
        JSON.stringify({
          type: "extraction_no_text",
          extractionId,
          timestamp: new Date().toISOString()
        })
      );

      await setStatus("review_needed", {
        extracted_text: "",
        parsed_results: [],
        document_date: null,
        date_confidence: 0,
        used_ocr: usedOcr,
        error_message: "No extractable text from PDF (parser and OCR failed)."
      });
      return;
    }

    await setStatus("parsing");

    const parseFromText = async (text: string) => {
      const ai = await this.extractWithAi(text);
      const regex = parseLabPdfText(text);
      const data: ParsedDocumentData =
        ai && (ai.results.length > 0 || ai.documentDate)
          ? ai
          : {
              documentDate: regex.documentDate,
              dateConfidence: regex.dateConfidence,
              results: regex.results
            };

      return { ai, data };
    };

    let { ai: aiParsed, data: parsedData } = await parseFromText(extractedText);

    if ((!parsedData.documentDate || parsedData.results.length === 0) && !usedOcr && parser) {
      const ocrText = await this.extractWithNvidiaOcr(parser);
      if (ocrText) {
        const candidate = await parseFromText(ocrText);
        if (this.getParsedScore(candidate.data) > this.getParsedScore(parsedData)) {
          extractedText = ocrText;
          parsedData = candidate.data;
          aiParsed = candidate.ai;
          usedOcr = true;
        }
      }
    }

    if (parser) {
      await parser.destroy().catch(() => undefined);
    }

    const parserVersion = aiParsed ? "openai-v1" : "regex-v1";

    this.logger.log(
      JSON.stringify({
        type: "extraction_parsed",
        extractionId,
        parserVersion,
        usedOcr,
        resultsCount: parsedData.results.length,
        documentDate: parsedData.documentDate,
        dateConfidence: parsedData.dateConfidence,
        timestamp: new Date().toISOString()
      })
    );

    const lowConfidence =
      parsedData.dateConfidence < 0.8 || parsedData.results.some((result) => result.confidence < 0.85);

    const status: ExtractionStatus =
      parsedData.documentDate && parsedData.results.length > 0 && !lowConfidence ? "completed" : "review_needed";

    const { error: updateError } = await supabase
      .from("document_extractions")
      .update({
        status,
        extracted_text: extractedText,
        parsed_results: parsedData.results,
        document_date: parsedData.documentDate,
        date_confidence: parsedData.dateConfidence,
        parser_version: parserVersion,
        used_ocr: usedOcr,
        error_message:
          status === "review_needed"
            ? "Needs user review for date and/or low-confidence parsed values"
            : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", extractionId);

    if (updateError) {
      this.logger.error(`Failed writing parsed extraction ${extractionId}: ${updateError.message}`);
      return;
    }

    this.logger.log(
      JSON.stringify({
        type: "extraction_persisted",
        extractionId,
        status,
        parserVersion,
        timestamp: new Date().toISOString()
      })
    );

    if (!parsedData.documentDate || parsedData.results.length === 0) {
      this.logger.warn(
        JSON.stringify({
          type: "extraction_waiting_review",
          extractionId,
          reason: "missing_date_or_results",
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    const measuredAt = `${parsedData.documentDate}T00:00:00.000Z`;
    const { data: existingRows, error: existingError } = await supabase
      .from("lab_results")
      .select("test_code")
      .eq("source_document_id", extraction.document_id);

    if (existingError) {
      this.logger.error(`Failed reading existing imported results: ${existingError.message}`);
      return;
    }

    const existingCodes = new Set((existingRows ?? []).map((row) => row.test_code).filter(Boolean));
    const rowsToInsert = parsedData.results
      .filter((result) => !existingCodes.has(result.testCode))
      .map((result) => ({
        user_id: extraction.user_id,
        test_name: result.testName,
        test_code: result.testCode,
        value: result.value,
        unit: result.unit || "",
        reference_range: null,
        measured_at: measuredAt,
        notes: parserVersion === "openai-v1" ? "Imported from PDF (AI extraction)" : "Imported from PDF",
        source_document_id: extraction.document_id,
        confidence: result.confidence,
        is_verified: result.confidence >= 0.85
      }));

    if (rowsToInsert.length === 0) {
      this.logger.log(
        JSON.stringify({
          type: "extraction_no_new_rows",
          extractionId,
          timestamp: new Date().toISOString()
        })
      );
      return;
    }

    const { error: insertError } = await supabase.from("lab_results").insert(rowsToInsert);
    if (insertError) {
      await setStatus("failed", { error_message: insertError.message });
      return;
    }

    this.logger.log(
      JSON.stringify({
        type: "extraction_rows_inserted",
        extractionId,
        inserted: rowsToInsert.length,
        timestamp: new Date().toISOString()
      })
    );
  }
}












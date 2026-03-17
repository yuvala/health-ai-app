import {
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
import { PDFParse } from "pdf-parse";
import type { CreateLabResultDto } from "./dto/create-lab-result.dto";
import { parseLabPdfText } from "./lab-pdf.parser";

type ExtractionStatus = "queued" | "extracting" | "parsing" | "review_needed" | "completed" | "failed";

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private workerTimer: NodeJS.Timeout | null = null;
  private isWorkerRunning = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

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
      .select("id,document_id,status,document_date,date_confidence,error_message,updated_at,created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data ?? [];
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
    try {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      extractedText = (parsed.text ?? "").trim();
      await parser.destroy();
    } catch (error) {
      await setStatus("failed", { error_message: error instanceof Error ? error.message : "PDF parsing failed" });
      return;
    }

    if (!extractedText) {
      await setStatus("review_needed", {
        extracted_text: "",
        parsed_results: [],
        document_date: null,
        date_confidence: 0,
        error_message: "No extractable PDF text (likely scanned PDF)."
      });
      return;
    }

    await setStatus("parsing");

    const parsedData = parseLabPdfText(extractedText);
    const lowConfidence = parsedData.dateConfidence < 0.8 || parsedData.results.some((result) => result.confidence < 0.85);
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
        parser_version: "regex-v1",
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

    if (!parsedData.documentDate || parsedData.results.length === 0) {
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
        notes: "Imported from PDF",
        source_document_id: extraction.document_id,
        confidence: result.confidence,
        is_verified: result.confidence >= 0.85
      }));

    if (rowsToInsert.length === 0) {
      return;
    }

    const { error: insertError } = await supabase.from("lab_results").insert(rowsToInsert);
    if (insertError) {
      await setStatus("failed", { error_message: insertError.message });
    }
  }
}






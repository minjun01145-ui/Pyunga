import {
  extractPdfTextPages,
  PdfTextExtractionError,
  type ExtractedPdfDocument,
} from "@/shared/pdf/pdf-text-extractor";

import { EvaluationTemplateImportError } from "../application/evaluation-template-import";

export async function extractEvaluationTemplatePdfText(file: File): Promise<ExtractedPdfDocument> {
  try {
    return await extractPdfTextPages(file);
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw new EvaluationTemplateImportError(error.message);
    }
    throw error;
  }
}

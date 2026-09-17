import {
  extractPdfTextPages as extractSharedPdfTextPages,
  PdfTextExtractionError,
  type ExtractedPdfDocument,
} from "@/shared/pdf/pdf-text-extractor";

import { AcademicCalendarImportError } from "../application/academic-calendar-import";

export type { ExtractedPdfDocument };

export async function extractPdfTextPages(file: File): Promise<ExtractedPdfDocument> {
  try {
    return await extractSharedPdfTextPages(file);
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw new AcademicCalendarImportError(error.message);
    }
    throw error;
  }
}

import { extractPdfTextPages, PdfTextExtractionError } from "@/shared/pdf/pdf-text-extractor";

export class CurriculumPdfImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurriculumPdfImportError";
  }
}

export async function extractCurriculumPdfText(file: File) {
  try {
    const document = await extractPdfTextPages(file);
    return {
      totalPages: document.totalPages,
      sourceText: document.pages.map((page) => `쪽 ${page.pageNumber}\n${page.text}`).join("\n\n"),
    };
  } catch (error) {
    if (error instanceof PdfTextExtractionError) throw new CurriculumPdfImportError(error.message);
    throw error;
  }
}

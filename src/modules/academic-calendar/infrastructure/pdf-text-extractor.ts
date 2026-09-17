import { extractText, getDocumentProxy } from "unpdf";

import type { ExtractedPdfPage } from "../application/academic-calendar-import";
import { AcademicCalendarImportError } from "../application/academic-calendar-import";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 60;
const MAX_IMAGE_PIXELS = 16_777_216;
const EXTRACTION_TIMEOUT_MS = 20_000;

export type ExtractedPdfDocument = {
  totalPages: number;
  pages: ExtractedPdfPage[];
};

export async function extractPdfTextPages(file: File): Promise<ExtractedPdfDocument> {
  if (file.size === 0) {
    throw new AcademicCalendarImportError("업로드한 PDF가 비어 있습니다.");
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new AcademicCalendarImportError("PDF 파일은 10MB 이하만 업로드할 수 있습니다.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfSignature(bytes)) {
    throw new AcademicCalendarImportError("올바른 PDF 파일이 아닙니다.");
  }

  const pdf = await getDocumentProxy(bytes, {
    maxImageSize: MAX_IMAGE_PIXELS,
  }).catch(() => {
    throw new AcademicCalendarImportError(
      "PDF 파일을 열 수 없습니다. 손상되었거나 지원하지 않는 PDF인지 확인해 주세요.",
    );
  });

  try {
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new AcademicCalendarImportError(`PDF는 ${MAX_PDF_PAGES}페이지 이하만 분석할 수 있습니다.`);
    }

    const extraction = await withTimeout(
      extractText(pdf, { mergePages: false }),
      EXTRACTION_TIMEOUT_MS,
      "PDF 텍스트 추출 시간이 초과되었습니다.",
    );

    const texts = Array.isArray(extraction.text) ? extraction.text : [extraction.text];
    const pages = texts
      .map((text, index) => ({ pageNumber: index + 1, text: text.trim() }))
      .filter((page) => page.text.length > 0);

    if (pages.length === 0) {
      throw new AcademicCalendarImportError(
        "PDF에서 텍스트를 읽지 못했습니다. 스캔 이미지 PDF라면 OCR 처리가 필요합니다.",
      );
    }

    return {
      totalPages: extraction.totalPages,
      pages,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AcademicCalendarImportError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

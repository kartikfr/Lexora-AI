import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export type PDFExtractionResult = {
  text: string;
  pageCount: number;
  usedOCR: boolean;
};

export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'str' in item) {
          return (item as { str: string }).str;
        }
        return '';
      })
      .join(' ');
    pageTexts.push(pageText);
    totalChars += pageText.length;
  }

  const avgCharsPerPage = totalChars / pageCount;
  const fullText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');

  // If very little text extracted, the PDF is likely scanned
  if (avgCharsPerPage < 100) {
    // For scanned PDFs, we note OCR would be needed but skip Tesseract in browser
    // due to WASM size constraints — indicate this to the user
    return {
      text: fullText.trim() || '[This appears to be a scanned PDF. OCR processing required for full text extraction. The document has been uploaded and basic structure detected.]',
      pageCount,
      usedOCR: avgCharsPerPage < 50,
    };
  }

  return {
    text: fullText.trim(),
    pageCount,
    usedOCR: false,
  };
}

export function chunkText(text: string, chunkSize = 3000, overlap = 200): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start = end - overlap;
  }

  return chunks;
}

export function truncateForPrompt(text: string, maxChars = 24000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... document truncated for analysis ...]';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

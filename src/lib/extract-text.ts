/** Browser-side text extraction for PDF and DOCX resumes / job descriptions. */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
    return `${file.name}: only PDF and DOCX files are supported.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name}: file is larger than 5 MB.`;
  }
  return null;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  return pages.join("\n\n").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.min.js");
  const lib = ((mammoth as unknown as { default?: unknown }).default ??
    mammoth) as {
    extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const buffer = await file.arrayBuffer();
  const result = await lib.extractRawText({ arrayBuffer: buffer });
  return result.value.replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  try {
    const text = name.endsWith(".pdf") ? await extractPdf(file) : await extractDocx(file);
    if (!text || text.length < 40) {
      throw new Error("no text");
    }
    return text;
  } catch {
    throw new Error(
      `Could not read text from ${file.name}. The file may be scanned, image-only or corrupted.`,
    );
  }
}

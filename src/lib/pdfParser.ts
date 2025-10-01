/**
 * PDF text extraction utility
 * Uses the browser's built-in PDF.js capabilities
 */

export const extractTextFromPDF = async (file: File): Promise<string> => {
  // For browser-based PDF parsing, we'll use pdf.js from CDN
  // This is a simplified approach - for production, consider using pdf-parse or similar
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Use pdfjs-dist (loaded via CDN in index.html)
        const pdfjsLib = (window as any).pdfjsLib;
        
        if (!pdfjsLib) {
          // Fallback: simple text extraction attempt
          const text = new TextDecoder().decode(arrayBuffer);
          resolve(text);
          return;
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        }
        
        resolve(fullText);
      } catch (error) {
        console.error('PDF parsing error:', error);
        reject(new Error('Failed to parse PDF. Please try a different file.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Normalize extracted text for AI processing
 */
export const normalizeText = (text: string): string => {
  return text
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove very short lines (likely noise)
    .split('\n')
    .filter(line => line.trim().length >= 3)
    // Rejoin paragraphs
    .join('\n')
    .trim();
};

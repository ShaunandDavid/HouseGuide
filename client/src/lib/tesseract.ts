import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(imageFile);
    
    Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress);
        }
      }
    }).then(({ data }) => {
      URL.revokeObjectURL(imageUrl);
      resolve({
        text: data.text,
        confidence: data.confidence
      });
    }).catch(error => {
      URL.revokeObjectURL(imageUrl);
      reject(error);
    });
  });
}

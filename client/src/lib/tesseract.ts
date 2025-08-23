import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  let imageUrl: string | null = null;
  
  try {
    imageUrl = URL.createObjectURL(imageFile);
    
    const { data } = await Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress);
        }
      }
    });
    
    return {
      text: data.text,
      confidence: data.confidence
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error(`Failed to process image with OCR: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }
}

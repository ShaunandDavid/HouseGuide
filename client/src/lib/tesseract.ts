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
    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('Selected file is not a valid image');
    }
    
    // Validate file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      throw new Error('Image file is too large (max 10MB)');
    }
    
    // Create object URL for Tesseract
    imageUrl = URL.createObjectURL(imageFile);
    
    // Test if image can be loaded before OCR
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Invalid or corrupted image file'));
      img.src = imageUrl!;
    });
    
    const { data } = await Tesseract.recognize(imageUrl, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress);
        }
      }
    });
    
    return {
      text: data.text?.trim() || '',
      confidence: data.confidence || 0
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    // Return a more user-friendly error message
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Unable to process image: ${message}`);
  } finally {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }
}

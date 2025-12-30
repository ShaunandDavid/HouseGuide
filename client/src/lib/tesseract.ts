import Tesseract from 'tesseract.js';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;

const loadImageFromFile = (imageFile: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Unsupported or corrupted image file. Try saving as JPEG.'));
    };

    img.src = objectUrl;
  });
};

const normalizeImageForOCR = async (imageFile: File): Promise<File> => {
  if (!imageFile.type.startsWith('image/')) {
    throw new Error('Selected file is not a valid image');
  }

  if (imageFile.size > MAX_IMAGE_BYTES) {
    throw new Error('Image file is too large (max 20MB)');
  }

  const img = await loadImageFromFile(imageFile);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  if (!width || !height) {
    throw new Error('Unable to read image dimensions');
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported on this device');
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Unable to convert image for OCR'));
      }
    }, 'image/jpeg', JPEG_QUALITY);
  });

  const normalizedName = imageFile.name.replace(/\.[^.]+$/, '') || 'document';
  return new File([blob], `${normalizedName}.jpg`, { type: 'image/jpeg' });
};

const shouldBypassNormalization = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('insecure') ||
    normalized.includes('security') ||
    normalized.includes('canvas is not supported') ||
    normalized.includes('unable to convert image')
  );
};

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  try {
    let sourceFile: File | Blob = imageFile;
    try {
      sourceFile = await normalizeImageForOCR(imageFile);
    } catch (error) {
      if (shouldBypassNormalization(error)) {
        console.warn('OCR normalization skipped due to browser restrictions:', error);
        sourceFile = imageFile;
      } else {
        throw error;
      }
    }

    const { data } = await Tesseract.recognize(sourceFile, 'eng', {
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
    // No cleanup needed since we're passing the File/Blob directly.
  }
}

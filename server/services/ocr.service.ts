// ============================================================================
// ZÉNITH
// Module : Financial / OCR Service (Yape Receipt Analysis)
// Layer  : Domain / Services
// File   : ocr.service.ts
// ============================================================================

import { GoogleGenAI } from '@google/genai';
import { YapeReceiptExtraction } from '../../src/types';

export const OcrService = {
  /**
   * Analiza una captura de pantalla de comprobante de Yape usando Gemini Vision.
   * Regla de Negocio:
   * La IA ÚNICAMENTE extrae información visible en formato JSON estructurado.
   * La IA NUNCA acredita dinero, NUNCA cambia saldos y NUNCA declara pagos recibidos.
   */
  analyzeYapeReceipt: async (imageBase64OrUrl: string): Promise<YapeReceiptExtraction> => {
    const emptyResult: YapeReceiptExtraction = {
      amount: null,
      date: null,
      time: null,
      payerName: null,
      securityCode: null,
      operationNumber: null,
      rawText: null,
      confidence: 0,
      extractedAt: new Date().toISOString()
    };

    if (!imageBase64OrUrl) {
      return emptyResult;
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('[OCR_SERVICE] GEMINI_API_KEY no configurada. Fallback estructurado.');
        return {
          ...emptyResult,
          rawText: 'ADVERTENCIA: GEMINI_API_KEY no disponible. Requiere revisión visual humana obligatoria.',
          confidence: 0
        };
      }

      const ai = new GoogleGenAI({ apiKey });

      // Preparar data base64 limpia y mimeType
      let mimeType = 'image/jpeg';
      let cleanBase64 = imageBase64OrUrl;

      if (imageBase64OrUrl.startsWith('data:')) {
        const matches = imageBase64OrUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          cleanBase64 = matches[2];
        } else {
          cleanBase64 = imageBase64OrUrl.split(',')[1] || imageBase64OrUrl;
        }
      }

      const prompt = `Analiza detenidamente esta captura de pantalla de un comprobante de pago de la aplicación peruana Yape (BCP).
Extrae EXCLUSIVAMENTE los datos que estén claramente visibles en la imagen. Si algún dato está borroso, tapado o ausente, asígnalo como null.
No inventes datos. No asumas números.

Responde ÚNICAMENTE con un objeto JSON con este esquema exacto:
{
  "amount": number o null (el monto numérico exacto en Soles, por ejemplo 10 o 50.00),
  "date": string o null (fecha en formato YYYY-MM-DD si es determinable, o texto legible de la fecha),
  "time": string o null (hora en formato HH:mm, por ejemplo "14:32" o "18:05"),
  "payerName": string o null (nombre del titular o pagador que envió el dinero si figura),
  "securityCode": string o null (el código de seguridad de 3 o 4 dígitos de Yape que suele figurar con candado o texto 'código de seguridad', por ejemplo '739'),
  "operationNumber": string o null (número de operación o correlativo si está visible),
  "rawText": string (resumen breve del texto visible detectado en el comprobante),
  "confidence": number entre 0 y 1 (nivel de certeza visual de la extracción)
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          },
          prompt
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      return {
        amount: typeof parsed.amount === 'number' ? parsed.amount : (parsed.amount ? parseFloat(parsed.amount) : null),
        date: parsed.date || null,
        time: parsed.time || null,
        payerName: parsed.payerName || null,
        securityCode: parsed.securityCode ? String(parsed.securityCode).trim() : null,
        operationNumber: parsed.operationNumber ? String(parsed.operationNumber).trim() : null,
        rawText: parsed.rawText || null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        extractedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[OCR_SERVICE] Error procesando imagen con Gemini:', error);
      return {
        ...emptyResult,
        rawText: `Error durante extracción OCR: ${error.message}. Marcado para revisión humana.`,
        confidence: 0
      };
    }
  }
};

import { TaxCalculation, TaxResult, TaxDocument, TaxStatus, Invoice, Receipt, TaxDocumentType } from './TaxTypes';
import { TaxRepository } from './TaxRepository';
import { SunatAdapter, NubefactAdapter, FactilizaAdapter, DigiflowAdapter, EfactAdapter } from './TaxAdapters';
import { AuditEngine } from '../AuditEngine';

export class TaxEngineClass {
  private repository = new TaxRepository();
  private defaultAdapter = new SunatAdapter(); 

  // Patrón Adapter: support changing adapter at runtime
  private currentAdapter = this.defaultAdapter;

  setProviderAdapter(adapterName: 'sunat' | 'nubefact' | 'factiliza' | 'digiflow' | 'efact') {
    switch (adapterName) {
      case 'sunat':
        this.currentAdapter = new SunatAdapter();
        break;
      case 'nubefact':
        this.currentAdapter = new NubefactAdapter();
        break;
      case 'factiliza':
        this.currentAdapter = new FactilizaAdapter();
        break;
      case 'digiflow':
        this.currentAdapter = new DigiflowAdapter();
        break;
      case 'efact':
        this.currentAdapter = new EfactAdapter();
        break;
    }
  }

  getCurrentProviderName(): string {
    return this.currentAdapter.provider.name;
  }

  calculateTax(calc: TaxCalculation): TaxResult {
    const rawPrice = calc.ridePrice;
    const discount = calc.discountAmount + calc.promotionalAmount;
    const finalPrice = Math.max(0, rawPrice - discount);

    if (calc.taxExempt) {
      return {
        subtotal: finalPrice,
        igv: 0,
        total: finalPrice,
        discount: discount,
        finalPrice: finalPrice,
        sealHash: `EXENTO-SEAL-${Math.random().toString(36).substring(7).toUpperCase()}`
      };
    }

    // IGV Peru = 18% inclusive
    const subtotal = finalPrice / 1.18;
    const igv = finalPrice - subtotal;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      igv: Number(igv.toFixed(2)),
      total: Number(finalPrice.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      finalPrice: Number(finalPrice.toFixed(2)),
      sealHash: `IGV-18-SEAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    };
  }

  async generateDocumentForRide(params: {
    rideId: string;
    passengerId: string;
    passengerName: string;
    passengerDocument: string; // DNI (8 chars) or RUC (11 chars)
    ridePrice: number;
    discountAmount: number;
    promotionalAmount: number;
    companyName?: string;
    companyAddress?: string;
  }): Promise<TaxDocument> {
    
    const isRuc = params.passengerDocument.length === 11;
    const type: TaxDocumentType = isRuc ? 'FACTURA' : 'BOLETA';
    
    // Calculate taxes
    const taxCalc = this.calculateTax({
      ridePrice: params.ridePrice,
      discountAmount: params.discountAmount,
      promotionalAmount: params.promotionalAmount,
      taxExempt: false
    });

    const series = isRuc ? 'F001' : 'B001';
    const correlative = Math.floor(Math.random() * 900000 + 100000).toString(); // Simulated sequential correlative
    const docId = `DOC-${type}-${series}-${correlative}`;

    let taxDoc: TaxDocument;

    if (isRuc) {
      const invoice: Invoice = {
        id: docId,
        type: 'FACTURA',
        status: TaxStatus.DRAFT,
        series,
        correlative,
        issueDate: new Date().toISOString(),
        subtotal: taxCalc.subtotal,
        igv: taxCalc.igv,
        discount: taxCalc.discount,
        total: taxCalc.total,
        currency: 'PEN',
        hash: taxCalc.sealHash,
        retryCount: 0,
        rideId: params.rideId,
        passengerId: params.passengerId,
        passengerName: params.passengerName,
        passengerDocument: params.passengerDocument,
        companyRuc: params.passengerDocument,
        companyName: params.companyName || 'CORPORACIÓN TRUJILLO S.A.C.',
        companyAddress: params.companyAddress || 'Av. Húsares de Junín 280, Trujillo, Perú',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      taxDoc = invoice;
    } else {
      const receipt: Receipt = {
        id: docId,
        type: 'BOLETA',
        status: TaxStatus.DRAFT,
        series,
        correlative,
        issueDate: new Date().toISOString(),
        subtotal: taxCalc.subtotal,
        igv: taxCalc.igv,
        discount: taxCalc.discount,
        total: taxCalc.total,
        currency: 'PEN',
        hash: taxCalc.sealHash,
        retryCount: 0,
        rideId: params.rideId,
        passengerId: params.passengerId,
        passengerName: params.passengerName,
        passengerDocument: params.passengerDocument,
        passengerDni: params.passengerDocument,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      taxDoc = receipt;
    }

    // Save initial state to TaxRepository (which audits automatically)
    await this.repository.saveDocument(taxDoc);

    return taxDoc;
  }

  async processEmission(documentId: string): Promise<boolean> {
    const docData = await this.repository.getDocumentById(documentId);
    if (!docData) {
      throw new Error(`Comprobante ${documentId} no existe en el sistema.`);
    }

    // State validation transition check
    if (docData.status !== TaxStatus.DRAFT && docData.status !== TaxStatus.PENDING) {
      console.warn(`[TaxEngine] Comprobante ${documentId} ya se procesó con estado ${docData.status}`);
      return false;
    }

    // Change state to PENDING
    await this.repository.updateDocumentStatus(documentId, TaxStatus.PENDING, {
      transition: 'DRAFT_TO_PENDING'
    });

    try {
      let result;
      if (docData.type === 'FACTURA') {
        result = await this.currentAdapter.emitInvoice(docData as Invoice);
      } else {
        result = await this.currentAdapter.emitReceipt(docData as Receipt);
      }

      if (result.success) {
        // Update document with success variables
        const updatedDoc: TaxDocument = {
          ...docData,
          status: result.status,
          xmlUrl: result.xmlUrl,
          pdfUrl: result.pdfUrl,
          cdrUrl: result.cdrUrl,
          hash: result.hash,
          sunatObservations: result.sunatObservations,
          sunatErrors: undefined,
          updatedAt: new Date().toISOString()
        };
        await this.repository.saveDocument(updatedDoc);

        await AuditEngine.logEvent({
          eventType: 'FINANCIAL_TRANSACTION',
          severity: 'INFO',
          actorId: 'SYSTEM_TAX_ENGINE',
          actorName: 'Zénith Tax Engine',
          description: `Comprobante ${docData.type} ${docData.series}-${docData.correlative} validado con éxito por OSE.`,
          metadata: {
            documentId,
            hash: result.hash,
            provider: this.currentAdapter.provider.name
          }
        });

        return true;
      } else {
        // Handle rejection or failure
        const updatedDoc: TaxDocument = {
          ...docData,
          status: result.status,
          sunatErrors: result.sunatErrors,
          updatedAt: new Date().toISOString()
        };
        await this.repository.saveDocument(updatedDoc);
        
        await this.repository.logError(documentId, result.sunatErrors?.[0] || 'Error general devuelto por SUNAT OSE.');
        return false;
      }

    } catch (e: any) {
      const errorMsg = e.message || 'Error de red con el PSE/OSE.';
      await this.repository.logError(documentId, errorMsg);
      await this.repository.updateDocumentStatus(documentId, TaxStatus.PENDING, {
        error: errorMsg,
        reintentos: docData.retryCount + 1
      });
      return false;
    }
  }
}

export const TaxEngine = new TaxEngineClass();

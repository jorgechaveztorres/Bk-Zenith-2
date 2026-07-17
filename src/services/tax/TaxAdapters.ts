import { 
  TaxAdapter, 
  TaxProvider, 
  Invoice, 
  Receipt, 
  CreditNote, 
  DebitNote, 
  TaxEmissionResult, 
  TaxStatus 
} from './TaxTypes';

// Helper function to simulate cryptographic signature generation
function generateMockCriptoHash(series: string, correlative: string, total: number): string {
  const characters = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return `ZENITH-SECURE-SIGN-[${series}-${correlative}]-[S/ ${total.toFixed(2)}]-${result}`;
}

// 1. Direct Sunat Adapter (Direct integration)
export class SunatAdapter implements TaxAdapter {
  provider: TaxProvider = {
    name: 'SUNAT OSE Direct Connection',
    identifier: 'sunat_direct'
  };

  async emitInvoice(invoice: Invoice): Promise<TaxEmissionResult> {
    // Simulating OSE processing time and validations
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // RUC check simulation
    if (!invoice.companyRuc.startsWith('20') && !invoice.companyRuc.startsWith('10')) {
      return {
        success: false,
        status: TaxStatus.REJECTED,
        hash: '',
        sunatErrors: ['RUC inválido de acuerdo con los padrones de SUNAT (Debe iniciar con 10 o 20).']
      };
    }

    const docHash = generateMockCriptoHash(invoice.series, invoice.correlative, invoice.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/xml/${invoice.id}.xml`,
      pdfUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/pdf/${invoice.id}.pdf`,
      cdrUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/cdr/${invoice.id}.xml`,
      hash: docHash,
      sunatObservations: ['Boleta/Factura emitida fuera de horario bancario habitual, registrada en cola batch.']
    };
  }

  async emitReceipt(receipt: Receipt): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (receipt.passengerDocument.length !== 8) {
      return {
        success: false,
        status: TaxStatus.REJECTED,
        hash: '',
        sunatErrors: ['DNI inválido. Debe poseer exactamente 8 dígitos numéricos.']
      };
    }

    const docHash = generateMockCriptoHash(receipt.series, receipt.correlative, receipt.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/xml/${receipt.id}.xml`,
      pdfUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/pdf/${receipt.id}.pdf`,
      cdrUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/cdr/${receipt.id}.xml`,
      hash: docHash
    };
  }

  async emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const docHash = generateMockCriptoHash(creditNote.series, creditNote.correlative, creditNote.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/xml/${creditNote.id}.xml`,
      pdfUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/pdf/${creditNote.id}.pdf`,
      cdrUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/cdr/${creditNote.id}.xml`,
      hash: docHash
    };
  }

  async emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const docHash = generateMockCriptoHash(debitNote.series, debitNote.correlative, debitNote.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/xml/${debitNote.id}.xml`,
      pdfUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/pdf/${debitNote.id}.pdf`,
      cdrUrl: `https://zenith-billing-bucket.s3.amazonaws.com/sunat/cdr/${debitNote.id}.xml`,
      hash: docHash
    };
  }
}

// 2. Nubefact Adapter (JSON REST API simulation)
export class NubefactAdapter implements TaxAdapter {
  provider: TaxProvider = {
    name: 'Nubefact REST PSE Service',
    identifier: 'nubefact'
  };

  async emitInvoice(invoice: Invoice): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 900));
    const docHash = generateMockCriptoHash(invoice.series, invoice.correlative, invoice.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://nubefact.com/api/v1/xml/${invoice.id}`,
      pdfUrl: `https://nubefact.com/api/v1/pdf/${invoice.id}`,
      cdrUrl: `https://nubefact.com/api/v1/cdr/${invoice.id}`,
      hash: docHash,
      sunatObservations: ['Nubefact: Comprobante recibido y visado por OSE Nubefact.']
    };
  }

  async emitReceipt(receipt: Receipt): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 700));
    const docHash = generateMockCriptoHash(receipt.series, receipt.correlative, receipt.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://nubefact.com/api/v1/xml/${receipt.id}`,
      pdfUrl: `https://nubefact.com/api/v1/pdf/${receipt.id}`,
      cdrUrl: `https://nubefact.com/api/v1/cdr/${receipt.id}`,
      hash: docHash
    };
  }

  async emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const docHash = generateMockCriptoHash(creditNote.series, creditNote.correlative, creditNote.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      hash: docHash
    };
  }

  async emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const docHash = generateMockCriptoHash(debitNote.series, debitNote.correlative, debitNote.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      hash: docHash
    };
  }
}

// 3. Factiliza Adapter (OSE/PSE cloud solution)
export class FactilizaAdapter implements TaxAdapter {
  provider: TaxProvider = {
    name: 'Factiliza OSE Integration',
    identifier: 'factiliza'
  };

  async emitInvoice(invoice: Invoice): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 1100));
    const docHash = generateMockCriptoHash(invoice.series, invoice.correlative, invoice.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://factiliza.pe/downloads/xml/${invoice.id}`,
      pdfUrl: `https://factiliza.pe/downloads/pdf/${invoice.id}`,
      cdrUrl: `https://factiliza.pe/downloads/cdr/${invoice.id}`,
      hash: docHash
    };
  }

  async emitReceipt(receipt: Receipt): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 800));
    const docHash = generateMockCriptoHash(receipt.series, receipt.correlative, receipt.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://factiliza.pe/downloads/xml/${receipt.id}`,
      pdfUrl: `https://factiliza.pe/downloads/pdf/${receipt.id}`,
      cdrUrl: `https://factiliza.pe/downloads/cdr/${receipt.id}`,
      hash: docHash
    };
  }

  async emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'FACTILIZA-CN-HASH' };
  }

  async emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'FACTILIZA-DN-HASH' };
  }
}

// 4. Digiflow Adapter (Cámara de Comercio de Lima PSE integration)
export class DigiflowAdapter implements TaxAdapter {
  provider: TaxProvider = {
    name: 'Digiflow Enterprise Billing Platform',
    identifier: 'digiflow'
  };

  async emitInvoice(invoice: Invoice): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const docHash = generateMockCriptoHash(invoice.series, invoice.correlative, invoice.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://digiflow.pe/portal/comprobantes/xml/${invoice.id}`,
      pdfUrl: `https://digiflow.pe/portal/comprobantes/pdf/${invoice.id}`,
      cdrUrl: `https://digiflow.pe/portal/comprobantes/cdr/${invoice.id}`,
      hash: docHash
    };
  }

  async emitReceipt(receipt: Receipt): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 950));
    const docHash = generateMockCriptoHash(receipt.series, receipt.correlative, receipt.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://digiflow.pe/portal/comprobantes/xml/${receipt.id}`,
      pdfUrl: `https://digiflow.pe/portal/comprobantes/pdf/${receipt.id}`,
      cdrUrl: `https://digiflow.pe/portal/comprobantes/cdr/${receipt.id}`,
      hash: docHash
    };
  }

  async emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 600));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'DIGIFLOW-CN-HASH' };
  }

  async emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 600));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'DIGIFLOW-DN-HASH' };
  }
}

// 5. Efact Adapter (Standard integration for high-volume transactions)
export class EfactAdapter implements TaxAdapter {
  provider: TaxProvider = {
    name: 'Efact OSE High-Volume Connector',
    identifier: 'efact'
  };

  async emitInvoice(invoice: Invoice): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 850));
    const docHash = generateMockCriptoHash(invoice.series, invoice.correlative, invoice.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://efact.pe/download/xml/${invoice.id}`,
      pdfUrl: `https://efact.pe/download/pdf/${invoice.id}`,
      cdrUrl: `https://efact.pe/download/cdr/${invoice.id}`,
      hash: docHash,
      sunatObservations: ['Efact: CDR emitido y firmado por SUNAT directamente.']
    };
  }

  async emitReceipt(receipt: Receipt): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 650));
    const docHash = generateMockCriptoHash(receipt.series, receipt.correlative, receipt.total);
    return {
      success: true,
      status: TaxStatus.ACCEPTED,
      xmlUrl: `https://efact.pe/download/xml/${receipt.id}`,
      pdfUrl: `https://efact.pe/download/pdf/${receipt.id}`,
      cdrUrl: `https://efact.pe/download/cdr/${receipt.id}`,
      hash: docHash
    };
  }

  async emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 550));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'EFACT-CN-HASH' };
  }

  async emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult> {
    await new Promise(resolve => setTimeout(resolve, 550));
    return { success: true, status: TaxStatus.ACCEPTED, hash: 'EFACT-DN-HASH' };
  }
}

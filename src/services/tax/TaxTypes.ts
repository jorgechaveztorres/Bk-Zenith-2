export enum TaxStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  GENERATED = 'GENERATED',
  SIGNED = 'SIGNED',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  ACCEPTED = 'ACCEPTED',
  OBSERVED = 'OBSERVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export type TaxDocumentType = 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

export interface TaxDocument {
  id: string;
  type: TaxDocumentType;
  status: TaxStatus;
  series: string;
  correlative: string;
  issueDate: string; // ISO String
  subtotal: number;
  igv: number;
  discount: number;
  total: number;
  currency: 'PEN';
  hash: string;
  xmlUrl?: string;
  pdfUrl?: string;
  cdrUrl?: string;
  sunatObservations?: string[];
  sunatErrors?: string[];
  retryCount: number;
  lastError?: string;
  rideId: string;
  passengerId: string;
  passengerName: string;
  passengerDocument: string; // DNI / RUC
  createdAt: string;
  updatedAt: string;
}

export interface Invoice extends TaxDocument {
  type: 'FACTURA';
  companyRuc: string;
  companyName: string;
  companyAddress: string;
}

export interface Receipt extends TaxDocument {
  type: 'BOLETA';
  passengerDni: string;
}

export interface CreditNote extends TaxDocument {
  type: 'NOTA_CREDITO';
  affectedDocumentSeries: string;
  affectedDocumentCorrelative: string;
  creditNoteReason: string;
}

export interface DebitNote extends TaxDocument {
  type: 'NOTA_DEBITO';
  affectedDocumentSeries: string;
  affectedDocumentCorrelative: string;
  debitNoteReason: string;
}

export interface LedgerEntry {
  id: string; // TransactionId / AccountingEntryId
  rideId: string;
  passengerId: string;
  driverId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  subtotal: number;
  igv: number;
  commission: number;
  total: number;
  paymentMethod: string;
  status: string;
  hash: string;
  auditId: string;
  createdAt: string;
}

export interface TaxCalculation {
  ridePrice: number;
  discountAmount: number;
  promotionalAmount: number;
  taxExempt: boolean;
}

export interface TaxResult {
  subtotal: number;
  igv: number;
  total: number;
  discount: number;
  finalPrice: number;
  sealHash: string;
}

export interface ITaxRepository {
  saveDocument(doc: TaxDocument): Promise<boolean>;
  getDocumentById(id: string): Promise<TaxDocument | null>;
  getDocumentByRideId(rideId: string): Promise<TaxDocument | null>;
  listDocuments(filters: { status?: TaxStatus; type?: TaxDocumentType; limitCount?: number }): Promise<TaxDocument[]>;
  updateDocumentStatus(id: string, status: TaxStatus, auditMeta: Record<string, string | number | boolean | null>): Promise<boolean>;
  logError(id: string, errorMsg: string): Promise<boolean>;
}

export interface TaxProvider {
  name: string;
  identifier: string;
}

export interface TaxEmissionResult {
  success: boolean;
  status: TaxStatus;
  xmlUrl?: string;
  pdfUrl?: string;
  cdrUrl?: string;
  hash: string;
  sunatErrors?: string[];
  sunatObservations?: string[];
}

export interface TaxAdapter {
  provider: TaxProvider;
  emitInvoice(invoice: Invoice): Promise<TaxEmissionResult>;
  emitReceipt(receipt: Receipt): Promise<TaxEmissionResult>;
  emitCreditNote(creditNote: CreditNote): Promise<TaxEmissionResult>;
  emitDebitNote(debitNote: DebitNote): Promise<TaxEmissionResult>;
}

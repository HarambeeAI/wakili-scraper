// Procurement tool type contracts (OPS-05)

export interface ProcClassification {
  isSearchSuppliers: boolean;
  isCompareQuotes: boolean;
  isCreatePO: boolean;
  isScoreVendor: boolean;
}

export interface SupplierResult {
  name: string;
  website: string;
  description: string;
  location: string;
  capabilities: string[];
}

export interface QuoteComparison {
  suppliers: Array<{
    name: string;
    price: number;
    terms: string;
    quality: number;
    leadTime: string;
    totalScore: number;
  }>;
  bestValue: string;
  recommendation: string;
}

export interface PurchaseOrderInput {
  userId: string;
  supplier: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  deliveryDate?: string;
  notes?: string;
}

export interface VendorScore {
  supplierName: string;
  score: number;
  reliability: number;
  price: number;
  quality: number;
  history: Array<{ date: string; amount: number; onTime: boolean }>;
}

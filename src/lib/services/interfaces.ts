/**
 * Service interfaces for dependency injection
 * Each interface mirrors the public API of its corresponding service class.
 */

export interface IQuoteService {
  getQuote(request: {
    amount: string;
    currency: string;
    feeMethod: 'USDC' | 'XLM' | 'stablecoin' | 'native';
  }): Promise<{
    destinationAmount: string;
    rate: number;
    currency: string;
    bridgeFee: string;
    payoutFee: string;
    estimatedTime: number;
  }>;
}

export interface IBridgeService {
  buildTransaction(request: {
    amount: string;
    fromAddress: string;
    toAddress: string;
    feePaymentMethod?: 'native' | 'stablecoin';
  }): Promise<{
    xdr: string;
    sourceToken: { symbol: string; decimals: number; contract?: string; chain: string };
    destinationToken: { symbol: string; decimals: number; contract?: string; chain: string };
  }>;
  submitTransaction(request: { xdr: string; signature: string }): Promise<{ txHash: string; status: string }>;
  getTransactionStatus(txHash: string): Promise<{ status: string; bridgeAmount?: string }>;
}

export interface IPayoutService {
  createOrder(request: {
    orderId: string;
    amount: string;
    currency: string;
    beneficiary: { institution: string; accountIdentifier: string; accountName: string };
    baseAddress: string;
  }): Promise<{ orderId: string; status: string; createdAt: string }>;
  getOrderStatus(orderId: string): Promise<{
    orderId: string;
    status: 'pending' | 'processing' | 'settled' | 'failed' | 'refunded';
    amount: string;
    currency: string;
    settledAt?: string;
    error?: string;
  }>;
  executePayout(orderId: string, baseUsdcAmount: string): Promise<{ success: boolean }>;
}

export interface IWebhookService {
  processPaycrestWebhook(payload: { event: string; data: Record<string, unknown> }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>;
}

export interface ITransactionService {
  getTransaction(id: string): Promise<Record<string, unknown> | null>;
  getTransactionByPayoutOrderId(orderId: string): Promise<Record<string, unknown> | null>;
  listTransactions(filter: {
    status?: string;
    currency?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  }): Promise<Record<string, unknown>[]>;
  updateTransaction(id: string, updates: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
  deleteTransaction(id: string): Promise<boolean>;
  getTransactionStats(filter?: Record<string, unknown>): Promise<{
    total: number; completed: number; failed: number; pending: number; totalAmount: string;
  }>;
}

export interface ISharingService {
  createShareLink(transactionId: string, userAddress: string, settings: { allowSharing: boolean; expirationDays?: number }): Promise<Record<string, unknown>>;
  getShareLink(shareToken: string): Promise<Record<string, unknown> | null>;
  incrementViewCount(shareToken: string): Promise<void>;
  revokeShareLink(shareToken: string): Promise<void>;
  getUserShareLinks(userAddress: string): Promise<Record<string, unknown>[]>;
  generateShareUrl(shareToken: string, baseUrl: string): string;
  generateSocialShareText(amount: string, currency: string): string;
  generateTwitterShareUrl(shareUrl: string, text: string): string;
  generateFacebookShareUrl(shareUrl: string): string;
  generateLinkedInShareUrl(shareUrl: string, title: string): string;
  generateEmailShareUrl(shareUrl: string, amount: string, currency: string): string;
}

export interface IAnalyticsService {
  getAnalytics(userAddress: string, startDate: number, endDate: number): Promise<Record<string, unknown>>;
}

export interface IQRCodeService {
  generateQRData(data: { transactionId: string; amount: string; currency: string; timestamp: number; status: string }, options?: { size?: number; format?: string }): string;
  generateSVGPattern(data: string, size?: number): string;
  createQRCode(transactionId: string, data: Record<string, unknown>, options?: Record<string, unknown>): Promise<Record<string, unknown>>;
  getQRCode(transactionId: string): Promise<Record<string, unknown> | null>;
  generateDownloadableQR(data: Record<string, unknown>, format?: 'svg' | 'png', size?: number): string;
  parseQRData(qrData: string): Record<string, unknown> | null;
}

export interface IOnrampService {
  getQuote(request: {
    fiatAmount: string;
    fiatCurrency: string;
    destinationToken: string;
    destinationNetwork?: string;
    provider?: string;
  }): Promise<Record<string, unknown>>;
  createOrder(request: Record<string, unknown>): Promise<Record<string, unknown>>;
  getOrderStatus(orderId: string): Promise<Record<string, unknown>>;
  handleDepositConfirmed(orderId: string): Promise<void>;
  handleBridgeCompleted(orderId: string): Promise<void>;
  reconciliate(orderId: string): Promise<void>;
  handleWebhook(payload: { event: string; data: Record<string, unknown> }): Promise<void>;
}

export interface IReferralService {
  createReferralCode(userId: string, rewardAmount?: number): Promise<Record<string, unknown>>;
  getReferralCode(userId: string): Promise<Record<string, unknown>>;
  trackReferral(referralCode: string, referredUserId: string): Promise<Record<string, unknown>>;
  getReferralStats(userId: string): Promise<Record<string, unknown>>;
  calculateReward(baseReward: number, claimedCount: number): number;
  distributeReward(referralId: string): Promise<Record<string, unknown>>;
  getReferralAnalytics(userId: string): Promise<Record<string, unknown>>;
  getReferralLeaderboard(limit?: number): Promise<Record<string, unknown>[]>;
  detectReferralFraud(userId: string, referralCode: string): Promise<{ suspicious: boolean; reasons: string[] }>;
}

export interface ISchedulingService {
  scheduleTransaction(userId: string, amount: number, currency: string, scheduledFor: Date): Promise<Record<string, unknown>>;
  getScheduledTransactions(userId: string): Promise<Record<string, unknown>[]>;
  getPendingScheduledTransactions(): Promise<Record<string, unknown>[]>;
  executeScheduledTransaction(scheduledId: string, transactionId: string): Promise<Record<string, unknown>>;
  cancelScheduledTransaction(scheduledId: string): Promise<Record<string, unknown>>;
  updateScheduledTransaction(scheduledId: string, scheduledFor: Date): Promise<Record<string, unknown>>;
}

export interface IInsuranceService {
  calculateInsurancePremium(amount: number, currency: string): Promise<Record<string, unknown>>;
  createInsurance(transactionId: string, premium: number, coverage: number, provider: string): Promise<Record<string, unknown>>;
  getInsuranceStatus(transactionId: string): Promise<Record<string, unknown>>;
  getInsuranceById(insuranceId: string): Promise<Record<string, unknown>>;
  fileClaim(insuranceId: string, reason: string, evidence?: string): Promise<Record<string, unknown>>;
  verifyClaim(insuranceId: string): Promise<{ valid: boolean; reason?: string }>;
  approveClaim(insuranceId: string): Promise<Record<string, unknown>>;
  rejectClaim(insuranceId: string, rejectionReason: string): Promise<Record<string, unknown>>;
  processInsurancePayout(insuranceId: string): Promise<Record<string, unknown>>;
  getInsuranceAnalytics(): Promise<Record<string, unknown>>;
}

export interface IBatchService {
  createBatch(userId: string, totalAmount: number): Promise<Record<string, unknown>>;
  addTransactionToBatch(batchId: string, transactionData: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateBatchTransactionStatus(batchTransactionId: string, status: string, transactionId?: string, errorMessage?: string): Promise<Record<string, unknown>>;
  getBatchStatus(batchId: string): Promise<Record<string, unknown>>;
  getBatchProgress(batchId: string): Promise<Record<string, unknown>>;
  completeBatch(batchId: string): Promise<Record<string, unknown>>;
  cancelBatch(batchId: string): Promise<Record<string, unknown>>;
  executeBatch(batchId: string, handler: (txPayload: Record<string, unknown>) => Promise<string>): Promise<{ succeeded: number; failed: number; batchStatus: string }>;
  getBatchAnalytics(userId?: string): Promise<Record<string, unknown>>;
}

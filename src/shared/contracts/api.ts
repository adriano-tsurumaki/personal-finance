import type { MonthlyStatementDto } from './monthly-statement';
import type { IndicatorAnchorApi } from './indicator-anchor';
import type { FinancialMonthDto } from './financial-month';
import type { RecurrenceApi } from './recurrence';
import type { InstallmentApi } from './installment';
import type {
  CardCorrectionPreview,
  CreditCardDto,
  CreditCardInput,
  InvoiceAssociationInput,
  InvoiceDetailsDto,
  InvoiceDto,
  InvoiceInput,
  InvoicePeriodDto,
  UnlinkedCreditEntryDto,
} from './credit-cards';
import type { CreateResult } from './result';
import type {
  TransactionDto,
  TransactionInput,
  TransactionUpdateInput,
} from './transaction';
import type {
  CreateProfileInput,
  CreateProfileResult,
  ProfileLocale,
  UserDto,
} from './user';
import type { ProfileOptionsDto } from './profile-catalog';
import type {
  CategoryDto,
  CategoryInput,
  CategoryMutationResult,
} from './categories';

export interface Api {
  indicatorAnchor: IndicatorAnchorApi;
  installment: InstallmentApi;
  recurrence: RecurrenceApi;
  getFinancialMonth(month: string): Promise<FinancialMonthDto>;
  getCreditCards(): Promise<CreditCardDto[]>;
  previewCreditCard(
    input: CreditCardInput,
    month: string,
  ): Promise<InvoicePeriodDto>;
  suggestInvoicePeriod(cardId: number, date: string): Promise<InvoicePeriodDto>;
  createCreditCard(input: CreditCardInput): Promise<number>;
  renameCreditCard(id: number, name: string): Promise<void>;
  archiveCreditCard(id: number): Promise<void>;
  previewInvoicePeriod(
    cardId: number,
    month: string,
  ): Promise<InvoicePeriodDto>;
  getCardInvoices(cardId: number): Promise<InvoiceDto[]>;
  getInvoiceDetails(id: number): Promise<InvoiceDetailsDto>;
  registerInvoice(cardId: number, input: InvoiceInput): Promise<number>;
  previewInvoiceCorrection(
    id: number,
    input: InvoiceInput,
  ): Promise<CardCorrectionPreview>;
  correctInvoice(id: number, input: InvoiceInput, token: string): Promise<void>;
  getUnlinkedCreditEntries(): Promise<UnlinkedCreditEntryDto[]>;
  previewInvoiceAssociation(
    id: number,
    input: InvoiceAssociationInput,
  ): Promise<CardCorrectionPreview>;
  associateInvoice(
    id: number,
    input: InvoiceAssociationInput,
    token: string,
  ): Promise<CardCorrectionPreview>;
  previewTransactionCreation(
    input: TransactionInput,
  ): Promise<CardCorrectionPreview | null>;
  previewTransactionUpdate(
    id: number,
    input: TransactionUpdateInput,
  ): Promise<CardCorrectionPreview>;
  previewTransactionDeletion(id: number): Promise<CardCorrectionPreview>;
  getCategories(): Promise<CategoryDto[]>;
  createCategory(input: CategoryInput): Promise<CategoryMutationResult>;
  updateCategory(
    id: number,
    input: CategoryInput,
  ): Promise<CategoryMutationResult>;
  archiveCategory(id: number): Promise<CategoryMutationResult>;
  listProfiles(): Promise<UserDto[]>;
  getActiveProfile(): Promise<UserDto | null>;
  createProfile(input: CreateProfileInput): Promise<CreateProfileResult>;
  enterProfile(id: number): Promise<UserDto>;
  leaveProfile(): Promise<void>;
  getProfileOptions(): Promise<ProfileOptionsDto>;
  updateProfileLocale(locale: ProfileLocale): Promise<UserDto>;
  getTransactions(month: string): Promise<TransactionDto[]>;
  getTransaction(id: number): Promise<TransactionInput>;
  createTransaction(input: TransactionInput): Promise<CreateResult>;
  updateTransaction(
    id: number,
    input: TransactionUpdateInput,
  ): Promise<CreateResult>;
  deleteTransaction(id: number, token?: string): Promise<void>;

  getMonthlyStatement(month: string): Promise<MonthlyStatementDto>;
}

import type { MonthlyStatementDto } from './monthly-statement';
import type { CreateResult } from './result';
import type { TransactionDto, TransactionInput } from './transaction';
import type {
  CreateProfileInput,
  CreateProfileResult,
  ProfileLocale,
  UserDto,
} from './user';
import type { ProfileOptionsDto } from './profile-catalog';

export interface Api {
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
  updateTransaction(id: number, input: TransactionInput): Promise<CreateResult>;
  deleteTransaction(id: number): Promise<void>;

  getMonthlyStatement?: (month: string) => Promise<MonthlyStatementDto>;
}

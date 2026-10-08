export interface UserDto {
  id: number;
  name: string;
  email: string;
  locale: ProfileLocale;
}

export type ProfileLocale = 'pt-BR' | 'en-US';

export interface CreateProfileInput {
  name: string;
  email: string;
  locale: ProfileLocale;
}

export type CreateProfileResult =
  | { ok: true; profile: UserDto }
  | { ok: false; error: 'invalid_profile' | 'email_in_use' };

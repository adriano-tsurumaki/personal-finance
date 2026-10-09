import { and, eq, isNull } from 'drizzle-orm';
import type { AppDatabase } from './db';
import { categoriesTable, paymentsTable, usersTable } from './db/schema';
import type {
  CreateProfileInput,
  CreateProfileResult,
  UserDto,
  ProfileLocale,
} from '@shared/contracts/user';
import type {
  ProfileOptionsDto,
  PaymentMethodKey,
} from '@shared/contracts/profile-catalog';

const defaultCategories = ['food', 'housing', 'salary', 'other'] as const;
const paymentCatalog: { key: PaymentMethodKey; name: string; type: number }[] =
  [
    { key: 'pix', name: 'Instant transfer', type: 1 },
    { key: 'debit', name: 'Debit card', type: 1 },
    { key: 'credit', name: 'Credit card', type: 2 },
    { key: 'cash', name: 'Cash', type: 1 },
  ];

/** Seeds records by stable identifiers; existing names and archived rows are preserved. */
export function initializeProfile(
  db: Pick<AppDatabase, 'select' | 'insert' | 'update' | 'transaction'>,
  userId: number,
): void {
  db.transaction((tx) => {
    for (const method of paymentCatalog) {
      const existing = tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.catalog_key, method.key))
        .get();

      if (existing) {
        continue;
      }

      const legacy = tx
        .select()
        .from(paymentsTable)
        .where(
          and(
            isNull(paymentsTable.catalog_key),
            eq(paymentsTable.name, method.name),
            eq(paymentsTable.type, method.type),
          ),
        )
        .get();

      if (legacy) {
        tx.update(paymentsTable)
          .set({ catalog_key: method.key })
          .where(eq(paymentsTable.id, legacy.id))
          .run();
      } else {
        tx.insert(paymentsTable)
          .values({
            name: method.name,
            type: method.type,
            catalog_key: method.key,
          })
          .run();
      }
    }

    for (const key of defaultCategories) {
      const existing = tx
        .select()
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.user_id, userId),
            eq(categoriesTable.catalog_key, key),
          ),
        )
        .get();

      if (existing) {
        continue;
      }

      const name = key[0].toUpperCase() + key.slice(1);
      const legacy = tx
        .select()
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.user_id, userId),
            isNull(categoriesTable.catalog_key),
            eq(categoriesTable.name, name),
          ),
        )
        .get();

      if (legacy) {
        tx.update(categoriesTable)
          .set({ catalog_key: key })
          .where(eq(categoriesTable.id, legacy.id))
          .run();
      } else {
        tx.insert(categoriesTable)
          .values({
            user_id: userId,
            name,
            catalog_key: key,
            icon_key: key,
            color: '#808080',
            transaction_type:
              key === 'salary'
                ? 'income'
                : key === 'other'
                  ? 'both'
                  : 'expense',
          })
          .run();
      }
    }
  });
}

export function createProfileService(db: AppDatabase) {
  let activeProfile: UserDto | null = null;
  const selection = {
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    locale: usersTable.locale,
  };

  return {
    list(): UserDto[] {
      return db
        .select(selection)
        .from(usersTable)
        .orderBy(usersTable.name)
        .all()
        .map((profile) => ({
          ...profile,
          locale: profile.locale === 'en-US' ? 'en-US' : 'pt-BR',
        }));
    },

    current(): UserDto | null {
      return activeProfile;
    },

    requireActive(): UserDto {
      if (!activeProfile) {
        throw new Error('No active profile.');
      }

      return activeProfile;
    },

    enter(id: number): UserDto {
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('Invalid profile.');
      }

      const profile = db
        .select(selection)
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .get();

      if (!profile) {
        throw new Error('Profile not found.');
      }

      initializeProfile(db, profile.id);
      activeProfile = {
        ...profile,
        locale: profile.locale === 'en-US' ? 'en-US' : 'pt-BR',
      };

      return activeProfile;
    },

    leave(): void {
      activeProfile = null;
    },

    updateLocale(locale: ProfileLocale): UserDto {
      const profile = this.requireActive();

      if (locale !== 'pt-BR' && locale !== 'en-US') {
        throw new Error('Unsupported profile locale.');
      }

      const updated = db
        .update(usersTable)
        .set({ locale })
        .where(eq(usersTable.id, profile.id))
        .returning(selection)
        .get();

      if (!updated) {
        throw new Error('Profile not found.');
      }

      activeProfile = updated;
      return updated;
    },

    create(input: CreateProfileInput): CreateProfileResult {
      if (
        !input ||
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.trim().length > 100 ||
        typeof input.email !== 'string' ||
        input.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
        !['pt-BR', 'en-US'].includes(input.locale)
      ) {
        return { ok: false, error: 'invalid_profile' };
      }

      const email = input.email.trim().toLowerCase();

      if (
        db.select().from(usersTable).where(eq(usersTable.email, email)).get()
      ) {
        return { ok: false, error: 'email_in_use' };
      }

      const profile = db.transaction((tx) => {
        const created = tx
          .insert(usersTable)
          .values({
            name: input.name.trim(),
            email,
            locale: input.locale,
            password: '!local-profile',
          })
          .returning(selection)
          .get();
        initializeProfile(tx, created.id);
        return created;
      });
      activeProfile = profile;
      return { ok: true, profile };
    },

    options(): ProfileOptionsDto {
      const profile = this.requireActive();
      return {
        categories: db
          .select({
            id: categoriesTable.id,
            name: categoriesTable.name,
            catalog_key: categoriesTable.catalog_key,
            icon_key: categoriesTable.icon_key,
            description: categoriesTable.description,
            transaction_type: categoriesTable.transaction_type,
            color: categoriesTable.color,
          })
          .from(categoriesTable)
          .where(
            and(
              eq(categoriesTable.user_id, profile.id),
              isNull(categoriesTable.archived_at),
            ),
          )
          .all(),
        payments: db
          .select({
            id: paymentsTable.id,
            catalog_key: paymentsTable.catalog_key,
          })
          .from(paymentsTable)
          .all()
          .filter((method): method is ProfileOptionsDto['payments'][number] =>
            paymentCatalog.some(({ key }) => key === method.catalog_key),
          ),
      };
    },
  };
}

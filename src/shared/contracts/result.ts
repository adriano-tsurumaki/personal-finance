export type CreateResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: 'invalid_input' | 'not_found' | 'internal_error';
        message: string;
      };
    };

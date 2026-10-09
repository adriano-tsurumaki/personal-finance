/** NFC preserves accents; Unicode lowercase makes accented capitals comparable. */
export function categoryNameKey(name: string): string {
  return name.trim().normalize('NFC').toLowerCase();
}

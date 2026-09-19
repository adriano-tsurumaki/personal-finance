import {
  Banknote,
  Bus,
  PiggyBank,
  Tag,
  Clapperboard,
  Dumbbell,
  Home,
  Landmark,
  Laptop,
  type LucideIcon,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';

import type { CategoryIconKey } from '@shared/contracts/categories';

export const categoryIcons: Record<CategoryIconKey, LucideIcon> = {
  salary: Banknote,
  freelance: Laptop,
  investment: Landmark,
  housing: Home,
  food: UtensilsCrossed,
  transport: Bus,
  shopping: ShoppingBag,
  health: Dumbbell,
  entertainment: Clapperboard,
  savings: PiggyBank,
  other: Tag,
};

export function getCategoryIcon(key: string | null | undefined): LucideIcon {
  return key && Object.prototype.hasOwnProperty.call(categoryIcons, key)
    ? categoryIcons[key as CategoryIconKey]
    : categoryIcons.other;
}

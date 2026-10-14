import type { OdometerMoneyProps } from './types';
import { formatCurrency } from '@lib/format/currency';

export default function OdometerMoney({
  value,
  absolute = false,
  formatValue = formatCurrency,
}: OdometerMoneyProps) {
  const formatted = formatValue(absolute ? Math.abs(value) : value);

  return (
    <span className="inline-flex items-baseline">
      {formatted.split('').map((char, index) => {
        const position = formatted.length - index - 1;

        if (!/\d/.test(char)) {
          return <span key={`character-${position}`}>{char}</span>;
        }

        return <Digit key={`digit-${position}`} digit={Number(char)} />;
      })}
    </span>
  );
}

function Digit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-grid w-[1ch] overflow-hidden">
      <span className="sr-only">{digit}</span>
      <span className="invisible" aria-hidden="true">
        {digit}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{
          transform: `translateY(-${digit}lh)`,
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block h-lh text-center">
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}

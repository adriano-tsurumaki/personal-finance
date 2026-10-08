import type { OdometerMoneyProps } from './types';
import { formatCurrency } from '@lib/format/currency';

export default function OdometerMoney({
  value,
  absolute = false,
}: OdometerMoneyProps) {
  const formatted = formatCurrency(absolute ? Math.abs(value) : value);

  return (
    <span className="inline-flex items-baseline">
      {formatted.split('').map((char, index) => {
        if (!/\d/.test(char)) {
          return <span key={index}>{char}</span>;
        }

        return <Digit key={index} digit={Number(char)} />;
      })}
    </span>
  );
}

function Digit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden">
      <span
        className="absolute left-0 top-0.5 flex flex-col transition-transform duration-500 ease-out"
        style={{
          transform: `translateY(-${digit}em)`,
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="flex h-[1em] items-center justify-center">
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}

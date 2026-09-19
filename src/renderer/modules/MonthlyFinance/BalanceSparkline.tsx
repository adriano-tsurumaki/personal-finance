import { useEffect, useRef, useState } from 'react';

interface Point {
  date: string;
  balance: number;
}

type XY = readonly [number, number];

export default function BalanceSparkline({
  data,
}: {
  data: Point[];
}): React.JSX.Element {
  const width = 240;
  const height = 56;
  const pad = 3;

  const [animatedPoints, setAnimatedPoints] = useState<XY[]>([]);
  const previousPoints = useRef<XY[]>([]);
  const animationFrame = useRef<number | null>(null);

  const calculatePoints = (values: Point[]): XY[] => {
    const balances = values.map((d) => d.balance);

    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const range = max - min || 1;

    return values.map((d, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);

      const y = height - pad - ((d.balance - min) / range) * (height - pad * 2);

      return [x, y] as const;
    });
  };

  useEffect(() => {
    if (data.length < 2) return;

    const nextPoints = calculatePoints(data);

    if (previousPoints.current.length === 0) {
      previousPoints.current = nextPoints;
      setAnimatedPoints(nextPoints);
      return;
    }

    const from = previousPoints.current;
    const to = nextPoints;

    const duration = 600;
    const start = performance.now();

    const animate = (now: number): void => {
      const progress = Math.min((now - start) / duration, 1);

      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      const points = to.map((point, i) => {
        const oldPoint = from[i] ?? from[from.length - 1];

        return [
          oldPoint[0] + (point[0] - oldPoint[0]) * eased,
          oldPoint[1] + (point[1] - oldPoint[1]) * eased,
        ] as const;
      });

      setAnimatedPoints(points);

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      } else {
        previousPoints.current = nextPoints;
      }
    };

    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [data]);

  if (data.length < 2 || animatedPoints.length < 2) {
    return <></>;
  }

  const linePath = animatedPoints
    .map(([x, y], i) => {
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPath = `${linePath}
    L${animatedPoints[animatedPoints.length - 1][0].toFixed(2)},${height}
    L${animatedPoints[0][0].toFixed(2)},${height}
    Z`;

  const last = animatedPoints[animatedPoints.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Line chart showing account balance trending upward over time"
    >
      <defs>
        <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--color-primary)"
            stopOpacity="0.22"
          />
          <stop
            offset="100%"
            stopColor="var(--color-primary)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#balance-fill)" />

      <path
        d={linePath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--color-primary)" />
    </svg>
  );
}

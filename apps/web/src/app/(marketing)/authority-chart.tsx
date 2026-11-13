// "Authority × time": which texts govern a question on a given date. Illustrative versions;
// the principle is exactly how Njumeni selects law: the version in force on the date, at each
// level of the hierarchy.
const YEARS = [2018, 2020, 2022, 2024, 2026];
const DATE = 2023.4;

const LEVELS = [
  { label: 'Constitution', bars: [{ from: 2018, to: 2027, v: 'In force throughout' }] },
  {
    label: 'Act',
    bars: [
      { from: 2018, to: 2021.5, v: 'Version 1' },
      { from: 2021.5, to: 2025, v: 'Version 2' },
      { from: 2025, to: 2027, v: 'Version 3' },
    ],
  },
  {
    label: 'Regulation',
    bars: [
      { from: 2018.8, to: 2024.2, v: 'Version 1' },
      { from: 2024.2, to: 2027, v: 'Version 2' },
    ],
  },
];

// Two layouts of the same chart: wide (labels beside the rows) and compact for phones (labels
// above the rows, so the text keeps a readable size). CSS shows one of them.
const LAYOUTS = {
  wide: {
    w: 620,
    h: 250,
    x0: 132,
    x1: 588,
    rows: [52, 112, 172],
    labelAbove: false,
    top: 14,
    axis: 200,
  },
  compact: {
    w: 340,
    h: 300,
    x0: 14,
    x1: 326,
    rows: [54, 128, 202],
    labelAbove: true,
    top: 22,
    axis: 228,
  },
} as const;

function Chart({ variant }: { variant: keyof typeof LAYOUTS }) {
  const L = LAYOUTS[variant];
  const x = (year: number) => L.x0 + ((year - 2018) / (2027 - 2018)) * (L.x1 - L.x0);
  return (
    <svg
      viewBox={`0 0 ${L.w} ${L.h}`}
      role="img"
      aria-labelledby={`atc-${variant}-title atc-${variant}-desc`}
      className={`nj-atc-svg nj-atc-svg--${variant}`}
    >
      <title id={`atc-${variant}-title`}>Which law applies on a date</title>
      <desc id={`atc-${variant}-desc`}>
        Three levels of authority — constitution, act and regulation — each with its versions over
        time. A vertical line at the chosen date crosses the one version at each level that was in
        force then: the constitution, version 2 of the act and version 1 of the regulation.
      </desc>
      {YEARS.map((year) => (
        <g key={year}>
          <line x1={x(year)} x2={x(year)} y1={L.top + 12} y2={L.axis} className="nj-atc-grid" />
          <text x={x(year)} y={L.axis + 22} className="nj-atc-year">
            {year}
          </text>
        </g>
      ))}
      {LEVELS.map((level, row) => {
        const y = L.rows[row]!;
        return (
          <g key={level.label}>
            <text
              x={L.labelAbove ? L.x0 : 0}
              y={L.labelAbove ? y - 24 : y + 5}
              className="nj-atc-level"
            >
              {level.label}
            </text>
            {level.bars.map((bar) => {
              const active = bar.from <= DATE && DATE < bar.to;
              return (
                <g key={bar.v + bar.from}>
                  <rect
                    x={x(bar.from) + 1.5}
                    y={y - 15}
                    width={x(bar.to) - x(bar.from) - 3}
                    height={30}
                    rx={5}
                    className={active ? 'nj-atc-bar is-on' : 'nj-atc-bar'}
                  />
                  <text
                    x={x(bar.from) + (L.labelAbove ? 8 : 12)}
                    y={y + 5}
                    className={active ? 'nj-atc-v is-on' : 'nj-atc-v'}
                  >
                    {bar.v}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      <line x1={x(DATE)} x2={x(DATE)} y1={L.top} y2={L.axis + 4} className="nj-atc-date" />
      <rect x={x(DATE) - 50} y={L.h - 22} width={100} height={22} rx={11} className="nj-atc-pill" />
      <text x={x(DATE)} y={L.h - 6} className="nj-atc-pilltext">
        Your date
      </text>
    </svg>
  );
}

export function AuthorityChart() {
  return (
    <figure className="nj-atc">
      <Chart variant="wide" />
      <Chart variant="compact" />
      <div className="nj-atc-more">
        <div>
          <small>Evidence</small>
          <b>Applied to which facts?</b>
          <span>The documents, their custody, versions and chronology.</span>
        </div>
        <div>
          <small>Responsibility</small>
          <b>Decided by whom?</b>
          <span>Review, sign-off and an audit record of every decision.</span>
        </div>
      </div>
      <figcaption className="nj-figcap">
        Illustrative versions. At each level, only the text in force on your date applies.
      </figcaption>
    </figure>
  );
}

// Chain of custody: each record's hash covers the record before it, so a change anywhere breaks
// every link after it. Illustrative records; the mechanism is the one Njumeni stores.
const RECORDS = [
  {
    time: '09:14',
    actor: 'A. Lie',
    action: 'Received',
    object: 'employment-contract.pdf',
    note: 'Stored privately · SHA-256 of the file recorded',
    prev: '00000000',
    hash: '9f2c41ab',
  },
  {
    time: '09:20',
    actor: 'A. Lie',
    action: 'Legal hold applied',
    object: 'Matter M-2026-014',
    note: 'Deletion blocked until the hold is released',
    prev: '9f2c41ab',
    hash: 'b81e07c3',
  },
  {
    time: '11:02',
    actor: 'K. Dahl',
    action: 'Version 2 added',
    object: 'employment-contract.pdf',
    note: 'Version 1 kept unchanged',
    prev: 'b81e07c3',
    hash: '3d5a9e10',
  },
  {
    time: '15:47',
    actor: 'I. Berg',
    action: 'Exported in bundle',
    object: 'Case bundle 3',
    note: 'Manifest lists every file and its hash',
    prev: '3d5a9e10',
    hash: 'e47f2c65',
  },
];

export function Custody() {
  return (
    <figure className="nj-cus">
      <div className="nj-cus-head" aria-hidden="true">
        <span>Time</span>
        <span>Action</span>
        <span>Integrity link</span>
      </div>
      <ol className="nj-cus-list">
        {RECORDS.map((r, i) => (
          <li key={r.hash}>
            <span className="nj-cus-time">
              <span className="nj-mono">{r.time}</span>
              <small>{r.actor}</small>
            </span>
            <span className="nj-cus-what">
              <b>{r.action}</b>
              <span>{r.object}</span>
              <small>{r.note}</small>
            </span>
            <span className="nj-cus-link">
              <span className="nj-cus-prev">
                <small>previous</small>
                <span className="nj-mono">{r.prev}</span>
              </span>
              <span className="nj-cus-hash">
                <small>this record</small>
                <span className="nj-mono">{r.hash}</span>
              </span>
              {i < RECORDS.length - 1 ? <i className="nj-cus-chain" aria-hidden="true" /> : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="nj-cus-foot">
        <span>
          <b>Chain verifies</b> · 4 of 4 links intact
        </span>
        <span>Export with a digest anyone can recompute</span>
      </div>
      <figcaption className="nj-figcap">
        Illustrative custody record with fictional people. Each record’s hash includes the one
        before it.
      </figcaption>
    </figure>
  );
}

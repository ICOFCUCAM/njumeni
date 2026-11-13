'use client';

import { useState } from 'react';

// The five environments a person or organisation can work in, and an access check against the
// example firm. The rules shown are the platform's: workspace membership, role permissions and
// information barriers, enforced by the database on every request. People and matters are fictional.
const ENVS = [
  {
    key: 'personal',
    name: 'Personal',
    who: 'One person and their own legal questions.',
    holds: ['Questions and saved answers', 'Their letters, contracts and evidence'],
    governance: ['Private to the owner', 'Deletion on request, unless a hold applies'],
  },
  {
    key: 'professional',
    name: 'Professional',
    who: 'A lawyer or adviser working on their own.',
    holds: ['Research, matters and drafts', 'Client evidence with custody records'],
    governance: ['Private to the professional', 'Review gates before work is relied on'],
  },
  {
    key: 'firm',
    name: 'Law firm',
    who: 'A practice with partners, associates and staff.',
    holds: ['Workspaces per practice area', 'Clients, matters, conflicts and barriers'],
    governance: ['Roles and permissions per member', 'Barriers between teams · audit records'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    who: 'An in-house legal, compliance or governance team.',
    holds: ['Compliance registers and obligations', 'Contracts, policies and matters'],
    governance: ['Single sign-on · named owners', 'Retention policies and legal holds'],
  },
  {
    key: 'institutional',
    name: 'Institutional',
    who: 'A public body with formal accountability.',
    holds: ['Legal knowledge across departments', 'Records kept for public accountability'],
    governance: ['Approvals by authorised people', 'Exportable, verifiable audit records'],
  },
] as const;

const MEMBERS = [
  { key: 'berg', name: 'I. Berg', role: 'Partner · Employment' },
  { key: 'lie', name: 'A. Lie', role: 'Associate · Corporate' },
  { key: 'dahl', name: 'K. Dahl', role: 'Compliance officer' },
] as const;
const RESOURCES = [
  { key: 'matter', name: 'Matter M-2026-014', where: 'Employment workspace' },
  { key: 'doc', name: 'Share purchase draft', where: 'Corporate workspace' },
  { key: 'audit', name: 'Audit records', where: 'Organisation' },
] as const;
type MemberKey = (typeof MEMBERS)[number]['key'];
type ResourceKey = (typeof RESOURCES)[number]['key'];

const RULES: Record<MemberKey, Record<ResourceKey, [boolean, string]>> = {
  berg: {
    matter: [true, 'Member of the Employment workspace; the partner role holds matter.read.'],
    doc: [false, 'Not a member of the Corporate workspace.'],
    audit: [false, 'The partner role does not include audit.read.'],
  },
  lie: {
    matter: [false, 'An information barrier separates Corporate from Employment matters.'],
    doc: [true, 'Member of the Corporate workspace; the associate role holds document.read.'],
    audit: [false, 'The associate role does not include audit.read.'],
  },
  dahl: {
    matter: [false, 'Not a member of the Employment workspace; audit access is not matter access.'],
    doc: [false, 'Not a member of the Corporate workspace.'],
    audit: [
      true,
      'The compliance role holds audit.read: the hash-chained audit records can be read and exported.',
    ],
  },
};

export function OrgExplorer() {
  const [env, setEnv] = useState(2);
  const e = ENVS[env]!;
  return (
    <div className="nj-envs">
      <div className="nj-envs-tabs" role="group" aria-label="Environments">
        {ENVS.map((item, i) => (
          <button key={item.key} type="button" aria-pressed={i === env} onClick={() => setEnv(i)}>
            <span className="nj-mono">{String(i + 1).padStart(2, '0')}</span>
            {item.name}
          </button>
        ))}
      </div>
      <div key={e.key} className="nj-envs-body nj-fade" aria-live="polite">
        <p className="nj-envs-who">{e.who}</p>
        <div>
          <p className="nj-envs-k">Holds</p>
          <ul>
            {e.holds.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="nj-envs-k">Governed by</p>
          <ul>
            {e.governance.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AccessCheck() {
  const [member, setMember] = useState<MemberKey>('lie');
  const [resource, setResource] = useState<ResourceKey>('matter');
  const [allowed, reason] = RULES[member][resource];
  const m = MEMBERS.find((x) => x.key === member)!;
  const r = RESOURCES.find((x) => x.key === resource)!;
  return (
    <div className="nj-access">
      <div className="nj-access-head">
        <h3>Try an access check</h3>
        <span className="nj-tag nj-tag--illustrative nj-tag--ondark">
          Example firm · fictional people
        </span>
      </div>
      <div className="nj-access-grid">
        <fieldset>
          <legend>Member</legend>
          {MEMBERS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={member === x.key}
              onClick={() => setMember(x.key)}
            >
              <b>{x.name}</b>
              <small>{x.role}</small>
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Asks for</legend>
          {RESOURCES.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={resource === x.key}
              onClick={() => setResource(x.key)}
            >
              <b>{x.name}</b>
              <small>{x.where}</small>
            </button>
          ))}
        </fieldset>
        <div
          key={`${member}-${resource}`}
          className={`nj-access-result nj-fade ${allowed ? 'is-yes' : 'is-no'}`}
          aria-live="polite"
        >
          <p className="nj-access-k">Decision by the database</p>
          <p className="nj-access-verdict">{allowed ? 'Allowed' : 'Refused'}</p>
          <p className="nj-access-q">
            {m.name} → {r.name}
          </p>
          <p className="nj-access-why">{reason}</p>
        </div>
      </div>
    </div>
  );
}

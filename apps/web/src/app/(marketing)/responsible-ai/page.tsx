import type { Metadata } from 'next';
import { CtaBand, Kicker, PageIntro, Related, Tag } from '../site';

export const metadata: Metadata = {
  title: { absolute: 'Responsible AI — Njumeni' },
  description:
    'How Njumeni uses AI: what it does today, what it never does, the conditions for connecting an AI provider, and how people stay responsible for legal judgement.',
  alternates: { canonical: '/responsible-ai' },
};

const RULES = [
  {
    t: 'The law is quoted, never generated',
    d: 'Research answers are extractive: the words shown as law are the words of the official text, checked against the held version. A model never writes text that is presented as law.',
  },
  {
    t: 'AI output is labelled as AI',
    d: 'Where a model contributes — ranking passages today, drafting later — the result says so, and it is kept apart from source-grounded findings.',
  },
  {
    t: 'No authority, no answer',
    d: 'If the text or the version for the date is not held, Njumeni declines. A model is never asked to fill the gap.',
  },
  {
    t: 'People decide',
    d: 'Reviews, sign-off and approvals come before work is relied on. Consequential platform actions need an authorised decision, by two people by default.',
  },
  {
    t: 'No training on customer data',
    d: 'An AI provider is connected only under terms that forbid training on customer content. Licensed legal material, including Lovdata data, is not used to train models.',
  },
  {
    t: 'Evaluated before it is claimed',
    d: 'Retrieval quality is measured against recorded evaluations before any coverage is claimed, and the results gate what the product may say.',
  },
];

export default function Page() {
  return (
    <>
      <PageIntro
        kicker="Responsible AI"
        title={
          <>
            AI assists. <em>The law provides the authority.</em>
          </>
        }
        lead="Professionals retain responsibility. This page sets out exactly where AI is used in Njumeni today, what it is never allowed to do, and the conditions under which anything more is added."
        tone="ivory"
      />
      <section className="nj-s nj-s--paper" aria-labelledby="today-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Where AI is used</Kicker>
              <h2 id="today-title">
                Today, <em>and what comes later.</em>
              </h2>
            </div>
            <p className="nj-lead">
              Each use is listed with its status. Nothing marked planned is available to customers.
            </p>
          </div>
          <ul className="nj-capgrid">
            <li>
              <b>Meaning search</b>
              <span>
                A multilingual language model ranks passages by meaning. It finds; it does not
                answer.
              </span>
              <Tag status="built" />
            </li>
            <li>
              <b>Change analysis</b>
              <span>Version comparison and impact tracing are rule-based and recorded.</span>
              <Tag status="built" />
            </li>
            <li>
              <b>Operator command centre</b>
              <span>
                An AI assistant for Njumeni’s platform team, acting only with human approval.
              </span>
              <Tag status="awaiting" />
            </li>
            <li>
              <b>Drafting and legal reasoning</b>
              <span>For customers, once a provider is connected under the conditions below.</span>
              <Tag status="planned" />
            </li>
          </ul>
        </div>
      </section>
      <section className="nj-s nj-s--ivory" aria-labelledby="rules-title">
        <div className="nj-wrap">
          <div className="nj-head">
            <div>
              <Kicker>Commitments</Kicker>
              <h2 id="rules-title">
                Six rules <em>AI works within.</em>
              </h2>
            </div>
          </div>
          <ol className="nj-principle-grid">
            {RULES.map((r) => (
              <li key={r.t}>
                <b>{r.t}</b>
                <span>{r.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="nj-s nj-s--paper" aria-labelledby="provider-title">
        <div className="nj-wrap nj-split">
          <div>
            <Kicker>Connecting a provider</Kicker>
            <h2 id="provider-title">
              The conditions, <em>before any model is switched on.</em>
            </h2>
          </div>
          <dl className="nj-deflist">
            <div>
              <dt>Data terms</dt>
              <dd>
                No training on customer content; a stated retention period; processing location
                recorded in the trust centre.
              </dd>
            </div>
            <div>
              <dt>Budget and limits</dt>
              <dd>
                A monthly budget and per-plan AI credits, so no plan runs unlimited high-cost AI.
              </dd>
            </div>
            <div>
              <dt>Evaluation</dt>
              <dd>Each new use is evaluated before release, and its results recorded.</dd>
            </div>
            <div>
              <dt>Disclosure</dt>
              <dd>
                Customers are told which features use which provider, and AI output is labelled.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <Related keys={['security', 'trust', 'research']} />
      <CtaBand
        title="Ask us how AI is governed."
        text="We explain the controls, the evaluations and the limits to your legal, risk and procurement teams."
      />
    </>
  );
}

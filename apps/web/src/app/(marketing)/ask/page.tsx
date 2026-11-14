import type { Metadata } from 'next';
import Link from 'next/link';
import { FACTS } from '../site-details';
import { PageIntro, Related, Tag, type Status } from '../site';
import { submitQuestion } from './actions';

export const metadata: Metadata = {
  title: 'Ask Njumeni',
  description:
    'Leave a legal question for when Njumeni’s live research opens in Norway, and see how an answer is formed in the demonstration.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/ask' },
};

const ERRORS: Record<string, string> = {
  consent: 'Please confirm that we may keep your question for 30 days.',
  invalid:
    'Please write a question of 5 to 1,000 characters, choose a jurisdiction and language, and check the date and email address.',
  busy: 'We are receiving many questions right now. Please try again in an hour.',
  unavailable: 'Your question could not be sent. Please try again later.',
};

const JURISDICTIONS: [string, string][] = [
  ['NO', 'Norway — opening first'],
  ['SE', 'Sweden'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['GB', 'United Kingdom'],
  ['EU', 'European Union'],
  ['OTHER', 'Another jurisdiction'],
];

// The three ways to meet Njumeni's research, and what each one is today.
const MODES: { status: Status; title: string; who: string; text: string }[] = [
  {
    status: 'built',
    title: 'Demonstration',
    who: 'Anyone, now',
    text: 'A fixed example question answered from real Norwegian statutory text. Change the date and see the answer change with the law. It does not take your own questions.',
  },
  {
    status: 'awaiting',
    title: 'Early-access research',
    who: 'Organisations in the programme',
    text: 'The research engine runs inside an organisation’s workspace, on sources approved for that workspace. It opens to participants as each source is activated.',
  },
  {
    status: 'planned',
    title: 'Live research for everyone',
    who: 'Anyone, with limits',
    text: 'Opens for a jurisdiction only after its official sources are activated and its answers pass evaluation — starting with Norway.',
  },
];

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; q?: string; email?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? (ERRORS[params.error] ?? null) : null;
  const question = (params.q ?? '').slice(0, 1000);
  const received = params.status === 'received';
  return (
    <>
      <PageIntro
        kicker="Ask Njumeni"
        title={
          <>
            What would you like to know <em>about the law?</em>
          </>
        }
        lead="Start with one legal question. Discover the authority behind the answer."
      >
        <p className="nj-ask-state" role="note">
          <b>Live research is not open yet.</b> Leave your question and it will be among the first
          we look at when research opens in Norway. Nothing on this page writes a legal answer.
        </p>
      </PageIntro>

      <section className="nj-s nj-s--paper nj-ask" aria-labelledby="ask-form-title">
        <div className="nj-wrap nj-form-wrap">
          <div className="nj-ask-side">
            <h2 id="ask-form-title" className="nj-ask-h">
              Leave your question
            </h2>
            <p className="nj-lead">
              Njumeni answers only from official legal text in force on your date, and declines when
              it cannot. Until that standard can be met for your jurisdiction, we would rather keep
              your question than guess at an answer.
            </p>
            <h3 className="nj-ask-sub">What happens to it</h3>
            <ul className="nj-checks">
              <li>We read questions to learn what people need from legal research.</li>
              <li>
                We use them to test research before it opens — never to show you an answer that has
                not been checked.
              </li>
              <li>
                It is deleted automatically after {FACTS.questionRetention}. We store no IP address
                and do not share it.
              </li>
              <li>
                If you leave an email address and live research opens for your jurisdiction within
                those {FACTS.questionRetention}, we will let you know.
              </li>
            </ul>
            <p className="nj-ask-alt">
              Want to see an answer now?{' '}
              <Link href="/platform/research#research">Open the demonstration</Link>, which uses
              real Norwegian statutory text. Asking for an organisation?{' '}
              <Link href="/early-access">Request early access</Link>.
            </p>
          </div>
          <div>
            {received ? (
              <div className="nj-alert nj-alert-ok nj-ask-done" role="status">
                <strong>Thank you — your question has been received.</strong>
                <p>
                  It has not been answered: Njumeni does not answer questions until live research is
                  open for their jurisdiction.{' '}
                  {params.email
                    ? `If research opens within ${FACTS.questionRetention}, we will write to you.`
                    : `It will be deleted after ${FACTS.questionRetention}.`}
                </p>
                <p className="nj-ctas">
                  <Link href="/platform/research#research" className="nj-btn nj-btn--navy">
                    Open the demonstration
                  </Link>
                  <Link href="/ask" className="nj-btn nj-btn--outline">
                    Ask another question
                  </Link>
                </p>
              </div>
            ) : (
              <form action={submitQuestion} className="nj-form" aria-label="Ask Njumeni">
                {error ? (
                  <p className="nj-alert nj-alert-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <label className="nj-field">
                  Your question
                  <textarea
                    name="question"
                    rows={5}
                    required
                    minLength={5}
                    maxLength={1000}
                    defaultValue={question}
                    placeholder="For example: Can my employer dismiss me without giving a reason?"
                  />
                </label>
                <div className="nj-field-row">
                  <label className="nj-field">
                    Jurisdiction
                    <select name="jurisdiction" required defaultValue="NO">
                      {JURISDICTIONS.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nj-field">
                    Answer in
                    <select name="language" required defaultValue="en">
                      <option value="en">English</option>
                      <option value="nb">Norwegian (Bokmål)</option>
                      <option value="nn">Norwegian (Nynorsk)</option>
                    </select>
                  </label>
                </div>
                <label className="nj-field">
                  The law as at <small>(optional — leave empty for today)</small>
                  <input name="date" type="date" min="1814-05-17" />
                </label>
                <label className="nj-field">
                  Email <small>(optional — only to tell you when research opens)</small>
                  <input name="email" type="email" maxLength={254} autoComplete="email" />
                </label>
                <div className="nj-hp" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="nj-consent">
                  <input type="checkbox" name="consent" value="yes" required />
                  <span>
                    I agree that Njumeni keeps this question, and my email if I gave one, for{' '}
                    {FACTS.questionRetention} to learn what people need and to prepare live
                    research. It is then deleted automatically. Please leave out names and other
                    personal details. <Link href="/privacy#collect">Privacy notice</Link>.
                  </span>
                </label>
                <button type="submit" className="nj-btn nj-btn--navy">
                  Leave my question
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="nj-s nj-s--ivory" aria-labelledby="modes-title">
        <div className="nj-wrap">
          <h2 id="modes-title" className="nj-ask-h">
            Three ways to meet Njumeni’s research
          </h2>
          <ol className="nj-ask-modes">
            {MODES.map((m) => (
              <li key={m.title}>
                <Tag status={m.status} />
                <h3>{m.title}</h3>
                <p className="nj-ask-who">{m.who}</p>
                <p>{m.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Related keys={['research', 'jurisdictions', 'responsibleAi']} />
    </>
  );
}

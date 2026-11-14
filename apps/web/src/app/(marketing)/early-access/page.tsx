import type { Metadata } from 'next';
import Link from 'next/link';
import { requestEarlyAccess } from './actions';

export const metadata: Metadata = {
  title: 'Request early access',
  description:
    'Request early access to Njumeni or a demonstration of its legal research, workspace and legal change intelligence.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/early-access' },
};

const ERRORS: Record<string, string> = {
  consent: 'Please confirm that we may store your request and contact you about it.',
  invalid: 'Please enter your name, a valid email address and who you are.',
  busy: 'We are receiving many requests right now. Please try again in an hour.',
  unavailable: 'Your request could not be sent. Please try again later.',
};
const JURISDICTIONS: [string, string][] = [
  ['NO', 'Norway'],
  ['SE', 'Sweden'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['GB', 'United Kingdom'],
  ['EU', 'European Union'],
  ['US', 'United States'],
  ['CM', 'Cameroon'],
  ['GH', 'Ghana'],
  ['KE', 'Kenya'],
  ['NG', 'Nigeria'],
  ['SN', 'Senegal'],
  ['UG', 'Uganda'],
  ['ZA', 'South Africa'],
];

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; interest?: string }>;
}) {
  const params = await searchParams;
  const demonstration = params.interest === 'demonstration';
  const error = params.error ? ERRORS[params.error] : null;
  return (
    <div className="nj-wrap nj-form-wrap">
      <div>
        <p className="nj-eyebrow">Pre-launch access</p>
        <h1
          className="nj-serif"
          style={{
            fontSize: 'clamp(34px, 4.5vw, 52px)',
            fontWeight: 500,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {demonstration ? 'Request a demonstration.' : 'Request early access.'}
        </h1>
        <p className="nj-lead" style={{ marginTop: 18 }}>
          Njumeni is opening to early-access organisations jurisdiction by jurisdiction, starting
          with Norway. Tell us who you are and which legal systems matter to you, and we will
          contact you when we can serve you well.
        </p>
        <ul className="nj-checks">
          <li>A personal demonstration of research, workspace and change intelligence</li>
          <li>Early access as your jurisdiction and use case become available</li>
          <li>No payment details and no account are needed to ask</li>
        </ul>
        <p style={{ fontSize: 14, color: 'var(--slate)' }}>
          Already have an account?{' '}
          <Link href="/sign-in" style={{ textDecoration: 'underline' }}>
            Sign in
          </Link>
          .{' '}
          <Link href="/" style={{ textDecoration: 'underline' }}>
            Back to the homepage
          </Link>
          .
        </p>
      </div>
      <div>
        {params.status === 'received' ? (
          <div className="nj-alert nj-alert-ok" role="status">
            <strong>Thank you — your request has been received.</strong> We will contact you by
            email. You can send the form again at any time to update your request.
          </div>
        ) : (
          <form action={requestEarlyAccess} className="nj-form" aria-label="Early access request">
            {error ? (
              <p className="nj-alert nj-alert-error" role="alert">
                {error}
              </p>
            ) : null}
            <fieldset className="nj-fieldset">
              <legend>I would like</legend>
              <div className="nj-options">
                <label>
                  <input
                    type="radio"
                    name="interest"
                    value="early_access"
                    defaultChecked={!demonstration}
                  />{' '}
                  Early access
                </label>
                <label>
                  <input
                    type="radio"
                    name="interest"
                    value="demonstration"
                    defaultChecked={demonstration}
                  />{' '}
                  A demonstration
                </label>
              </div>
            </fieldset>
            <label className="nj-field">
              Full name
              <input name="fullName" required minLength={2} maxLength={120} autoComplete="name" />
            </label>
            <label className="nj-field">
              Work email
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label className="nj-field">
              Organisation <small>(optional)</small>
              <input name="organisation" maxLength={160} autoComplete="organization" />
            </label>
            <label className="nj-field">
              I am
              <select name="audience" required defaultValue="">
                <option value="" disabled>
                  Choose one
                </option>
                <option value="individual">An individual</option>
                <option value="legal_professional">A legal professional</option>
                <option value="law_firm">A law firm</option>
                <option value="enterprise">A business or enterprise</option>
                <option value="public_institution">A public institution</option>
              </select>
            </label>
            <fieldset className="nj-fieldset">
              <legend>Jurisdictions of interest (optional)</legend>
              <div className="nj-options">
                {JURISDICTIONS.map(([code, name]) => (
                  <label key={code}>
                    <input type="checkbox" name="jurisdictions" value={code} /> {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="nj-field">
              What would you like to use Njumeni for? <small>(optional)</small>
              <textarea name="message" rows={4} maxLength={1500} />
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
                I agree that Njumeni stores this request and contacts me about it. We keep it for 12
                months after your last update, store no IP address, and never share it. You can ask
                us to delete it by replying to our email.
              </span>
            </label>
            <button type="submit" className="nj-btn nj-btn--navy">
              {demonstration ? 'Request a demonstration' : 'Request early access'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

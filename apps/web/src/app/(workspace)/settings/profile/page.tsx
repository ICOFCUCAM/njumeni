import { updateProfile } from './actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ error?: string; message?: string }>;

const errorMessages: Record<string, string> = {
  invalid: 'Please review the fields. Names, locale, time zone or avatar URL are invalid.',
  'profile-unavailable': 'Your profile is not ready yet. Please try again shortly.',
  'save-failed': 'Your profile could not be saved. Please try again.',
  unavailable: 'Profile services are temporarily unavailable.',
};

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select(
      'display_name, given_name, family_name, avatar_url, locale, timezone, created_at, updated_at',
    )
    .single();

  return (
    <>
      <header>
        <p className="page-eyebrow">Account</p>
        <h1 className="page-title">Profile settings</h1>
        <p className="page-description">
          Manage the personal details used to identify you across your Njumeni workspace. Your
          sign-in email and authentication credentials remain managed separately by the secure
          identity provider.
        </p>
      </header>
      {params.error ? (
        <p className="auth-error" role="alert">
          {errorMessages[params.error] ??
            'The requested profile operation could not be completed.'}
        </p>
      ) : null}
      {params.message === 'saved' ? (
        <p className="auth-success" role="status">
          Your profile has been saved.
        </p>
      ) : null}
      {error || !profile ? (
        <section className="module-panel" aria-labelledby="profile-unavailable-title">
          <h2 id="profile-unavailable-title">Profile not available</h2>
          <p>
            Your authenticated account is active, but its profile record is not available yet. No
            identity or access permissions can be changed from this screen.
          </p>
        </section>
      ) : (
        <section className="profile-panel" aria-labelledby="profile-details-title">
          <div className="profile-panel-heading">
            <div>
              <h2 id="profile-details-title">Personal details</h2>
              <p>Only profile presentation fields can be changed here.</p>
            </div>
            <span className="profile-state">Authenticated account</span>
          </div>
          <form action={updateProfile} className="profile-form">
            <div className="profile-field">
              <label htmlFor="display_name">Display name</label>
              <input
                id="display_name"
                name="display_name"
                maxLength={120}
                defaultValue={profile.display_name ?? ''}
                autoComplete="nickname"
              />
            </div>
            <div className="profile-field-grid">
              <div className="profile-field">
                <label htmlFor="given_name">First name</label>
                <input
                  id="given_name"
                  name="given_name"
                  maxLength={80}
                  defaultValue={profile.given_name ?? ''}
                  autoComplete="given-name"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="family_name">Last name</label>
                <input
                  id="family_name"
                  name="family_name"
                  maxLength={80}
                  defaultValue={profile.family_name ?? ''}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="profile-field">
              <label htmlFor="avatar_url">Avatar image URL</label>
              <input
                id="avatar_url"
                name="avatar_url"
                type="url"
                inputMode="url"
                maxLength={2048}
                placeholder="https://…"
                defaultValue={profile.avatar_url ?? ''}
              />
              <small>Use a secure HTTPS image address. This does not upload a file.</small>
            </div>
            <div className="profile-field-grid">
              <div className="profile-field">
                <label htmlFor="locale">Language / locale</label>
                <input
                  id="locale"
                  name="locale"
                  maxLength={35}
                  defaultValue={profile.locale}
                  placeholder="en or en-GB"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="timezone">Time zone</label>
                <input
                  id="timezone"
                  name="timezone"
                  maxLength={100}
                  defaultValue={profile.timezone}
                  placeholder="Europe/Oslo"
                />
              </div>
            </div>
            <div className="profile-actions">
              <button className="auth-submit" type="submit">
                Save profile
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

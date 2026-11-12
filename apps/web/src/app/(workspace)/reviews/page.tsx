import Link from 'next/link';
import { decideReviewAction } from './actions';
import { createClient } from '@/lib/supabase/server';
import { GATE_LABELS } from '@/modules/verification/quality';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ org?: string; ws?: string; error?: string }>;

interface Review {
  id: string;
  subjectType: 'research_run' | 'argument_issue';
  subjectId: string;
  subjectTitle: string | null;
  gate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  selfReview: boolean;
  requestedByMe: boolean;
}

const errors: Record<string, string> = {
  'four-eyes': 'You requested this review, so another reviewer must decide it.',
  'already-decided': 'This review has already been decided.',
  'not-authorized': 'You do not have permission to decide reviews in this workspace.',
  'note-required': 'Explain why when rejecting or requesting changes.',
  'invalid-input': 'Choose a decision.',
  failed: 'The decision could not be saved. Try again.',
};

const statusText: Record<Review['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, organization_id, name')
    .eq('status', 'active')
    .order('created_at');
  const workspaceList = workspaces ?? [];
  const selected =
    workspaceList.find((w) => w.id === params.ws && w.organization_id === params.org) ??
    workspaceList[0];
  const { data } = selected
    ? await supabase.rpc('review_list', {
        p_organization_id: selected.organization_id,
        p_workspace_id: selected.id,
      })
    : { data: null };
  const reviews = (data ?? []) as unknown as Review[];
  const back = selected ? `/reviews?org=${selected.organization_id}&ws=${selected.id}` : '/reviews';

  return (
    <article>
      <header>
        <p className="page-eyebrow">Verification and legal quality</p>
        <h1 className="page-title">Human review</h1>
        <p className="page-description">
          Research that relies on conflicting authority, limited coverage or law that has changed
          since it was written waits here for a qualified person. In a team, the person who asked
          for a review cannot approve it. Every decision is written to the audit log.
        </p>
      </header>

      {params.error && errors[params.error] ? (
        <p role="alert" className="module-panel">
          {errors[params.error]}
        </p>
      ) : null}

      {workspaceList.length > 1 ? (
        <nav className="module-panel" aria-label="Workspace">
          {workspaceList.map((w) => (
            <Link key={w.id} href={`/reviews?org=${w.organization_id}&ws=${w.id}`}>
              {w.id === selected?.id ? <strong>{w.name}</strong> : w.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="module-panel" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="section-heading">
          Reviews
        </h2>
        {reviews.length === 0 ? (
          <p>Nothing needs review in this workspace.</p>
        ) : (
          <ul className="membership-list">
            {reviews.map((review) => (
              <li key={review.id} className="membership-row">
                <span className="workspace-status">
                  {GATE_LABELS[review.gate] ?? review.gate} · {statusText[review.status]}
                  {review.selfReview ? ' (self-review)' : ''}
                </span>{' '}
                <Link
                  href={
                    review.subjectType === 'research_run'
                      ? `/research/${review.subjectId}#verification`
                      : `/arguments/${review.subjectId}`
                  }
                >
                  {review.subjectTitle ?? 'Untitled'}
                </Link>
                <small> · {review.reason}</small>
                {review.decisionNote ? <small> · “{review.decisionNote}”</small> : null}
                {review.status === 'pending' ? (
                  <form action={decideReviewAction} className="profile-field-grid">
                    <input type="hidden" name="requestId" value={review.id} />
                    <input type="hidden" name="back" value={back} />
                    <label className="profile-field">
                      Note (required to reject or request changes)
                      <input name="note" maxLength={2000} />
                    </label>
                    <div className="profile-actions">
                      <button
                        type="submit"
                        name="decision"
                        value="approved"
                        className="auth-submit"
                      >
                        Approve
                      </button>{' '}
                      <button type="submit" name="decision" value="changes_requested">
                        Request changes
                      </button>{' '}
                      <button type="submit" name="decision" value="rejected">
                        Reject
                      </button>
                    </div>
                    {review.requestedByMe ? <small>You requested this review.</small> : null}
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

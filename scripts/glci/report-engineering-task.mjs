// Reports a GLCI engineering task result from the GitHub workflow to Njumeni
// (public.glci_engineering_task_report). Inputs come from the environment only.
// Without SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY it prints the result and exits successfully:
// the run log is then the record.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TASK_ID, RESULT, OUTCOME } = process.env;

export function reportPayload(taskId, resultJson, outcome) {
  let result = {};
  try {
    result = resultJson ? JSON.parse(resultJson) : {};
  } catch {
    result = {};
  }
  const prUrl = typeof result.pullRequestUrl === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(result.pullRequestUrl)
    ? result.pullRequestUrl
    : null;
  const opened = outcome === 'success' && result.status === 'pr_opened' && prUrl !== null;
  return {
    p_task_id: taskId,
    p_status: opened ? 'pr_opened' : 'failed',
    p_pull_request_url: opened ? prUrl : null,
    p_summary: typeof result.summary === 'string' ? result.summary.slice(0, 4000) : null,
    p_error: opened ? null : outcome !== 'success' ? 'GITHUB_ACTION_FAILED' : result.status === 'pr_opened' ? 'PULL_REQUEST_URL_MISSING' : 'AGENT_REPORTED_FAILURE',
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const payload = reportPayload(TASK_ID, RESULT, OUTCOME);
  console.log(JSON.stringify({ taskId: TASK_ID, status: payload.p_status, pullRequestUrl: payload.p_pull_request_url, error: payload.p_error }));
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Njumeni reporting is not configured; the result above is the record.');
  } else {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/glci_engineering_task_report`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`Reporting failed: HTTP ${response.status}`);
      process.exitCode = 1;
    }
  }
}

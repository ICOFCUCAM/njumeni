import { createClient } from '@/lib/supabase/server';
import { formatCitation, type CitationStyle } from '@/modules/global/citation-style';

export const dynamic = 'force-dynamic';

interface Readiness {
  code: string;
  name: string;
  legalSystem: string;
  parentCode: string | null;
  coverageLevel: string;
  languages: string[];
  citationStyle: CitationStyle;
  territorialNote: string | null;
  relationships: { to: string; relationship: string; note: string | null }[];
  sources: number;
  approvedSources: number;
  activeSources: number;
  authorities: number;
  latestEvaluationPassed: boolean | null;
  glossaryLanguages: string[];
  meetsPartial: boolean;
  marketedAs: string;
}

const EXAMPLE = { citation: 'ID-1', title: 'Example Act', authorityType: 'act', provision: '12' };

export default async function JurisdictionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('jurisdiction_readiness');
  const rows = (data ?? []) as unknown as Readiness[];
  const partial = rows.filter((r) => r.meetsPartial).length;
  return (
    <article>
      <header>
        <p className="page-eyebrow">Module G · Jurisdictions and legal systems</p>
        <h1 className="page-title">Jurisdiction coverage</h1>
        <p className="page-description">
          Each jurisdiction is described exactly as far as its coverage has been tested (master plan
          §6.7). A jurisdiction reaches “partial” only with rights-approved live sources, a coverage
          review and a passing evaluation set.{' '}
          <strong>
            {partial} of {rows.length} jurisdictions are at partial coverage or better.
          </strong>
        </p>
      </header>
      <section className="module-panel" aria-label="Coverage">
        <table>
          <thead>
            <tr>
              <th>Jurisdiction</th>
              <th>System</th>
              <th>Coverage</th>
              <th>Sources (approved / live)</th>
              <th>Evaluation</th>
              <th>Languages (glossary)</th>
              <th>Citation style</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td>
                  <strong>{r.name}</strong> ({r.code})
                  {r.parentCode ? <small> · within {r.parentCode}</small> : null}
                  {r.relationships.length ? (
                    <small>
                      {' '}
                      ·{' '}
                      {r.relationships
                        .map((x) => `${x.relationship.replace(/_/g, ' ')} ${x.to}`)
                        .join(', ')}
                    </small>
                  ) : null}
                  {r.territorialNote ? (
                    <>
                      <br />
                      <small>{r.territorialNote}</small>
                    </>
                  ) : null}
                </td>
                <td>{r.legalSystem.replace('_', ' ')}</td>
                <td>
                  {r.coverageLevel}
                  <br />
                  <small>{r.marketedAs}</small>
                </td>
                <td>
                  {r.sources} ({r.approvedSources} / {r.activeSources})
                </td>
                <td>
                  {r.latestEvaluationPassed === null
                    ? 'none yet'
                    : r.latestEvaluationPassed
                      ? 'passing'
                      : 'failing'}
                </td>
                <td>
                  {r.languages.join(', ')}
                  <br />
                  <small>glossary: {r.glossaryLanguages.join(', ') || '—'}</small>
                </td>
                <td>
                  <small>
                    {formatCitation(r.citationStyle, {
                      ...EXAMPLE,
                      language: r.languages[0] ?? 'en',
                    })}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="module-panel" aria-label="Cross-language research">
        <h2 className="section-heading">Asking in another language</h2>
        <p>
          You may ask in English, Norwegian or French. When the sources are in another language,
          Njumeni searches them using the legal concepts your question mentions (from its legal
          glossary) and tells you exactly what it searched for. Nothing is machine-translated into
          the answer: quotations always stay in the language of the source.
        </p>
      </section>
    </article>
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test(
  'infrastructure audit distinguishes Njumeni app from marketing deployment',
  async () => {
    const audit = await readFile('docs/INFRASTRUCTURE_AUDIT.md', 'utf8');
    const environment = await readFile('docs/ENVIRONMENT_STRATEGY.md', 'utf8');

    assert.match(audit, /repository is \*\*PUBLIC\*\*/);
    assert.match(audit, /njumeni-marketing-website/);
    assert.match(audit, /ICOFCUCAM\/marketing-website/);
    assert.match(
      audit,
      /No Njumeni application project\/deployment is linked/,
    );
    assert.match(audit, /no project identifiable as Njumeni/);
    assert.match(audit, /authenticationConnected: false/);
    assert.match(audit, /databaseConnected: false/);
    assert.match(audit, /branch protection\/ruleset settings were not exposed/);
    assert.match(audit, /No secret values were read/);
    assert.match(environment, /apps\/web\/package.json/);
    assert.match(
      environment,
      /no Njumeni application project\/deployment is linked/i,
    );
  },
);

test(
  'infrastructure audit records provider gaps without claiming provisioning',
  async () => {
    const audit = await readFile('docs/INFRASTRUCTURE_AUDIT.md', 'utf8');

    for (const requirement of [
      'Object storage',
      'Redis/queues',
      'API/worker/scheduler',
      'Domains/DNS/WAF',
      'Monitoring/telemetry',
      'Backups/DR',
      'Region/data residency',
      'Containers/IaC',
    ]) {
      assert.ok(
        audit.includes(requirement),
        'Missing infrastructure audit area: ' + requirement,
      );
    }

    assert.match(
      audit,
      /No provider, project, domain, region, bucket or secret value is selected/,
    );
    assert.match(audit, /task 0\.13 is complete as an infrastructure audit/);
  },
);

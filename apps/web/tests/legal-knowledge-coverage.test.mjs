import assert from 'node:assert/strict';
import test from 'node:test';
import {assessJurisdictionCoverage} from '../src/modules/legal-knowledge/coverage.ts';

const now=new Date('2026-11-10T12:00:00.000Z');
const source={sourceKey:'lovdata',rightsStatus:'approved',sourceStatus:'active',ingestionEnabled:true,authorityTypes:['act','regulation'],languages:['no','nn'],lastVerifiedAt:'2026-11-01T00:00:00.000Z',knownGaps:[]};
const profile={jurisdictionCode:'NO',requestedAuthorityTypes:['act','regulation'],requestedLanguages:['no'],sources:[source],reviewIntervalDays:90};

test('assesses supported status only for current rights-approved scoped coverage',()=>{
  const result=assessJurisdictionCoverage(profile,now);
  assert.equal(result.status,'supported');assert.deepEqual(result.unsupportedAuthorityTypes,[]);
});
test('does not claim support for missing authority classes or languages',()=>{
  const result=assessJurisdictionCoverage({...profile,requestedAuthorityTypes:['act','judgment'],requestedLanguages:['no','fr']},now);
  assert.equal(result.status,'pilot');assert.deepEqual(result.unsupportedAuthorityTypes,['judgment']);assert.deepEqual(result.unsupportedLanguages,['fr']);
});
test('does not count sources without approved rights or active status',()=>{
  const result=assessJurisdictionCoverage({...profile,sources:[{...source,rightsStatus:'review_required'}]},now);
  assert.equal(result.status,'planned');
});
test('downgrades stale source coverage and reports it',()=>{
  const result=assessJurisdictionCoverage({...profile,sources:[{...source,lastVerifiedAt:'2025-01-01T00:00:00.000Z'}]},now);
  assert.equal(result.status,'pilot');assert.deepEqual(result.staleSources,['lovdata']);
});
test('retains known gaps for disclosure even when scoped coverage exists',()=>{
  const result=assessJurisdictionCoverage({...profile,sources:[{...source,knownGaps:['Supreme court decisions before 1950']} ]},now);
  assert.equal(result.status,'supported');assert.deepEqual(result.knownGaps,['Supreme court decisions before 1950']);
});
test('rejects invalid jurisdiction codes and review intervals',()=>{
  assert.throws(()=>assessJurisdictionCoverage({...profile,jurisdictionCode:'bad-code'},now),/JURISDICTION_CODE_INVALID/);
  assert.throws(()=>assessJurisdictionCoverage({...profile,reviewIntervalDays:0},now),/JURISDICTION_COVERAGE_REVIEW_INTERVAL_INVALID/);
  assert.equal(assessJurisdictionCoverage({...profile,requestedLanguages:[]},now).status,'pilot');
});

test('does not claim support outside a source coverage date interval',()=>{
  const future=assessJurisdictionCoverage({...profile,sources:[{...source,coverageFrom:'2027-01-01'}]},now);
  assert.equal(future.status,'planned');
  const ended=assessJurisdictionCoverage({...profile,sources:[{...source,coverageUntil:'2026-01-01'}]},now);
  assert.equal(ended.status,'planned');
});

test('rejects malformed or inverted source coverage intervals',()=>{
  assert.throws(()=>assessJurisdictionCoverage({...profile,sources:[{...source,coverageFrom:'2026-99-99'}]},now),/JURISDICTION_SOURCE_COVERAGE_DATES_INVALID/);
  assert.throws(()=>assessJurisdictionCoverage({...profile,sources:[{...source,coverageFrom:'2026-10-01',coverageUntil:'2026-09-01'}]},now),/JURISDICTION_SOURCE_COVERAGE_DATES_INVALID/);
});

test('does not count approved active sources whose ingestion is disabled',()=>{
  const result=assessJurisdictionCoverage({...profile,sources:[{...source,ingestionEnabled:false}]},now);
  assert.equal(result.status,'planned');
  assert.deepEqual(result.disabledSources,['lovdata']);
});

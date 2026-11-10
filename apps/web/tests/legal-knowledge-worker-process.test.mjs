import test from 'node:test';
import assert from 'node:assert/strict';
import {createStructuredWorkerLogger} from '../src/modules/legal-knowledge/worker-process.ts';

test('structured worker logs contain lifecycle metadata without source payloads',()=>{
 const lines=[];
 const log=createStructuredWorkerLogger(line=>lines.push(line));
 log({type:'checkpoint_saved',jobId:'job-1',completed:3});
 const event=JSON.parse(lines[0]);
 assert.equal(event.component,'njumeni-legal-ingestion-worker');
 assert.equal(event.type,'checkpoint_saved');
 assert.equal(event.completed,3);
 assert.equal('sourceText' in event,false);
 assert.equal('serviceRoleKey' in event,false);
});

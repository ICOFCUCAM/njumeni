import {
  runLegalIngestionWorker,
  type LegalIngestionWorkerDependencies,
  type WorkerEvent,
} from './worker-runtime.ts';

export type WorkerLogWriter=(line:string)=>void;
export function createStructuredWorkerLogger(write:WorkerLogWriter): (event:WorkerEvent)=>void {
  return event=>{
    write(JSON.stringify({timestamp:new Date().toISOString(),component:'njumeni-legal-ingestion-worker',...event}));
  };
}
export async function runLegalIngestionWorkerProcess(
  dependencies:LegalIngestionWorkerDependencies,
  options:{maxJobs?:number;idleDelayMs?:number;writeLog?:WorkerLogWriter}={},
):Promise<{processed:number;idlePolls:number;shutdownSignal:'SIGINT'|'SIGTERM'|null}> {
  const controller=new AbortController();
  let shutdownSignal:'SIGINT'|'SIGTERM'|null=null;
  const stop=(signal:'SIGINT'|'SIGTERM')=>{
    if(shutdownSignal)return;
    shutdownSignal=signal;controller.abort();
  };
  const onInterrupt=()=>stop('SIGINT');
  const onTerminate=()=>stop('SIGTERM');
  process.once('SIGINT',onInterrupt);
  process.once('SIGTERM',onTerminate);
  const log=createStructuredWorkerLogger(options.writeLog??(line=>process.stdout.write(line+'\n')));
  try{
    const result=await runLegalIngestionWorker({
      ...dependencies,
      onEvent:event=>{dependencies.onEvent?.(event);log(event);},
    },{
      signal:controller.signal,
      ...(options.maxJobs===undefined?{}:{maxJobs:options.maxJobs}),
      ...(options.idleDelayMs===undefined?{}:{idleDelayMs:options.idleDelayMs}),
    });
    return {...result,shutdownSignal};
  }finally{
    process.removeListener('SIGINT',onInterrupt);
    process.removeListener('SIGTERM',onTerminate);
  }
}

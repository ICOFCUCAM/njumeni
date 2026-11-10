import type {LegalAuthorityRelationshipType} from './relationships.ts';

export interface AuthorityGraphEdge {
  fromAuthorityId:string;
  toAuthorityId:string;
  relationshipType:LegalAuthorityRelationshipType;
  effectiveFrom:string|null;
  provenanceUri:string|null;
}
export interface AuthorityGraphPath {
  authorityIds:string[];
  relationshipTypes:LegalAuthorityRelationshipType[];
  provenanceUris:(string|null)[];
}
export interface AuthorityGraphTrace {
  rootAuthorityId:string;
  relatedAuthorityIds:string[];
  paths:AuthorityGraphPath[];
  truncated:boolean;
}
export function traceAuthorityGraph(
  rootAuthorityId:string,
  edges:readonly AuthorityGraphEdge[],
  options:{maxDepth?:number;maxNodes?:number;asOfDate?:string;relationshipTypes?:readonly LegalAuthorityRelationshipType[]}={},
):AuthorityGraphTrace {
  const maxDepth=options.maxDepth??4,maxNodes=options.maxNodes??100;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rootAuthorityId)) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_ROOT_INVALID');
  }
  if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>12||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>500) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_LIMIT_INVALID');
  }
  if(options.asOfDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(options.asOfDate)||
    Number.isNaN(Date.parse(options.asOfDate+'T00:00:00.000Z'))||
    new Date(options.asOfDate+'T00:00:00.000Z').toISOString().slice(0,10)!==options.asOfDate)) {
    throw new Error('LEGAL_AUTHORITY_GRAPH_DATE_INVALID');
  }
  const allowed=options.relationshipTypes?new Set(options.relationshipTypes):null;
  const adjacency=new Map<string,AuthorityGraphEdge[]>();
  for(const edge of edges){
    if(edge.fromAuthorityId===edge.toAuthorityId)continue;
    if(allowed&&!allowed.has(edge.relationshipType))continue;
    if(options.asOfDate&&edge.effectiveFrom&&edge.effectiveFrom>options.asOfDate)continue;
    const list=adjacency.get(edge.fromAuthorityId)??[];
    list.push(edge);adjacency.set(edge.fromAuthorityId,list);
  }
  for(const list of adjacency.values())list.sort((a,b)=>a.toAuthorityId.localeCompare(b.toAuthorityId)||a.relationshipType.localeCompare(b.relationshipType));
  const queue:AuthorityGraphPath[]=[{authorityIds:[rootAuthorityId],relationshipTypes:[],provenanceUris:[]}];
  const paths:AuthorityGraphPath[]=[];const visited=new Set<string>([rootAuthorityId]);let truncated=false;
  while(queue.length){
    const path=queue.shift()!;const current=path.authorityIds[path.authorityIds.length-1]!;
    if(path.relationshipTypes.length>=maxDepth)continue;
    for(const edge of adjacency.get(current)??[]){
      if(path.authorityIds.includes(edge.toAuthorityId))continue;
      if(!visited.has(edge.toAuthorityId)&&visited.size>=maxNodes){truncated=true;continue;}
      visited.add(edge.toAuthorityId);
      const next:AuthorityGraphPath={
        authorityIds:[...path.authorityIds,edge.toAuthorityId],
        relationshipTypes:[...path.relationshipTypes,edge.relationshipType],
        provenanceUris:[...path.provenanceUris,edge.provenanceUri],
      };
      paths.push(next);queue.push(next);
    }
  }
  return {rootAuthorityId,relatedAuthorityIds:[...visited].filter(id=>id!==rootAuthorityId),paths,truncated};
}

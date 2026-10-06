import { describe,expect,it } from 'vitest';
import { DeterministicClassifier } from './classifier.js';
import type { ProviderRecord } from '../integrations/types.js';

const classifier=new DeterministicClassifier();
const record=(title:string,snippet=''):ProviderRecord=>({providerResourceId:'x',type:'mail',title,snippet,occurredAt:'2026-09-26T00:00:00.000Z'});
const courses=[{id:'course-1',institutionId:'iitm',code:'ZZ9001',name:'Future Data Systems',aliases:[]}];

describe('deterministic classification',()=>{
  it('matches courses from the supplied database catalogue rather than hard-coded codes',()=>{const result=classifier.classify(record('ZZ9001 graded assignment due 2027-02-04'),courses,'iitm',{academicSource:true})[0];expect(result.courseId).toBe('course-1');expect(result.proposedDueAt).toContain('2027-02-04');});
  it('does not invent a date from ambiguous language',()=>{const result=classifier.classify(record('Assignment due next Friday'),courses,'iitm',{academicSource:true})[0];expect(result.proposedDueAt).toBeUndefined();expect(result.reasons).toContain('No unambiguous full due date');});
  it('proposes an unknown course code only with academic route and context',()=>{const result=classifier.classify(record('AB1234 Week 1 assignment'),courses,'iitm',{academicSource:true});expect(result.some(p=>p.kind==='new-course')).toBe(true);expect(classifier.classify(record('AB1234 account reference'),courses,'iitm',{academicSource:true}).some(p=>p.kind==='new-course')).toBe(false);expect(classifier.classify(record('AB1234 Week 1 assignment'),courses,'iitm').length).toBe(0);});
  it('does not classify ordinary Google security mail as academic',()=>{expect(classifier.classify(record('2-Step Verification turned on'),courses,'iitm').length).toBe(0)});
});

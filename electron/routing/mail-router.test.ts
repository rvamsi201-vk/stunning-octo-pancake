import { describe,expect,it } from 'vitest';
import { MailRouter } from './mail-router.js';
import type { ProviderRecord } from '../integrations/types.js';

const router=new MailRouter();
const mail=(title:string,overrides:Partial<ProviderRecord>={}):ProviderRecord=>({providerResourceId:'m1',type:'mail',title,sender:'sender@example.com',occurredAt:'2026-09-28T10:00:00.000Z',rawMetadata:{to:'personal@example.com',labelIds:['INBOX']},...overrides});
const context={accountEmail:'personal@example.com',accountArea:'PERSONAL' as const,accountInstitutionId:null,rules:[],institutions:[{id:'iitm-id',area:'IITM' as const,domains:['iitm.ac.in','study.iitm.ac.in']}]};

describe('deterministic mail routing',()=>{
  it('routes forwarded IITM mail using original recipient metadata',()=>{const result=router.route(mail('Week 1 assignment',{rawMetadata:{to:'personal@example.com',originalTo:'student@study.iitm.ac.in',labelIds:['INBOX']}}),context);expect(result).toMatchObject({include:true,area:'IITM',institutionId:'iitm-id',academic:true})});
  it('excludes promotions and social mail by default',()=>{expect(router.route(mail('Sale',{rawMetadata:{labelIds:['CATEGORY_PROMOTIONS']}}),context).include).toBe(false);expect(router.route(mail('New follower',{rawMetadata:{labelIds:['CATEGORY_SOCIAL']}}),context).include).toBe(false)});
  it('allows an explicitly included sender',()=>{const result=router.route(mail('Automated receipt',{sender:'billing@vendor.example',rawMetadata:{labelIds:['CATEGORY_PROMOTIONS']}}),{...context,rules:[{action:'include' as const,matchType:'sender' as const,matchValue:'billing@vendor.example',targetArea:'PERSONAL' as const}]});expect(result.include).toBe(true)});
  it('keeps an explicitly ignored sender out',()=>{const result=router.route(mail('Hello',{sender:'friend@example.com'}),{...context,rules:[{action:'ignore' as const,matchType:'sender' as const,matchValue:'friend@example.com'}]});expect(result.include).toBe(false)});
  it('excludes routine Google security notifications',()=>{expect(router.route(mail('2-Step Verification turned on',{sender:'Google Accounts <no-reply@accounts.google.com>'}),context).include).toBe(false)});
});

import type { Area } from '../../shared/contracts.js';
import type { ProviderRecord } from '../integrations/types.js';

export interface RoutingRule {
  action: 'include'|'ignore';
  matchType: 'sender'|'sender-domain'|'recipient'|'label'|'institution-domain';
  matchValue: string;
  targetArea?: Area|null;
  targetInstitutionId?: string|null;
}
export interface InstitutionRoute { id:string; area:Area; domains:string[] }
export interface MailRoutingContext { accountEmail?:string|null; accountArea:Area; accountInstitutionId?:string|null; rules:RoutingRule[]; institutions:InstitutionRoute[] }
export interface RoutingDecision { include:boolean; area:Area; institutionId?:string|null; academic:boolean; reason:string }

const emails=(value:unknown)=>String(value??'').toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/g)??[];
const domain=(address:string)=>address.split('@').at(-1)?.replace(/^www\./,'')??'';
const matchesDomain=(candidate:string,configured:string)=>candidate===configured||candidate.endsWith(`.${configured}`);
const metadata=(record:ProviderRecord)=>record.rawMetadata??{};

export class MailRouter {
  route(record:ProviderRecord,context:MailRoutingContext):RoutingDecision {
    if(record.type!=='mail')return{include:true,area:context.accountArea,institutionId:context.accountInstitutionId,academic:Boolean(context.accountInstitutionId),reason:'Calendar record uses the account association'};
    const meta=metadata(record);
    const labelValues:unknown[]=Array.isArray(meta.labelIds)?meta.labelIds:[];const labels=labelValues.map(String).map(v=>v.toUpperCase());
    const senderAddresses=emails(record.sender);
    const recipients=['to','deliveredTo','originalTo','resentTo','xForwardedTo'].flatMap(key=>emails(meta[key]));
    const senderDomains=senderAddresses.map(domain);
    const recipientDomains=recipients.map(domain);
    const ruleMatches=(rule:RoutingRule)=>{const value=rule.matchValue.trim().toLowerCase();switch(rule.matchType){case'sender':return senderAddresses.some(address=>address===value);case'sender-domain':return senderDomains.some(d=>matchesDomain(d,value));case'recipient':return recipients.some(address=>address===value);case'label':return labels.some(label=>label===value.toUpperCase());case'institution-domain':return [...senderDomains,...recipientDomains].some(d=>matchesDomain(d,value));}};
    const matchedRules=context.rules.filter(ruleMatches).sort((a,b)=>a.action===b.action?0:a.action==='ignore'?-1:1);
    const rule=matchedRules[0];
    if(rule){const area=rule.targetArea??context.accountArea;return{include:rule.action==='include',area,institutionId:rule.targetInstitutionId,academic:rule.action==='include'&&Boolean(rule.targetInstitutionId),reason:`Configured ${rule.action} rule (${rule.matchType})`};}
    for(const institution of context.institutions){const matched=[...senderDomains,...recipientDomains].some(candidate=>institution.domains.some(configured=>matchesDomain(candidate,configured)));if(matched)return{include:true,area:institution.area,institutionId:institution.id,academic:true,reason:'Matched a configured institution mail domain'};}
    const noisyLabels:string[]=['SPAM','TRASH','CATEGORY_PROMOTIONS','CATEGORY_SOCIAL'];if(labels.some(label=>noisyLabels.includes(label)))return{include:false,area:'PERSONAL',academic:false,reason:'Excluded Gmail spam, trash, promotion, or social category'};
    const title=record.title.toLowerCase();const senderText=String(record.sender??'').toLowerCase();
    if((senderDomains.some(d=>matchesDomain(d,'google.com'))||senderText.includes('google accounts'))&&/(security|2-step|verification|password|sign-in|account alert)/i.test(title))return{include:false,area:'PERSONAL',academic:false,reason:'Excluded routine Google account or security notification'};
    if(meta.listUnsubscribe||/\b(bulk|list|junk)\b/i.test(String(meta.precedence??''))||/newsletter|unsubscribe|marketing/i.test(`${title} ${record.snippet??''}`))return{include:false,area:'PERSONAL',academic:false,reason:'Excluded newsletter or bulk mail'};
    if(labels.includes('STARRED')||labels.includes('IMPORTANT'))return{include:true,area:'PERSONAL',academic:false,reason:'Included starred or important mail'};
    const account=String(context.accountEmail??'').toLowerCase();const directlyAddressed=Boolean(account)&&recipients.includes(account);const automated=/(^|[<@._-])(no-?reply|donotreply|notifications?|mailer-daemon)([>@._-]|$)/i.test(senderText);
    if(directlyAddressed&&!automated)return{include:true,area:'PERSONAL',academic:false,reason:'Included direct personal correspondence'};
    return{include:false,area:'PERSONAL',academic:false,reason:'Excluded by conservative personal-mail default'};
  }
}

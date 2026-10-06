import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CommandCentreApi, type Area, type ItemInput, type ItemStatus } from '../../shared/contracts.js';

const invoke = <T>(channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload) as Promise<T>;
const api: CommandCentreApi = {
  getDashboard: () => invoke(IPC.dashboard), getToday: () => invoke(IPC.today), getUpcoming: (days) => invoke(IPC.upcoming,{days}), getOverdue: () => invoke(IPC.overdue),
  getItems: (filters?:{area?:Area;status?:ItemStatus}) => invoke(IPC.items,filters), createItem: (input:ItemInput) => invoke(IPC.itemCreate,input), updateItem: (input) => invoke(IPC.itemUpdate,input), completeItem: (id) => invoke(IPC.itemComplete,{id}),
  getCourses: (institution?:string, options?:{includeHistorical?:boolean}) => invoke(IPC.courses,{institution,...options}),
  getCourse: (id:string) => invoke(IPC.courseGet,{id}),
  getAcademicOverview: (institution:string) => invoke(IPC.academic,{institution}),
  listAdminInstitutions: (includeArchived?:boolean) => invoke(IPC.academicInstitutions,{includeArchived}),
  createAdminInstitution: (input) => invoke(IPC.academicInstitutionCreate,input),
  updateAdminInstitution: (input) => invoke(IPC.academicInstitutionUpdate,input),
  archiveAdminInstitution: (id:string) => invoke(IPC.academicInstitutionArchive,{id}),
  listAdminTerms: (institutionId:string) => invoke(IPC.academicTerms,{institutionId}),
  createAdminTerm: (input) => invoke(IPC.academicTermCreate,input),
  updateAdminTerm: (input) => invoke(IPC.academicTermUpdate,input),
  setAdminTermStatus: (input) => invoke(IPC.academicTermStatus,input),
  listAdminCourses: (institutionId:string, termId?:string) => invoke(IPC.academicCourses,{institutionId,termId}),
  createAdminCourse: (input) => invoke(IPC.academicCourseCreate,input),
  updateAdminCourse: (input) => invoke(IPC.academicCourseUpdate,input),
  archiveAdminCourse: (id:string) => invoke(IPC.academicCourseArchive,{id}),
  listAdminModules: (courseId:string) => invoke(IPC.academicModules,{id:courseId}),
  createAdminModule: (input) => invoke(IPC.academicModuleCreate,input),
  updateAdminModule: (input) => invoke(IPC.academicModuleUpdate,input),
  archiveAdminModule: (id:string) => invoke(IPC.academicModuleArchive,{id}),
  reorderAdminModules: (input) => invoke(IPC.academicModuleReorder,input),
  listAdminAssessments: (courseId:string) => invoke(IPC.academicAssessments,{id:courseId}),
  createAdminAssessment: (input) => invoke(IPC.academicAssessmentCreate,input),
  updateAdminAssessment: (input) => invoke(IPC.academicAssessmentUpdate,input),
  archiveAdminAssessment: (id:string) => invoke(IPC.academicAssessmentArchive,{id}),
  setModuleCompletion: (id,completed) => invoke(IPC.moduleComplete,{id,completed}), setAssessmentScore: (id,score) => invoke(IPC.assessmentScore,{id,score}),
  getInbox: (filters) => invoke(IPC.inbox,filters), actOnExternalRecord: (input) => invoke(IPC.inboxAction,input), search: (query,area) => invoke(IPC.search,{query,area}),
  actOnProposal:(input)=>invoke(IPC.proposalAction,input),getIntegrationAccounts:()=>invoke(IPC.integrations),connectGoogle:(input)=>invoke(IPC.googleConnect,input),syncIntegration:(id)=>invoke(IPC.integrationSync,{id}),reconnectIntegration:(id)=>invoke(IPC.integrationReconnect,{id}),disconnectIntegration:(id)=>invoke(IPC.integrationDisconnect,{id}),openOriginal:(url)=>invoke(IPC.openOriginal,{url}),
  getMailRoutingRules:(accountId)=>invoke(IPC.mailRules,{id:accountId}),addMailRoutingRule:(input)=>invoke(IPC.mailRuleAdd,input),deleteMailRoutingRule:(id)=>invoke(IPC.mailRuleDelete,{id}),reevaluateInbox:(accountId)=>invoke(IPC.inboxReevaluate,{id:accountId}),
  getSetting: (key) => invoke(IPC.settingGet,{key}), setSetting: (key,value) => invoke(IPC.settingSet,{key,value}), exportBackup: () => invoke(IPC.backup),
};
contextBridge.exposeInMainWorld('commandCentre',api);

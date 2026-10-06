import { z } from 'zod';

export const areas = ['IITM', 'MANIPAL', 'EXORA', 'PERSONAL'] as const;
export const itemTypes = ['task', 'assignment', 'class', 'exam', 'activity', 'reminder', 'meeting', 'recording'] as const;
export const itemStatuses = ['inbox', 'todo', 'doing', 'done'] as const;
export const priorities = ['low', 'normal', 'high', 'urgent'] as const;

export const ItemInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().max(10_000).default(''),
  area: z.enum(areas),
  courseId: z.string().uuid().nullable().optional(),
  type: z.enum(itemTypes).default('task'),
  status: z.enum(itemStatuses).default('todo'),
  priority: z.enum(priorities).default('normal'),
  dueAt: z.string().datetime().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
});
export const ItemPatchSchema = ItemInputSchema.partial().extend({ id: z.string().uuid() });
export const IdSchema = z.object({ id: z.string().uuid() });
export const RangeSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) });
export const SearchSchema = z.object({ query: z.string().trim().max(200), area: z.enum(areas).optional() });
export const ModuleStateSchema = z.object({ id: z.string().uuid(), completed: z.boolean() });
export const AssessmentScoreSchema = z.object({ id: z.string().uuid(), score: z.number().min(0).max(100).nullable() });
export const SettingSchema = z.object({ key: z.string().min(1).max(80), value: z.string().max(5000) });
export const ExternalActionSchema = z.object({ id: z.string().uuid(), action: z.enum(['archive', 'create-task', 'confirm-deadline']) });
export const AccountIdSchema = z.object({ id: z.string().uuid() });
export const InboxFilterSchema = z.object({ area: z.enum(areas).optional(), state: z.enum(['needs_review','confirmed','ignored']).optional() });
export const MailRoutingRuleInputSchema = z.object({ accountId: z.string().uuid(), action: z.enum(['include','ignore']), matchType: z.enum(['sender','sender-domain','recipient','label','institution-domain']), matchValue: z.string().trim().min(1).max(240), targetArea: z.enum(areas).nullable().optional(), targetInstitutionId: z.string().uuid().nullable().optional() });
export const ConnectGoogleSchema = z.object({ area: z.enum(areas), institutionId: z.string().uuid().nullable().optional(), label: z.string().trim().min(1).max(120).default('Google Account') });
export const ProposalActionSchema = z.object({ id: z.string().uuid(), action: z.enum(['confirm', 'ignore']), edits: z.object({ title: z.string().trim().min(1).max(240).optional(), dueAt: z.string().datetime().nullable().optional(), type: z.enum(itemTypes).optional(), courseId: z.string().uuid().nullable().optional(), priority: z.enum(priorities).optional() }).optional() });
export const OpenOriginalSchema = z.object({ url: z.string().url().refine((value) => value.startsWith('https://'), 'Only HTTPS provider URLs are allowed') });
export const InstitutionInputSchema = z.object({ name: z.string().trim().min(1).max(120), shortName: z.enum(areas) });
export const InstitutionUpdateSchema = InstitutionInputSchema.extend({ id: z.string().uuid() });
export const TermInputSchema = z.object({ institutionId: z.string().uuid(), name: z.string().trim().min(1).max(120), code: z.string().trim().max(40).nullable().optional(), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional(), status: z.enum(['upcoming','active','completed','archived']).optional(), moduleUnitLabel: z.string().trim().max(40).optional() });
export const TermUpdateSchema = TermInputSchema.partial().extend({ id: z.string().uuid(), institutionId: z.string().uuid() });
export const TermStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(['upcoming','active','completed','archived']) });
export const CourseAdminInputSchema = z.object({ institutionId: z.string().uuid(), termId: z.string().uuid(), code: z.string().trim().max(40).optional(), name: z.string().trim().min(1).max(160), credits: z.number().nullable().optional(), notes: z.string().max(5000).optional(), gradingConfig: z.string().max(5000).nullable().optional() });
export const CourseAdminUpdateSchema = CourseAdminInputSchema.partial().extend({ id: z.string().uuid(), institutionId: z.string().uuid() });
export const ModuleAdminInputSchema = z.object({ courseId: z.string().uuid(), weekNumber: z.number().int().min(1).max(200), title: z.string().trim().min(1).max(160), topics: z.array(z.string().trim().max(240)).optional() });
export const ModuleAdminUpdateSchema = ModuleAdminInputSchema.extend({ id: z.string().uuid() });
export const ModuleReorderSchema = z.object({ courseId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) });
export const AssessmentAdminInputSchema = z.object({ courseId: z.string().uuid(), type: z.enum(['assignment','quiz','exam','activity','peer_review','project','other']), title: z.string().trim().min(1).max(160), scheduledAt: z.string().datetime().nullable().optional(), releaseAt: z.string().datetime().nullable().optional(), peerReviewAt: z.string().datetime().nullable().optional(), maximumScore: z.number().nullable().optional(), notes: z.string().max(5000).optional(), sourceUrl: z.string().url().nullable().optional(), score: z.number().nullable().optional(), status: z.string().max(40).optional() });
export const AssessmentAdminUpdateSchema = AssessmentAdminInputSchema.extend({ id: z.string().uuid() });
export const InstitutionScopeSchema = z.object({ institutionId: z.string().uuid(), termId: z.string().uuid().optional(), courseId: z.string().uuid().optional(), includeHistorical: z.boolean().optional() });

export type Area = typeof areas[number];
export type ItemType = typeof itemTypes[number];
export type ItemStatus = typeof itemStatuses[number];
export type Priority = typeof priorities[number];
export type ItemInput = z.infer<typeof ItemInputSchema>;

export interface Item extends ItemInput {
  id: string;
  courseName?: string | null;
  source: string;
  externalRecordId?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Course {
  id: string; institutionId: string; institutionName: string; institutionShortName?: Area; termId: string; termName: string;
  code: string; name: string; credits: number | null; active: boolean; notes?: string; gradingConfig?: string | null; moduleUnitLabel?: string;
  modules: CourseModule[]; assessments: Assessment[];
}
export interface CourseModule { id: string; weekNumber: number; title: string; topics: string[]; completed: boolean; }
export interface Assessment { id: string; courseId: string; type: string; title: string; scheduledAt: string | null; releaseAt: string | null; peerReviewAt: string | null; score: number | null; maximumScore: number | null; status: string; notes: string; sourceUrl?: string | null; }
export interface ReviewProposal { id: string; kind: string; confidence: number; title: string; courseId: string | null; courseName: string | null; institutionId: string | null; institutionName?: string | null; proposedDueAt: string | null; proposedData: Record<string, unknown>; reasons: string[]; status: 'pending'|'confirmed'|'ignored'; }
export interface ExternalRecord { id: string; provider: string; providerAccountId?: string | null; accountEmail?: string | null; type: string; title: string; sender: string | null; occurredAt: string; endAt?: string | null; detectedDueAt: string | null; sourceUrl: string | null; snippet?: string | null; content?: string | null; location?: string | null; providerStatus?: string; classificationState: string; routingState?: string; routingReason?: string | null; area: Area; archived: boolean; proposals?: ReviewProposal[]; }
export interface MailRoutingRule { id: string; accountId: string; action: 'include'|'ignore'; matchType: 'sender'|'sender-domain'|'recipient'|'label'|'institution-domain'; matchValue: string; targetArea: Area|null; targetInstitutionId: string|null; institutionName?: string|null; }
export interface IntegrationAccount { id: string; provider: string; providerAccountId: string | null; label: string; email: string | null; area: Area; institutionId: string | null; institutionName: string | null; scopes: string[]; status: 'never_synced'|'syncing'|'synced'|'partial_failure'|'authentication_required'|'error'; lastSyncAt: string | null; lastSyncAttemptAt: string | null; lastSyncError: string | null; }
export interface SyncResult { accountId: string; status: IntegrationAccount['status']; mail: { processed: number; failed: number }; calendar: { processed: number; failed: number }; message: string; }
export interface AcademicOverview { institution: { id: string; name: string }; term: { id: string; name: string; startsAt: string; status: string } | null; courses: Course[]; items: Item[]; }
export interface InstitutionAdmin { id: string; name: string; shortName: Area; archived: boolean; createdAt: string; updatedAt: string; }
export interface TermAdmin { id: string; institutionId: string; programId: string; name: string; code: string | null; startsAt: string | null; endsAt: string | null; status: 'upcoming'|'active'|'completed'|'archived'; moduleUnitLabel: string; createdAt: string; updatedAt: string; }
export interface CourseAdmin { id: string; institutionId: string; termId: string; code: string; name: string; credits: number | null; notes: string; active: boolean; gradingConfig: string | null; termName: string; termStatus: TermAdmin['status']; moduleUnitLabel: string; }
export interface Dashboard { today: Item[]; overdue: Item[]; upcoming: Item[]; inbox: ExternalRecord[]; courses: Course[]; capacity: string; }
export interface SearchResult { id: string; kind: 'item' | 'course' | 'assessment' | 'inbox'; title: string; subtitle: string; area: Area; route?: string; }

export interface CommandCentreApi {
  getDashboard(): Promise<Dashboard>;
  getToday(): Promise<Item[]>;
  getUpcoming(days: 7 | 14 | 30): Promise<Item[]>;
  getOverdue(): Promise<Item[]>;
  getItems(filters?: { area?: Area; status?: ItemStatus }): Promise<Item[]>;
  createItem(input: ItemInput): Promise<Item>;
  updateItem(input: z.infer<typeof ItemPatchSchema>): Promise<Item>;
  completeItem(id: string): Promise<Item>;
  getCourses(institution?: string, options?: { includeHistorical?: boolean }): Promise<Course[]>;
  getCourse(id: string): Promise<Course | null>;
  getAcademicOverview(institution: string): Promise<AcademicOverview>;
  listAdminInstitutions(includeArchived?: boolean): Promise<InstitutionAdmin[]>;
  createAdminInstitution(input: z.infer<typeof InstitutionInputSchema>): Promise<InstitutionAdmin>;
  updateAdminInstitution(input: z.infer<typeof InstitutionUpdateSchema>): Promise<InstitutionAdmin>;
  archiveAdminInstitution(id: string): Promise<void>;
  listAdminTerms(institutionId: string): Promise<TermAdmin[]>;
  createAdminTerm(input: z.infer<typeof TermInputSchema>): Promise<TermAdmin>;
  updateAdminTerm(input: z.infer<typeof TermUpdateSchema>): Promise<TermAdmin>;
  setAdminTermStatus(input: z.infer<typeof TermStatusSchema>): Promise<TermAdmin>;
  listAdminCourses(institutionId: string, termId?: string): Promise<CourseAdmin[]>;
  createAdminCourse(input: z.infer<typeof CourseAdminInputSchema>): Promise<CourseAdmin>;
  updateAdminCourse(input: z.infer<typeof CourseAdminUpdateSchema>): Promise<CourseAdmin>;
  archiveAdminCourse(id: string): Promise<void>;
  listAdminModules(courseId: string): Promise<CourseModule[]>;
  createAdminModule(input: z.infer<typeof ModuleAdminInputSchema>): Promise<CourseModule>;
  updateAdminModule(input: z.infer<typeof ModuleAdminUpdateSchema>): Promise<CourseModule>;
  archiveAdminModule(id: string): Promise<void>;
  reorderAdminModules(input: z.infer<typeof ModuleReorderSchema>): Promise<CourseModule[]>;
  listAdminAssessments(courseId: string): Promise<Assessment[]>;
  createAdminAssessment(input: z.infer<typeof AssessmentAdminInputSchema>): Promise<Assessment>;
  updateAdminAssessment(input: z.infer<typeof AssessmentAdminUpdateSchema>): Promise<Assessment>;
  archiveAdminAssessment(id: string): Promise<void>;
  setModuleCompletion(id: string, completed: boolean): Promise<void>;
  setAssessmentScore(id: string, score: number | null): Promise<void>;
  getInbox(filters?: z.infer<typeof InboxFilterSchema>): Promise<ExternalRecord[]>;
  actOnExternalRecord(input: z.infer<typeof ExternalActionSchema>): Promise<void>;
  actOnProposal(input: z.infer<typeof ProposalActionSchema>): Promise<void>;
  getIntegrationAccounts(): Promise<IntegrationAccount[]>;
  connectGoogle(input: z.infer<typeof ConnectGoogleSchema>): Promise<IntegrationAccount>;
  syncIntegration(id: string): Promise<SyncResult>;
  reconnectIntegration(id: string): Promise<IntegrationAccount>;
  disconnectIntegration(id: string): Promise<void>;
  getMailRoutingRules(accountId: string): Promise<MailRoutingRule[]>;
  addMailRoutingRule(input: z.infer<typeof MailRoutingRuleInputSchema>): Promise<MailRoutingRule>;
  deleteMailRoutingRule(id: string): Promise<void>;
  reevaluateInbox(accountId: string): Promise<{included:number;archived:number}>;
  openOriginal(url: string): Promise<void>;
  search(query: string, area?: Area): Promise<SearchResult[]>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  exportBackup(): Promise<string | null>;
}

export const IPC = {
  dashboard: 'cc:dashboard', today: 'cc:today', upcoming: 'cc:upcoming', overdue: 'cc:overdue',
  items: 'cc:items', itemCreate: 'cc:item:create', itemUpdate: 'cc:item:update', itemComplete: 'cc:item:complete',
  courses: 'cc:courses', courseGet: 'cc:course:get', academic: 'cc:academic', moduleComplete: 'cc:module:complete', assessmentScore: 'cc:assessment:score',
  academicInstitutions: 'cc:academic:institutions', academicInstitutionCreate: 'cc:academic:institution:create', academicInstitutionUpdate: 'cc:academic:institution:update', academicInstitutionArchive: 'cc:academic:institution:archive',
  academicTerms: 'cc:academic:terms', academicTermCreate: 'cc:academic:term:create', academicTermUpdate: 'cc:academic:term:update', academicTermStatus: 'cc:academic:term:status',
  academicCourses: 'cc:academic:courses', academicCourseCreate: 'cc:academic:course:create', academicCourseUpdate: 'cc:academic:course:update', academicCourseArchive: 'cc:academic:course:archive',
  academicModules: 'cc:academic:modules', academicModuleCreate: 'cc:academic:module:create', academicModuleUpdate: 'cc:academic:module:update', academicModuleArchive: 'cc:academic:module:archive', academicModuleReorder: 'cc:academic:module:reorder',
  academicAssessments: 'cc:academic:assessments', academicAssessmentCreate: 'cc:academic:assessment:create', academicAssessmentUpdate: 'cc:academic:assessment:update', academicAssessmentArchive: 'cc:academic:assessment:archive',
  inbox: 'cc:inbox', inboxAction: 'cc:inbox:action', proposalAction: 'cc:proposal:action', search: 'cc:search', settingGet: 'cc:setting:get', settingSet: 'cc:setting:set', backup: 'cc:backup',
  integrations: 'cc:integrations', googleConnect: 'cc:google:connect', integrationSync: 'cc:integration:sync', integrationReconnect: 'cc:integration:reconnect', integrationDisconnect: 'cc:integration:disconnect', mailRules: 'cc:mail-rules', mailRuleAdd: 'cc:mail-rule:add', mailRuleDelete: 'cc:mail-rule:delete', inboxReevaluate: 'cc:inbox:reevaluate', openOriginal: 'cc:open-original',
} as const;

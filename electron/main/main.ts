import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC, AccountIdSchema, AssessmentAdminInputSchema, AssessmentAdminUpdateSchema, AssessmentScoreSchema, ConnectGoogleSchema, CourseAdminInputSchema, CourseAdminUpdateSchema, ExternalActionSchema, IdSchema, InboxFilterSchema, InstitutionInputSchema, InstitutionUpdateSchema, ItemInputSchema, ItemPatchSchema, MailRoutingRuleInputSchema, ModuleAdminInputSchema, ModuleAdminUpdateSchema, ModuleReorderSchema, ModuleStateSchema, OpenOriginalSchema, ProposalActionSchema, RangeSchema, SearchSchema, SettingSchema, TermInputSchema, TermStatusSchema, TermUpdateSchema } from '../../shared/contracts.js';
import { runMigrations } from '../database/migrations.js';
import { seedDatabase } from '../database/seed.js';
import { LocalDatabase } from '../database/client.js';
import { AcademicAdminService } from '../services/academic-admin-service.js';
import { CommandCentreService } from '../services/command-centre-service.js';
import { IntegrationService } from '../services/integration-service.js';
import { MacKeychainCredentialStore } from '../integrations/keychain-credential-store.js';
import { GoogleOAuthClient } from '../integrations/google/google-oauth.js';
import { GoogleProvider } from '../integrations/google/google-provider.js';
import { DeterministicClassifier } from '../classification/classifier.js';
import { configureAppUserData } from './app-paths.js';
import { loadMainEnvironment } from './load-env.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
configureAppUserData();
loadMainEnvironment({
  mainModuleDir: dirname,
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  overridePath: process.env.COMMAND_CENTRE_ENV_FILE,
});
let database: LocalDatabase;
let service: CommandCentreService;
let academicAdmin: AcademicAdminService;
let integrations: IntegrationService;

function assertTrusted(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url ?? '';
  if (!(url.startsWith('file://') || (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)))) throw new Error('Untrusted IPC sender');
}
function handle(channel: string, fn: (payload: any) => unknown) { ipcMain.handle(channel, (event, payload) => { assertTrusted(event); return fn(payload); }); }

function registerIpc() {
  handle(IPC.dashboard, () => service.getDashboard()); handle(IPC.today, () => service.getToday());
  handle(IPC.upcoming, (p) => service.getUpcoming(RangeSchema.parse(p).days)); handle(IPC.overdue, () => service.getOverdue());
  handle(IPC.items, (p={}) => service.getItems(p)); handle(IPC.itemCreate, (p) => service.createItem(ItemInputSchema.parse(p))); handle(IPC.itemUpdate, (p) => service.updateItem(ItemPatchSchema.parse(p))); handle(IPC.itemComplete, (p) => service.completeItem(IdSchema.parse(p).id));
  handle(IPC.courses, (p) => service.getCourses(p?.institution, { includeHistorical: p?.includeHistorical }));
  handle(IPC.courseGet, (p) => service.getCourseById(IdSchema.parse(p).id));
  handle(IPC.academic, (p) => service.getAcademicOverview(String(p?.institution ?? '')));
  handle(IPC.academicInstitutions, (p) => academicAdmin.listInstitutions(Boolean(p?.includeArchived)));
  handle(IPC.academicInstitutionCreate, (p) => academicAdmin.createInstitution(InstitutionInputSchema.parse(p)));
  handle(IPC.academicInstitutionUpdate, (p) => academicAdmin.updateInstitution(InstitutionUpdateSchema.parse(p)));
  handle(IPC.academicInstitutionArchive, (p) => academicAdmin.archiveInstitution(IdSchema.parse(p).id));
  handle(IPC.academicTerms, (p) => academicAdmin.listTerms(String(p?.institutionId ?? '')));
  handle(IPC.academicTermCreate, (p) => academicAdmin.createTerm(TermInputSchema.parse(p)));
  handle(IPC.academicTermUpdate, (p) => academicAdmin.updateTerm(TermUpdateSchema.parse(p)));
  handle(IPC.academicTermStatus, (p) => { const value = TermStatusSchema.parse(p); return academicAdmin.setTermStatus(value.id, value.status); });
  handle(IPC.academicCourses, (p) => academicAdmin.listCourses(String(p?.institutionId ?? ''), p?.termId));
  handle(IPC.academicCourseCreate, (p) => academicAdmin.createCourse(CourseAdminInputSchema.parse(p)));
  handle(IPC.academicCourseUpdate, (p) => academicAdmin.updateCourse(CourseAdminUpdateSchema.parse(p)));
  handle(IPC.academicCourseArchive, (p) => academicAdmin.archiveCourse(IdSchema.parse(p).id));
  handle(IPC.academicModules, (p) => academicAdmin.listModules(IdSchema.parse(p).id));
  handle(IPC.academicModuleCreate, (p) => academicAdmin.createModule(ModuleAdminInputSchema.parse(p)));
  handle(IPC.academicModuleUpdate, (p) => academicAdmin.updateModule(ModuleAdminUpdateSchema.parse(p)));
  handle(IPC.academicModuleArchive, (p) => academicAdmin.archiveModule(IdSchema.parse(p).id));
  handle(IPC.academicModuleReorder, (p) => academicAdmin.reorderModules(ModuleReorderSchema.parse(p).courseId, ModuleReorderSchema.parse(p).orderedIds));
  handle(IPC.academicAssessments, (p) => academicAdmin.listAssessments(IdSchema.parse(p).id));
  handle(IPC.academicAssessmentCreate, (p) => academicAdmin.createAssessment(AssessmentAdminInputSchema.parse(p)));
  handle(IPC.academicAssessmentUpdate, (p) => academicAdmin.updateAssessment(AssessmentAdminUpdateSchema.parse(p)));
  handle(IPC.academicAssessmentArchive, (p) => academicAdmin.archiveAssessment(IdSchema.parse(p).id));
  handle(IPC.moduleComplete, (p) => { const value=ModuleStateSchema.parse(p); service.setModuleCompletion(value.id,value.completed); });
  handle(IPC.assessmentScore, (p) => { const value=AssessmentScoreSchema.parse(p); service.setAssessmentScore(value.id,value.score); });
  handle(IPC.inbox, (p) => service.getInbox(InboxFilterSchema.parse(p??{}))); handle(IPC.inboxAction, (p) => service.actOnExternalRecord(ExternalActionSchema.parse(p)));
  handle(IPC.proposalAction,(p)=>integrations.actOnProposal(ProposalActionSchema.parse(p)));
  handle(IPC.integrations,()=>integrations.getAccounts());
  handle(IPC.googleConnect,(p)=>integrations.connectGoogle(ConnectGoogleSchema.parse(p)));
  handle(IPC.integrationSync,(p)=>integrations.sync(AccountIdSchema.parse(p).id));
  handle(IPC.integrationReconnect,(p)=>integrations.reconnect(AccountIdSchema.parse(p).id));
  handle(IPC.integrationDisconnect,(p)=>integrations.disconnect(AccountIdSchema.parse(p).id));
  handle(IPC.mailRules,(p)=>integrations.getMailRoutingRules(AccountIdSchema.parse(p).id));
  handle(IPC.mailRuleAdd,(p)=>integrations.addMailRoutingRule(MailRoutingRuleInputSchema.parse(p)));
  handle(IPC.mailRuleDelete,(p)=>integrations.deleteMailRoutingRule(IdSchema.parse(p).id));
  handle(IPC.inboxReevaluate,(p)=>integrations.reevaluateInbox(AccountIdSchema.parse(p).id));
  handle(IPC.openOriginal,async(p)=>{const {url}=OpenOriginalSchema.parse(p);await shell.openExternal(url)});
  handle(IPC.search, (p) => { const v=SearchSchema.parse(p); return service.search(v.query,v.area); });
  handle(IPC.settingGet, (p) => service.getSetting(String(p?.key ?? ''))); handle(IPC.settingSet, (p) => { const v=SettingSchema.parse(p); service.setSetting(v.key,v.value); });
  handle(IPC.backup, async () => { const selected=await dialog.showSaveDialog({ title:'Export Command Centre backup',defaultPath:`command-centre-${new Date().toISOString().slice(0,10)}.sqlite`,filters:[{name:'SQLite database',extensions:['sqlite']}] }); if(selected.canceled||!selected.filePath)return null; database.backup(selected.filePath); return selected.filePath; });
}

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 920, minWidth: 880, minHeight: 620, titleBarStyle: 'hiddenInset', backgroundColor: '#111113', webPreferences: { preload: path.join(dirname,'../../preload/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  win.webContents.on('will-navigate',(event,url)=>{ if(url!==win.webContents.getURL())event.preventDefault(); });
  win.webContents.on('preload-error',(_event,preloadPath,error)=>console.error('[preload]',preloadPath,error));
  win.webContents.on('did-fail-load',(_event,code,description,url)=>console.error('[load]',code,description,url));
  if(process.env.VITE_DEV_SERVER_URL) void win.loadURL(process.env.VITE_DEV_SERVER_URL); else void win.loadFile(path.join(dirname,'../../../dist/index.html'));
}

app.whenReady().then(() => { app.setAboutPanelOptions({applicationName:'Command Centre',applicationVersion:app.getVersion()});const template:MenuItemConstructorOptions[]=[{label:'Command Centre',submenu:[{role:'about'},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'reload'},{role:'toggleDevTools'},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},{label:'Window',submenu:[{role:'minimize'},{role:'zoom'},{role:'front'}]}];Menu.setApplicationMenu(Menu.buildFromTemplate(template));const dbPath=process.env.COMMAND_CENTRE_DB ?? path.join(app.getPath('userData'),'command-centre.sqlite'); database=new LocalDatabase(dbPath); runMigrations(database); seedDatabase(database); service=new CommandCentreService(database);academicAdmin=new AcademicAdminService(database);const google=new GoogleProvider(new GoogleOAuthClient((url)=>shell.openExternal(url)));integrations=new IntegrationService(database,new MacKeychainCredentialStore(),new Map([[google.id,google]]),new DeterministicClassifier(),service); registerIpc(); createWindow();setInterval(()=>{for(const account of integrations.getAccounts().filter(a=>a.status==='synced'||a.status==='partial_failure'))void integrations.sync(account.id)},15*60_000).unref(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();}); });
app.on('window-all-closed',()=>{ if(process.platform!=='darwin')app.quit(); });
app.on('before-quit',()=>{ try{database?.close()}catch{/* Database may already be closed during shutdown. */} });

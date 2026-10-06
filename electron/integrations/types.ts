import type { Area } from '../../shared/contracts.js';
export interface StoredCredential { accessToken: string; refreshToken?: string; expiresAt: number; tokenType: string; scopes: string[] }
export interface ProviderAccountMetadata { providerAccountId: string; email: string; label: string; scopes: string[] }
export interface ProviderRecord { providerResourceId: string; type: 'mail'|'calendar-event'; title: string; sender?: string; occurredAt: string; endAt?: string; sourceUrl?: string; snippet?: string; content?: string; location?: string; calendarId?: string; providerStatus?: string; providerUpdatedAt?: string; rawMetadata?: Record<string,unknown> }
export interface ProviderSyncState { gmailHistoryId?: string; gmailLastSyncedAt?: string; calendarSyncToken?: string }
export interface ProviderSyncBatch { records: ProviderRecord[]; nextState: ProviderSyncState; failures: string[]; mailProcessed: number; calendarProcessed: number }
export interface ConnectContext { area: Area; institutionId?: string|null; label: string }
export interface IntegrationProvider { readonly id:string; connect(context:ConnectContext):Promise<{metadata:ProviderAccountMetadata;credential:StoredCredential}>; reconnect(accountId:string,context:ConnectContext):Promise<{metadata:ProviderAccountMetadata;credential:StoredCredential}>; sync(accountId:string,credential:StoredCredential,state:ProviderSyncState):Promise<{batch:ProviderSyncBatch;credential:StoredCredential}>; revoke(credential:StoredCredential):Promise<void> }
export interface CredentialStore { get(accountId:string):Promise<StoredCredential|null>; set(accountId:string,credential:StoredCredential):Promise<void>; delete(accountId:string):Promise<void> }

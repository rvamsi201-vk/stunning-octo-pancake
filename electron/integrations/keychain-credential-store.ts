import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CredentialStore, StoredCredential } from './types.js';
const execFileAsync=promisify(execFile); const SERVICE='com.commandcentre.google.oauth';
export class MacKeychainCredentialStore implements CredentialStore {
  async get(accountId:string){try{const {stdout}=await execFileAsync('/usr/bin/security',['find-generic-password','-a',accountId,'-s',SERVICE,'-w'],{maxBuffer:1024*1024});return JSON.parse(stdout.trim()) as StoredCredential}catch(error:any){if(error?.code===44||error?.stderr?.includes('could not be found'))return null;throw new Error('Could not read credentials from macOS Keychain')}}
  async set(accountId:string,credential:StoredCredential){await execFileAsync('/usr/bin/security',['add-generic-password','-U','-a',accountId,'-s',SERVICE,'-w',JSON.stringify(credential)],{maxBuffer:1024*1024})}
  async delete(accountId:string){try{await execFileAsync('/usr/bin/security',['delete-generic-password','-a',accountId,'-s',SERVICE])}catch(error:any){if(!(error?.code===44||error?.stderr?.includes('could not be found')))throw new Error('Could not remove credentials from macOS Keychain')}}
}
export class MemoryCredentialStore implements CredentialStore {private values=new Map<string,StoredCredential>();async get(id:string){return this.values.get(id)??null}async set(id:string,value:StoredCredential){this.values.set(id,value)}async delete(id:string){this.values.delete(id)}}

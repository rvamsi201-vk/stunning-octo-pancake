/// <reference types="vite/client" />
import type { CommandCentreApi } from '../shared/contracts';
declare global { interface Window { commandCentre: CommandCentreApi } }
export {};

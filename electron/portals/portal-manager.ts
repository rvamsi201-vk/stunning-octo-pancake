export interface PortalDestination { id: string; name: string; url: string; allowedOrigins: string[] }

/**
 * Architectural boundary for a future WebContentsView implementation.
 * Remote views must be created with sandbox=true, nodeIntegration=false,
 * contextIsolation=true, no preload, a restrictive permission handler, and
 * navigation limited to explicitly configured origins.
 */
export interface PortalManager {
  open(destination: PortalDestination): Promise<void>;
  close(destinationId: string): Promise<void>;
}

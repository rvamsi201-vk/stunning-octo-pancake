import { BrowserWindow, WebContentsView, shell } from 'electron';
import { validatePortalUrl } from '../services/portal-service.js';
import { buildPortalTrustedOrigins, handlePortalNavigation } from './portal-navigation-policy.js';

/** Isolated persistent session for portal cookies — separate from the privileged app renderer. */
export const PORTAL_SESSION_PARTITION = 'persist:command-centre-portals';

export interface PortalNavigationState {
  portalId: string;
  name: string;
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export class SecurePortalHost {
  private view: WebContentsView | null = null;
  private portalId: string | null = null;
  private portalName = '';
  private trustedOrigins: string[] = [];

  constructor(private readonly getMainWindow: () => BrowserWindow | null) {}

  private ensureView() {
    if (this.view) return this.view;
    this.view = new WebContentsView({
      webPreferences: {
        partition: PORTAL_SESSION_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });
    const contents = this.view.webContents;
    contents.setWindowOpenHandler(({ url }) => {
      const decision = handlePortalNavigation(url, this.trustedOrigins);
      if (decision.action === 'allow') {
        void contents.loadURL(url);
      } else if (decision.action === 'open-external') {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });
    const onNavigate = (event: Electron.Event, url: string) => {
      const decision = handlePortalNavigation(url, this.trustedOrigins);
      if (decision.action === 'allow') return;
      event.preventDefault();
      if (decision.action === 'open-external') void shell.openExternal(url);
    };
    contents.on('will-navigate', onNavigate);
    contents.on('will-redirect', onNavigate);
    contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    return this.view;
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }) {
    const win = this.getMainWindow();
    const view = this.ensureView();
    if (!win) return;
    if (!win.contentView.children.includes(view)) win.contentView.addChildView(view);
    view.setBounds(bounds);
  }

  hide() {
    const win = this.getMainWindow();
    if (this.view && win?.contentView.children.includes(this.view)) {
      win.contentView.removeChildView(this.view);
    }
  }

  async open(portalId: string, name: string, url: string, configuredTrustedOrigins: string[] = []): Promise<PortalNavigationState> {
    const safeUrl = validatePortalUrl(url);
    if (!safeUrl) throw new Error('Configure an HTTPS URL before opening this portal.');
    this.portalId = portalId;
    this.portalName = name;
    this.trustedOrigins = buildPortalTrustedOrigins(safeUrl, configuredTrustedOrigins);
    const view = this.ensureView();
    await view.webContents.loadURL(safeUrl);
    return this.state();
  }

  back() {
    if (this.view?.webContents.navigationHistory.canGoBack()) this.view.webContents.navigationHistory.goBack();
    return this.state();
  }

  forward() {
    if (this.view?.webContents.navigationHistory.canGoForward()) this.view.webContents.navigationHistory.goForward();
    return this.state();
  }

  reload() {
    this.view?.webContents.reload();
    return this.state();
  }

  openExternal() {
    const url = this.view?.webContents.getURL();
    if (url) void shell.openExternal(url);
  }

  state(): PortalNavigationState {
    const url = this.view?.webContents.getURL() ?? '';
    return {
      portalId: this.portalId ?? '',
      name: this.portalName,
      url,
      canGoBack: Boolean(this.view?.webContents.navigationHistory.canGoBack()),
      canGoForward: Boolean(this.view?.webContents.navigationHistory.canGoForward()),
    };
  }
}

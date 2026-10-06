import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Globe, Plus, RefreshCw, Settings, X } from 'lucide-react';
import type { Area, PortalNavigationState, PortalRecord } from '@shared/contracts';

const api = window.commandCentre;
const areaNames: Record<Area, string> = { IITM: 'IIT Madras', MANIPAL: 'Manipal', EXORA: 'Exora', PERSONAL: 'Personal' };
const areaClass: Record<Area, string> = { IITM: 'iitm', MANIPAL: 'manipal', EXORA: 'exora', PERSONAL: 'personal' };

export function PortalHubPage() {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const [portals, setPortals] = useState<PortalRecord[]>([]);
  const [active, setActive] = useState<PortalNavigationState | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => { api.listPortals().then(setPortals).catch(() => setError('Could not load portals.')); }, []);
  useEffect(() => { reload(); return () => { void api.hidePortal(); }; }, [reload]);

  useEffect(() => {
    const node = hostRef.current;
    if (!active || !node) return;
    const updateBounds = () => {
      const rect = node.getBoundingClientRect();
      void api.setPortalBounds({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    observer.observe(node);
    window.addEventListener('resize', updateBounds);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateBounds); };
  }, [active]);

  async function openPortal(portal: PortalRecord) {
    setError('');
    try {
      const state = await api.openPortal(portal.id);
      setActive(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This portal could not be opened.');
    }
  }

  return (
    <div className="page portal-hub-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Secure destinations</span>
          <h2>Portal Hub</h2>
          <p>Remote sites open in an isolated WebContentsView without Command Centre APIs or your local database.</p>
        </div>
        <button className="compact" onClick={() => navigate('/settings')}><Settings size={15} />Manage portals</button>
      </div>
      {error && <div className="toast-banner">{error}</div>}
      <div className="portal-hub-layout">
        <div className="portal-list">
          {portals.map((portal) => (
            <button key={portal.id} className={`portal-list-item ${active?.portalId === portal.id ? 'active' : ''}`} onClick={() => openPortal(portal)}>
              <span className={`portal-icon ${areaClass[portal.area]}`}><Globe size={16} /></span>
              <span><strong>{portal.name}</strong><small>{areaNames[portal.area]}{portal.url ? ` · ${portal.url}` : ' · URL not set'}</small></span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <div className="portal-browser">
          <div className="portal-toolbar">
            <strong>{active?.name || 'Select a portal'}</strong>
            <div className="portal-controls">
              <button disabled={!active?.canGoBack} onClick={async () => setActive(await api.portalBack())}><ChevronLeft size={15} /></button>
              <button disabled={!active?.canGoForward} onClick={async () => setActive(await api.portalForward())}><ChevronRight size={15} /></button>
              <button disabled={!active} onClick={async () => setActive(await api.portalReload())}><RefreshCw size={15} /></button>
              <button disabled={!active} onClick={() => api.portalOpenExternal()}><ExternalLink size={15} />Open externally</button>
              <button disabled={!active} onClick={async () => { await api.hidePortal(); setActive(null); }}><X size={15} /></button>
            </div>
          </div>
          <div ref={hostRef} className="portal-host">
            {!active && <div className="empty"><Globe size={18} /><strong>No portal open</strong><span>Choose a saved portal to browse inside Command Centre.</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalSettingsSection() {
  const [portals, setPortals] = useState<PortalRecord[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [area, setArea] = useState<Area>('PERSONAL');
  const [trustedOrigins, setTrustedOrigins] = useState('');
  const reload = () => api.listPortals(true).then(setPortals);
  useEffect(() => { reload(); }, []);
  const parseOrigins = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return (
    <section className="section">
      <div className="section-head"><h2>Portals</h2></div>
      <p className="routing-help">Add HTTPS SSO origins (comma-separated) so sign-in redirects stay inside the isolated portal browser.</p>
      <form className="rule-form" onSubmit={async (e) => { e.preventDefault(); await api.createPortal({ name, url, area, trustedOrigins: parseOrigins(trustedOrigins) }); setName(''); setUrl(''); setTrustedOrigins(''); reload(); }}>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Portal name" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <input value={trustedOrigins} onChange={(e) => setTrustedOrigins(e.target.value)} placeholder="SSO origins, e.g. login.microsoftonline.com" />
        <select value={area} onChange={(e) => setArea(e.target.value as Area)}>{Object.entries(areaNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <button type="submit"><Plus size={13} />Add portal</button>
      </form>
      <div className="rule-list">
        {portals.filter((portal) => !portal.archived).map((portal) => (
          <div key={portal.id}>
            <strong>{portal.name}</strong>
            <code>{portal.url || 'No URL'}</code>
            <input
              aria-label={`Trusted SSO origins for ${portal.name}`}
              value={portal.trustedOrigins.join(', ')}
              onChange={() => undefined}
              onBlur={async (e) => {
                await api.updatePortal({ id: portal.id, trustedOrigins: parseOrigins(e.target.value) });
                reload();
              }}
            />
            <button onClick={async () => { await api.archivePortal(portal.id); reload(); }}><X size={13} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

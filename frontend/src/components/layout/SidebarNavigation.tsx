import { openHelpManual } from '../../api/native';

export type AppSection = 'search' | 'ingest' | 'documents' | 'settings';

type SidebarNavigationProps = {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
};

type NavigationItem = {
  section: AppSection;
  label: string;
  description: string;
};

const navigationItems: NavigationItem[] = [
  { section: 'search', label: 'Buscador', description: 'Encontrar casos' },
  { section: 'ingest', label: 'Carga', description: 'Carpetas, auditoría e ingesta' },
  { section: 'documents', label: 'Documentos', description: 'Biblioteca y estados' },
  { section: 'settings', label: 'Configuración', description: 'Carpetas, IA y servicios' },
];

export function SidebarNavigation({ activeSection, onSectionChange }: SidebarNavigationProps) {
  async function handleOpenManual(): Promise<void> {
    try {
      await openHelpManual();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos abrir el manual.';
      window.alert(message);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebarBrand">
        <span className="brandMark">SG</span>
        <div>
          <strong>Archivo de</strong>
          <span>SCIVOLI GNC</span>
        </div>
      </div>

      <nav className="sidebarNav" aria-label="Secciones principales">
        {navigationItems.map((item) => (
          <button
            key={item.section}
            type="button"
            className={item.section === activeSection ? 'navItem active' : 'navItem'}
            onClick={() => onSectionChange(item.section)}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </nav>

      <div className="sidebarFooter">
        <button type="button" className="navItem helpNavItem" onClick={() => void handleOpenManual()}>
          <span>Manual de uso</span>
          <small>Guía paso a paso del proceso</small>
        </button>
      </div>
    </aside>
  );
}

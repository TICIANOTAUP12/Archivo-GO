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
  { section: 'ingest', label: 'Carga', description: 'Auditar e ingestar' },
  { section: 'documents', label: 'Documentos', description: 'Biblioteca y estados' },
  { section: 'settings', label: 'IA', description: 'Modelos y keys' },
];

export function SidebarNavigation({ activeSection, onSectionChange }: SidebarNavigationProps) {
  return (
    <aside className="sidebar">
      <div className="sidebarBrand">
        <span className="brandMark">AD</span>
        <div>
          <strong>Archivo Digital</strong>
          <span>Inteligente</span>
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
    </aside>
  );
}

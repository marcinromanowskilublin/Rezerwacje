import { Brain, CalendarDays, Files, MapPin, Newspaper, Stethoscope, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatNip, formatRegon, fullAddress, site } from '../../config/site';

const links = [
  { id: 'rezerwacja', label: 'Rezerwacja', Icon: CalendarDays },
  { id: 'aktualnosci', label: 'Aktualności', Icon: Newspaper },
  { id: 'o-mnie', label: 'O mnie', Icon: UserRound },
  { id: 'oferta', label: 'Oferta', Icon: Stethoscope },
  { id: 'adhd', label: 'ADHD', Icon: Brain },
  { id: 'dokumenty', label: 'Dokumenty', Icon: Files },
];

export type OfficeTheme = 'ciemny' | 'jasny';

export default function OfficeHeader({ theme, onThemeChange }: {
  theme: OfficeTheme;
  onThemeChange: (theme: OfficeTheme) => void;
}) {
  return (
    <header className="office-header">
      <div className="office-masthead office-width">
        <a className="office-brand" href="#o-mnie">
          <Brain aria-hidden="true" />
          <span><small>{site.practiceKind}</small><strong>{site.officeName}</strong></span>
        </a>
        <address className="office-address">
          <span><MapPin aria-hidden="true" /> {fullAddress()}</span>
          <span>NIP {formatNip()} · REGON {formatRegon()} · PWZ {site.pwz}</span>
        </address>
        <div className="office-theme-switch" role="group" aria-label="Wariant zieleni">
          <button type="button" aria-label="Jasna zieleń" aria-pressed={theme === 'jasny'} onClick={() => onThemeChange('jasny')}>Jasny</button>
          <button type="button" aria-label="Ciemna zieleń" aria-pressed={theme === 'ciemny'} onClick={() => onThemeChange('ciemny')}>Ciemny</button>
        </div>
      </div>
      <nav aria-label="Główne sekcje" className="office-nav office-width">
        {links.map(({ id, label, Icon }) => (
          <a key={id} href={`#${id}`}><Icon aria-hidden="true" />{label}</a>
        ))}
        <Link className="office-panel-link" to="/admin/login">Panel</Link>
      </nav>
    </header>
  );
}

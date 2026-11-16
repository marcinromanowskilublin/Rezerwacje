import { ArrowUpRight, Facebook } from 'lucide-react';
import { site } from '../../config/site';

function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M12 2.4c-5.3 0-9.6 4.3-9.6 9.6 0 1.7.4 3.3 1.3 4.7L2 22l5.4-1.4c1.4.8 2.9 1.2 4.6 1.2 5.3 0 9.6-4.3 9.6-9.6S17.3 2.4 12 2.4Zm0 17.5c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-3.2.8.9-3.1-.2-.3A7.1 7.1 0 1 1 12 19.9Zm4.1-5.3c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1-1-.5-1.9-1.2-2.6-2.1-.2-.2 0-.4.1-.5l.5-.6c.1-.1.1-.3.1-.4 0-.1 0-.3-.1-.4l-.6-1.5c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.4 1.4.6 1.9.6 2.6.5.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.1-.4-.2Z"
      />
    </svg>
  );
}

export default function SiteContact() {
  return (
    <div className="office-social">
      <a href={site.facebookPageUrl} target="_blank" rel="noopener noreferrer">
        <Facebook aria-hidden="true" />
        Gabinet na Facebooku
        <ArrowUpRight aria-hidden="true" />
      </a>
      <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon />
        Napisz na WhatsApp
        <ArrowUpRight aria-hidden="true" />
      </a>
    </div>
  );
}

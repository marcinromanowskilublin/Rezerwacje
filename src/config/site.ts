const phoneDigits = '48663500636';

export const site = {
  officeName: 'Marcin Romanowski',
  officeDisplayName: 'lek. Marcin Romanowski',
  officeTitle: 'specjalista psychiatrii · Lublin',
  headerTitle: 'specjalista psychiatrii · PWZ 2750702 · Lublin',
  professionalTitle: 'lekarz',
  titleCountry: 'Polska',
  pwz: '2750702',
  pwzRegister: 'Centralny Rejestr Lekarzy RP',
  pwzRegisterAuthority: 'Naczelna Izba Lekarska',
  chamberName: 'Lubelska Izba Lekarska',
  chamberUrl: 'https://oil.lublin.pl/',
  ethicsCodeName: 'Kodeks Etyki Lekarskiej',
  ethicsCodeUrl: 'https://nil.org.pl/dokumenty/kodeks-etyki-lekarskiej',
  licensingRegister: 'Rejestr Podmiotów Wykonujących Działalność Leczniczą',
  licensingAuthority: 'Wojewoda Lubelski',
  visitModeWord: 'online',
  visitPrices: {
    first: 275,
    followup: 250,
  },
  practiceKind: 'Indywidualna praktyka lekarska',
  businessName: 'Indywidualna Praktyka Lekarska Marcin Romanowski',
  nip: '7133026806',
  regon: '367591005',
  streetAddress: 'ul. Turniowa 7/49',
  postalCode: '20-563',
  city: 'Lublin',
  countryCode: 'PL',
  domain: 'marcin-romanowski.pl',
  publicUrl: 'https://marcin-romanowski.pl',
  canonicalUrl: 'https://marcin-romanowski.pl/',
  privacyEmail: 'kontakt@marcin-romanowski.pl',
  znanyLekarzUrl: 'https://www.znanylekarz.pl/marcin-romanowski-2/psychiatra/lublin',
  portraitSrc: `${import.meta.env.BASE_URL}marcin-romanowski.jpg`,
  whatsappUrl: `https://wa.me/${phoneDigits}`,
  contactNote:
    'Korzystam z WhatsAppa, żeby wygodnie wymieniać informacje i pliki — tak kontaktuję się z pacjentami.',
  bookingConfirmNote:
    'Potwierdzeniem rezerwacji jest wiadomość na podany adres e-mail.',
};

export function fullAddress(): string {
  return `${site.streetAddress}, ${site.postalCode} ${site.city}`;
}

export function visitPriceZl(kind?: string, fallback?: number): number {
  if (kind === 'first') return site.visitPrices.first;
  if (kind === 'followup') return site.visitPrices.followup;
  return fallback ?? site.visitPrices.followup;
}

export function formatZl(amount: number): string {
  return `${amount} zł`;
}

export function formatNip(nip = site.nip): string {
  const digits = nip.replace(/\D/g, '');
  if (digits.length !== 10) return nip;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

export function formatRegon(regon = site.regon): string {
  const digits = regon.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return regon;
}

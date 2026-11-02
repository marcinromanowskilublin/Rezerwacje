import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { site } from '../../config/site';

const updatedAt = '9 września 2026 r.';

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium tracking-[-0.01em] text-[#007865]">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-neutral-600">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <Link to="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
        ← Wróć do rezerwacji
      </Link>

      <header className="mt-8 border-b border-neutral-200 pb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
          Informacja o przetwarzaniu danych
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.025em] text-[#007865] sm:text-4xl">
          Polityka prywatności
        </h1>
        <p className="mt-3 text-sm text-neutral-500">Ostatnia aktualizacja: {updatedAt}</p>
      </header>

      <div className="mt-9 space-y-10">
        <Section title="1. Administrator danych">
          <p>
            Administratorem danych jest {site.businessName}, {site.practiceKind}, NIP {site.nip},
            REGON {site.regon}, adres: {site.streetAddress}, {site.postalCode} {site.city}.
          </p>
          <p>
            W sprawach dotyczących prywatności możesz napisać na{' '}
            <a className="text-[#007865] underline underline-offset-4" href={`mailto:${site.privacyEmail}`}>
              {site.privacyEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Jakie dane przetwarzamy">
          <p>
            Przy rezerwacji podajesz imię i nazwisko, adres e-mail oraz numer telefonu. System zapisuje
            również wybrany rodzaj wizyty, termin, status rezerwacji, daty zmian oraz indywidualny token
            potrzebny do zarządzania wizytą.
          </p>
          <p>
            Formularz nie służy do przekazywania opisu stanu zdrowia, diagnozy ani dokumentacji
            medycznej. Prosimy nie wpisywać takich informacji w polach kontaktowych.
          </p>
        </Section>

        <Section title="3. Cele i podstawy przetwarzania">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              obsługa rezerwacji, potwierdzenie, zmiana lub anulowanie terminu — art. 6 ust. 1 lit. b
              RODO;
            </li>
            <li>
              realizacja obowiązków prawnych związanych z działalnością leczniczą — art. 6 ust. 1
              lit. c RODO;
            </li>
            <li>
              zapewnienie bezpieczeństwa systemu oraz ustalenie, dochodzenie lub obrona roszczeń —
              art. 6 ust. 1 lit. f RODO;
            </li>
            <li>
              jeżeli kontekst rezerwacji ujawnia dane dotyczące zdrowia — art. 9 ust. 2 lit. h RODO
              w związku z udzielaniem świadczeń zdrowotnych.
            </li>
          </ul>
        </Section>

        <Section title="4. Odbiorcy danych">
          <p>
            Dane mogą być przetwarzane przez dostawców hostingu, bazy danych i poczty elektronicznej,
            w szczególności home.pl, a także przez podmioty świadczące wsparcie IT — wyłącznie w
            zakresie niezbędnym do działania i zabezpieczenia systemu.
          </p>
          <p>
            Na prywatny adres Gmail administratora wysyłane jest tylko techniczne powiadomienie o
            dacie i godzinie nowej rezerwacji. Nie zawiera ono imienia, telefonu, adresu e-mail ani
            tokenu pacjenta.
          </p>
          <p>
            WhatsApp jest usługą zewnętrzną i nie jest wymagany do dokonania rezerwacji. Po kliknięciu
            przycisku „Napisz na WhatsApp” dalsze przetwarzanie odbywa się zgodnie z zasadami Meta.
          </p>
        </Section>

        <Section title="5. Okres przechowywania">
          <p>
            Dane rezerwacyjne są przechowywane przez czas potrzebny do obsługi terminu, a następnie
            przez okres wymagany przepisami lub niezbędny do ustalenia, dochodzenia bądź obrony
            roszczeń. Dane, których dalsze przechowywanie nie jest potrzebne, podlegają usunięciu lub
            anonimizacji.
          </p>
          <p>
            Dokumentacja medyczna, jeżeli powstanie w związku z udzieleniem świadczenia, jest
            prowadzona i przechowywana odrębnie według właściwych przepisów.
          </p>
        </Section>

        <Section title="6. Twoje prawa">
          <p>
            W granicach przewidzianych przez RODO masz prawo żądać dostępu do danych, ich sprostowania,
            usunięcia, ograniczenia przetwarzania, przeniesienia danych oraz wnieść sprzeciw wobec
            przetwarzania opartego na prawnie uzasadnionym interesie.
          </p>
          <p>
            Masz również prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych. Skorzystanie
            z prawa może podlegać ograniczeniom wynikającym z obowiązków dotyczących dokumentacji
            medycznej lub obrony roszczeń.
          </p>
        </Section>

        <Section title="7. Dobrowolność podania danych">
          <p>
            Podanie danych jest dobrowolne, ale niezbędne do utworzenia rezerwacji i przekazania
            informacji o jej statusie. Brak wymaganych danych uniemożliwi zapis online.
          </p>
        </Section>

        <Section title="8. Statystyki i pliki cookies">
          <p>
            Własny licznik przechowuje wyłącznie łączną liczbę odsłon przypisaną do dnia. Aplikacja nie
            zapisuje na potrzeby statystyk adresów IP, lokalizacji, operatora, identyfikatorów
            urządzenia, user-agenta ani źródła wejścia. Nie korzystamy z Google Analytics ani
            reklamowych plików cookies.
          </p>
          <p>
            Dostawca hostingu może prowadzić standardowe logi techniczne serwera w celu zapewnienia
            bezpieczeństwa i ciągłości usługi.
          </p>
        </Section>

        <Section title="9. Bezpieczeństwo rezerwacji">
          <p>
            Link otrzymany w wiadomości e-mail umożliwia zarządzanie wizytą. Traktuj go jak poufną
            informację i nie przekazuj osobom trzecim. System nie podejmuje wobec pacjentów decyzji w
            sposób wyłącznie zautomatyzowany i nie prowadzi profilowania.
          </p>
        </Section>

        <Section title="10. Zmiany polityki">
          <p>
            Polityka może zostać zaktualizowana, jeżeli zmieni się sposób działania systemu, zakres
            usług lub obowiązujące przepisy. Aktualna wersja jest zawsze publikowana na tej stronie.
          </p>
        </Section>
      </div>
    </article>
  );
}

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

export default function BookingTerms() {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <Link to="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
        ← Wróć do rezerwacji
      </Link>

      <header className="mt-8 border-b border-neutral-200 pb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
          Informacje organizacyjne
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.025em] text-[#007865] sm:text-4xl">
          Zasady rezerwacji
        </h1>
        <p className="mt-3 text-sm text-neutral-500">Ostatnia aktualizacja: {updatedAt}</p>
      </header>

      <div className="mt-9 space-y-10">
        <Section title="1. Kto prowadzi system">
          <p>
            System rezerwacji prowadzi {site.businessName} ({site.practiceKind}), NIP {site.nip},
            REGON {site.regon}, adres: {site.streetAddress}, {site.postalCode} {site.city}.
            Tytuł zawodowy: {site.professionalTitle} ({site.titleCountry}). PWZ {site.pwz} —{' '}
            {site.pwzRegister}, {site.pwzRegisterAuthority}. Samorząd: {site.chamberName}.
            Działalność lecznicza: {site.licensingRegister}, organ: {site.licensingAuthority}.
            Zasady etyki zawodowej:{' '}
            <a
              className="text-[#007865] underline underline-offset-4"
              href={site.ethicsCodeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {site.ethicsCodeName}
            </a>
            .
          </p>
          <p>
            Kontakt organizacyjny:{' '}
            <a className="text-[#007865] underline underline-offset-4" href={`mailto:${site.privacyEmail}`}>
              {site.privacyEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Zakres systemu">
          <p>
            Strona służy wyłącznie do wybrania rodzaju wizyty, dnia i dostępnej godziny oraz do
            przekazania danych kontaktowych potrzebnych do obsługi terminu.
          </p>
          <p>
            Rezerwacja online nie stanowi porady medycznej, diagnozy ani pomocy w sytuacji nagłej.
            Warunki udzielenia świadczenia zdrowotnego wynikają z właściwych przepisów i ustaleń
            dokonywanych podczas wizyty.
          </p>
        </Section>

        <Section title="3. Dokonanie rezerwacji">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Wybierz rodzaj wizyty, dzień i wolną godzinę.</li>
            <li>Podaj prawidłowe imię i nazwisko, adres e-mail oraz numer telefonu.</li>
            <li>Sprawdź podsumowanie i zatwierdź zapis.</li>
            <li>Otwórz wiadomość e-mail i użyj indywidualnego linku do potwierdzenia wizyty.</li>
          </ol>
          <p>
            Termin jest blokowany po zapisaniu rezerwacji. Status wizyty można sprawdzić przez
            indywidualny link otrzymany w wiadomości.
          </p>
        </Section>

        <Section title="4. Potwierdzenie i kontakt">
          <p>
            Po zapisaniu system podejmuje próbę wysłania wiadomości na podany adres e-mail, a ekran
            podsumowania informuje o wyniku zlecenia wysyłki. Pacjent odpowiada za poprawność danych
            oraz za sprawdzenie folderu Spam lub Oferty, jeżeli wiadomość nie pojawi się w skrzynce
            głównej.
          </p>
          <p>
            Preferowaną formą kontaktu organizacyjnego jest wiadomość tekstowa na WhatsApp. Korzystanie
            z WhatsApp jest dobrowolne i nie jest konieczne do rezerwacji online.
          </p>
        </Section>

        <Section title="5. Anulowanie i zmiana terminu">
          <p>
            Wizytę można anulować przez indywidualny link otrzymany po zapisie. Po skutecznym
            anulowaniu termin może ponownie pojawić się jako dostępny dla innych osób.
          </p>
          <p>
            W sprawie zmiany terminu skorzystaj z dostępnego kontaktu organizacyjnego. Nie udostępniaj
            swojego linku do zarządzania rezerwacją osobom trzecim.
          </p>
        </Section>

        <Section title="6. Dostępność i problemy techniczne">
          <p>
            Prezentowane godziny odzwierciedlają aktualny stan systemu. Sporadyczne opóźnienie,
            przerwa techniczna lub jednoczesna próba zapisu mogą spowodować, że wybrany termin nie
            będzie już dostępny przy zatwierdzaniu.
          </p>
          <p>
            Jeżeli zapis nie zakończy się ekranem potwierdzenia albo wiadomość nie dotrze, skontaktuj
            się przed ponownym utworzeniem rezerwacji, aby uniknąć duplikatu.
          </p>
        </Section>

        <Section title="7. Sytuacje nagłe">
          <p>
            System nie jest przeznaczony do kontaktu w sytuacji bezpośredniego zagrożenia życia lub
            zdrowia. W sytuacji nagłej zadzwoń pod numer alarmowy 112 lub 999 albo zgłoś się do
            najbliższej placówki udzielającej pomocy doraźnej.
          </p>
        </Section>

        <Section title="8. Prywatność">
          <p>
            Szczegóły dotyczące przetwarzania danych znajdują się w{' '}
            <Link className="text-[#007865] underline underline-offset-4" to="/polityka-prywatnosci">
              Polityce prywatności
            </Link>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}

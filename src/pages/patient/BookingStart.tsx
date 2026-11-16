import { addMonths, format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowRight, CalendarDays, ClipboardList, HeartHandshake, Laptop, MessageSquare, Newspaper, Stethoscope, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SiteContact from '../../components/layout/SiteContact';
import { config } from '../../config/features';
import { site, visitPriceZl } from '../../config/site';
import { slotRange } from '../../lib/schedule';
import { bookingApi } from '../../services/bookingApi';
import type { VisitType } from '../../types';
import { useBooking } from './BookingContext';

interface Availability {
  date: string;
  times: string[];
}

const warsawDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', dateStyle: 'short' });

async function getUpcomingAvailability(visitTypeId: string): Promise<Availability | null> {
  const today = warsawDate.format(new Date());

  for (let offset = 0; offset < 2; offset++) {
    const month = addMonths(parseISO(today), offset);
    const dates = await bookingApi.getAvailableDays(visitTypeId, month.getMonth() + 1, month.getFullYear());
    const upcomingDates = dates.filter(date => date >= today).sort();
    for (const date of upcomingDates.slice(0, 2)) {
      const times = await bookingApi.getAvailableSlots(date, visitTypeId);
      if (times.length) return { date, times: [...times].sort().slice(0, 3) };
    }
  }

  return null;
}

export default function BookingStart() {
  const [visitTypes, setVisitTypes] = useState<VisitType[] | null>(null);
  const [scheduleOn, setScheduleOn] = useState<boolean | null>(config.API_MODE === 'production' ? null : true);
  const [availability, setAvailability] = useState<Availability | null | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { updateState } = useBooking();
  const previewVisit = visitTypes?.find(visit => visit.kind === 'first') ?? visitTypes?.[0];
  const time = selectedTime ?? availability?.times[0];

  useEffect(() => {
    let active = true;
    bookingApi.getVisitTypes()
      .then(types => { if (active) setVisitTypes(types); })
      .catch(() => { if (active) setVisitTypes([]); });
    if (config.API_MODE === 'production') {
      bookingApi.getSiteStatus()
        .then(status => { if (active) setScheduleOn(Boolean(status.schedule_enabled)); })
        .catch(() => { if (active) setScheduleOn(false); });
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!scheduleOn || !previewVisit) return;
    let active = true;
    getUpcomingAvailability(previewVisit.id)
      .then(result => { if (active) setAvailability(result); })
      .catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, [scheduleOn, previewVisit]);

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  function chooseVisit(visitType: VisitType) {
    updateState({ visitType, date: null, time: null, paymentMethod: undefined });
    navigate('/day');
  }

  function reservePreview() {
    if (!previewVisit || !availability || !time) return;
    updateState({ visitType: previewVisit, date: availability.date, time, paymentMethod: undefined });
    navigate('/form');
  }

  const loading = visitTypes === null || scheduleOn === null;

  return (
    <>
      <div className="office-opening">
        <div className="office-width">
          <section id="o-mnie" aria-labelledby="doctor-name" className="office-hero">
            <div className="office-intro">
              <p className="office-kicker">Lekarz psychiatra</p>
              <h1 id="doctor-name">Marcin<br />Romanowski</h1>
              <p className="office-subtitle">Specjalista psychiatrii <span aria-hidden="true">·</span> Lublin</p>
              <p className="office-intro-copy">Konsultacje psychiatryczne dla dorosłych, w spokojnej atmosferze.</p>
            </div>
            <div className="office-portrait">
              <img src={site.portraitSrc} alt={site.officeName} width={756} height={756} fetchPriority="high" />
            </div>
          </section>

          <ul className="office-benefits" aria-label="Informacje o wizytach">
            <li><HeartHandshake aria-hidden="true" /><span>Profesjonalna<br />pomoc</span></li>
            <li><UsersRound aria-hidden="true" /><span>Indywidualne<br />podejście</span></li>
            <li><CalendarDays aria-hidden="true" /><span>Wygodna<br />rezerwacja online</span></li>
          </ul>

          <section id="rezerwacja" className="office-booking" aria-labelledby="office-booking-heading">
            <div className="office-booking-main">
              <div className="office-booking-title">
                <CalendarDays aria-hidden="true" />
                <div>
                  <h2 id="office-booking-heading">Wybierz termin wizyty</h2>
                  {availability && previewVisit && (
                    <p>{format(parseISO(availability.date), 'EEEE, d MMMM yyyy', { locale: pl })} · {previewVisit.duration_minutes} min · {site.visitModeWord}</p>
                  )}
                </div>
              </div>
              {availability && previewVisit ? (
                <fieldset className="office-slots">
                  <legend>{previewVisit.name} · Godzina</legend>
                  <div>
                    {availability.times.map(slot => (
                      <label key={slot}>
                        <input type="radio" name="office-time" checked={time === slot} onChange={() => setSelectedTime(slot)} />
                        <span>{slotRange(slot, previewVisit.duration_minutes).replace('-', ' – ')}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="office-booking-status" role="status">
                  {scheduleOn === false ? 'Terminy ustalamy przez WhatsApp.'
                    : loading || (previewVisit && availability === undefined) ? 'Sprawdzam dostępne terminy…'
                    : previewVisit ? 'Więcej terminów znajdziesz w kalendarzu.'
                    : 'Terminarz jest chwilowo niedostępny.'}
                </p>
              )}
            </div>
            <div className="office-booking-action">
              <Laptop aria-hidden="true" />
              <div><h3>Wizyta online</h3><p>Potwierdzenie otrzymasz e-mailem.</p></div>
              {scheduleOn === false || (!loading && !previewVisit) ? (
                <a className="office-button" href={site.whatsappUrl} target="_blank" rel="noopener noreferrer">Napisz na WhatsApp <ArrowRight aria-hidden="true" /></a>
              ) : availability ? (
                <button className="office-button" type="button" onClick={reservePreview}>Zarezerwuj wizytę <ArrowRight aria-hidden="true" /></button>
              ) : (
                <button className="office-button" type="button" disabled={loading || !previewVisit} onClick={() => previewVisit && chooseVisit(previewVisit)}>Zobacz terminy <ArrowRight aria-hidden="true" /></button>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="office-width office-content">
        <section id="oferta" aria-labelledby="visit-type-heading" className="office-visit-types">
          <h2 id="visit-type-heading"><Stethoscope aria-hidden="true" />{scheduleOn === false ? 'Rodzaje wizyt' : 'Wybierz rodzaj wizyty'}</h2>
          <ul aria-busy={loading}>
            {visitTypes?.map(visit => {
              const Icon = visit.kind === 'followup' ? ClipboardList : MessageSquare;
              const description = <>
                <Icon aria-hidden="true" />
                <span className="office-visit-name"><strong>{visit.name}</strong><small>{visit.duration_minutes} min · {site.visitModeWord}</small></span>
                <span className="office-price">{visitPriceZl(visit.kind, visit.price)} zł</span>
              </>;
              return (
                <li key={visit.id}>
                  {scheduleOn ? (
                    <button className="office-visit-row" type="button" onClick={() => chooseVisit(visit)}>
                      {description}<span className="office-visit-arrow"><ArrowRight aria-hidden="true" /></span>
                    </button>
                  ) : <div className="office-visit-row">{description}</div>}
                </li>
              );
            })}
          </ul>
          {!loading && visitTypes?.length === 0 && <p>O rodzaje wizyt zapytaj przez <a href={site.whatsappUrl}>WhatsApp</a>.</p>}
        </section>

        <section id="aktualnosci" className="office-news" aria-labelledby="news-heading">
          <h2 id="news-heading"><Newspaper aria-hidden="true" />Aktualności</h2>
          <article>
            <h3>Umawianie konsultacji</h3>
            <p>{scheduleOn === true
              ? 'Terminy pierwszych konsultacji i wizyt kontrolnych znajdziesz w kalendarzu. W sprawach organizacyjnych napisz przez WhatsApp.'
              : 'O terminy konsultacji i sprawy organizacyjne zapytaj przez WhatsApp.'}</p>
          </article>
          <SiteContact />
        </section>

        <div className="office-more">
          <section id="adhd" aria-labelledby="adhd-heading">
            <h2 id="adhd-heading">ADHD u dorosłych</h2>
            <p>Konsultacje dotyczą diagnozy ADHD u dorosłych i kontynuacji leczenia.</p>
          </section>
          <section id="dokumenty" aria-labelledby="documents-heading">
            <h2 id="documents-heading">Dokumenty</h2>
            <div><Link to="/zasady-rezerwacji">Zasady rezerwacji</Link><Link to="/polityka-prywatnosci">Polityka prywatności</Link></div>
          </section>
        </div>
      </div>
    </>
  );
}

// ICS Kalender-Export — Termine als iCalendar-Datei
const fs = require('fs');

function generiereUID() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@imhws`;
}

function escapeICS(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatICSDate(datum) {
  if (!datum) return '';
  const dt = new Date(datum);
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function termineZuICS(termine) {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IMHWS//Handwerker-Software//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:IMHWS Termine',
    'X-WR-TIMEZONE:Europe/Berlin',
    '',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const t of termine) {
    ics.push('');
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${t.id ? t.id + '@imhws' : generiereUID()}`);
    ics.push(`DTSTAMP:${formatICSDate(new Date())}`);

    if (t.start) {
      ics.push(`DTSTART;TZID=Europe/Berlin:${formatICSDate(t.start)}`);
    }
    if (t.ende) {
      ics.push(`DTEND;TZID=Europe/Berlin:${formatICSDate(t.ende)}`);
    } else if (t.start) {
      const end = new Date(new Date(t.start).getTime() + 60 * 60 * 1000);
      ics.push(`DTEND;TZID=Europe/Berlin:${formatICSDate(end)}`);
    }

    ics.push(`SUMMARY:${escapeICS(t.titel || t.betreff || '')}`);
    if (t.beschreibung) ics.push(`DESCRIPTION:${escapeICS(t.beschreibung)}`);
    if (t.ort) ics.push(`LOCATION:${escapeICS(t.ort)}`);
    if (t.kunde) ics.push(`DESCRIPTION:${escapeICS('Kunde: ' + t.kunde + (t.beschreibung ? '\\n' + t.beschreibung : ''))}`);

    if (t.status === 'abgeschlossen') {
      ics.push('STATUS:COMPLETED');
    } else if (t.status === 'abgesagt') {
      ics.push('STATUS:CANCELLED');
    } else {
      ics.push('STATUS:CONFIRMED');
    }

    if (t.mitarbeiter) {
      ics.push(`ATTENDEE;CN=${escapeICS(t.mitarbeiter)}:mailto:noreply@imhws.de`);
    }

    ics.push('END:VEVENT');
  }

  ics.push('');
  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

function icsDateiSpeichern(pfad, termine) {
  const ics = termineZuICS(termine);
  fs.writeFileSync(pfad, ics, 'utf-8');
  return pfad;
}

module.exports = { termineZuICS, icsDateiSpeichern, escapeICS, formatICSDate };

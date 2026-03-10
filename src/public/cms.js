import wixData from 'wix-data';

/**
 * @param {string} id — the id of a event entry
 * @param {object} trg — the text field that will be filled with the summary
 */
export async function printEventSummary(id, trg) {
    let event = (await wixData.query("events").eq("_id", id).find()).items[0];

    let html = "<ul>";

    if (event.address)
        html += `<li>🏠 ${event.address.formatted}`;

    if (event.price)
        html += `<li>💶 ${event.price}`;

    if (event.responsible)
        html += `<li>👤 ${event.responsible}`

    if (event.registration)
        html += `<li>📝 Vornameldung bis ${dateRangeToString(event.registration)}`;

    if (event.dates && event.dates.length > 0) {
        html += "<li>📅";
        event.dates.forEach((ed, i) => {
            if (i > 0) html += "<br>";
            html += printRanges(ed)
        });
    }
    trg.html = html + "</ul>";
}

/**
 * @param {object} sport — the sport entry
 * @param {object} trg — the text field that will be filled with the summary
 */
export async function printSportSummary(sport, trg) {
    let html = "<ul>";

    html += sport.description;

    if (sport.ownEquipment)
        html += `<li>🎽 ${sport.ownEquipment}`;

    if (sport.price)
        html += `<li>💶 ${sport.price}`;

    if (sport.contact)
        html += `<li>👤 ${sport.contact}`

    trg.html = html + "</ul>";
}

/**
 * @param {object[]} sorted
 * @param {string} nameSingularWPrefix
 * @param {string} namePlural
 * @param {boolean} filtered
 */
export function printDataSetSummary(sorted, nameSingularWPrefix, namePlural, filtered) {
    let cnt = sorted.length;
    $w("#textCountResults").text = (() => {
        switch (true) {
            case cnt == 0:
                return `Leider keine passenden ${namePlural}`;
            case cnt == 1:
                return `1 passende${nameSingularWPrefix}:`;
            case filtered:
                return `${cnt} passende ${namePlural}:`;
            default:
                return `Alle ${cnt} ${namePlural}:`;
        }
    })();
}

export const FormatTypesMonth = {
    narrow: 'narrow',
    short: 'short',
    long: 'long',
    numeric: 'numeric',
    twoDigit: '2-digit',
    none: null
};

export const FormatTypesWeekday = {
    narrow: 'narrow',
    short: 'short',
    long: 'long',
    none: null
};

export const FormatTypesNumeric = {
    numeric: 'numeric',
    twoDigit: '2-digit',
    none: null
};

/**
 * @param {object} start start date, shall be a Dat object or a string parseable to a Date
 * @param {object} end optional end date to print a range instead of a single date
 * @param {object} options options for the date formatting
 * @param {string|string[]} options.locales the locale(s) to use for formatting, defaults to "de-DE"
 * @param {FormatTypesWeekday} options.weekday the format of the weekday, defaults to "short"
 * @param {FormatTypesNumeric} options.day the format of the day, defaults to "2-digit"
 * @param {FormatTypesMonth} options.month the format of the month, defaults to "short"
 * @param {FormatTypesNumeric} options.year the format of the year, defaults to "numeric"
 * @param {FormatTypesNumeric} options.hour the format of the hour, defaults to "2-digit"
 * @param {FormatTypesNumeric} options.minute the format of the minute, defaults to "2-digit"
 * @param {FormatTypesNumeric} options.second the format of the second, defaults to "none"
 * @returns {string} — human readable string of the range
 */
export function dateRangeToString(
    start,
    end = null,
    {
        locales = "de-DE",
        weekday = FormatTypesWeekday.short,
        day = FormatTypesNumeric.twoDigit,
        month = FormatTypesMonth.short,
        year = FormatTypesNumeric.numeric,
        hour = FormatTypesNumeric.twoDigit,
        minute = FormatTypesNumeric.twoDigit,
        second = FormatTypesNumeric.none
    } = {}) {
    let res = "";
    if (start) {
        let df = { timeZone: "Europe/Berlin" };
        if (weekday != null) df.weekday = weekday;
        if (day != null) df.day = day;
        if (month != null) df.month = month;
        if (year != null) df.year = year;
        if (hour != null) df.hour = hour;
        if (minute != null) df.minute = minute;
        if (second != null) df.second = second;
        const dStart = toLocal(start);
        res += dStart.toLocaleString(locales, df);
        if (end) {
            const dEnd = toLocal(end);
            const sameDay = dStart.getDate() == dEnd.getDate() && dStart.getMonth() == dEnd.getMonth() && dStart.getFullYear() == dEnd.getFullYear();
            const sameTime = dStart.getHours() == dEnd.getHours() && dStart.getMinutes() == dEnd.getMinutes() && dStart.getSeconds() == dEnd.getSeconds();
            const showDay = weekday != null || day != null || month != null || year != null;
            const showTime = hour != null || minute != null || second != null;
            if ((showDay && !sameDay) || (showTime && !sameTime)) {
                res += " - ";
                if (sameDay) res += dEnd.toLocaleString(locales, Object.fromEntries(Object.entries(df).filter(([k]) => !['weekday', 'day', 'month', 'year'].includes(k))));
                else res += dEnd.toLocaleString(locales, df);
            }
        }
    }
    return res;
}

export function stringToDateRange(str) {
    const parseDateTime = (text) => {
        const months = ["jan", "feb", "mär", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];
        for (let month = 0; month < 12; ++month) {
            if (text.toLowerCase().includes(months[month])) {
                const date = parseInt(text.slice(text.indexOf(",") + 1).trim(), 10);
                let year = parseInt(text.slice(text.lastIndexOf(" ") + 1), 10);
                if (year >= 0 && year <= 40) year += 2000;
                else if (year >= 0 && year <= 99) year += 1900;
                if (year >= 1900 && year <= 2100 && date >= 0 && date <= 31) return new Date(Date.UTC(year, month, date));
                return null;
            }
        }
        return null;
    };

    const dateTimeParts = str.split("-");
    let start = dateTimeParts.length == 0 ? null : parseDateTime(dateTimeParts[0].trim());
    let end = dateTimeParts.length <= 1 ? start : parseDateTime(dateTimeParts[1].trim());
    return [start, end];
}

/**
 * @param {object} eventDate — An item of the Event Dates dataset
 * @returns {Array<object>} — all single date-ranges found in the event-date in form {start[, end]}
 */
export function listAllRanges(eventDate) {
    let res = [];
    if (!eventDate.start) return res;
    const start = new Date(eventDate.start);
    const end = new Date(eventDate.end || start);

    const rct = eventDate.recurrenceType;
    const itv = parseInt(eventDate.recurrenceInterval) || 1;
    const mr = eventDate.monthlyRepetition || "weekday";
    let weekdays = eventDate.recurrenceDays;
    if (!weekdays || weekdays.length == 0) weekdays = [WEAKDAY_NAMES[start.getDay()]]; // if no weekday specified, assume only the week day that the start date has

    let duration = end.getTime() - start.getTime();
    if (itv > 0) {
        // duration shall only contain the *time* difference between end and start
        let e = new Date(end);
        e.setFullYear(start.getFullYear(), start.getMonth(), start.getDate());
        duration = e.getTime() - start.getTime();
        if (duration < 0) duration += 24 * 3600 * 1000;
    }

    let cur = new Date(start);
    let count = 0;
    while (count < 1000) { // safety measure against dead loops
        ++count;
        if (cur > end) return res; // end reached
        if ((rct != "weekly" || weekdays.includes(WEAKDAY_NAMES[cur.getDay()])) &&
            (rct != "monthly" || (mr == "weekday" ? cur.getDay() == start.getDay() : cur.getDate() == start.getDate())))
            res.push({ start: new Date(cur), end: duration > 0 ? new Date(cur.getTime() + duration) : null });
        if (itv <= 0) return res; // no repetition, one-time event
        switch (rct) {
            case "daily":
                cur.setDate(cur.getDate() + itv);
                break;
            case "weekly":
                // check each day, but respect itv after having processed all weekdays
                cur.setDate(cur.getDate() + 1);
                if (cur.getDay() === start.getDay()) cur.setDate(cur.getDate() + (itv - 1) * 7);
                break;
            case "monthly":
                switch (mr) {
                    case "weekday": { // like every second Monday of the month, based on the weekday of the start date
                        cur.setMonth(cur.getMonth() + itv, 1);
                        cur.setDate(1 + (start.getDay() - cur.getDay() + 7) % 7 + (Math.ceil(start.getDate() / 7) - 1) * 7);
                        // if the calculated day does not exist in this month (like 5th Monday), it will be skipped during the next iteration
                        if (cur.getMonth() != (start.getMonth() + count * itv) % 12) cur.setDate(0);
                        break;
                    }
                    case "dayOfMonth": { // like every 15th of the month, based on the day of the month of the start date
                        const targetDay = start.getDate();
                        cur.setMonth(cur.getMonth() + itv, targetDay);
                        // if the day does not exist in this month (like 30th in February), it will be skipped during the next iteration
                        if (cur.getDate() != targetDay) cur.setDate(0);
                        break;
                    }
                }
                break;
            default:
                return res; // no iteration at all
        }
    }
    console.log(`Stopped after ${count} iterations, didn't reach ${end} from ${start}, got to ${cur}`);
    return res;
}

/**
 * @param {object} eventDate — An item of the Event Dates dataset
 * @returns {string} — human readable string describing the event-date as short as possible
 */
export function printRanges(eventDate) {
    const ranges = listAllRanges(eventDate);
    if (ranges.length == 0) return ""; // no date at all
    const first = ranges[0];
    if (ranges.length == 1) return dateRangeToString(first.start, first.end); // no iteration at all
    const last = ranges[ranges.length - 1];

    const rct = eventDate.recurrenceType;
    const itv = parseInt(eventDate.recurrenceInterval) || 1;
    const mr = eventDate.monthlyRepetition || "weekday";
    let weekdays = eventDate.recurrenceDays;
    if (!weekdays || weekdays.length == 0) weekdays = [WEAKDAY_NAMES[first.start.getDay()]]; // if no weekday specified, assume only the week day that the start date has
    let res = "Ab ";

    let sameYear = first.start.getFullYear() == last.end.getFullYear();
    let sameMonth = sameYear && first.start.getMonth() == last.end.getMonth();
    res += dateRangeToString(first.start, first.end, {
        year: sameYear ? FormatTypesNumeric.none : FormatTypesNumeric.numeric,
        month: sameMonth ? FormatTypesMonth.none : FormatTypesMonth.long,
        weekday: rct == "weekly" ? null : FormatTypesWeekday.long,
        hour: null,
        minute: null
    });

    const occNames = ["ersten", "zweiten", "dritten", "vierten", "fünften"];
    res += ` jeden `;

    switch (rct) {
        case "daily":
            res += itv == 1 ? "" : `${occNames[itv - 1] || itv + "."} `;
            res += "Tag";
            break;
        case "weekly":
            res += itv == 1 ? "" : `${occNames[itv - 1] || itv + "."} `;
            weekdays.forEach((wd, i) => { res += `${i == 0 ? " " : i == weekdays.length - 1 ? " und " : ", "}${WEAKDAY_NAMES_HR[WEAKDAY_NAMES.indexOf(wd)]}` });
            break;
        case "monthly":
            switch (mr) {
                case "weekday": {
                    res += occNames[Math.ceil(first.start.getDate() / 7) - 1];
                    res += " ";
                    res += WEAKDAY_NAMES_HR[first.start.getDay()];
                    res += itv == 1 ? " im Monat" : ` in jedem ${occNames[itv - 1] || itv + "."} Monat`;
                    break;
                }
                case "dayOfMonth": {
                    res += first.start.getDate();
                    res += ". ";
                    res += itv == 1 ? "des Monats" : `jeden ${occNames[itv - 1] || itv + "."} Monats`;
                    if (first.start.getDate() > 28) res += " (soweit vorhanden)";
                    break;
                }
            }
            break;
    }
    res += " bis zum ";
    res += dateRangeToString(last.start, last.end, {
        year: FormatTypesNumeric.numeric,
        month: FormatTypesMonth.long,
        weekday: rct == "weekly" ? null : FormatTypesWeekday.long,
    });
    res += " Uhr";
    return res;
}

const WEAKDAY_NAMES = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const WEAKDAY_NAMES_HR = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export function generateICS(events) {
    const pad = n => String(n).padStart(2, '0');
    const formatDate = date => date.getUTCFullYear() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) + 'T' +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) + 'Z';

    let lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//fsg-alfdorf.de//Events//EN"
    ];

    events.forEach(event => {
        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id || Date.now()}`,
            `DTSTAMP:${formatDate(new Date())}`,
            `DTSTART:${formatDate(event.start)}`,
            `DTEND:${formatDate(event.end)}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${event.description || ""}`,
            `LOCATION:${event.adress?.formatted || ""}`,
            "END:VEVENT"
        );
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
}

export function filterAndSortEvents(filterYouth) {
    let filtered = false;
    let q = wixData.query("events");

    if (filterYouth) q = q.eq("youth", true); // does not count as filtered

    if ($w("#checkboxNoReservation").checked) {
        filtered = true;
        q = q.eq("onGround", true);
    }

    const showPast = $w("#checkboxAlsoPast").checked;

    if ($w("#checkboxNoRegistration").checked) {
        filtered = true;
        q = q.isEmpty("registration");
    }

    if ($w("#checkboxNoPrice").checked) {
        filtered = true;
        q = q.isEmpty("price");
    }

    const type = $w("#dropdownType").value;
    switch (type) {
        case "Alle":
            break;
        case "Sport-Event":
            filtered = true;
            q = q.hasSome("type", [type, "Sport-Turnier"]);
            break;
        default:
            if (type) {
                filtered = true;
                q = q.hasSome("type", [type]);
            }
    }

    q.find().then((results) => {
        let res = results.items;
        if (!showPast) {
            const now = new Date();
            res = res.filter(v => {
                const firstStart = v.dates && v.dates.length > 0 ? new Date(v.dates[0].start) : null;
                return firstStart && firstStart >= now;
            });
        }
        const sorted = res.sort((a, b) => {
            const aMin = a.dates && a.dates.length > 0 ? Math.min(...a.dates.map(d => new Date(d.start))) : Infinity;
            const bMin = b.dates && b.dates.length > 0 ? Math.min(...b.dates.map(d => new Date(d.start))) : Infinity;
            return aMin - bMin;
        });
        $w("#repeaterResults").data = sorted;
        printDataSetSummary(sorted, "r Event", "Events", filtered);
    }).catch((err) => console.error(`Cannot filter and sort data set:`, err));
}

/**
 * @param {boolean} onGround
 * @param {object} address
 * @returns string
 */
export function insertLocation(html, onGround, address) {
    if (address) {
        let a = address.formatted;
        if (onGround)
            html += `<li><div>🏠 ${a}</div>`;
        else
            html += `<li><div><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}">🏠 ${a}</a></div>`;
    } else if (onGround)
        html += `<li><div>🏠 Auf unserem Gelände</div>`;
    return html;
}

/**
 * @param {string} contact
 * @param {string} mail
 * @param {string} phone
 * @returns string
 */
export function insertContact(html, contact, mail, phone) {
    if (contact) {
        html += `<li><div>👤 ${contact}`;
        if (mail) html += `<a href="mailto:${mail}"> (${mail})</a>`
        if (phone) html += `<a href="tel:${phone.replace(/\D/g, "")}"> (${phone})</a>`
        html += "</div>";
    }
    return html;
}

export function debugStr(dt) {
    return dt ? toLocal(dt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "null";
}

/**
 * @param {Date}   localDate
 * @returns {Date}
 */
export function toUTC(localDate) {
    const dt = new Date(localDate);
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
}

/**
 * @param {object} utcDate shall be a Date object or a string parseable to a Date
 * @returns {Date}
 */
export function toLocal(utcDate) {
    const dt = new Date(utcDate);
    return new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
}

export function incUTCDate(date, delta) {
    date.setUTCDate(date.getUTCDate() + delta);
    return date;
}

/**
 * Returns number of nights between the two dates.
 * @param {any}   dateFrom
 * @param {any}   dateTo
 * @returns {Number}
 */
export function nightsBetween(dateFrom, dateTo) {
    if (dateFrom && dateTo) {
        const d1 = new Date(dateFrom);
        const d2 = new Date(dateTo);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    } else return 0;
}

function testDateTimeToString() {
    const testDate = new Date(2026, 3, 9, 8, 15);
    const testDateSameDay = new Date(2026, 3, 9, 14, 30);
    const testDateSameTime = new Date(2026, 4, 12, 8, 15);
    const testDateOther = new Date(2026, 4, 12, 14, 30);
    const optOnlyTime = { year: null, weekday: null, month: null, day: null };
    const optOnlyDay = { hour: null, minute: null, second: null };
    const optDayAndTime = { year: null, weekday: null };
    const optDayAndTimeShort = { year: FormatTypesNumeric.numeric, weekday: FormatTypesWeekday.narrow, month: FormatTypesMonth.numeric, day: FormatTypesNumeric.numeric, hour: FormatTypesNumeric.numeric, minute: FormatTypesNumeric.numeric };

    console.log("One day", dateRangeToString(testDate));
    console.log("One day only day", dateRangeToString(testDate, null, optOnlyDay));
    console.log("One day only time", dateRangeToString(testDate, null, optOnlyTime));
    console.log("One day day+time", dateRangeToString(testDate, null, optDayAndTime));
    console.log("One day day+time short", dateRangeToString(testDate, null, optDayAndTimeShort));

    console.log("Same date", dateRangeToString(testDate, testDate));
    console.log("Same date only day", dateRangeToString(testDate, testDate, optOnlyDay));
    console.log("Same date only time", dateRangeToString(testDate, testDate, optOnlyTime));
    console.log("Same date day+time", dateRangeToString(testDate, testDate, optDayAndTime));
    console.log("Same date day+time short", dateRangeToString(testDate, testDate, optDayAndTimeShort));

    console.log("Same day", dateRangeToString(testDate, testDateSameDay));
    console.log("Same day only day", dateRangeToString(testDate, testDateSameDay, optOnlyDay));
    console.log("Same day only time", dateRangeToString(testDate, testDateSameDay, optOnlyTime));
    console.log("Same day day+time", dateRangeToString(testDate, testDateSameDay, optDayAndTime));
    console.log("Same day day+time short", dateRangeToString(testDate, testDateSameDay, optDayAndTimeShort));

    console.log("Same time", dateRangeToString(testDate, testDateSameTime));
    console.log("Same time only day", dateRangeToString(testDate, testDateSameTime, optOnlyDay));
    console.log("Same time only time", dateRangeToString(testDate, testDateSameTime, optOnlyTime));
    console.log("Same time day+time", dateRangeToString(testDate, testDateSameTime, optDayAndTime));
    console.log("Same time day+time short", dateRangeToString(testDate, testDateSameTime, optDayAndTimeShort));
}

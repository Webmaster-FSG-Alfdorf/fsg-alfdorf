import wixData from 'wix-data';

/**
 * @param {string} id — the id of a event entry
 * @param {object} trg — the text field that will be filled with the summary
 */
export async function printEventSummary(id, trg) {
    // need to query data again and include eventDates collection references
    let event = (await wixData.query("events").eq("_id", id).include("dates").find()).items[0];

    let html = "<ul>";

    if (event.address)
        html += `<li>🏠 ${event.address.formatted}`;

    if (event.price)
        html += `<li>💶 ${event.price}`;

    if (event.responsible)
        html += `<li>👤 ${event.responsible}`

    if (event.registration)
        html += `<li>📝 Vornameldung bis ${dateRangeToString({start: new Date(event.registration)})}`;

    let dates = event.dates || [];
    if (dates.length > 0) {
        html += "<li>📅";
        dates.forEach((ed, i) => {
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

/**
 * @param {object} dateRange — a date-range with {start, [end]}
 * @returns {string} — human readable string of the range
 */
export function dateRangeToString(dateRange, { locales = "de-DE", weekday = "short", day = "2-digit", month = "short", year = "numeric", hour = "2-digit", minute = "2-digit" } = {}) {
    let res = "";
    if (dateRange.start) {
        let df = { timeZone: "Europe/Berlin" };
        if (weekday != null) df.weekday = weekday;
        if (day != null) df.day = day;
        if (month != null) df.month = month;
        if (year != null) df.year = year;
        if (hour != null) df.hour = hour;
        if (minute != null) df.minute = minute;
        res += toLocal(dateRange.start).toLocaleString(locales, df);
        if (dateRange.end) {
            res += " - ";
            res += toLocal(dateRange.end).toLocaleString(locales, df);
            //TODO cut duplicate date part
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
    let start = new Date(eventDate.start);
    let end = new Date(eventDate.end || start);
    let itv = eventDate.recurrenceInterval;
    let rct = eventDate.recurrenceType;

    // contains only the time difference between end and start
    let duration = end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds() - start.getHours() * 3600 - start.getMinutes() * 60 - start.getSeconds();
    // if no recurrence, and end - start differ by more then a day, this is a multi-day event
    if (rct != "daily" && rct != "weekly" && rct != "monthly") duration = (end.getTime() - start.getTime()) / 1000;

    let cur = new Date(start);
    let count = 0;
    while (count < 1000) { // safety measure against dead loops
        ++count;
        if (cur > end) return res; // end reached
        if (rct != "weekly" || eventDate.recurrenceDays.includes(WEAKDAY_NAMES[cur.getDay()]))
            res.push({ start: new Date(cur), end: duration > 0 ? new Date(cur.getTime() + duration * 1000) : null });
        if (itv <= 0) return res; // no / invalid interval (in which case we now may at least have one push)
        switch (rct) {
        case "daily":
            cur.setDate(cur.getDate() + itv);
            break;
        case "weekly":
            // check each day, but respect itv after having processed all weekdays
            cur.setDate(cur.getDate() + 1 + (count % 7 == 0 ? (itv - 1) * 7 : 0));
            break;
        case "monthly":
            cur.setMonth(cur.getMonth() + itv);
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
    let ranges = listAllRanges(eventDate);
    if (ranges.length == 0) return ""; // no date at all
    if (ranges.length == 1) return dateRangeToString(ranges[0]); // no iteration at all

    let rct = eventDate.recurrenceType;
    let n = rct == "weekly" ? "" : "n"; // to correctly gender "Tag" and "Monat"
    let res = "Ab ";

    //FIXME or remove?
    let rStart = ranges[0].start;
    let rEnd = ranges[ranges.length - 1].end;
    let sameYear = rStart && rEnd && rStart.year == rEnd.year;
    let sameMonth = sameYear && rStart.month == rEnd.month;

    res += dateRangeToString(ranges[0], { year: sameYear ? null : "numeric", month: sameMonth ? null : "short" });
    res += ` jede${n} `;
    switch (eventDate.recurrenceInterval) {
    case 0:
    case 1:
        break;
    case 2:
        res += `zweite${n} `;
        break;
    case 3:
        res += `dritte${n} `;
        break;
    case 4:
        res += `vierte${n} `;
        break;
    default:
        res += `${eventDate.recurrenceInterval}. `;
    }
    switch (rct) {
    case "daily":
        res += "Tag";
        break;
    case "weekly":
        res += "Woche";
        break;
    case "monthly":
        res += "Monat";
        break;
    }
    if (rct == "weekly" && eventDate.recurrenceDays.length != 7) {
        eventDate.recurrenceDays.forEach((wd, i) => { res += `${i == 0 ? " " : " , "}${WEAKDAY_NAMES_HR[WEAKDAY_NAMES.indexOf(wd)]}` });
    }
    res += " bis ";
    res += dateRangeToString(ranges[ranges.length - 1]);
    return res;
}

const WEAKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEAKDAY_NAMES_HR = ["Sonntags", "Montags", "Dienstags", "Mittwochs", "Donnerstags", "Freitags", "Samstags"];

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
    let q = wixData.query("events").include("dates");

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
    case "Sportveranstaltung":
        filtered = true;
        q = q.hasSome("type", [type, "Sportturnier"]);
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
                const dates = v.dates || [];
                const firstStart = dates.length ? new Date(dates[0].start) : null;
                return firstStart && firstStart >= now;
            });
        }
        const sorted = res.sort((a, b) => {
            const aDates = a.dates || [];
            const bDates = b.dates || [];
            const aMin = aDates.length ? Math.min(...aDates.map(d => new Date(d.start))) : Infinity;
            const bMin = bDates.length ? Math.min(...bDates.map(d => new Date(d.start))) : Infinity;
            return aMin - bMin;
        });
        $w("#repeaterResults").data = sorted;
        printDataSetSummary(sorted, "r Event", "Events", filtered);
    }).catch((err) => console.log(`Cannot filter and sort data set:`, err));
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
        html += `<li><div>🏠 Auf dem Gelände der FSG Alfdorf e.V.</div>`;
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
 * @param {Date}   utcDate
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
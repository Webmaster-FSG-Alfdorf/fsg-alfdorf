import { calculateReservationPrice } from 'backend/common.jsw';

export async function formatReservationPrice(currentDate) {
    const cls = " class=\"font_8 wixui-rich-text__text\" style=\"padding: 8px\"";
    const lodging = $w("#inputLodging").value.split("|");
    const depositGiven = $w("#checkboxGroupDeposit").value
    const res = await calculateReservationPrice(lodging[0], currentDate[0], currentDate[1], +$w("#inputAdults").value, +$w("#inputChildren").value);
    let html = `<table><thead><tr>`;
    html += `<th${cls}>Leistung</th>`;
    html += `<th${cls}>Anzahl Erw.</th>`;
    html += `<th${cls}>Nächte</th>`;
    html += `<th${cls}>Einzelpreis</th>`;
    html += `<th${cls}>Gesamt</th>`;
    html += "</tr></thead><tbody>";
    let sum = 0;
    let sumDeposit = 0;
    let sumReturn = 0;
    res.forEach(line => {
        html += "<tr>";
        html += `<td${cls}">${line.title}</td>`;
        if (line.cntAdults)
            html += `<td${cls}">* ${line.cntAdults}</td>`;
        else
            html += "<td></td>";
        if (line.cntNights)
            html += `<td${cls}">* ${line.cntNights}</td>`;
        else
            html += "<td></td>";
        const price = line.price * (line.cntAdults || 1) * (line.cntNights || 1);
        if (line.depositName) {
            if (Array.isArray(depositGiven) && depositGiven.includes(line.depositName)) {
                sumReturn += price;
                html += `<td${cls}">(-${line.price.toFixed(2)} €)</td>`;
                html += `<td${cls}">(-${price.toFixed(2)} €)</td>`;
            } else {
                sumDeposit += price;
                html += `<td${cls}">(${line.price.toFixed(2)} €)</td>`;
                html += `<td${cls}">(${price.toFixed(2)} €)</td>`;
            }
        } else {
            html += `<td${cls}">${line.price.toFixed(2)} €</td>`;
            html += `<td${cls}">${price.toFixed(2)} €</td>`;
            sum += price;
        }
        html += "</tr>";
    });
    html += "<tr>";
    html += `<td${cls}"><b>Summe</b></td>`;
    html += "<td></td>";
    html += "<td></td>";
    html += "<td></td>";
    html += `<td${cls}"><b>${sum.toFixed(2)} €</b></td>`;
    html += "</tr>";
    if (sumDeposit > 0) {
        html += "<tr>";
        html += `<td${cls}"><b>+ Kaution/Pfand</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${cls}"><b>(${sumDeposit.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }
    if (sumReturn > 0) {
        html += "<tr>";
        html += `<td${cls}"><b>- Kaution/Pfand zurück</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${cls}"><b>(-${sumReturn.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
}


import { calculateReservationPrice } from 'backend/common.jsw';

export async function formatReservationPrice(currentDate, lodgingID, cntAdults, depositGiven = [], paidSum = NaN) { //FIXME replace with generateHTMLTable
    const cls0 = " class=\"font_7\" style=\"padding: 8px; text-align: left\"";
    const cls1 = " class=\"font_7\" style=\"padding: 8px; text-align: center\"";
    const clsN = " class=\"font_7\" style=\"padding: 8px; text-align: right\"";
    const res = await calculateReservationPrice(lodgingID, currentDate[0], currentDate[1], cntAdults, depositGiven);
    let html = `<table><thead><tr>`;
    html += `<th${cls0}>Leistung</th>`;
    html += `<th${cls1}>Anzahl Erw.</th>`;
    html += `<th${cls1}>Nächte</th>`;
    html += `<th${clsN}>Einzelpreis</th>`;
    html += `<th${clsN}>Gesamt</th>`;
    html += "</tr></thead><tbody>";
    let sum = 0;
    let sumDeposit = 0;
    let sumReturn = 0;
    res.forEach(line => {
        html += "<tr>";
        html += `<td${cls0}">${line.title}</td>`;
        if (line.cntAdults)
            html += `<td${cls1}">* ${line.cntAdults}</td>`;
        else
            html += "<td></td>";
        if (line.cntNights)
            html += `<td${cls1}">* ${line.cntNights}</td>`;
        else
            html += "<td></td>";
        const price = line.price * (line.cntAdults || 1) * (line.cntNights || 1);
        //TODO also list deposits that are not part of this lodging but still issued
        if (line.depositName) {
            if (depositGiven.includes(line.depositName)) {
                sumReturn += price;
                html += `<td${clsN}">(-${line.price.toFixed(2)} €)</td>`;
                html += `<td${clsN}">(-${price.toFixed(2)} €)</td>`;
            } else {
                sumDeposit += price;
                html += `<td${clsN}">(${line.price.toFixed(2)} €)</td>`;
                html += `<td${clsN}">(${price.toFixed(2)} €)</td>`;
            }
        } else {
            html += `<td${clsN}">${line.price.toFixed(2)} €</td>`;
            html += `<td${clsN}">${price.toFixed(2)} €</td>`;
            sum += price;
        }
        html += "</tr>";
    });

    html += "<tr>";
    html += `<td${cls0}"><b>Summe</b></td>`;
    html += "<td></td>";
    html += "<td></td>";
    html += "<td></td>";
    html += `<td${clsN}"><b>${sum.toFixed(2)} €</b></td>`;
    html += "</tr>";

    if (paidSum) {
        html += "<tr>";
        html += `<td${cls0}">Bereits bezahlt</td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${clsN}">${paidSum.toFixed(2)} €</td>`;
        html += "</tr>";
        html += "<tr>";

        if (paidSum != sum) {
            html += `<td${cls0}"><b>${paidSum <= sum ? "Noch zu bezahlen" : "- Rückzahlung"}</b></td>`;
            html += "<td></td>";
            html += "<td></td>";
            html += "<td></td>";
            html += `<td${clsN}"><b>${(sum - paidSum).toFixed(2)} €</b></td>`;
            html += "</tr>";
        }
    }

    if (sumDeposit > 0) {
        html += "<tr>";
        html += `<td${cls0}"><b>+ Kaution/Pfand</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${clsN}"><b>(${sumDeposit.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }

    if (sumReturn > 0) {
        html += "<tr>";
        html += `<td${cls0}"><b>- Kaution/Pfand zurück</b></td>`;
        html += "<td></td>";
        html += "<td></td>";
        html += "<td></td>";
        html += `<td${clsN}"><b>(-${sumReturn.toFixed(2)} €)</b></td>`;
        html += "</tr>";
    }

    html += "</tbody></table>";
    return html;
}


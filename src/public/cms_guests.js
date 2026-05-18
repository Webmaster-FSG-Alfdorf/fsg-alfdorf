import wixData from 'wix-data';
import { CmsEditor, FieldType, FilterType, FilterCombine, SafeHTML } from 'public/cms_edit';
import { ROLES, dateRangeToString, FormatTypesMonth, FormatTypesNumeric, nightsBetween, incUTCDate } from 'public/cms.js';
import { getOccupations, isDateOccupied, generateLodgingName, getAllLodgingNames, generateCostsTable } from 'backend/common.jsw';

export function initGuestsEditor(editMode, cfg) {
    const curUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));
    const maxUTC = new Date(curUTC);
    maxUTC.setUTCMonth(maxUTC.getUTCMonth() + 6);

    wixData.query("lodgings").ascending("order").find().then(async (results) => {
        let options = [];
        let batchRequests = [];
        // main lodgings go first
        results.items.forEach((lodging) => {
            options.push({ label: lodging.title, value: `${lodging.lodgingID}|0` });
        });
        // then all sub lodgings
        for (const lodging of results.items) if (lodging.capacity > 1)
            for (let index = 1; index <= lodging.capacity; index++) batchRequests.push({
                lodging: lodging.lodgingID,
                lodgingSub: index
            });
        if (batchRequests.length > 0) {
            const names = await getAllLodgingNames(batchRequests);
            options.push(...batchRequests.map((req, i) => ({ label: names[i], value: `${req.lodging}|${req.lodgingSub}` })));
        }
        $w("#inputLodging").options = options;
        const filterLodging = $w("#filterLodging");
        if (filterLodging && "options" in filterLodging) filterLodging.options = [{ label: "(Alle)", value: "*" }, ...options];
    });

    let editor;
    editor = new CmsEditor({
        editMode,
        cmsName: "guestReservations",
        dataSetName: "datasetReservations",
        viewModeURL: "guest",

        itemSelector: $w("#itemSelector"),
        textResponse: $w("#textResponse"),
        buttonSave: $w("#buttonSave"),
        buttonRevert: $w("#buttonRevert"),
        buttonNew: $w("#buttonNew"),
        buttonRemove: $w("#buttonRemove"),
        buttonPrev: $w("#buttonPrev"),
        buttonNext: $w("#buttonNext"),
        buttonView: $w("#buttonView"),

        messages: {
            itemSaved: { emailId: "ReservationUpdated", automaticMail: !editMode, customizableMail: editMode },
            itemRemoved: { emailId: "ReservationRemoved", customizableMail: editMode },
        },

        translatedMessages: {
            itemName: "Reservierung",
            itemNamePlural: "Reservierungen",
            itemRemoved: "Die Reservierungsanfrage wurde storniert.",
            repeaterSummaries: {
                one: "1 passende {itemName}",
            },
            messageIds: {
                itemSaved: "✔ Vielen Dank! Ihre Anfrage wurde gesendet",
                itemSavedDetails: "{summary}",
                itemSaveError: "✖ Anfrage konnte nicht gesendet werden.",
            }
        },

        generateTitle: (item) => {
            if (item && (item.dateFrom || item.dateTo || item.lastName || item.lodging)) {
                const startDate = dateRangeToString(item.dateFrom, null, { month: FormatTypesMonth.short, weekday: null, hour: null, minute: null });
                const nights = `+${nightsBetween(item.dateFrom, item.dateTo)}N`;
                return `${startDate} ${nights} ${item.lastName} ${item.lodging ?? ""} ${item.lodgingSub > 0 ? item.lodgingSub : ""}`.trim();
            } else
                return "(Neue Reservierung)";
        },

        onGenerateEmailOptions: async (item) => ({
            ...editor.convertToEmailOptions("a", editor.getSummary($w, item)),
            ...editor.convertToEmailOptions("b", await generateCostsTable(item))
        }),

        onBeforeSave: async (item) => {
            const msg = editor.originalItem && item && editor.originalItem.state != item.state ? {
                "Anfrage": "Der Status wurde zurückgesetzt auf eine unverbindliche Anfrage.",
                "Reserviert": "Ihre Anfrage wurde akzeptiert.",
                "Bezahlt": "Ihre Reservierung wurde als bezahlt markiert.",
                "Abgelehnt": "Ihre Anfrage wurde abgelehnt."
            }[item.state] || "" :
                "";
            editor.translatedMessages.messageIds.itemSavedDetails = `${msg}${msg ? "<br>" : ""}{diff}`;
            return true;
        },

        cmsSchema: {
            "#inputState": {
                field: "state",
                label: "Status",
                type: FieldType.STRING,
                required: true,
            },
            "#inputLodging": {
                fields: ["lodging", "lodgingSub"],
                label: "Unterkunft",
                type: FieldType.CUSTOM,
                required: true,
                default: "GW|0", //TODO
                onParseCustomUserInput: (value) => value ? value.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)) : ["", 0],
                onFormatCustomValue: (values) => Array.isArray(values) && values.length == 2 ? `${values[0]}|${values[1] ?? 0}` : "",
                onPrintValue: (item) => editor.lodgingNames[item?.lodging + "|" + item?.lodgingSub] ?? "",
                onCustomValidation: async (item) => await validateLodging(editor, item),
                onChanged: async (item) => {
                    if (item) editor.lodgingNames[item.lodging + "|" + item.lodgingSub] = await generateLodgingName(item);
                    await updateCostsTable(editor, item);
                }
            },
            "#inputDate": {
                fields: ["dateFrom", "dateTo"],
                label: "Datum der An- und Abreise",
                type: FieldType.DATE_RANGE,
                datePicker: "#htmlDate",
                required: true,
                minAllowed: editMode ? incUTCDate(curUTC, -31) : curUTC,
                maxAllowed: maxUTC,
                onDisplayedDateChanged: async () => await validateLodging(editor, editor.ds.getCurrentItem()),
                onChanged: async (item) => await updateCostsTable(editor, item),
                onPrintValue: (item) => {
                    if (!item || !item.dateFrom || !item.dateTo) return "";
                    const haveAT = new Date(item.dateFrom).getHours() != 2;
                    const haveDT = new Date(item.dateTo).getHours() != 23;
                    return dateRangeToString(item.dateFrom, item.dateTo, {
                        hour: null,
                        minute: null,
                        start: { hour: haveAT ? FormatTypesNumeric.twoDigit : null, minute: haveAT ? FormatTypesNumeric.twoDigit : null },
                        end: { hour: haveDT ? FormatTypesNumeric.twoDigit : null, minute: haveDT ? FormatTypesNumeric.twoDigit : null }
                    });
                },
            },
            "#inputArrivalTime": {
                field: "dateFrom",
                label: "Ankunft ab",
                default: "2", //TODO
                required: true,
                type: FieldType.HOURS_OF_DATE,
                collectSummary: false,
                collectDiff: false
            },
            "#inputDepartureTime": {
                field: "dateTo",
                label: "Abreise bis",
                default: "23", //TODO
                required: true,
                type: FieldType.HOURS_OF_DATE,
                collectSummary: false,
                collectDiff: false
            },
            "#inputAdults": {
                field: "cntAdults",
                label: "Anzahl Erwachsene",
                type: FieldType.NUMBER,
                required: true,
                onChanged: async (item) => await updateCostsTable(editor, item)
            },
            "#inputChildren": {
                field: "cntChildren",
                label: "Anzahl Kinder",
                type: FieldType.NUMBER,
                required: true,
            },
            "#inputFirstName": {
                field: "firstName",
                label: "Vorname",
                type: FieldType.STRING,
                summaryLabel: "Name",
                onPrintValue: (item) => item ? `${item.firstName} ${item.lastName}` : "",
            },
            "#inputLastName": {
                field: "lastName",
                label: "Nachname",
                required: true,
                type: FieldType.STRING,
                collectSummary: false,
                collectDiff: false
            },
            "#inputMail": {
                field: "email",
                label: "E-Mail-Adresse",
                type: FieldType.STRING_MAIL,
                required: true,
                linkButton: "#buttonSendMail",
                linkPrefix: "mailto:"
            },
            "#inputPhone": {
                field: "phoneNumber",
                label: "Telefonnummer",
                type: FieldType.STRING_PHONE,
                linkButton: "#buttonPhone",
                linkPrefix: "tel:"
            },
            "#inputAddress": {
                field: "address",
                label: "Adresse",
                type: FieldType.ADDRESS
            },
            "#inputNotes": {
                field: "notes",
                label: "Optionale Hinweise",
                type: FieldType.STRING
            },
            "#inputPrivacyPolicy": {
                field: "privacyPolicy",
                label: "Datenschutzerklärung",
                required: true,
                type: FieldType.BOOLEAN
            },
            "#captcha1": {
                label: "Captcha",
                required: true,
                type: FieldType.CAPTCHA,
                onEqualData: () => false,
                collectDiff: false,
                collectSummary: false
            },
            "#inputDeposit": {
                field: "deposit",
                label: "Pfand",
                type: FieldType.MULTI_SELECT,
                onChanged: async (item) => await updateCostsTable(editor, item)
            },
            "#inputPaidSum": {
                field: "paidSum",
                label: "Bereits gezahlt",
                type: FieldType.NUMBER,
                onChanged: async (item) => await updateCostsTable(editor, item),
                fractionDigits: 2,
                onPrintedValue: (res) => res + "€",
            },
            "#inputPaidSumup": {
                field: "paidSumup",
                label: "Sumup Referenz",
                type: FieldType.STRING,
                showToUser: false
            },
            "#inputComment": {
                field: "comment",
                label: "Interner Kommentar",
                type: FieldType.STRING,
                showToUser: false
            },
        },

        filterSortField: "_updatedDate",
        filterSortAscending: false,
        filterSchema: {
            "#filterSearch": {
                type: FilterType.CONTAINS,
                field: "searchField",
                skip: (val) => !val || !isNaN(Number(val)),
                value: (val) => val.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
            },
            "#filterSearch   numeric": {
                id: "#filterSearch",
                type: FilterType.EQ,
                combine: FilterCombine.OR,
                fields: ["cntAdults", "cntChildren", "paidSum", "lodgingSub"],
                skip: (val) => val === "" || val == null || isNaN(Number(val)),
                value: (val) => Number(val)
            },
            "#filterAlsoPast": {
                type: FilterType.GE,
                skip: (val) => val, // only apply if not checked
                value: incUTCDate(new Date(), 1),
                field: "dateTo",
            },
            "#filterStatus": {
                type: FilterType.EQ,
                field: "state"
            },
            "#filterLodging": {
                type: FilterType.EQ,
                combine: FilterCombine.PARALLEL_AND,
                value: (val) => val.split("|").map((v, i) => i == 0 ? v : Number(v ?? 0)),
                fields: ["lodging", "lodgingSub"],
            },
        },

        ...cfg
    });
    editor.lodgingNames = {};
    editor.init();
    editor.setupEditButton("#buttonEdit", ROLES.GUESTS_MANAGEMENT.slug, ROLES.GUESTS_MANAGEMENT.id, editor.getItem());

    return editor;
}

async function validateLodging(editor, item) {
    const cfg = editor.cmsSchema["#inputDate"];
    const toSend = {
        id: item._id,
        lodging: item.lodging,
        lodgingSub: item.lodgingSub,
        displayedYear: cfg.displayedYear,
        displayedMonth: cfg.displayedMonth,
    };
    console.log("validateLodging", toSend);
    if (cfg.lastSent != toSend) {
        cfg.lastSent = toSend;
        const occ = toSend.lodging && toSend.displayedYear != null && toSend.displayedMonth != null ?
            await getOccupations(
                toSend.lodging,
                toSend.lodgingSub,
                new Date(toSend.displayedYear, toSend.displayedMonth - 1, 21),
                new Date(toSend.displayedYear, toSend.displayedMonth + 1, 7),
                toSend.id
            ) :
            { capacity: 0, occupations: [] };
        if (toSend.lodgingSub > 0 && occ.capacity >= 1) {
            occ.occupations.forEach(day => { day.count = day.count >= occ.capacity ? 1 : 0; });
            occ.capacity = 1;
        }
        editor.postMessageToDatePicker(cfg, $w, occ);
    }

    if (!item.lodging) return "Bitte zuerst eine Unterkunft wählen.";
    const valRes = await isDateOccupied(item.lodging, item.lodgingSub, item.dateFrom, item.dateTo, true, item._id);
    console.log("onCustomValidation", { valRes, item });
    if (valRes.occupied) return (
        valRes.suggestedArrival ? `Belegt. Ankunft erst ab ${valRes.suggestedArrival} Uhr möglich.` :
            valRes.suggestedDeparture ? `Belegt. Abreise bis spätestens ${valRes.suggestedDeparture} Uhr nötig.` :
                `Der Zeitraum ist in dieser Unterkunft bereits belegt.`);

    return null;
}

async function updateCostsTable(editor, item) {
    console.log("updateCostsTable");
    $w("#textReservationPrice").html = editor.getString(
        "Leistung\t{@align=right:Anzahl Erw.}\t{@align=right:Nächte}\t{@align=right:Einzelpreis}\t{@align=right:Gesamt}\n{-costs}",
        item ?? {},
        { "costs": await generateCostsTable(item) },
        {}
    );
}

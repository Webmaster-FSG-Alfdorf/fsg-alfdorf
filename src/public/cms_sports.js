import { CmsEditor, FieldType, FilterType, FilterCombine, SafeHTML } from 'public/cms_edit';
import { ROLES } from "public/cms.js";

export function initSportsEditor(editMode, cfg) {
    const editor = new CmsEditor({
        editMode,
        cmsName: "sports",
        dataSetName: "datasetSports",
        viewModeURL: "sport",

        itemSelector: $w("#itemSelector"),
        textResponse: $w("#textResponse"),
        buttonSave: $w("#buttonSave"),
        buttonRevert: $w("#buttonRevert"),
        buttonNew: $w("#buttonNew"),
        buttonRemove: $w("#buttonRemove"),
        buttonPrev: $w("#buttonPrev"),
        buttonNext: $w("#buttonNext"),
        buttonView: $w("#buttonView"),

        translatedMessages: {
            itemName: "Sportangebot",
            itemNamePlural: "Sportangebote",
            repeaterSummaries: {
                one: "1 passendes {itemName}", //TODO untested
            },
        },

        generateTitle: (item) => item?.name,

        cmsSchema: {
            "#inputName": {
                field: "name",
                label: "Name",
                type: FieldType.STRING,
                required: true,
            },

            "#inputDescriptionShort": {
                field: "description",
                label: "Beschreibung",
                type: FieldType.STRING,
                required: true,
            },

            "#inputMainImage": {
                field: "mainImage",
                label: "Haupt-Bild",
                type: FieldType.IMAGE,
                required: true
            },

            "#inputGallery": {
                field: "gallery",
                label: "Bildersammlung",
                type: FieldType.IMAGES,
            },

            "#inputDescriptionFull": {
                field: "descriptionRich",
                label: "Beschreibung ausführlich",
                type: FieldType.RICH_TEXT,
            },

            "#inputAlltime": {
                field: "alltime",
                type: FieldType.STRING,
                label: "XXX",
            },

            "#inputOnGround": {
                field: "onGround",
                type: FieldType.BOOLEAN,
                label: "Auf dem Gelände?",
            },

            "#inputWeatherIndep": {
                field: "weatherIndep",
                type: FieldType.BOOLEAN,
                label: "Wetter unabhängig?",
                boolTrue: "Wetter unabhängig",
                boolFalse: "Nur bei gutem Wetter",
            },

            "#inputPrice": {
                field: "price",
                type: FieldType.STRING,
                label: "Preis",
            },

            "#inputEquipment": {
                field: "ownEquipment",
                type: FieldType.STRING,
                label: "Eigene Ausrüstung",
            },

            "#inputSeason": {
                field: "season",
                label: "Saison",
                options: { "main": "Sommersaison", "off": "Wintersaison" },
                onPrintValue: (item, values) => values[0]?.length == 2 ? "Sommer- und Wintersaison" : null,
                type: FieldType.TAGS,
                required: true,
            },

            "#inputAddress": {
                field: "address",
                type: FieldType.ADDRESS,
                label: "Addresse",
            },

            "#inputContact": {
                field: "contact",
                type: FieldType.STRING,
                label: "Kontakt",
            },

            "#inputContactMail": {
                field: "contactMail",
                type: FieldType.STRING_MAIL,
                label: "Kontakt E-Mail",
            },

            "#inputContactPhone": {
                field: "contactPhone",
                type: FieldType.STRING_PHONE,
                label: "Kontakt Telefon",
            },

            "#inputContactWhatsapp": {
                field: "whatsappGroup",
                type: FieldType.STRING,
                label: "WhatsApp-Gruppe",
            },

            "#inputContactWhatsappCode": {
                field: "whatsappCode",
                type: FieldType.STRING,
                label: "WhatsApp-Einladungscode",
                onPrintValue: (item, values) => values[0] ? new SafeHTML(`<a href="https://chat.whatsapp.com/${values[0]}">${values[0]}</a>`, values[0]) : null,
            },
        },

        filterSortField: "name",
        filterSchema: {
            "#filterSearch": {
                type: FilterType.CONTAINS,
                combine: FilterCombine.OR,
                fields: ["name", "description", "descriptionRich", "price", "ownEquipment", "address", "contact", "contactMail", "contactPhone", "whatsappGroup"],
                value: (val) => val ? val.toString().trim() : "",
            },
            "#checkboxOnGround": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "onGround"
            },
            "#checkboxWeatherIndep": {
                type: FilterType.EQ,
                skip: (val) => !val,
                field: "weatherIndep"
            },
            "#checkboxNoReservation": {
                type: FilterType.IS_EMPTY,  //FIXME doesnt seem to work
                field: "alltime"
            },
            "#checkboxNoPrice": {
                type: FilterType.IS_EMPTY,
                field: "price"
            },
            "#checkboxNoEquipment": {
                type: FilterType.IS_EMPTY,  //FIXME simple isEmpty check does not work here
                field: "ownEquipment"
            },
            "#dropdownSeason": {
                type: FilterType.HAS_SOME,
                skip: (val) => val == null || val === "all",
                field: "season"
            },
        },

        ...cfg
    });
    editor.init();
    editor.setupEditButton("#buttonEdit", ROLES.SPORTS_EDIT.slug, ROLES.SPORTS_EDIT.id, editor.getItem());
    return editor;
}

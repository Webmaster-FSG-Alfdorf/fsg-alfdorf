import { CmsEditor, FieldType, SafeHTML } from 'public/cms_edit';

$w.onReady(function () {
    const editor = new CmsEditor({
        editMode: false,
        cmsName: "sports",
        dataSetName: "sportsDataset", //TODO rename to datasetSports
        viewModeURL: "sport",

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
                onPrintValue: (item, values) => values[0].length == 2 ? "Sommer- und Wintersaison" : null,
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
        onReady: () => {
            $w("#textDescription").html = editor.getString(
                "{#inputDescriptionFull}\n"
                + "🎒\t{ownEquipment}\n"
                + "🪙\t{price}\n"
                + "📍\t{address}\n"
                + "👤\t{contact} ✉️{contactMail} 📞{contactPhone}\n"
                + "👤\t{contact}\t✉️{contactMail}\t📞{contactPhone}\n"
                + "📝\t{alltime}\n"
                + "🌦️\t{weatherIndep}\n"
                + "🍂\t{season}\n"
                + "{whatsappIcon}\t{whatsappCode}\n"
                + "📅\t{events}\n", //TODO events
                {
                    whatsappIcon: new SafeHTML('<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" alt="WhatsApp>', "WhatsApp"),
                }, {});
        }
    });

    editor.init();
    editor.setupEditButton("#buttonEdit", "sports-edit", "3ef4ffaa-79b2-440c-9872-802287e9407b", editor.getItem());
});
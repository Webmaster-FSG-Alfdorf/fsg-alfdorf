import { CmsEditor, FieldType, FilterType, FilterCombine } from 'public/cms_edit.js';

$w.onReady(function () {
    $w("#datasetSports").onReady(async () => {
        console.log("#datasetSports onReady");

        const editor = new CmsEditor({
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
            },

            generateTitle: (item) => item?.name,

            cmsSchema: {
                "#inputName": {
                    field: "name",
                    type: FieldType.STRING,
                    required: true,
                },

                "#inputDescriptionShort": {
                    field: "description",
                    type: FieldType.STRING,
                    required: true
                },

                "#inputMainImage": {
                    field: "mainImage",
                    type: FieldType.IMAGE,
                    required: true
                },

                "#inputGallery": {
                    field: "gallery",
                    type: FieldType.IMAGES
                },

                "#inputDescriptionFull": {
                    field: "descriptionRich",
                    label: "Beschreibung ausführlich",
                    type: FieldType.RICH_TEXT
                },

                "#inputAlltime": {
                    field: "alltime",
                    type: FieldType.STRING
                },

                "#inputOnGround": {
                    field: "onGround",
                    type: FieldType.BOOLEAN
                },

                "#inputWeatherIndep": {
                    field: "weatherIndep",
                    type: FieldType.BOOLEAN
                },

                "#inputPrice": {
                    field: "price",
                    type: FieldType.STRING
                },

                "#inputEquipment": {
                    field: "ownEquipment",
                    type: FieldType.STRING
                },

                "#inputSeason": {
                    field: "season",
                    type: FieldType.TAGS,
                    required: true,
                },

                "#inputAddress": {
                    field: "address",
                    type: FieldType.ADDRESS
                },

                "#inputContact": {
                    field: "contact",
                    type: FieldType.STRING
                },

                "#inputContactMail": {
                    field: "contactMail",
                    type: FieldType.STRING,
                },

                "#inputContactPhone": {
                    field: "contactPhone",
                    type: FieldType.STRING,
                },

                "#inputContactWhatsapp": {
                    field: "whatsappGroup",
                    type: FieldType.STRING,
                }
            },

            filterSortField: "name",
            filterSchema: {
                "#filterSearch": {
                    type: FilterType.CONTAINS,
                    combine: FilterCombine.OR,
                    fields: ["name", "description", "descriptionRich", "price", "ownEquipment", "address", "contact", "contactMail", "contactPhone", "whatsappGroup"],
                    value: (val) => val.toString().trim(),
                },
            },
        });

        editor.init();
    });
});

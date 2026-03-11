import wixData from 'wix-data';
import wixLocation from 'wix-location-frontend';

export class CmsEditor {
    constructor(config) {
        this.cmsName = config.cmsName;
        this.dataSetName = config.dataSetName || `${config.cmsName}Dataset`;
        this.linkField = config.linkField || `link-${config.cmsName}-title`;
        this.refreshUI = config.refreshUI || (() => { });
    }

    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        const ds = $w(`#${this.dataSetName}`);

        ds.onReady(() => { this.updateSelectorList() });

        ds.onError((error) => {
            const errStr = (JSON.stringify(error) + String(error.stack) + String(error.message)).toLowerCase();
            console.error("Error saving item:", errStr);

            let msg = "Fehler beim Speichern.";
            if (errStr.includes("validation")) msg = "Bitte fülle alle Pflichtfelder korrekt aus.";
            else if (errStr.includes("email")) msg = "Die E-Mail-Adresse ist ungültig.";
            else if (errStr.includes("not allowed during save")) msg = "Speichervorgang noch nicht abgeschlossen.";

            this.showMessage(msg, true);
        });

        if ($w("#itemSelector").length) $w("#itemSelector").onChange(() => {
            const val = $w("#itemSelector").value;
            console.log("selected value:", val);

            if (val === "--new--") {
                ds.new().then(() => {
                    console.log("item created");
                    this.refreshUI();
                });
            } else if (val) {
                this.navigateTo(val);
            }
        });

        if ($w("#buttonSave").length) $w("#buttonSave").onClick(() => {
            $w("#textResponse").collapse();
            ds.save().then(() => {
                console.log("item saved");
                this.updateSelectorList();
                this.showMessage("Erfolgreich gespeichert.");
            });
        });

        if ($w("#buttonRevert").length) $w("#buttonRevert").onClick(() => {
            $w("#textResponse").collapse();
            ds.revert().then(() => {
                console.log("item reverted");
                this.updateSelectorList();
                this.showMessage("Änderungen verworfen.");
            });
        });

        if ($w("#buttonNew").length) $w("#buttonNew").onClick(() => {
            $w("#textResponse").collapse();
            ds.save().then(() => {
                console.log("item saved before creating new item");
                ds.new().then(() => {
                    console.log("item created");
                    this.updateSelectorList();
                    this.showMessage("Erfolgreich erstellt.");
                });
            });
        });

        if ($w("#buttonRemove").length) $w("#buttonRemove").onClick(() => {
            $w("#textResponse").collapse();
            ds.remove().then(() => {
                console.log("item removed");
                this.updateSelectorList();

                wixData.query(this.cmsName).ascending("title").limit(1).find().then((results) => {
                    console.log("query after deletion:", results);
                    this.showMessage("Erfolgreich gelöscht.");

                    if (results.items.length > 0) {
                        const nextUrl = results.items[0][this.linkField];
                        console.log("going to:", nextUrl);
                        if (nextUrl) wixLocation.to(nextUrl);
                    } else {
                        ds.new().then(() => { this.updateSelectorList(); });
                    }
                });
            });
        });
    }

    async navigateTo(id) {
        wixData.query(this.cmsName).eq("_id", id).find().then((results) => {
            if (results.items.length > 0) {
                const dynamicUrl = results.items[0][this.linkField];
                console.log("going to:", dynamicUrl, "from:", wixLocation.url);

                if (dynamicUrl && wixLocation.url.includes(dynamicUrl)) {
                    wixLocation.to(wixLocation.url);
                } else if (dynamicUrl) {
                    wixLocation.to(dynamicUrl);
                }
            }
        });
    }

    updateSelectorList() {
        console.log("Updating item selector list");
        wixData.query(this.cmsName).ascending("title").limit(1000).find().then((result) => {
            const currentItem = $w(`#${this.dataSetName}`).getCurrentItem();
            console.log("current item:", currentItem?._id, "query results:\n", result.items.map(i => `${i._id}: ${i.title}`).join("\n"));
            $w("#itemSelector").options = [
                { label: "➕ Neuer Eintrag", value: "--new--" },
                ...result.items.map(item => ({ label: item.title, value: item._id }))
            ];
            if (currentItem) $w("#itemSelector").value = currentItem._id;

            this.refreshUI();
        });
    }

    showMessage(message, isError = false) {
        if (!$w("#textResponse").length) return;
        const color = isError ? "#E74C3C" : "#2ECC71";
        $w("#textResponse").html = `<p style="color: ${color}; font-size: 16px; text-align: center;">${isError ? "✖ " : "✔ "}${message}</p>`;
        $w("#textResponse").expand();
        setTimeout(() => { $w("#textResponse").collapse(); }, 20000);
    }
}
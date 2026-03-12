import wixData from 'wix-data';
import wixLocation from 'wix-location-frontend';

export class CmsEditor {
    constructor(config) {
        this.cmsName = config.cmsName;
        this.dataSetName = config.dataSetName || `${config.cmsName}Dataset`;
        this.linkField = config.linkField || `link-${config.cmsName}-title`;
        this.refreshUI = config.refreshUI || (() => { });
        this.onBeforeSave = config.onBeforeSave || (async () => true);
        this.onAfterSave = config.onAfterSave || (() => { });
        this.onAfterReverted = config.onAfterReverted || (() => { });
        this.onAfterDelete = config.onAfterDelete || (() => { });

        this.messageTimer = null;
    }

    init() {
        console.log("Initializing CMS Editor for", this.cmsName, "with dataset", this.dataSetName);

        const ds = $w(`#${this.dataSetName}`);

        ds.onReady(() => { this.updateSelectorList(); });

        ds.onError((error) => { this.showError(error); });

        if ($w("#itemSelector").id) $w("#itemSelector").onChange(() => {
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
        }); else console.warn("itemSelector not found in DOM");

        if ($w("#buttonSave").id) $w("#buttonSave").onClick(async () => {
            this.collapseResponse();
            this.beforeSafeResult = await this.onBeforeSave();
            ds.save().then(() => {
                console.log("item saved");
                this.updateSelectorList();
                this.onAfterSave(this.beforeSafeResult);
                this.showMessage("Erfolgreich gespeichert.");
            });
        }); else console.warn("buttonSave not found in DOM");

        if ($w("#buttonRevert").id) $w("#buttonRevert").onClick(() => {
            this.collapseResponse();
            ds.revert().then(() => {
                console.log("item reverted");
                this.updateSelectorList();
                this.onAfterReverted();
                this.showMessage("Änderungen verworfen.");
            });
        }); else console.warn("buttonRevert not found in DOM");

        if ($w("#buttonNew").id) $w("#buttonNew").onClick(() => {
            this.collapseResponse();
            ds.save().then(() => {
                console.log("item saved before creating new item");
                ds.new().then(() => {
                    console.log("item created");
                    this.updateSelectorList();
                    this.showMessage("Erfolgreich erstellt.");
                });
            });
        }); else console.warn("buttonNew not found in DOM");

        if ($w("#buttonRemove").id) $w("#buttonRemove").onClick(() => {
            this.collapseResponse();
            const itemToDelete = ds.getCurrentItem();
            ds.remove().then(() => {
                console.log("item removed");
                this.updateSelectorList();
                this.onAfterDelete(itemToDelete);
                this.showMessage("Erfolgreich gelöscht.");

                wixData.query(this.cmsName).ascending("title").limit(1).find().then((results) => {
                    console.log("query after deletion:", results);
                    if (results.items.length > 0) {
                        const nextUrl = results.items[0][this.linkField];
                        console.log("going to:", nextUrl);
                        if (nextUrl) wixLocation.to(nextUrl);
                    } else {
                        console.log("no more items left");
                        ds.new().then(() => { this.updateSelectorList(); });
                    }
                });
            });
        }); else console.warn("buttonRemove not found in DOM");
    }

    async navigateTo(id) {
        wixData.query(this.cmsName).eq("_id", id).find().then((results) => {
            if (results.items.length > 0) {
                const dynamicUrl = results.items[0][this.linkField];
                console.log("going to:", dynamicUrl, "from:", wixLocation.url);
                if (dynamicUrl && wixLocation.url.includes(dynamicUrl))
                    wixLocation.to(wixLocation.url);
                else if (dynamicUrl)
                    wixLocation.to(dynamicUrl);
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
            $w("#itemSelector").value = currentItem?._id ?? undefined;

            this.refreshUI();
        });
    }

    showError(error) {
        const errStr = (JSON.stringify(error) + String(error.stack) + String(error.message)).toLowerCase();
        console.error("Error saving item:", errStr);

        let msg = "Fehler beim Speichern.";
        if (errStr.includes("validation")) msg = "Bitte fülle alle Pflichtfelder korrekt aus.";
        else if (errStr.includes("email")) msg = "Die E-Mail-Adresse ist ungültig.";
        else if (errStr.includes("not allowed during save")) msg = "Speichervorgang noch nicht abgeschlossen.";

        this.showMessage(msg, true);
    }

    showMessage(message, isError = false) {
        if (!$w("#textResponse").id) return;
        if (this.messageTimer) clearTimeout(this.messageTimer);
        const color = isError ? "#E74C3C" : "#2ECC71";
        $w("#textResponse").html = `<p style="color: ${color}; font-size: 16px; text-align: center;">${isError ? "✖ " : "✔ "}${message}</p>`;
        $w("#textResponse").expand();
        this.messageTimer = setTimeout(() => { this.collapseResponse(); }, 20000);
    }

    collapseResponse() {
        if (!$w("#textResponse").id) return;
        $w("#textResponse").collapse();
        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }
    }

}

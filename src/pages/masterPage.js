import wixData from 'wix-data';

import { currentMember, authentication } from "wix-members-frontend";

$w.onReady(function () {
    authentication.onLogin(() => update());
    authentication.onLogout(() => update());
    update();
});

function update() {
    currentMember.getRoles().then((roles) => {
        const showMenu = roles.some((role) => role._id == "276cacd9-b43e-4e4e-8e3f-92192eb8eba7"); // "Gästerverwalter"
        const menu = $w("#expandableMenu");
        const mi = menu.menuItems;
        const menuShown = mi.some(item => item.id == "guest-management");
        if (showMenu && !menuShown) {
            console.log("masterPage - going to show guest-management menu item");
            wixData.query("guestReservations").descending("_updatedDate").limit(1).find().then((res) => {
                console.log(`masterPage - going to show guest-management menu item for ${res.items.map(i => i._id)}`);
                mi.push({
                    id: "guest-management",
                    link: res.items.length > 0 ? `/guests-management/${res.items[0]._id}` : "/guests-management", //FIXME test with length == 0
                    label: "Gästeverwaltung",
                    target: "_self",
                    "selected": false,
                    "menuItems": []
                });
                menu.menuItems = mi;
            });
        }
        if (!showMenu && menuShown) {
            console.log("masterPage - going to hide guest-management menu item");
            menu.menuItems = mi.filter(item => item.id != "guest-management");
        }
    });
}
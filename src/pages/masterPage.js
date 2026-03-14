import { currentMember, authentication } from "wix-members-frontend";

$w.onReady(function () {
    authentication.onLogin(() => update());
    authentication.onLogout(() => update());
    update();
});

function update() {
    currentMember.getRoles().then((roles) => {
        toggleMenu(roles, "276cacd9-b43e-4e4e-8e3f-92192eb8eba7", "Gästeverwaltung", "guests-management");
        toggleMenu(roles, "231ed231-93cf-45c1-9cbe-d99e7e45a27e", "Events bearbeiten", "events-edit");
        toggleMenu(roles, "9cf0085c-a914-46de-a6b1-29aa4b86a76e", "Speisekarte bearbeiten", "food-edit");
    });
}

function toggleMenu(roles, roleID, label, url) {
    const showMenu = roles.some((role) => role._id == roleID);
    const menu = $w("#expandableMenu");
    const menuShown = menu.menuItems.some(item => item.id == url);
    if (showMenu && !menuShown) {
        console.log(`masterPage - going to show ${url} menu item`);
        const mi = menu.menuItems;
        mi.push({
            id: url,
            link: `/${url}`,
            label: label,
            target: "_self",
            "selected": false,
            "menuItems": []
        });
        menu.menuItems = mi;
    }
    if (!showMenu && menuShown) {
        console.log(`masterPage - going to hide ${url} menu item`);
        menu.menuItems = menu.menuItems.filter(item => item.id != url);
    }
}
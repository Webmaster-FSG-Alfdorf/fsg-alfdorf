import { currentMember, authentication } from "wix-members-frontend";
import { ROLES } from "public/cms.js";

$w.onReady(function () {
    authentication.onLogin(() => update());
    authentication.onLogout(() => update());
    update();
});

function update() {
    const applyRoles = (roles) => {
        for (const r of Object.values(ROLES)) toggleMenu(roles, r.id, r.label, r.slug);
    };
    if (authentication.loggedIn)
        currentMember.getRoles().then(applyRoles).catch(() => applyRoles([]));
    else
        applyRoles([]);
}

function toggleMenu(roles, roleID, label, url) {
    const showMenu = roles && roles.some((role) => role._id == roleID);
    const menu = $w("#expandableMenu");
    const menuShown = menu.menuItems?.some(item => item.id == url);
    if (menu.menuItems && showMenu && !menuShown) {
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
    if (menu.menuItems && !showMenu && menuShown) {
        console.log(`masterPage - going to hide ${url} menu item`);
        menu.menuItems = menu.menuItems.filter(item => item.id != url);
    }
}
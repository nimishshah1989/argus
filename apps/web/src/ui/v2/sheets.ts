// The v2 kit's style sheets: v2.css (the base) first, then every other `ui/v2/*.css` in name order. A sheet added to
// this folder is loaded with no list to edit. Nothing here depends on the order of the rest: one class, one sheet.
import './v2.css';

import.meta.glob(['./*.css', '!./v2.css'], { eager: true });

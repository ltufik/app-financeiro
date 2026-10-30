// APP_VERSION without loading the browser module (usage.js needs a page).
import fs from 'fs';
export const APP_VERSION = /APP_VERSION = '(v\d+)'/.exec(fs.readFileSync(new URL('../../public/js/usage.js', import.meta.url), 'utf8'))[1];

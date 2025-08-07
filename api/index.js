"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_1 = require("../src/app");
let dbInitialized = false;
async function handler(req, res) {
    if (!dbInitialized) {
        try {
            await (0, app_1.initDatabase)();
            dbInitialized = true;
        }
        catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }
    return new Promise((resolve, reject) => {
        (0, app_1.app)(req, res, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(undefined);
            }
        });
    });
}
//# sourceMappingURL=index.js.map
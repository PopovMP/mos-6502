import
{strictEqual}  from "node:assert";
import {test} from "node:test";

import {Utils}     from "../js/utils.js";

test("Utils.wordToHex: 0x1000", () => {
    const hex = Utils.wordToHex(0x1000);
    strictEqual(hex, "1000");
});

test("Utils.wordToHex: 0xAFF", () => {
    const hex = Utils.wordToHex(0xAFF);
    strictEqual(hex, "0AFF");
});

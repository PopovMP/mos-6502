import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Utils}     from "../js/utils.js";

describe("Utils", () => {
    describe("wordToHex", () => {
        it("0x1000", () => {
            const hex = Utils.wordToHex(0x1000);
            strictEqual(hex, "1000");
        });
    });
});

"use strict";

const {strictEqual}  = require("assert");
const {describe, it} = require("@popovmp/mocha-tiny");
const {Utils}        = require("../js/index.js");

describe("Utils", () => {
    describe("wordToHex", () => {
        it("0x1000", () => {
            const hex = Utils.wordToHex(0x1000);
            strictEqual(hex, "1000");
        });
    });
});

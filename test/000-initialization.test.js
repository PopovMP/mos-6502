import {test       } from "node:test";
import {strictEqual} from "node:assert";

import {Assembler} from "../js/assembler.js";
import {Cpu      } from "../js/cpu.js";
import {DataSheet} from "../js/data-sheet.js";
import {Emulator } from "../js/emulator.js";
import {Utils    } from "../js/utils.js";

test("Assembler can be instantiated", () => {
    const assembler = new Assembler();
    strictEqual(typeof assembler, "object");
});

test("CPU can be instantiated", () => {
    const memory = new Uint8Array(0xFFFF + 1);
    const cpu    = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);
    strictEqual(typeof cpu, "object");
});

test("Data Sheet can be instantiated", () => {
    const dataSheet = new DataSheet();
    strictEqual(typeof dataSheet, "object");
});

test("Emulator can be instantiated", () => {
    const emulator = new Emulator();
    strictEqual(typeof emulator, "object");
});

test("Utils Provides static methods", () => {
    strictEqual(typeof Utils.byteToHex, "function");
    strictEqual(typeof Utils.wordToHex, "function");
});

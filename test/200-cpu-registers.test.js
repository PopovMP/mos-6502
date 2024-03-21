import {test       } from "node:test";
import {strictEqual}  from "node:assert";

import {Cpu} from "../js/cpu.js";

const memory = new Uint8Array(0xFFFF + 1);
const cpu    = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

test("N 0 -> clear", () => {
    cpu.setNZ(0);
    strictEqual(cpu.N, false);
});

test("N 1 -> clear", () => {
    cpu.setNZ(1);
    strictEqual(cpu.N, false);
});

test("N 127 ( 0x7F ) -> clear", () => {
    cpu.setNZ(0x7F);
    strictEqual(cpu.N, false);
});

test("N 128 ( 0x80 ) -> set", () => {
    cpu.setNZ(0x80);
    strictEqual(cpu.N, true);
});

test("N 255 ( 0xFF ) -> set", () => {
    cpu.setNZ(0xFF);
    strictEqual(cpu.N, true);
});

test("Z: 0 -> set", () => {
    cpu.setNZ(0);
    strictEqual(cpu.Z, true);
});

test("Z: 1 -> clear", () => {
    cpu.setNZ(1);
    strictEqual(cpu.Z, false);
});

test("P: Set N -> 0b1010_0000", () => {
    cpu.setNZ(1);
    cpu.N = true;
    strictEqual((cpu.P >> 7), 1);
});

test("Set P -> N, V, C, ..", () => {
    cpu.setNZ(1);
    cpu.P = 0b1010_0001;
    strictEqual(cpu.N, true);
    strictEqual(cpu.V, false);
    strictEqual(cpu.C, true);
});

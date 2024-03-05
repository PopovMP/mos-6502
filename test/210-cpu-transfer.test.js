import {strictEqual}  from "node:assert";
import {describe, it} from "node:test"
;

import {Cpu}       from "../js/cpu.js";

const memory = new Uint8Array(0xFFFF + 1);
const cpu    = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("CPU - transfer", () => {
    it("TAX", () => {
        cpu.PC = 0x0800;
        cpu.A  = 128;
        cpu.X  = 0;

        memory[cpu.PC] = 0xAA; // TAX
        cpu.step();

        strictEqual(cpu.X, cpu.A);
        strictEqual(cpu.Z, false);
        strictEqual(cpu.N, true);
        strictEqual(cpu.PC, 0x0801);
    });
});

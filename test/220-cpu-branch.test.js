import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";
import {Cpu}       from "../js/cpu.js";

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("CPU Branching", () => {
    it("BEQ branch forward", () => {
        const sourceCode = `
			*=$0000
			LDX #42
			CPX #42
			BEQ good
			JMP bad

	good	LDA #1
			BRK	
	bad     LDA #2
			BRK
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 1);
    });

    it("BEQ skip branch forward", () => {
        const sourceCode = `
			*=$0800
			LDX #42
			CPX #13
			BEQ good
			JMP bad

	good	LDA #1
			BRK	
	bad     LDA #2
			BRK
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 2);
    });

    it("BEQ branch backwards", () => {
        const sourceCode = `
			*=$0800

			JMP start

	good	LDA #1
			BRK	
	bad     LDA #2
			BRK

	start	LDX #42
			CPX #42
			BEQ good
			JMP bad
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 1);
    });

    it("BEQ skip branch backwards", () => {
        const sourceCode = `
			*=$0800

			JMP start

	good	LDA #1
			BRK	
	bad     LDA #2
			BRK

	start	LDX #42
			CPX #13
			BEQ good
			JMP bad
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 2);
    });
});
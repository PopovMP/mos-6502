"use strict";

const {strictEqual}    = require("assert");
const {describe, it}   = require("@popovmp/mocha-tiny");
const {Assembler, Cpu} = require("../js/index.js");

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("CPU Branching", () => {
    describe("BEQ branch forward", () => {
        const sourceCode = `
			*=$0800
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

        it("Correct location", () => {
            strictEqual(cpu.A, 1);
        });
    });

    describe("BEQ skip branch forward", () => {
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

        it("Correct location", () => {
            strictEqual(cpu.A, 2);
        });
    });

    describe("BEQ branch backwards", () => {
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

        it("Correct location", () => {
            strictEqual(cpu.A, 1);
        });
    });

    describe("BEQ skip branch backwards", () => {
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

        it("Correct location", () => {
            strictEqual(cpu.A, 2);
        });
    });
});

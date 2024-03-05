import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";
import {Cpu}       from "../js/cpu.js";

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("CPU - addressing modes", () => {
    it("($nn,X)", () => {
        const sourceCode = `
			* = $0800
			LDX #$01
			LDA #$05
			STA $01
			LDA #$07
			STA $02
			LDY #$0A
			STY $0705
			LDA ($00,X)
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 0x0A);
    });

    it("(variable,X)", () => {
        const sourceCode = `
			* = $0800
			var = $00
			LDX #$01
			LDA #$05
			STA $01
			LDA #$07
			STA $02
			LDY #$0A
			STY $0705
			LDA (var,X)
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 0x0A);
    });

    it("($nn),Y", () => {
        const sourceCode = `
			* = $0800
			LDY #$01
			LDA #$03
			STA $01
			LDA #$07
			STA $02
			LDX #$0A
			STX $0704
			LDA ($01),Y
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 0x0A);
    })
})

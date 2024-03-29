import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";
import {Cpu}       from "../js/cpu.js";

const memory    = new Uint8Array(0xFFFF + 1);
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);
const assembler = new Assembler();

describe("Multiply 10", () => {

    const sourceCode = `
    * = $0800       ; can be anywhere, ROM or RAM

	TEMP  = $F0     ; temp partial low byte

    LDA #$10
    JSR MULT10
    BRK
    ;;;

MULT10  ASL         ; multiply by 2
        STA TEMP    ; temp store in TEMP
        ASL         ; again multiply by 2 (*4)
        ASL         ; again multiply by 2 (*8)
        CLC
        ADC TEMP    ; as result, A = x*8 + x*2
        RTS
	`;

    describe("Multiply 10", () => {
        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        it("16 * 10 = 160", () => {
            strictEqual(cpu.A, 160);
        });
    });
});

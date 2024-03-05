import {strictEqual}  from "node:assert";
import {describe, it} from "node:test"
;

import {Assembler} from "../js/assembler.js";
import {Cpu}       from "../js/cpu.js";

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("CPU Stack", () => {
    it("Push and pull correct value", () => {
        const sourceCode = `
        *=$0800
        LDA #42
        PHA
        LDA #13
        PLA
        BRK
    `;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 42);
    });

    it("Push and pull 2 values", () => {
        const sourceCode = `
        *=$0800
        LDA #42
        PHA
        LDA #13
        PHA
        LDA #8
        PLA
        TAX
        PLA
        TAY
        BRK
    `;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.X, 13);
        strictEqual(cpu.Y, 42);
    });


    it("Loops", () => {
        const sourceCode = `
            * = $0600
                LDX #$00
                LDY #$00
            
            firstLoop:
                TXA
                STA $0200,Y
                PHA
                INX
                INY
                CPY #$10
                BNE firstLoop ; loop until Y is $10
            
            secondLoop:
                PLA
                STA $0200,Y
                INY
                CPY #$20      ; loop until Y is $20
                BNE secondLoop
                
                BRK
        `;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.X, 0x10);
        strictEqual(cpu.Y, 0x20);
    });
});

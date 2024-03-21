import {strictEqual} from "node:assert";
import {test}        from "node:test";
import {Assembler}   from "../js/assembler.js";
import {Cpu}         from "../js/cpu.js";

const sourceCode = `
        * = $0800

        ; Variables location in Zero Page
        maxCnt   = $00 
        prevFibo = $01
        currFibo = $02
        temp     = $03

        ; Initialize variables. Pre-set first 2 numbers
        LDA #13         ; Numbers to find
        STA maxCnt
        LDA #0
        STA prevFibo
        LDA #1
        STA currFibo
        LDX #1          ; Current numbers found

loop
        LDA currFibo
        CPX maxCnt
        BEQ exit        ; Exit if max count reached

        STA temp
        CLC
        ADC prevFibo
        STA currFibo
        LDA temp
        STA prevFibo

        INX
        JMP loop

exit    
        BRK
`;

const assembler = new Assembler();
const memory    = new Uint8Array(0xFFFF + 1);
assembler.load(sourceCode, memory);
const cpu = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);
cpu.reset();
while (memory[cpu.PC] !== 0x00)
    cpu.step();

test("Fibonacci 13 = 233", () => {
    strictEqual(cpu.A, 233);
});

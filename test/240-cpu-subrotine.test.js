import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";
import {Cpu}       from "../js/cpu.js";

const memory    = new Uint8Array(0xFFFF + 1);
const assembler = new Assembler();
const cpu       = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("Subroutine", () => {

    it("JSR/RTS", () => {
        const sourceCode = `
		        * = $0800
			  JSR init
			  JSR loop
			  JSR end
			
			init:
			  LDX #$00
			  RTS
			
			loop:
			  INX
			  CPX #$05
			  BNE loop
			  RTS
			
			end:
			  BRK
		`;
        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.X, 5);
    });

    it("Math subroutines", () => {
        const sourceCode = `
		        * = $0800
		
				temp = $30 
		        
				LDA #8          ; A = 8
				JSR doubleA     ; A *= 2
				TAX             ; X = A
				JSR doubleA     ; A *= 2
				TAY             ; Y = A
				JSR sumXY       ; A = X + Y
				JMP finish
		
		sumXY
				TXA
				STA temp
				TYA
				CLC
				ADC temp
				RTS
				
		doubleA
				STA temp
				CLC
				ADC temp
				RTS
				
		finish		    
		        BRK
		`;

        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 48);
    });

    it("Math recursion", () => {
        const sourceCode = `
		;; Sum numbers from 1 to 10 with recursion
		
		        * = $0800
		
				sum = $30 

				LDA #0
				STA sum
				LDX #0
				JSR loop
				LDA sum
				JMP finish

		loop
				TXA
				CMP #10
				BEQ exit_loop
				JMP continue_loop
		exit_loop
				RTS
		continue_loop		
				INX
				TXA
				CLC
				ADC sum
				STA sum
				JMP loop
				
		finish		    
		        BRK
		`;

        const assembler = new Assembler();
        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        strictEqual(cpu.A, 55);
    });
});

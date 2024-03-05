"use strict";

const {strictEqual}    = require("assert");
const {describe, it}   = require("@popovmp/mocha-tiny");
const {Cpu, Assembler} = require("../js/index.js");

const memory = new Uint8Array(0xFFFF + 1);
const cpu    = new Cpu((addr) => memory[addr], (addr, data) => memory[addr] = data);

describe("Fibonacci", () => {

    const sourceCode = `
	        * = $0800
	
	        ; Variables location in Zero Page
	        maxCnt   = $00 
	        prevFibo = $01
	        currFibo = $02
	        temp     = $03
	
	        ; Initialize variables. Pre-set first 2 numbers
	        LDA #13            ; Numbers to find
	        STA maxCnt
	        LDA #0
	        STA prevFibo
	        LDA #1
	        STA currFibo
	        LDX #1             ; Current numbers found
	
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

    describe("Fibonacci", () => {
        const assembler = new Assembler();
        assembler.load(sourceCode, memory);
        cpu.reset();
        while (memory[cpu.PC] !== 0x00)
            cpu.step();

        it("Fibo 13 = 233", () => {
            strictEqual(cpu.A, 233);
        });
    });
});

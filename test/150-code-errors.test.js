import {strictEqual}  from "node:assert";
import {describe, it} from "node:test";

import {Assembler} from "../js/assembler.js";

describe("Assembler - errors", () => {
    describe("Tokenize code", () => {
        it("Show errors", () => {

            const sourceCode = `
			        * = $0800
			
			        ; Variables location in Zero Page
			        
			        prevFibo = $01
			        prevFibo = $01
			        currFibo = $02rr
			        temp     = $03
			
			        ; Initialize variables. Pre-set first 2 numbers
			        LDA #13            ; Numbers to find
			        STA maxCnt
			        LdDA #0
			        STA prevFibo
			        LDA #1
			        STA currFibod s
			        LDX #1             ; Current numbers found
			sdfas
			loopeesadf
			        LDA currFibo
			        CPX maxCnt
			        BEQ exit        ; Exit if max count reached
			
			        STA tffemp
			        CLC
			        AdDCee prevFibo
			        STA currFiboewr
			        LDA temp
			        STA prevFibo
			ff
			loopeesadf
			        INX
			        JMP loop
			
			exit    
			        BRK
			`;

            const assembler = new Assembler();
            const codeDto   = assembler.tokenize(sourceCode);

            const errorOutput = codeDto.codeTokens
                .filter(token => token.tokenType === "error")
                .reduce((acc, token) => {
                    acc.push("Error:       " + token.error);
                    acc.push("Code line:   " + token.codeLine);
                    acc.push("Instruction: " + token.instrName);
                    return acc;
                }, []);

            // console.error(errorOutput.join('\n'))

            try {
                assembler.assemble(sourceCode);
            } catch (e) {
                // console.error(e.message)
            }

            strictEqual(errorOutput.length, 9);
        });
    });
});

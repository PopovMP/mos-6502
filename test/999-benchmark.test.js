
'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Cpu, Assembler } = require('../js/index.js')

const memory = new Uint8Array(0xFFFF + 1)
const cpu = new Cpu(memory)
const sourceCode = `
        * = $0800

        ; Variables location in Zero Page
        maxCnt   = $00 
        prevFibo = $01
        currFibo = $02
        temp     = $03
        runs     = $05

        LDA #0
        STA runs

start
		INC runs

        LDA #13             ; Numbers to find
        STA maxCnt
        LDA #0
        STA prevFibo
        LDA #1
        STA currFibo
        LDX #1              ; Current numbers found

loop
        LDA currFibo
        CPX maxCnt
        BEQ ready           ; Exit if max count reached

        STA temp
        CLC
        ADC prevFibo
        STA currFibo
        LDA temp
        STA prevFibo

        INX
        JMP loop

ready    
		LDA runs
		CMP #$FF            ; Max count of runs
		BEQ finish
        JMP start

finish  BRK
`
const assembler = new Assembler()
assembler.load(sourceCode, memory)

cpu.reset()

let steps = 0
const startTime  = Date.now()

while (memory[cpu.PC] !== 0x00) {
	cpu.step()
	steps++
}

const time   = Date.now() - startTime

const frq = Math.round( (steps / (time / 1000)) / 1000 )

describe('Benchmark', () => {
	describe('Run demo program', () => {
		it('Makes more than 1000 kHz', () => {
			console.log( `Frequency: ${frq} kHz`)
			strictEqual(frq > 1000, true)
		})
	})
})

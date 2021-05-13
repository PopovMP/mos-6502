'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Assembler, Cpu } = require('../js')

const memory    = new Uint8Array(0xFFFF + 1)
const assembler = new Assembler()
const cpu       = new Cpu(memory)

describe('CPU Stack', () => {
	describe('push and pull', () => {
		it('Push and pull correct value', () => {
			const sourceCode = `
			*=$0800
			LDA #42
			PHA
			LDA #13
			PLA
			BRK
		`

			assembler.load(sourceCode, memory)
			cpu.reset()
			cpu.run()
			strictEqual(cpu.A, 42)
		})

		it('Push and pull 2 values', () => {
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
		`

			assembler.load(sourceCode, memory)
			cpu.reset()
			cpu.run()
			strictEqual(cpu.X, 13)
			strictEqual(cpu.Y, 42)
		})


		it('Loops', () => {
			const sourceCode = `
				  * = $0600
				
				  LDX #$00
				  LDY #$00
				
				firstloop:
				  TXA
				  STA $0200,Y
				  PHA
				  INX
				  INY
				  CPY #$10
				  BNE firstloop ; loop until Y is $10
				
				secondloop:
				  PLA
				  STA $0200,Y
				  INY
				  CPY #$20      ; loop until Y is $20
				  BNE secondloop
				  
				  BRK
			`

			assembler.load(sourceCode, memory)
			cpu.reset()
			cpu.run()
			strictEqual(cpu.X, 0x10)
			strictEqual(cpu.Y, 0x20)
		})

	})

})

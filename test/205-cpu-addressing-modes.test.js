'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Cpu, Assembler } = require('../public/js')

const memory    = new Uint8Array(0xFFFF)
const assembler = new Assembler()
const cpu       = new Cpu(memory)

describe('CPU - addressing modes', () => {
	describe('($nn,X)', () => {
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
		`
		assembler.load(sourceCode, memory)
		cpu.reset()
		cpu.run()

		it('Gets correct value', () => {
			strictEqual(cpu.A, 0x0A)
		})
	})

	describe('($nn),Y', () => {
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
		`
		assembler.load(sourceCode, memory)
		cpu.reset()
		cpu.run()

		it('Gets correct value', () => {
			strictEqual(cpu.A, 0x0A)
		})
	})
})
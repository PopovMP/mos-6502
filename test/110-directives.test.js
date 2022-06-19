'use strict'

const { strictEqual  } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Assembler    } = require('../js/index.js')
const assembler = new Assembler()
const memory    = new Uint8Array(0xFFFF + 1)

describe('Assembler - Directives', () => {

	describe('.BYTE', () => {
		it('Sets a byte in memory', () => {
			const sourceCode =  `
				* = $0800
				.BYTE $AB
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0xAB)
		})

		it('Sets multiple bytes', () => {
			const sourceCode =  `
				* = $0800
				.BYTE $AB, $AC, $AD
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0xAB)
			strictEqual(memory[0x0801], 0xAC)
			strictEqual(memory[0x0802], 0xAD)
		})

		it('Sets a byte with a label', () => {
			const sourceCode =  `
				* = $0800
				LDA label
				label .BYTE $AB
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0803], 0xAB)
		})

		it('BYTE with variable', () => {
			const sourceCode =  `
				* = $0800
				VARA = $F4
				.BYTE VARA
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0xF4)
		})
	})

	describe('.WORD', () => {
		it('Sets a WORD in memory', () => {
			const sourceCode =  `
				* = $0800
				.WORD $AB11
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0x11)
			strictEqual(memory[0x0801], 0xAB)
		})

		it('Sets multiple bytes', () => {
			const sourceCode =  `
				* = $0800
				.WORD $AB11, $CD22
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0x11)
			strictEqual(memory[0x0801], 0xAB)
			strictEqual(memory[0x0802], 0x22)
			strictEqual(memory[0x0803], 0xCD)
		})

		it('WORD sets a label', () => {
			const sourceCode =  `
				* = $0800
				label NOP
				      NOP
				      NOP
				.WORD label
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0803], 0x00)
			strictEqual(memory[0x0804], 0x08)
		})

		it('WORD with variable', () => {
			const sourceCode =  `
				* = $0800
				VARA = $ABCD
				.WORD VARA
			`
			memory.fill(0x00)
			assembler.load(sourceCode, memory)
			strictEqual(memory[0x0800], 0xCD)
			strictEqual(memory[0x0801], 0xAB)
		})

	})
})

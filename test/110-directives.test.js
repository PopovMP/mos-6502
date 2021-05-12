'use strict'

const { strictEqual  } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Assembler    } = require('../public/js')

describe('Assembler - Directives', () => {
	const assembler = new Assembler()
	const memory    = new Uint8Array(0xFFFF + 1)

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
	})
})

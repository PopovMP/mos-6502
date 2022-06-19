'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Assembler, Cpu, DataSheet, Emulator, Utils } = require('../js/index.js')

describe('Initialization', () => {
	describe('Assembler', () => {
		it('can be instantiated', () => {
			const assembler = new Assembler()
			strictEqual(typeof assembler, 'object')
		})
	})

	describe('CPU', () => {
		it('can be instantiated', () => {
			const memory = new Uint8Array(0xFFFF + 1)
			const cpu = new Cpu(memory)
			strictEqual(typeof cpu, 'object')
		})
	})

	describe('Data Sheet', () => {
		it('can be instantiated', () => {
			const dataSheet = new DataSheet()
			strictEqual(typeof dataSheet, 'object')
		})
	})

	describe('Emulator', () => {
		it('can be instantiated', () => {
			const emulator = new Emulator()
			strictEqual(typeof emulator, 'object')
		})
	})

	describe('Utils', () => {
		it('Provides static methods', () => {
			strictEqual(typeof Utils.byteToHex, 'function')
			strictEqual(typeof Utils.wordToHex, 'function')
		})
	})
})

'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Cpu } = require('../public/js')

const memory = new Uint8Array(0xFFFF)
const cpu = new Cpu(memory)

describe('CPU - transfer', () => {
	describe('TAX', () => {
		cpu.PC     = 0x0800
		cpu.A      = 128
		cpu.X      = 0
		cpu.cycles = 10

		memory[cpu.PC] = 0xAA // TAX
		cpu.step()

		it('X is correct', () => {
			strictEqual(cpu.X, cpu.A)
		})
		it('Z is clear', () => {
			strictEqual(cpu.Z, false)
		})
		it('N is set', () => {
			strictEqual(cpu.N, true)
		})
		it('PC is advanced', () => {
			strictEqual(cpu.PC, 0x0801)
		})
		it('cycles is advanced', () => {
			strictEqual(cpu.cycles, 12)
		})
	})
})

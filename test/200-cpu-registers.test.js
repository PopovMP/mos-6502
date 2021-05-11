'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Cpu } = require('../public/js')

const memory = new Uint8Array(0xFFFF)
const cpu = new Cpu(memory)

describe('CPU - registers', () => {
	describe('setN', () => {
		it('0 -> clear', () => {
			cpu.setNZ(0)
			strictEqual(cpu.N, false)
		})
		it('1 -> clear', () => {
			cpu.setNZ(1)
			strictEqual(cpu.N, false)
		})
		it('127 ( 0x7F ) -> clear', () => {
			cpu.setNZ(0x7F)
			strictEqual(cpu.N, false)
		})
		it('128 ( 0x80 ) -> set', () => {
			cpu.setNZ(0x80)
			strictEqual(cpu.N, true)
		})
		it('255 ( 0xFF ) -> set', () => {
			cpu.setNZ(0xFF)
			strictEqual(cpu.N, true)
		})
	})
	describe('setZ', () => {
		it('0 -> set', () => {
			cpu.setNZ(0)
			strictEqual(cpu.Z, true)
		})
		it('1 -> clear', () => {
			cpu.setNZ(1)
			strictEqual(cpu.Z, false)
		})
	})
	describe('P', () => {
		it('Reset -> 0b0010_0000', () => {
			cpu.reset()
			strictEqual(cpu.P, 0b0010_0000)
		})
		it('Set N -> 0b1010_0000', () => {
			cpu.setNZ(1)
			cpu.N = true
			strictEqual(cpu.P, 0b1010_0000)
		})
		it('Set P -> N, V, C, ..', () => {
			cpu.setNZ(1)
			cpu.P = 0b1010_0001
			strictEqual(cpu.N, true)
			strictEqual(cpu.V, false)
			strictEqual(cpu.C, true)
		})

	})

})

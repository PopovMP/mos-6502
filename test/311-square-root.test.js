
'use strict'

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')
const { Cpu, Assembler } = require('../public/js')

const memory    = new Uint8Array(0xFFFF + 1)
const cpu       = new Cpu(memory)
const assembler = new Assembler()

describe('Square root', () => {

	const sourceCode = `
    * = $0800           ; can be anywhere, ROM or RAM
    
	Numberl = $F0      ; number to find square root of low byte
	Numberh = $F1      ; number to find square root of high byte
	Reml    = $F2      ; remainder low byte
	Remh    = $F3      ; remainder high byte
	templ   = $F4      ; temp partial low byte
	temph   = $F5      ; temp partial high byte
	Root    = $F6      ; square root

    ;;;
    ; SQRT of 256
    
    LDA #$00
    STA Numberl
    LDA #$01
    STA Numberh

    JSR SqRoot
    LDA Root
    BRK
    ;;;

SqRoot
    LDA    #$00        ; clear A
    STA    Reml        ; clear remainder low byte
    STA    Remh        ; clear remainder high byte
    STA    Root        ; clear Root
    LDX    #$08        ; 8 pairs of bits to do
Loop
    ASL    Root        ; Root = Root * 2

    ASL    Numberl     ; shift highest bit of number ..
    ROL    Numberh     ;
    ROL    Reml        ; .. into remainder
    ROL    Remh        ;

    ASL    Numberl     ; shift highest bit of number ..
    ROL    Numberh     ;
    ROL    Reml        ; .. into remainder
    ROL    Remh        ;

    LDA    Root        ; copy Root ..
    STA    templ       ; .. to templ
    LDA    #$00        ; clear byte
    STA    temph       ; clear temp high byte

    SEC                ; +1
    ROL    templ       ; temp = temp * 2 + 1
    ROL    temph       ;

    LDA    Remh        ; get remainder high byte
    CMP    temph       ; comapre with partial high byte
    BCC    Next        ; skip sub if remainder high byte smaller

    BNE    Subtr       ; do sub if <> (must be remainder>partial !)

    LDA    Reml        ; get remainder low byte
    CMP    templ       ; comapre with partial low byte
    BCC    Next        ; skip sub if remainder low byte smaller

                       ; else remainder>=partial so subtract then
                       ; and add 1 to root. carry is always set here
Subtr
    LDA    Reml        ; get remainder low byte
    SBC    templ       ; subtract partial low byte
    STA    Reml        ; save remainder low byte
    LDA    Remh        ; get remainder high byte
    SBC    temph       ; subtract partial high byte
    STA    Remh        ; save remainder high byte

    INC    Root        ; increment Root
Next
    DEX                ; decrement bit pair count
    BNE    Loop        ; loop if not all done

    RTS
	`

	describe('Square root', () => {
		assembler.load(sourceCode, memory)
		cpu.reset()
		cpu.run()
		it('SQRT of 256 = 16', () => {
			strictEqual(cpu.A, 0x10)
		})
	})
})

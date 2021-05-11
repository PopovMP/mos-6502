'use strict'

const fs = require('fs')

const { strictEqual } = require('assert')
const { describe, it } = require('@popovmp/mocha-tiny')

const { Assembler } = require('../public/js')

describe('Assembler', () => {
	const sourceCode =  `
			* = $ 0800
			index    = \t \t $0200
				start LDX #   $ 00
				ldy   #$00
			first_loop: TXA
				STA   index , Y
				
				PHA
				inX
				ldY $FF
				LSR A
				CPY #$10
				BNE first_loop ;loop until Y is $10
			secondLoop PLA
				STA index,Y
				INY
				CPY # $20      ;loop until Y is $20
				BNE     \t  secondLoop
				finish
			`

	describe('Clean code', () => {
		it('can be instantiated', () => {

			const assembler = new Assembler()
			const cleaned = assembler.cleanSourceCode(sourceCode).join(';')
			strictEqual(cleaned, '*=$0800;INDEX=$0200;START;LDX #$00;LDY #$00;FIRST_LOOP;TXA;STA INDEX,Y;PHA;INX;LDY $FF;LSR A;CPY #$10;BNE FIRST_LOOP;SECONDLOOP;PLA;STA INDEX,Y;INY;CPY #$20;BNE SECONDLOOP;FINISH')
		})
	})

	describe('Tokenize code', () => {
		it('can be tokenized', () => {

			const assembler = new Assembler()
			const cleaned = assembler.cleanSourceCode(sourceCode)
			const codeDto = assembler.tokenizeSourceCode(cleaned)

			strictEqual(codeDto.codeTokens.length, 20)
		})
	})

	describe('Assemble code', () => {
		it('returns a dump', () => {

			const assembler = new Assembler()
			const codePages = assembler.assemble(sourceCode)
			const actual    = Assembler.hexDump(codePages)

			strictEqual(actual,
				'0800: A2 00 A0 00 8A 99 00 02 48 E8 A4 FF 4A C0 10 D0' + '\n' +
				'0810: F3 68 99 00 02 C8 C0 20 D0 F7  .  .  .  .  .  .')
		})

		it('Assembles a game', () => {
			const sourcePath =  (__dirname).endsWith('test') ? __dirname + '/game.asm' :  __dirname + '/test/game.asm'
			const sourceCode = fs.readFileSync( sourcePath, 'utf8')

			const assembler = new Assembler()
			const codePages = assembler.assemble(sourceCode)
			const actual    = Assembler.hexDump(codePages)

			strictEqual(actual,
				'0600: 20 06 06 20 38 06 20 0D 06 20 2A 06 60 A9 02 85\n' +
				'0610: 02 A9 04 85 03 A9 11 85 10 A9 10 85 12 A9 0F 85\n' +
				'0620: 14 A9 04 85 11 85 13 85 15 60 A5 FE 85 00 A5 FE\n' +
				'0630: 29 03 18 69 02 85 01 60 20 4D 06 20 8D 06 20 C3\n' +
				'0640: 06 20 19 07 20 20 07 20 2D 07 4C 38 06 A5 FF C9\n' +
				'0650: 77 F0 0D C9 64 F0 14 C9 73 F0 1B C9 61 F0 22 60\n' +
				'0660: A9 04 24 02 D0 26 A9 01 85 02 60 A9 08 24 02 D0\n' +
				'0670: 1B A9 02 85 02 60 A9 01 24 02 D0 10 A9 04 85 02\n' +
				'0680: 60 A9 02 24 02 D0 05 A9 08 85 02 60 60 20 94 06\n' +
				'0690: 20 A8 06 60 A5 00 C5 10 D0 0D A5 01 C5 11 D0 07\n' +
				'06A0: E6 03 E6 03 20 2A 06 60 A2 02 B5 10 C5 10 D0 06\n' +
				'06B0: B5 11 C5 11 F0 09 E8 E8 E4 03 F0 06 4C AA 06 4C\n' +
				'06C0: 35 07 60 A6 03 CA 8A B5 10 95 12 CA 10 F9 A5 02\n' +
				'06D0: 4A B0 09 4A B0 19 4A B0 1F 4A B0 2F A5 10 38 E9\n' +
				'06E0: 20 85 10 90 01 60 C6 11 A9 01 C5 11 F0 28 60 E6\n' +
				'06F0: 10 A9 1F 24 10 F0 1F 60 A5 10 18 69 20 85 10 B0\n' +
				'0700: 01 60 E6 11 A9 06 C5 11 F0 0C 60 C6 10 A5 10 29\n' +
				'0710: 1F C9 1F F0 01 60 4C 35 07 A0 00 A5 FE 91 00 60\n' +
				'0720: A6 03 A9 00 81 10 A2 00 A9 01 81 10 60 A2 00 EA\n' +
				'0730: EA CA D0 FB 60  .  .  .  .  .  .  .  .  .  .  .'
			)
		})
	})

	describe('Disassemble code', () => {
		it('Disassemble a game', () => {
			const sourcePath =  (__dirname).endsWith('test') ? __dirname + '/game.asm' :  __dirname + '/test/game.asm'
			const sourceCode = fs.readFileSync( sourcePath, 'utf8')

			const assembler     = new Assembler()
			const codePages     = assembler.assemble(sourceCode)
			const codeBytes     = assembler.codePagesToBytes(codePages)
			const disAssyTokens = assembler.disassemble(codeBytes, 0x0600)

			const output = []

			for (const tkn of disAssyTokens) {
				// noinspection JSUnresolvedVariable
				output.push(`$${tkn.address}   ${tkn.code.join(' ').padEnd(8, ' ')}   ${tkn.text.padEnd(13, ' ')}  ; ${tkn.description}`)
			}

			const actual = '\n' + output.join('\n') + '\n'

			strictEqual(actual,`
$0600   20 06 06   JSR $0606      ; Jump to Subroutine
$0603   20 38 06   JSR $0638      ; Jump to Subroutine
$0606   20 0D 06   JSR $060D      ; Jump to Subroutine
$0609   20 2A 06   JSR $062A      ; Jump to Subroutine
$060C   60         RTS            ; Return from Subroutine
$060D   A9 02      LDA #$02       ; Load Accumulator
$060F   85 02      STA $02        ; Store Accumulator
$0611   A9 04      LDA #$04       ; Load Accumulator
$0613   85 03      STA $03        ; Store Accumulator
$0615   A9 11      LDA #$11       ; Load Accumulator
$0617   85 10      STA $10        ; Store Accumulator
$0619   A9 10      LDA #$10       ; Load Accumulator
$061B   85 12      STA $12        ; Store Accumulator
$061D   A9 0F      LDA #$0F       ; Load Accumulator
$061F   85 14      STA $14        ; Store Accumulator
$0621   A9 04      LDA #$04       ; Load Accumulator
$0623   85 11      STA $11        ; Store Accumulator
$0625   85 13      STA $13        ; Store Accumulator
$0627   85 15      STA $15        ; Store Accumulator
$0629   60         RTS            ; Return from Subroutine
$062A   A5 FE      LDA $FE        ; Load Accumulator
$062C   85 00      STA $00        ; Store Accumulator
$062E   A5 FE      LDA $FE        ; Load Accumulator
$0630   29 03      AND #$03       ; Logical AND
$0632   18         CLC            ; Clear Carry Flag
$0633   69 02      ADC #$02       ; Add with Carry
$0635   85 01      STA $01        ; Store Accumulator
$0637   60         RTS            ; Return from Subroutine
$0638   20 4D 06   JSR $064D      ; Jump to Subroutine
$063B   20 8D 06   JSR $068D      ; Jump to Subroutine
$063E   20 C3 06   JSR $06C3      ; Jump to Subroutine
$0641   20 19 07   JSR $0719      ; Jump to Subroutine
$0644   20 20 07   JSR $0720      ; Jump to Subroutine
$0647   20 2D 07   JSR $072D      ; Jump to Subroutine
$064A   4C 38 06   JMP $0638      ; Jump
$064D   A5 FF      LDA $FF        ; Load Accumulator
$064F   C9 77      CMP #$77       ; Compare
$0651   F0 0D      BEQ $0660      ; Branch if Equal
$0653   C9 64      CMP #$64       ; Compare
$0655   F0 14      BEQ $066B      ; Branch if Equal
$0657   C9 73      CMP #$73       ; Compare
$0659   F0 1B      BEQ $0676      ; Branch if Equal
$065B   C9 61      CMP #$61       ; Compare
$065D   F0 22      BEQ $0681      ; Branch if Equal
$065F   60         RTS            ; Return from Subroutine
$0660   A9 04      LDA #$04       ; Load Accumulator
$0662   24 02      BIT $02        ; Bit Test
$0664   D0 26      BNE $068C      ; Branch if Not Equal
$0666   A9 01      LDA #$01       ; Load Accumulator
$0668   85 02      STA $02        ; Store Accumulator
$066A   60         RTS            ; Return from Subroutine
$066B   A9 08      LDA #$08       ; Load Accumulator
$066D   24 02      BIT $02        ; Bit Test
$066F   D0 1B      BNE $068C      ; Branch if Not Equal
$0671   A9 02      LDA #$02       ; Load Accumulator
$0673   85 02      STA $02        ; Store Accumulator
$0675   60         RTS            ; Return from Subroutine
$0676   A9 01      LDA #$01       ; Load Accumulator
$0678   24 02      BIT $02        ; Bit Test
$067A   D0 10      BNE $068C      ; Branch if Not Equal
$067C   A9 04      LDA #$04       ; Load Accumulator
$067E   85 02      STA $02        ; Store Accumulator
$0680   60         RTS            ; Return from Subroutine
$0681   A9 02      LDA #$02       ; Load Accumulator
$0683   24 02      BIT $02        ; Bit Test
$0685   D0 05      BNE $068C      ; Branch if Not Equal
$0687   A9 08      LDA #$08       ; Load Accumulator
$0689   85 02      STA $02        ; Store Accumulator
$068B   60         RTS            ; Return from Subroutine
$068C   60         RTS            ; Return from Subroutine
$068D   20 94 06   JSR $0694      ; Jump to Subroutine
$0690   20 A8 06   JSR $06A8      ; Jump to Subroutine
$0693   60         RTS            ; Return from Subroutine
$0694   A5 00      LDA $00        ; Load Accumulator
$0696   C5 10      CMP $10        ; Compare
$0698   D0 0D      BNE $06A7      ; Branch if Not Equal
$069A   A5 01      LDA $01        ; Load Accumulator
$069C   C5 11      CMP $11        ; Compare
$069E   D0 07      BNE $06A7      ; Branch if Not Equal
$06A0   E6 03      INC $03        ; Increment Memory
$06A2   E6 03      INC $03        ; Increment Memory
$06A4   20 2A 06   JSR $062A      ; Jump to Subroutine
$06A7   60         RTS            ; Return from Subroutine
$06A8   A2 02      LDX #$02       ; Load X Register
$06AA   B5 10      LDA $10,X      ; Load Accumulator
$06AC   C5 10      CMP $10        ; Compare
$06AE   D0 06      BNE $06B6      ; Branch if Not Equal
$06B0   B5 11      LDA $11,X      ; Load Accumulator
$06B2   C5 11      CMP $11        ; Compare
$06B4   F0 09      BEQ $06BF      ; Branch if Equal
$06B6   E8         INX            ; Increment X Register
$06B7   E8         INX            ; Increment X Register
$06B8   E4 03      CPX $03        ; Compare X Register
$06BA   F0 06      BEQ $06C2      ; Branch if Equal
$06BC   4C AA 06   JMP $06AA      ; Jump
$06BF   4C 35 07   JMP $0735      ; Jump
$06C2   60         RTS            ; Return from Subroutine
$06C3   A6 03      LDX $03        ; Load X Register
$06C5   CA         DEX            ; Decrement X Register
$06C6   8A         TXA            ; Transfer X to Accumulator
$06C7   B5 10      LDA $10,X      ; Load Accumulator
$06C9   95 12      STA $12,X      ; Store Accumulator
$06CB   CA         DEX            ; Decrement X Register
$06CC   10 F9      BPL $06C7      ; Branch if Plus
$06CE   A5 02      LDA $02        ; Load Accumulator
$06D0   4A         LSR A          ; Logical Shift Right
$06D1   B0 09      BCS $06DC      ; Branch if Carry Set
$06D3   4A         LSR A          ; Logical Shift Right
$06D4   B0 19      BCS $06EF      ; Branch if Carry Set
$06D6   4A         LSR A          ; Logical Shift Right
$06D7   B0 1F      BCS $06F8      ; Branch if Carry Set
$06D9   4A         LSR A          ; Logical Shift Right
$06DA   B0 2F      BCS $070B      ; Branch if Carry Set
$06DC   A5 10      LDA $10        ; Load Accumulator
$06DE   38         SEC            ; Set Carry Flag
$06DF   E9 20      SBC #$20       ; Subtract with Carry
$06E1   85 10      STA $10        ; Store Accumulator
$06E3   90 01      BCC $06E6      ; Branch if Carry Clear
$06E5   60         RTS            ; Return from Subroutine
$06E6   C6 11      DEC $11        ; Decrement Memory
$06E8   A9 01      LDA #$01       ; Load Accumulator
$06EA   C5 11      CMP $11        ; Compare
$06EC   F0 28      BEQ $0716      ; Branch if Equal
$06EE   60         RTS            ; Return from Subroutine
$06EF   E6 10      INC $10        ; Increment Memory
$06F1   A9 1F      LDA #$1F       ; Load Accumulator
$06F3   24 10      BIT $10        ; Bit Test
$06F5   F0 1F      BEQ $0716      ; Branch if Equal
$06F7   60         RTS            ; Return from Subroutine
$06F8   A5 10      LDA $10        ; Load Accumulator
$06FA   18         CLC            ; Clear Carry Flag
$06FB   69 20      ADC #$20       ; Add with Carry
$06FD   85 10      STA $10        ; Store Accumulator
$06FF   B0 01      BCS $0702      ; Branch if Carry Set
$0701   60         RTS            ; Return from Subroutine
$0702   E6 11      INC $11        ; Increment Memory
$0704   A9 06      LDA #$06       ; Load Accumulator
$0706   C5 11      CMP $11        ; Compare
$0708   F0 0C      BEQ $0716      ; Branch if Equal
$070A   60         RTS            ; Return from Subroutine
$070B   C6 10      DEC $10        ; Decrement Memory
$070D   A5 10      LDA $10        ; Load Accumulator
$070F   29 1F      AND #$1F       ; Logical AND
$0711   C9 1F      CMP #$1F       ; Compare
$0713   F0 01      BEQ $0716      ; Branch if Equal
$0715   60         RTS            ; Return from Subroutine
$0716   4C 35 07   JMP $0735      ; Jump
$0719   A0 00      LDY #$00       ; Load Y Register
$071B   A5 FE      LDA $FE        ; Load Accumulator
$071D   91 00      STA ($00),Y    ; Store Accumulator
$071F   60         RTS            ; Return from Subroutine
$0720   A6 03      LDX $03        ; Load X Register
$0722   A9 00      LDA #$00       ; Load Accumulator
$0724   81 10      STA ($10,X)    ; Store Accumulator
$0726   A2 00      LDX #$00       ; Load X Register
$0728   A9 01      LDA #$01       ; Load Accumulator
$072A   81 10      STA ($10,X)    ; Store Accumulator
$072C   60         RTS            ; Return from Subroutine
$072D   A2 00      LDX #$00       ; Load X Register
$072F   EA         NOP            ; No Operation
$0730   EA         NOP            ; No Operation
$0731   CA         DEX            ; Decrement X Register
$0732   D0 FB      BNE $072F      ; Branch if Not Equal
$0734   60         RTS            ; Return from Subroutine
`
			)
		})
	})

})


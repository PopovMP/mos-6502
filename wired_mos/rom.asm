; Simple 65C02S Monitor Firmware (WozMon + KIM-1 Inspired)
; Uses 65C51 ACIA for serial I/O and 65C21 PIA for LED output
; Features: Memory read/write, program execution, hex command parser

; Zero page variables
ZP_ADDR_LO  = $10   ; Address low byte
ZP_ADDR_HI  = $11   ; Address high byte
ZP_DATA     = $12   ; Data buffer
ZP_MODE     = $13   ; Mode: 0=read, 1=write, 2=run
ZP_TEMP     = $14   ; Temporary storage

; ACIA register addresses
ACIA_DATA       = $D000 ; Data register
ACIA_STATUS     = $D001 ; Status register
ACIA_CMD        = $D002 ; Command register
ACIA_CTRL       = $D003 ; Control register

; PIA register addresses
PIA_PORT_A      = $D010 ; Either DDR or Data port A (CTRL A bit 2 set)
PIA_CTRL_A      = $D011
PIA_PORT_B      = $D012 ; Either DDR or Data port B (CTRL B bit 2 set)
PIA_CTRL_B      = $D013

; ASCII constants
CR          = $0D   ; Carriage return
LF          = $0A   ; Line feed
SPACE       = $20   ; Space
DOT         = $2E   ; Period (.)
COLON       = $3A   ; Colon (:)
R_CMD       = $52   ; 'R' for run

; Start of ROM (8kB 0xE000 - 0xFFFF)
*=$E000

;
; NMI entry point
;
nmi_handler             ; Receives a NMI
    rti             ; Return


;
; Reset entry point
;
reset_handler       ; Receives a Reset
    ; Reset CPU
    cld             ; Clear decimal mode
    cli             ; Enable IRQ interrupts.
    ldx #$FF
    txs             ; Set stack pointer to $FF (top of stack)

    ; Initialize ACIA
                    ; Software reset 
    lda #$00        ; The data does not mater
    sta ACIA_STATUS ; Doesn't do actual write. Resets bits in CTRL and CMD registers.
    lda #$1E        ; Control reg: 0b00011110
    sta ACIA_CTRL   ; 9600 baud rate (1.8432 MHz clock), 8 bits, 1 stop
    lda #$0B        ; Command reg: 0b00001011
    sta ACIA_CMD    ; No parity, no echo, no IRQ, RTS low, DTR low

    ; Initialize PIA
                    ; Set port A to output
    lda #$00        ; Select DDR A by setting bit 2 to 0
    sta PIA_CTRL_A  ;
    lda #$FF        ; Set all pins to output: 0b11111111
    sta PIA_PORT_A  ; 
    lda #$04        ; Select peripheral mode for A by setting bit 2 to 1
    sta PIA_CTRL_A  ;
                    ; Set port B to input
    lda #$00        ; Select DDR B by setting bit 2 to 0
    sta PIA_CTRL_B  ;
    lda #$00        ; Set all pins to input: 0b00000000
    sta PIA_PORT_B  ; 
    lda #$04        ; Select peripheral mode for B by setting bit 2 to 1
    sta PIA_CTRL_B  ;

    jmp start       ; Jump to the main program entry point


;
; IRQ entry point
;
irq_handler
    lda ACIA_STATUS ; Check ACIA (bit 7 set means IRQ)
    and #$80        ; Bit 7 mask: 0b10000000
    bne acia_irq    ; Branch if the bit matches
                    ;
    lda PIA_CTRL_A  ; Check PIA Port A (bits 6 or 7 set means IRQ)
    and #$C0        ; Bits 7 and 6 mask: 11000000
    bne pia_a_irq   ; Branch if any bit matches
                    ;
    lda PIA_CTRL_B  ; Check PIA Port B (bits 6 or 7 set means IRQ)
    and #$C0        ; Bits 7 and 6 mask: 11000000
    bne pia_b_irq   ; Branch if any bit matches
                    ;
    rti             ; No known IRQ source, just return

acia_irq            ; Handle ACIA IRQ here
    lda ACIA_STATUS
    lda ACIA_DATA   ; Read to clear RX interrupt
    rti

pia_a_irq           ; Handle PIA Port A IRQ here
    lda PIA_PORT_A  ; Read to clear interrupt
    rti

pia_b_irq           ; Handle PIA Port B IRQ here
    lda PIA_PORT_B  ; Read to clear interrupt
    rti


start:
    ; Initialize variables
    LDA #$00
    STA ZP_MODE      ; Default to read mode
    STA ZP_ADDR_LO
    STA ZP_ADDR_HI
    JSR say_hi

prompt:
    JSR print_prompt ; Print ">"
    LDA #$00
    STA ZP_MODE      ; Reset to read mode

main_loop:
    JSR get_char     ; Get character from serial
    CMP #CR          ; Check for carriage return
    BEQ parse_cmd    ; Parse command on CR
    CMP #SPACE       ; Space separates input
    BEQ next_field
    CMP #DOT         ; Period for range
    BEQ set_range
    CMP #COLON       ; Colon for write mode
    BEQ set_write
    CMP #R_CMD       ; 'R' for run
    BEQ set_run
    JSR parse_hex    ; Parse hex digit
    BCC valid_hex    ; If valid, continue
    LDA #$3F         ; ASCII '?'
    JSR put_char     ; Print '?'
    JMP main_loop    ; Ignore invalid input and loop
valid_hex:
    JSR store_hex    ; Store hex nibble
    JMP main_loop

next_field:
    LDA ZP_MODE
    CMP #$01         ; Write mode?
    BEQ write_data   ; Write data if in write mode
    JMP main_loop

set_range:
    LDA #$00         ; Set mode to read range
    STA ZP_MODE
    JMP main_loop

set_write:
    LDA #$01         ; Set mode to write
    STA ZP_MODE
    JMP main_loop

set_run:
    LDA #$02         ; Set mode to run
    STA ZP_MODE
    JMP parse_cmd

parse_cmd:
    LDA ZP_MODE
    CMP #$02         ; Run mode?
    BEQ run_program
    CMP #$01         ; Write mode?
    BEQ write_data
    JSR read_memory  ; Default to read memory
    JMP prompt

read_memory:
    LDY #$00
    LDA (ZP_ADDR_LO),Y  ; Read byte from address
    JSR print_hex       ; Print hex value
    JSR print_space
    INC ZP_ADDR_LO      ; Increment address
    BNE prompt
    INC ZP_ADDR_HI
    JMP prompt

write_data:
    LDA ZP_DATA
    LDY #$00
    STA (ZP_ADDR_LO),Y  ; Write byte to address
    INC ZP_ADDR_LO      ; Increment address
    BNE prompt
    INC ZP_ADDR_HI
    JMP prompt

run_program:
    JMP (ZP_ADDR_LO) ; Jump to user program

; Subroutines
print_prompt:
    LDA #$3E         ; '>'
    JSR put_char
    LDA #CR
    JSR put_char
    LDA #LF
    JSR put_char
    RTS

get_char:
    LDA ACIA_STATUS  ; Check status
    AND #$08         ; RX data available?
    BEQ get_char     ; Wait until ready
    LDA ACIA_DATA    ; Read character
    JSR put_char     ; Echo character
    RTS

put_char:
    sta ACIA_DATA   ; Transmit char
    jsr wait_1300   ; Because of 65C51N bug, wait programmatically to transmit
    jsr wait_1300   ; Transmission takes 1042us at 9600. We wait for 2x705us
    RTS

print_hex:
    PHA
    LSR A
    LSR A
    LSR A
    LSR A            ; Get high nibble
    JSR print_nibble
    PLA
    AND #$0F         ; Get low nibble
    JSR print_nibble
    RTS

print_nibble:
    CMP #$0A
    BCC is_digit
    ADC #$06         ; Convert A-F to ASCII
is_digit:
    ADC #$30         ; Convert 0-9 to ASCII
    JSR put_char
    RTS

print_space:
    LDA #SPACE
    JSR put_char
    RTS

parse_hex:
    CMP #$30
    BCC invalid      ; < '0'
    CMP #$3A
    BCC is_digit2    ; 0-9
    CMP #$41
    BCC invalid      ; < 'A'
    CMP #$47
    BCC is_hex       ; A-F
    CMP #$61
    BCC invalid      ; < 'a'
    CMP #$67
    BCC is_hex_lower ; a-f
invalid:
    SEC              ; Carry set for invalid
    RTS
is_digit2:
    SBC #$30         ; Convert ASCII 0-9 to value
    CLC              ; Carry clear for valid
    RTS
is_hex:
    SBC #$37         ; Convert ASCII A-F to value
    CLC              ; Carry clear for valid
    RTS
is_hex_lower:
    SBC #$57         ; Convert ASCII a-f to value (A=10, a=10, so $61-$57=$0A)
    CLC              ; Carry clear for valid
    RTS

store_hex:
    ASL A
    ASL A
    ASL A
    ASL A            ; Shift to high nibble
    STA ZP_TEMP

get_next_nibble:
    JSR get_char
    ; Check for command characters before parsing as hex
    CMP #CR
    BEQ store_hex_cmd
    CMP #SPACE
    BEQ store_hex_cmd
    CMP #DOT
    BEQ store_hex_cmd
    CMP #COLON
    BEQ store_hex_cmd
    CMP #R_CMD
    BEQ store_hex_cmd

    JSR parse_hex
    BCS get_next_nibble    ; Retry if invalid

    ORA ZP_TEMP            ; Combine nibbles
    STA ZP_DATA
    LDA ZP_MODE
    CMP #$01
    BEQ store_addr         ; In write mode, keep data
    STA ZP_ADDR_LO         ; Store as address low

    ; Get high byte
    JSR get_char
    ; Check for command characters before parsing as hex
    CMP #CR
    BEQ store_hex_cmd
    CMP #SPACE
    BEQ store_hex_cmd
    CMP #DOT
    BEQ store_hex_cmd
    CMP #COLON
    BEQ store_hex_cmd
    CMP #R_CMD
    BEQ store_hex_cmd

    JSR parse_hex
    BCS get_next_nibble    ; Retry if invalid

    ASL A
    ASL A
    ASL A
    ASL A
    STA ZP_TEMP

    JSR get_char
    ; Check for command characters before parsing as hex
    CMP #CR
    BEQ store_hex_cmd
    CMP #SPACE
    BEQ store_hex_cmd
    CMP #DOT
    BEQ store_hex_cmd
    CMP #COLON
    BEQ store_hex_cmd
    CMP #R_CMD
    BEQ store_hex_cmd

    JSR parse_hex
    BCS get_next_nibble    ; Retry if invalid

    ORA ZP_TEMP
    STA ZP_ADDR_HI         ; Store address high
    CLC
    RTS

store_hex_cmd:
    ; If a command character is found, return with carry set
    SEC
    RTS

store_addr:
    CLC
    RTS


; Wait for 1300 cycles
; It takes 705us on 1.8432 MHz clock
wait_1300               ;
    pha             ; Store A to the stack
    txa             ;
    pha             ; Store X to the stack
                    ;
    ldx #$FF        ; Init counter
wait_1300_              ; Loop's entry point
    dex             ; Decrement counter. Sets Z flag
    bne wait_1300_  ; Loop if X > 0
                    ;
    pla             ; Epilogue
    tax             ; Recover X from the stack
    pla             ; Recover A from the stack
    rts             ; Return

;
; Prints welcome message to ACIA
;
say_hi
    pha             ; Store A to the stack
    txa             ; Copy X to A
    pha             ; Push X to the stack
    ldx #$00        ; Initialize index to 0
say_hi_loop         ; Loop entry point
    lda message,x   ; Load character at x
    beq say_hi_done ; If zero (end of string), exit
    JSR put_char    ; Transmit the character at A
    inx             ; Increment x
    jmp say_hi_loop ; Loop
say_hi_done         ; Ready
    pla             ; Pool X value from the stack
    tax             ; Recover X from the stack
    pla             ; Recover A from the stack
    rts             ; Return

*=$F200
message ; "Hello, MOS 65C02!\r\n\0"
        .BYTE $48, $65, $6C, $6C, $6F, $2C, $20, $4D, $4F, $53
        .BYTE $20, $36, $35, $43, $30, $32, $21, $0D, $0A, $00

; Entry vectors
*=$FFFA
    .WORD nmi_handler       ; NMI
    .WORD reset_handler     ; Reset
    .WORD irq_handler       ; IRQ
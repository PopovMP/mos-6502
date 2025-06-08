; Simple 65C02S Monitor Firmware (WozMon inpired)
; Uses 65C51 ACIA for serial I/O and 65C21 PIA (not yet)
; Features: Memory read/write, program execution, hex command parser

; Zero page variables
ZP_ADDR_LO  = $10   ; Address low byte
ZP_ADDR_HI  = $11   ; Address high byte
ZP_DATA     = $12   ; Data buffer
ZP_MODE     = $13   ; Mode: 0=read, 1=write, 2=run
ZP_TEMP     = $14   ; Temporary storage

; ACIA register addresses
ACIA_DATA   = $D000 ; Data register
ACIA_STATUS = $D001 ; Status register
ACIA_CMD    = $D002 ; Command register
ACIA_CTRL   = $D003 ; Control register

; PIA register addresses
PIA_PORT_A  = $D010 ; Either DDR or Data port A (CTRL A bit 2 set)
PIA_CTRL_A  = $D011
PIA_PORT_B  = $D012 ; Either DDR or Data port B (CTRL B bit 2 set)
PIA_CTRL_B  = $D013

; ASCII constants
CR          = $0D   ; Carriage return
SPACE       = $20   ; Space
DOT         = $2E   ; Period (.)
COLON       = $3A   ; Colon (:)
R_CMD       = $52   ; 'R' for run

; Start of ROM (8kB 0xE000 - 0xFFFF)
.ORG = $E000

;
; NMI entry point
;
nmi_handler:        ; Receives a NMI
    RTI             ; Return


;
; Reset entry point
;
reset_handler:      ; Receives a Reset
    ; Reset CPU
    CLD             ; Clear decimal mode
    CLI             ; Enable IRQ interrupts.
    LDX #$FF        ;
    TXS             ; Set stack pointer to $FF (top of stack)

    ; Initialize ACIA
    LDA #$00        ; Software reset. The data does not mater
    STA ACIA_STATUS ; Doesn't do actual write. Resets bits in CTRL and CMD registers.
                    ;
    LDA #$1F        ; Control reg: 0b00011111
    STA ACIA_CTRL   ; bit 7 = 0 - Stop bit - 0 (1 stop bit)
                    ; bit 6 = 0, bit 5 = 0 - WL (Word Length) - 8 bits
                    ; bit 4 = 1 - RSC (Receiver clock) - Use internal clock
                    ; bit 3 - bit 0 = 1111 - SBR (Selected boud rate) - 19200 baud
                    ;
    LDA #$0B        ; Command reg: 0b00001011
    STA ACIA_CMD    ; bit 7 = 0, bit 6 = 0 - PMC (Parity Mode Control) - Use but no parity
                    ; bit 5 = 0 - PME (Parity mode enabled) - Parity disabled
                    ; bit 4 = 0 - REM (Receive Enable Mode) - RX disabled
                    ; bit 3 = 1, bit 2 = 0 - TIC (Transmit Interrupt Control) - RTSB -> Low. Tx interrupts disabled
                    ; bit 1 = 1 - IRD (Receiver Interrupt Request Disable) - IRQB disabled
                    ; bit 0 = 1 - DTR (Data Terminal Ready) - DTRB -> Low. Data terminal ready

    ; Initialize PIA
                    ; Set port A to output
    LDA #$00        ; Select DDR A by setting bit 2 to 0
    STA PIA_CTRL_A  ;
    LDA #$FF        ; Set all pins to output: 0b11111111
    STA PIA_PORT_A  ;
    LDA #$04        ; Select peripheral mode for A by setting bit 2 to 1
    STA PIA_CTRL_A  ;
                    ; Set port B to input
    LDA #$00        ; Select DDR B by setting bit 2 to 0
    STA PIA_CTRL_B  ;
    LDA #$00        ; Set all pins to input: 0b00000000
    STA PIA_PORT_B  ;
    LDA #$04        ; Select peripheral mode for B by setting bit 2 to 1
    STA PIA_CTRL_B  ;

    JMP start       ; Jump to the main program entry point


;
; IRQ entry point
;
irq_handler:
    PHA             ; Save A
                    ;
    LDA ACIA_STATUS ; Check ACIA (bit 7 set means IRQ)
    AND #$80        ; Bit 7 mask: 0b10000000
    BNE acia_irq    ; Branch if the bit matches
                    ;
    LDA PIA_CTRL_A  ; Check PIA Port A (bits 6 or 7 set means IRQ)
    AND #$C0        ; Bits 7 and 6 mask: 11000000
    BNE pia_a_irq   ; Branch if any bit matches
                    ;
    LDA PIA_CTRL_B  ; Check PIA Port B (bits 6 or 7 set means IRQ)
    AND #$C0        ; Bits 7 and 6 mask: 11000000
    BNE pia_b_irq   ; Branch if any bit matches
                    ;
    PLA             ; Restore A
    RTI             ; No known IRQ source, just return

acia_irq:           ; Handle ACIA IRQ here
    LDA ACIA_STATUS
    LDA ACIA_DATA   ; Read to clear RX interrupt
    PLA             ; Restore A
    RTI

pia_a_irq:          ; Handle PIA Port A IRQ here
    LDA PIA_PORT_A  ; Read to clear interrupt
    PLA             ; Restore A
    RTI

pia_b_irq:          ; Handle PIA Port B IRQ here
    LDA PIA_PORT_B  ; Read to clear interrupt
    PLA             ; Restore A
    RTI


;
; Main program entry point
;
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


;
; Transmit a character to ACIA
;
put_char:
    PHA             ; Store A to the stack
put_char_lp:        ; Loop entry point
    LDA ACIA_STATUS ; Check if ACIA is ready to transmit
    AND #$40        ; 0b01000000 - Inspect bit 6 (Data Set Ready)
    BNE put_char_lp ; Loop while bit 6 is set.
                    ; Due to bug in 65C51 an external timer generates
                    ; a positive signal on DSRB line during the transmission.
                    ; We use a NE555 timer with C1 = 0.1uf and R1 = 5.1ko
                    ; to achieve delay 561us (Required min 521us for 19200 baud rate).
    PLA             ; Recover A from the stack
    STA ACIA_DATA   ; Transmit char
    RTS


;
; Wait for a character from ACIA
;
get_char:
    PHA             ; Store A to the stack
    LDA ACIA_STATUS ; Check status
    AND #$08        ; 0b0000100 - inspect bit 3 (Receiver Data Register Full)
    BEQ get_char    ; Wait until ready
    LDA ACIA_DATA   ; Read character
    JSR put_char    ; Echo character
    RTS


;
; Prints the prompt character '>'
;
print_prompt:
    PHA             ; Store A to the stack
    LDA #$3E        ; '>'
    JSR put_char
    PLA             ; Recover A from the stack
    RTS


;
; Prints a nibble (4 bits) as hex digit
;
print_nibble:
    PHA             ; Store A to the stack
    CMP #$0A
    BCC is_digit    ; It is digit when < 10
    ADC #$06        ; Convert A-F to ASCII
is_digit:
    ADC #$30        ; Convert 0-9 to ASCII
    JSR put_char
    PLA             ; Recover A from the stack
    RTS


;
; Prints a byte as two hex digits
;
print_hex:
    PHA             ; Store A to the stack
    PHA
    LSR
    LSR
    LSR
    LSR             ; Get high nibble
    JSR print_nibble
    PLA
    AND #$0F        ; Get low nibble
    JSR print_nibble
    PLA             ; Recover A from the stack
    RTS


;
; Prints a space character
;
print_space:
    PHA             ; Store A to the stack
    LDA #SPACE
    JSR put_char
    PLA             ; Recover A from the stack
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
    ASL
    ASL
    ASL
    ASL             ; Shift to high nibble
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

    ASL
    ASL
    ASL
    ASL
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

;
; Prints welcome message to ACIA
;
say_hi:
    PHA             ; Store A to the stack
    TXA             ; Copy X to A
    PHA             ; Push X to the stack
    LDX #$00        ; Initialize index to 0
say_hi_loop:        ; Loop entry point
    LDA cstr_hi,X   ; Load character at x
    BEQ say_hi_done ; If zero (end of string), exit
    JSR put_char    ; Transmit the character at A
    INX             ; Increment x
    JMP say_hi_loop ; Loop
say_hi_done:        ; Ready
    PLA             ; Pool X value from the stack
    TAX             ; Recover X from the stack
    PLA             ; Recover A from the stack
    RTS             ; Return


;
; String region. Contains zero-terminated strings
;
.ORG = $FF00
cstr_hi: ; "Hello, MOS 65C02!\r\n\0"
        .BYTE $48, $65, $6C, $6C, $6F, $2C, $20, $4D, $4F, $53
        .BYTE $20, $36, $35, $43, $30, $32, $21, $0D, $0A, $00


;
; Entry vectors
;
.ORG = $FFFA
    .WORD nmi_handler       ; NMI
    .WORD reset_handler     ; Reset
    .WORD irq_handler       ; IRQ

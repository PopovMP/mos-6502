; Simple 65C02S Monitor Firmware (WozMon + KIM-1 Inspired)
; Uses 65C51 ACIA for serial I/O and 65C21 PIA for LED output
; Features: Memory read/write, program execution, hex command parser

    ORG $F000           ; Firmware starts at $F000 in EEPROM
    ; Zero page variables
    ZP_ADDR_LO  = $10   ; Address low byte
    ZP_ADDR_HI  = $11   ; Address high byte
    ZP_DATA     = $12   ; Data buffer
    ZP_MODE     = $13   ; Mode: 0=read, 1=write, 2=run
    ZP_TEMP     = $14   ; Temporary storage

    ; Hardware addresses
    ACIA_DATA   = $6000 ; ACIA data register
    ACIA_STATUS = $6001 ; ACIA status register
    ACIA_CTRL   = $6002 ; ACIA control register
    ACIA_CMD    = $6003 ; ACIA command register
    PIA_PORTA   = $6800 ; PIA Port A (LEDs)
    PIA_PORTB   = $6801 ; PIA Port B (unused)
    PIA_CTLA    = $6802 ; PIA Control A
    PIA_CTLB    = $6803 ; PIA Control B

    ; ASCII constants
    CR          = $0D   ; Carriage return
    LF          = $0A   ; Line feed
    SPACE       = $20   ; Space
    DOT         = $2E   ; Period (.)
    COLON       = $3A   ; Colon (:)
    R_CMD       = $52   ; 'R' for run

start:
    SEI                 ; Disable interrupts
    CLD                 ; Clear decimal mode

    ; Initialize PIA (Port A as output for LEDs)
    LDA #$FF            ; Set Port A as output
    STA PIA_PORTA
    LDA #$04            ; Enable Port A output
    STA PIA_CTLA
    LDA #$01            ; LED on (status indicator)
    STA PIA_PORTA

    ; Initialize ACIA (9600 baud, 8N1)
    LDA #$1F         ; 9600 baud, 8-bit, 1 stop, no parity
    STA ACIA_CTRL
    LDA #$0B         ; Enable TX/RX, no interrupts
    STA ACIA_CMD

    ; Initialize variables
    LDA #$00
    STA ZP_MODE      ; Default to read mode
    STA ZP_ADDR_LO
    STA ZP_ADDR_HI

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
    BCS main_loop    ; Ignore invalid input
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
    PHA
put_wait:
    LDA ACIA_STATUS  ; Check status
    AND #$10         ; TX buffer empty?
    BEQ put_wait     ; Wait until ready
    PLA
    STA ACIA_DATA    ; Send character
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
invalid:
    SEC              ; Carry set for invalid
    RTS
is_digit2:
    SEC
    SBC #$30         ; Convert ASCII 0-9 to value
    RTS
is_hex:
    SEC
    SBC #$37         ; Convert ASCII A-F to value
    RTS

store_hex:
    ASL A
    ASL A
    ASL A
    ASL A            ; Shift to high nibble
    STA ZP_TEMP
    JSR get_char
    JSR parse_hex
    BCS store_hex    ; Retry if invalid
    ORA ZP_TEMP      ; Combine nibbles
    STA ZP_DATA
    LDA ZP_MODE
    CMP #$01
    BEQ store_addr   ; In write mode, keep data
    STA ZP_ADDR_LO   ; Store as address low
    JSR get_char
    JSR parse_hex
    BCS store_hex    ; Retry if invalid
    ASL A
    ASL A
    ASL A
    ASL A
    STA ZP_TEMP
    JSR get_char
    JSR parse_hex
    BCS store_hex    ; Retry if invalid
    ORA ZP_TEMP
    STA ZP_ADDR_HI   ; Store address high
    CLC
    RTS

store_addr:
    CLC
    RTS

    ; Reset vector
    ORG $FFFC
    .word start
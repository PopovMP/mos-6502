;
; Hello, MOS 65C02!
;

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
reset_handler           ; Receives a Reset
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

acia_irq                ; Handle ACIA IRQ here
        rti

pia_a_irq               ; Handle PIA Port A IRQ here
        rti

pia_b_irq               ; Handle PIA Port B IRQ here
        rti


;
; Program entry point
;
start
        jsr say_hi
        jmp acia_echo

; Listen for input
; Output it on PIA port A. Echo it back.
acia_echo
        lda ACIA_STATUS
        and #$08        ; Check rx buffer status flag
        beq acia_echo   ; Loop if rx buffer empty

        lda ACIA_DATA   ; Read rx buffer

        jsr wait_1300

        sta PIA_PORT_A  ; Output character to PIA port A
        sta ACIA_DATA   ; Send character
        jmp acia_echo

;
; Prints welcome message to ACIA
;
say_hi
        pha             ; Store A to the stack
        txa             ; Copy X to A
        pha             ; Push X to the stack
        ldx #$00        ; Initialize index to 0
say_hi_loop             ; Loop entry point
        lda message,x   ; Load character at x
        beq say_hi_done ; If zero (end of string), exit
        sta ACIA_DATA   ; Transmit char
        inx             ; Increment x
        jsr wait_1300   ; Because of 65C51N bug, wait programmatically to transmit
        jsr wait_1300   ; Transmission takes 1042us at 9600. We wait for 2x705us
        jmp say_hi_loop ; Loop
say_hi_done             ; Ready
        pla             ; Pool X value from the stack
        tax             ; Recover X from the stack
        pla             ; Recover A from the stack
        rts             ; Return


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


*=$E200
message ; "Hello, MOS 65C02!\r\n\0"
        .BYTE $48, $65, $6C, $6C, $6F, $2C, $20, $4D, $4F, $53
        .BYTE $20, $36, $35, $43, $30, $32, $21, $0D, $0A, $00

; Entry vectors
*=$FFFA
        .WORD nmi_handler       ; NMI
        .WORD reset_handler     ; Reset
        .WORD irq_handler       ; IRQ

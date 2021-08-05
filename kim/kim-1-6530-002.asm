;
; KIM-1 Source Code
;
        PCL    = $EF   ; program counter low
        PCH    = $F0   ; program counter high
        PREG   = $F1   ; status register
        SPUSER = $F2   ; stack pointer
        ACC    = $F3
        YREG   = $F4
        XREG   = $F5
        INL    = $F8   ; input buffer low
        INH    = $F9   ; input buffer high
        POINTL = $FA   ; address L on display
        POINTH = $FB   ; address H on display
        TEMP   = $FC  
        TMPX   = $FD  
        MODE   = $FF  
;                     
        SBD    = $1740 ; I/O B register
        SAD    = $1741 ; I/O A register
        PBDD   = $1742 ; I/O B direction
        PADD   = $1743 ; I/O A direction

*=$1C00
;
; KIM-entry via NMI or IRQ
SAVE    STA     ACC
        PLA
        STA     PREG
        PLA
        STA     PCL
        STA     POINTL
        PLA
        STA     PCH
        STA     POINTH
        STY     YREG
        STX     XREG
        TSX
        STX     SPUSER
        JSR     INITS
        JMP     START
;
; The KIM starts here after a reset
RESET   LDX     #$FF
        TXS             ; set stack
        STX     SPUSER
        JSR     INITS
        JMP     START
;
; Initialization 6520
INITS   LDX     #$01
        STX     MODE    ; Set display to address mode
        LDX     #$00
        STX     PADD    ; PA0..PA7 = input
        LDX     #$3F
        STX     PBDD    ; PB0..PB5 = output
        LDX     #$07    ; Enable data in
        STX     SBD     ; Output
        CLD
        SEI
        RTS
;
; Main routine for keyboard and display
START   JSR     SCAND   ; wait until NO key pressed
        BNE     START   ; if pressed, wait again ->
START1  JSR     SCAND   ; Wait for key...
        BEQ     START1  ; no key ->
        JSR     SCAND   ; debounce key
        BEQ     START1  ; no key ->
        JSR     GETKEY
        CMP     #$15    ; >= $15 = illegal - no kew pressed
        BPL     START   ; yes ->
        CMP     #$10
        BEQ     ADDRM   ; "AD" - addres mode
        CMP     #$11
        BEQ     DATAM   ; "DA" - data mode
        CMP     #$14
        BEQ     PCCMD   ; "PC" - display Program Counter
        CMP     #$12
        BEQ     STEP    ; "+" - step
        CMP     #$13
        BEQ     GOV     ; "GO" - execute program
; One of the hexidecimal buttons has been pushed
        ASL             ; move LSB key number to MSB
        ASL
        ASL
        ASL
        STA     TEMP    ; store for datamode
        LDX     #$04
DATA1   LDY     MODE    ; part of address?
        BNE     ADDR    ; yes ->
        LDA     (POINTL),Y ; get data
        ASL     TEMP
        ROL             ; MSB-TEMP = MSB-key -> A
        STA     (POINTL),Y ; store new data
        JMP     DATA2
ADDR    ASL             ; TEMP not needed here
        ROL     POINTL  ; MSB-key -> POINTL
        ROL     POINTH  ; POINTL -> POINTH
DATA2   DEX             ; 4 times = complete nibble?
        BNE     DATA1   ; no ->
        JMP     START
;
; "AD" - Switch to address mode
ADDRM   LDA     #$01
        STA     MODE
        JMP     START
;
; "DA" -  Switch to data mode
DATAM   LDA     #$00
        STA     MODE
        JMP     START
;
; "PC" - Display PC by moving it to POINT
PCCMD   LDA     PCL
        STA     POINTL
        LDA     PCH
        STA     POINTH
        JMP     START
;
; "+" key. Increment address on display
; It is a 2-byte word so increment Low first. Increment High if necessery.
STEP    INC     POINTL ; Increment the Low byte.
        BNE     STEP1  ; Check if 0. If not, branch to end.
        INC     POINTH ; If Low byte equal to 0, increment the High byte.
STEP1   JMP     START
;
; "GO" - Start a program at displayed address.
; RTI is used as a comfortable way to define all flags in one move.
GOV     LDX     SPUSER  ; user user defined stack
        TXS
        LDA     POINTH  ; program runs from
        PHA             ;  displayed address
        LDA     POINTL
        PHA
        LDA     PREG    ; user defined Flag register
        PHA
        LDX     XREG
        LDY     YREG
        LDA     ACC
        RTI             ; start program
;
; Output to 7-segment-display
SCAND   LDY     #$00    ; POINTL/POINTH = address on display
        LDA     (POINTL),Y ; get data from this address
        STA     INH     ; store in INH =
        LDA     #$7F    ; PA0..PA6 := output
        STA     PADD
        LDX     #$09    ; Start with display at output 4
        LDY     #$03    ; 3 bytes to be shown
SCAND1  LDA     INL,Y   ; get byte
        LSR             ; get MSD by shifting A
        LSR
        LSR
        LSR
        JSR     CONVD
        LDA     INL,Y   ; get byte again
        AND     #$0F    ; get LSD
        JSR     CONVD
        DEY             ; all ?
        BNE     SCAND1  ; no ->
        STX     SBD     ; all digits off
        LDA     #$00    ; Change segment 
        STA     PADD    ; PA0..PA7 := input
; Determine if key is depressed: NO -> A=0, YES -> A>0
        LDY     #$03    ; 3 rows
        LDX     #$01    ; select 74145 output 0
ONEKEY  LDA     #$FF    ; initial value
AK1     STX     SBD     ; enable output = select row
        INX
        INX             ; prepare for next row
        AND     SAD     ; A := A && (PA0..PA7)
        DEY             ; all rows?
        BNE     AK1     ; no ->
        LDY     #$07
        STY     SBD     ; select 74145 output 3 (not used)
        ORA     #$80    ; mask bit 7 of A
        EOR     #$FF    ; if A still is $FF -> A := 0
        RTS
;
; Convert digit into 7-segment-value
CONVD   STY     TEMP
        TAY
        LDA     TABLE,Y
        LDY     #$00
        STY     SAD     ; turn off segments
        STX     SBD     ; select 7-s-display
        STA     SAD     ; output code on display
        LDY     #$49    ; #$7F delay ~500 cycles
CONVD1  DEY
        BNE     CONVD1
        INX             ; Get next digit number
        INX             ; Add 2
        LDY     TEMP    ; Restore Y
        RTS
;
; Get key from keyboard in A
GETKEY  LDX     #$21    ; row 0
GETKE5  LDY     #$01    ; only one row in the time
        JSR     ONEKEY  ; key?
        BNE     KEYIN   ; yes ->
        CPX     #$27    ; last row?
        BNE     GETKE5  ; no, next one ->
        LDA     #$15    ; 15 = no key
        RTS
KEYIN   LDY     #$FF    ; Y := key number
KEYIN1  ASL             ; shift A until
        BCS     KEYIN2  ;  bit = 1 ->
;
; Comment: bit 7 is always 0 so Carry is always 0 the first time
;  and allowing Y to become 0 (key $FF does not exist)
        INY
        BPL     KEYIN1  ; always ->
KEYIN2  TXA
        AND     #$0F    ; strip bit4..7
        LSR             ; A := row+1
        TAX             ; X := actual row+1
        TYA
        BPL     KEYIN4  ; always, because Y<7 ->
;
; Add 7 to A for every row above 0 to get actual key number
KEYIN3  CLC
        ADC     #$07    ; add (X-1) times 7 to A
KEYIN4  DEX             ; countdown to 0
        BNE     KEYIN3
        RTS             ; A is always < 21 eg. < $15
;
; Hex -> 7-segment
*=$1FE7
;               0    1    2    3    4    5    6    7
TABLE   .BYTE   $BF, $86, $DB, $CF, $E6, $ED, $FD, $87
        .BYTE   $FF, $EF, $F7, $FC, $B9, $DE, $F9, $F1
;               8    9    A    B    C    D    E    F
;
; Entry vectors
*=$1FFA
        .WORD   SAVE    ; NMI
        .WORD   RESET   ; Reset
        .WORD   SAVE    ; IRQ

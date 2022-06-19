;
; KIM-1 Source Code
;
; MPU reg. save area in Page 0
        PCL     = $EF   ; Program counter low
        PCH     = $F0   ; Program counter high
        PREG    = $F1   ; Current status register
        SPUSER  = $F2   ; Current stack pointer
        ACC     = $F3   ; Accumulator
        YREG    = $F4   ; Y index
        XREG    = $F5   ; X index
; KIM fixed area in Page 0
        INL     = $F8   ; Input buffer low
        INH     = $F9   ; Input buffer high
        POINTL  = $FA   ; LSB of address on display
        POINTH  = $FB   ; MSB of address on display
        TEMP    = $FC
        TMPX    = $FD
        MODE    = $FF   ; Keyboard mode: 0 = data, 1 = address,
;
        SBD     = $8040 ; I/O B register
        SAD     = $804F ; I/O A register
        PBDD    = $8042 ; I/O B direction
        PADD    = $8043 ; I/O A direction
;
*=$C000
;
; KIM-entry via NMI or IRQ
SAVE    STA     ACC
        PLA
        STA     PREG
        PLA             ; KIM entry via JSR (A lost)
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
RST     LDX     #$FF
        TXS             ; set stack
        STX     SPUSER
        JSR     INITS
        JMP     START
;
; Main routine for keyboard and display
START   JSR     INIT1
TTYKB   JSR     SCAND   ; Wait until NO key pressed
        BNE     START   ; if pressed, wait again ->
TTYKB1  JSR     SCAND   ; Wait for key...
        BEQ     TTYKB1  ; no key ->
        JSR     SCAND   ; debounce key
        BEQ     TTYKB1  ; no key ->
GETK    JSR     GETKEY
        CMP     #$15    ; >= $15 = illegal - no kew pressed
        BPL     START   ; yes ->
        CMP     #$14
        BEQ     PCCMD   ; "PC" - display Program Counter
        CMP     #$10
        BEQ     ADDRM   ; "AD" - address mode
        CMP     #$11
        BEQ     DATAM   ; "DA" - data mode
        CMP     #$12
        BEQ     STEP    ; "+" - step
        CMP     #$13
        BEQ     GOV     ; "GO" - execute program
DATA    ASL             ; One of the hexadecimal buttons has been pushed
        ASL             ; move LSB key number to MSB
        ASL
        ASL
        STA     TEMP    ; store for data mode
        LDX     #$04
DATA1   LDY     MODE    ; part of address?
        BNE     ADDR    ; yes ->
        LDA     (POINTL),Y ; get data
        ASL     TEMP
        ROL             ; MSB-TEMP = MSB-key -> A
        STA     (POINTL),Y ; store new data
        JMP     DATA2
;
ADDR    ASL             ; TEMP not needed here
        ROL     POINTL  ; MSB-key -> POINTL
        ROL     POINTH  ; POINTL -> POINTH
DATA2   DEX             ; 4 times = complete nibble?
        BNE     DATA1   ; no ->
        BEQ     DATAM2  ; -> always
;
; "AD" - Switch to address mode
ADDRM   LDA     #$01
        BNE     DATAM1  ; -> always
;
; "DA" -  Switch to data mode
DATAM   LDA     #$00
DATAM1  STA     MODE
DATAM2  JMP     START
;
; "+" key. Increment address on display
STEP    JSR     INCPT
		JMP     START
;
; "GO" - Start a program at displayed address.
GOV     JMP     GOEXEC
;
; "PC" - Display PC by moving it to POINT
PCCMD   LDA     PCL
        STA     POINTL
        LDA     PCH
        STA     POINTH
        JMP     START
;
; RTI is used as a comfortable way to define all flags in one move.
GOEXEC  LDX     SPUSER  ; user user defined stack
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
; Initialization VIA 6522 for KIM Display / Keyboard
INITS   LDX     #$01
        STX     MODE    ; Set display to address mode
INIT1   LDX     #$00    ; 0000 0000
        STX     PADD    ; PA0..PA7 = input
        LDX     #$1E    ; 0001 1110
        STX     PBDD    ; PB1..PB4 = output
        CLD
        SEI
        RTS
; Determine if key is depressed: NO -> A=0, YES -> A>0
AK      LDY     #$03    ; 3 rows
        LDX     #$01    ; select 74145 output 0
ONEKEY  LDA     #$FF    ; initial value
AK1     STX     SBD     ; enable output = select row
        INX
        INX             ; prepare for next row
        AND     SAD     ; A := A && (PA0..PA7)
        DEY             ; all rows?
        BNE     AK1     ; not yet, Y > 0 ->
        ORA     #$80    ; mask bit 7 of A
        EOR     #$FF    ; if A still is $FF -> A := 0
        RTS
;
; Output to 7-segment-display
SCAND   LDY     #$00    ; POINTL/POINTH = address on display
        LDA     (POINTL),Y ; get data from this address
        STA     INH     ; store in INH =
SCANDS  LDA     #$7F    ; PA0..PA6 := output
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
        JMP     AK      ; GET ANY KEY
; Convert digit into 7-segment-value
CONVD   STY     TEMP
        TAY
        LDA     TABLE,Y
        LDY     #$00
        STY     SAD     ; Turn off segments
        STX     SBD     ; Select 7-s-display
        STA     SAD     ; Output code on display
        LDY     #$7F    ; Delay ~500 cycles
CONVD1  DEY
        BNE     CONVD1
        INX             ; Get next digit number
        INX             ; Add 2
        LDY     TEMP    ; Restore Y
        RTS
; Increment POINT = address on display
INCPT   INC     POINTL
		BNE     INCPT2
		INC     POINTH
INCPT2  RTS
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
        INY
        BPL     KEYIN1  ; always ->
KEYIN2  TXA
        AND     #$0F    ; strip bit4..7
        LSR             ; A := row+1
        TAX             ; X := actual row+1
        TYA
        BPL     KEYIN4  ; always, because Y<7 ->
KEYIN3  CLC             ; Add 7 to A for every row above 0 to get actual key number
        ADC     #$07    ; add (X-1) times 7 to A
KEYIN4  DEX             ; countdown to 0
        BNE     KEYIN3
        RTS             ; A is always < 21 eg. < $15
;
; Hex -> 7-segment
;               0    1    2    3    4    5    6    7
TABLE   .BYTE   $BF, $86, $DB, $CF, $E6, $ED, $FD, $87
        .BYTE   $FF, $EF, $F7, $FC, $B9, $DE, $F9, $F1
;               8    9    A    B    C    D    E    F
;
; Entry vectors
*=$FFFA
        .WORD   SAVE    ; NMI
        .WORD   RST     ; Reset
        .WORD   SAVE    ; IRQ

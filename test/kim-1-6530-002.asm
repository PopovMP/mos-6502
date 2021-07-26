
	PCL 	= $EF	; Program counter low
	PCH 	= $F0	; Program counter high
	PREG    = $F1	; Status register
	SPUSER  = $F2	; Stack pointer
	ACC 	= $F3	; Accumulator
	YREG    = $F4	; Y index
	XREG    = $F5	; X index
;
; Kim fixed area in page 0
;
	CHKHI   = $F6
	CHKSUM  = $F7
	INL 	= $F8	; Input buffer low
	INH 	= $F9	; Input buffer high
	POINTL  = $FA	; Address L on display (open cell)
	POINTH  = $FB	; Address H on display (open cell)
	TEMP    = $FC
	TMPX    = $FD
	CHAR    = $FE
	MODE    = $FF
;
; Set up for 6530-002 I/O
;
	SAD 	= $1740	; A data register
	PADD    = $1741	; A data direction register
	SBD 	= $1742	; B data register
	PBDD    = $1743	; B data direction register
	CLK1T   = $1744 ; Timer div by 1
	CLK8T   = $1745 ; Timer div by 8
	CLK64T  = $1746 ; Timer div by 64
	CLKKT   = $1747 ; Timer div by 1024
	CLKRDI  = $1747 ; Read time out BIT
	CLKRDT  = $1746 ; Read time
;
; Kim fixed area in page 23
;
	CHKL    = $17E7
	CHKH    = $17E8 ; Checksum
	SAVX    = $17E9
	VEB 	= $17EC	; Volatile execution block
	CNTL30  = $17F2 ; TTY Delay
	CNTH30  = $17F3	; TTY Delay
	TIMH    = $17F4
	SAL 	= $17F5 ; Starting address of program Low / High
	SAH 	= $17F6 ;
	EAL 	= $17F7	; End address of program Low / High
	EAH 	= $17F8	;
	ID  	= $17F9	; Tape program ID number

;
; Interrupt vectors
;
	NMIV    = $17FA ; NMI-vector (STP -> $1C00)
	RSTV    = $17FC ; RST-vector (RST -> $1800)
	IRQV    = $17FE ; IRQ-vector (BRK -> $1C00)


*= $1C00

; KIM-entry via STOP (NMI) or BRK (IRQ)
SAVE    STA     ACC
    	PLA
	    STA     PREG
;
; KIM-entry via JSR (Accumulator lost)
SAVEA   PLA
    	STA     PCL
    	STA     POINTL
    	PLA
    	STA     PCH
    	STA     POINTH
;
SAVEB   STY     YREG
    	STX     XREG
	    TSX
	    STX     SPUSER
	    JSR     INITS
	    JMP     START
;
; NMI AND IRQ are called via RAM-vector. This enables the programmer
; to insert his own routines.
NMIT    JMP     (NMIV) ; Non-maskable interrupt Trap
IRQT    JMP     (IRQV) ; Interrupt Trap
;
; The KIM starts here after a reset
RESET   LDX     #$FF
	    TXS             ; set stack
	    STX     SPUSER
	    JSR     INITS
;
; Determine characters per second
DETCPS  LDA     #$FF    ; count start BIT
	    STA     CNTH30  ; zero CNTH30
;
; Test first keyboard or teleprinter
    	LDA     #1      ; mask BIT 0
DET1    BIT     SAD     ; test for teleprinter
	    BNE     START   ; no ->
    	BMI     DET1    ; no start BIT, wait for it ->
    	LDA     #$FC
DET3    CLC             ; this loop counts start BIT time
    	ADC     #1      ; A=0 ?
    	BCC     DET2    ; no ->
    	INC     CNTH30
DET2    LDY     SAD     ; check for end of start BIT
	BPL     DET3    ; no ->
	STA     CNTL30
	LDX     #8
	JSR     GET5    ; get rest of char, test char
;
; Make TTY/KB selection
START   JSR     INIT1
    	LDA     #1      ; read jumper
    	BIT     SAD     ; TTY ?
    	BNE     TTYKB   ; no -> keyboard/display-routine
    	JSR     CRLF    ; print return/linefeed
    	LDX     #$0A
    	JSR     PRTST   ; print 'KIM'
    	JMP     SHOW1
;
;
CLEAR   LDA     #0
    	STA     INL     ; clear input buffer
    	STA     INH
;
READ    JSR     GETCH   ; get char from TTY
    	CMP     #1      ; 1 has no meaning for TTY
    	BEQ     TTYKB   ; 1 = KB-mode ->
    	JSR     PACK
    	JMP     SCAN
;
; Main routine for keyboard AND display
TTYKB   JSR     SCAND   ; wait until NO key pressed
	    BNE     START   ; if pressed, wait again ->
TTYKB1  LDA     #1      ; check KB/TTY mode
    	BIT     SAD     ; TTY?
    	BEQ     START   ; yes ->
    	JSR     SCAND   ; Wait for key...
    	BEQ     TTYKB1  ; no key ->
    	JSR     SCAND   ; debounce key
    	BEQ     TTYKB1  ; no key ->
;
GETK    JSR     GETKEY
	    CMP     #$15    ; >= $15 = illegal
	    BPL     START   ; yes ->
    	CMP     #$14
	    BEQ     PCCMD   ; "PC" display Program Counter
    	CMP     #$10
    	BEQ     ADDRM   ; "AD" addres mode
    	CMP     #$11
    	BEQ     DATAM   ; "DA" data mode
    	CMP     #$12
    	BEQ     STEP    ; "+"  step
    	CMP     #$13
    	BEQ     GOV     ; "GO" execute program
;
; One of the hexidecimal buttons has been pushed
DATA    ASL             ; move LSB key number to MSB
	    ASL
	    ASL
	    ASL
	    STA     TEMP    ; store for datamode
	    LDX     #4

DATA1   LDY     MODE    ; part of address?
    	BNE     ADDR    ; yes ->

    	LDA     (POINTL),Y      ; get data
    	ASL     TEMP
    	ROL             ; MSB-TEMP = MSB-key -> A
    	STA     (POINTL),Y      ; store new data
    	JMP     DATA2

ADDR    ASL             ; TEMP not needed here
    	ROL     POINTL  ; MSB-key -> POINTL
    	ROL     POINTH  ; POINTL -> POINTH

DATA2   DEX             ; 4 times = complete nibble?
    	BNE     DATA1   ; no ->

    	BEQ     DATAM2  ; -> always
;
; Switch to address mode
ADDRM   LDA     #1
	BNE     DATAM1  ; -> always
;
; Switch to data mode
DATAM   LDA     #0
DATAM1  STA     MODE
DATAM2  JMP     START
;
; Increment address on display
STEP    JSR     INCPT
	    JMP     START
;
GOV     JMP     GOEXEC
;
; Display PC by moving it to POINT
PCCMD   LDA     PCL
    	STA     POINTL
    	LDA     PCH
    	STA     POINTH
    	JMP     START
;
; Load papertape from TTY
LOAD    JSR     GETCH
		CMP     #$3B    ; ":", semicolon?
		BNE     LOAD    ; No -> again

LOADS   LDA     #0
		STA     CHKSUM
		STA     CHKHI
;
		JSR     GETBYT  ; get byte CNT
		TAX
		JSR     CHK     ; Compute checksum
;
		JSR     GETBYT  ; get address HI
		STA     POINTH
		JSR     CHK     ; Compute checksum
;
		JSR     GETBYT  ; get address LO
		STA     POINTL
		JSR     CHK     ; Compute checksum
;
		TXA             ; CNT = 0 ?
		BEQ     LOAD3
;
LOAD2   JSR     GETBYT  ; get DATA
		STA     (POINTL),y      ; store data
		JSR     CHK
		JSR     INCPT
		DEX
		BNE     LOAD2

		INX             ; X=1 = data record
			; X=0 = last record
;
LOAD3   JSR     GETBYT  ; compare checksum
		CMP     CHKHI
		BNE     LOADE1

		JSR     GETBYT
		CMP     CHKSUM
		BNE     LOADER
;
		TXA             ; X=0 = last record
		BNE     LOAD
;
LOAD7   LDX     #$0C    ; X-OFF KIM
LOAD8   LDA     #$27
		STA     SBD     ; disable data in
		JSR     PRTST
		JMP     START
;
LOADE1  JSR     GETBYT  ; dummy
LOADER  LDX     #$11    ; X-OFF error KIM
		BNE     LOAD8   ; always ->
;
; Dump to TTY from open cell address to LIMHL, LIMHH
DUMP    LDA     #0
		STA     INL
		STA     INH     ; clear record count
DUMP0   LDA     #0
		STA     CHKHI   ; clear checksum
		STA     CHKSUM
;
DUMP1   JSR     CRLF
		LDA     #$3B    ; ":"
		JSR     OUTCH
;
; Check if POINTL/H >= EAL/H
		LDA     POINTL
		CMP     EAL
;
		LDA     POINTH
		SBC     EAH
		BCC     DUMP4   ; no ->
;
		LDA     #0      ; print last record
		JSR     PRTBYT  ; 0 bytes
		JSR     OPEN
		JSR     PRTPNT
;
		LDA     CHKHI   ; print checksum
		JSR     PRTPNT  ;  for last record
		LDA     CHKSUM
		JSR     PRTBYT
		JSR     CHK
		JMP     CLEAR
;
DUMP4   LDA     #$18    ; print 24 bytes
		TAX             ; save as index
		JSR     PRTBYT
		JSR     CHK
		JSR     PRTPNT
;
DUMP2   LDY     #0
		LDA     (POINTL),y
		JSR     PRTBYT  ; print data
		JSR     CHK
		JSR     INCPT
		DEX             ; Printed everything?
		BNE     DUMP2   ; No ->
;
		LDA     CHKHI
		JSR     PRTBYT  ; print checksum
		LDA     CHKSUM
		JSR     PRTBYT
		INC     INL     ; increment recourd counter
		BNE     DUMP3

		INC     INH
DUMP3   JMP     DUMP0
;
SPACE   JSR     OPEN    ; open new cell
SHOW    JSR     CRLF
SHOW1   JSR     PRTPNT
		JSR     OUTSP   ; print space
		LDY     #0
		LDA     (POINTL),y      ; print data
		JSR     PRTBYT
		JSR     OUTSP   ; print space
		JMP     CLEAR
;
RTRN    JSR     INCPT   ; next address
		JMP     SHOW

; Start a program at displayed address. RTI is used as a comfortable
;  way to define all flags in one move.
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
;
; Take care if TTY-input
SCAN    CMP     #$20    ; open new cell
		BEQ     SPACE

		CMP     #$7F    ; rub out, restart KIM
		BEQ     STV

		CMP     #$0D    ; next cell
		BEQ     RTRN

		CMP     #$0A    ; prev cell
		BEQ     FEED

		CMP     #$2E    ; "." = modify cell
		BEQ     MODIFY

		CMP     #$47    ; "G" = exec program
		BEQ     GOEXEC

		CMP     #$51    ; "Q" = dump from open cell
		BEQ     DUMPV   ;  to HI limit

		CMP     #$4C    ; "L" = load tape
		BEQ     LOADV

		JMP     READ    ; ignore illegal CHAR
;
STV     JMP     START
DUMPV   JMP     DUMP
LOADV   JMP     LOAD
;
FEED    SEC
		LDA     POINTL  ; decrement POINTL/H
		SBC     #1
		STA     POINTL
		BCS     FEED1

		DEC     POINTH
FEED1   JMP     SHOW
;
MODIFY  LDY     #0      ; get contents of input buffer
		LDA     INL     ;  INL AND store in location
		STA     (POINTL),y      ;  specified by POINT
		JMP     RTRN
;
; Subroutine to print POINT = address
PRTPNT  LDA     POINTH
		JSR     PRTBYT
		JSR     CHK
		LDA     POINTL
		JSR     PRTBYT
		JSR     CHK
		RTS
;
; Print ASCII-string from TOP+X to TOP
CRLF    LDX     #7      ; output <RETURN> AND <LF>
PRTST   LDA     TOP,x
		JSR     OUTCH
		DEX             ; everything?
		BPL     PRTST   ; no ->

PRT1    RTS
;
; Print 1 hex byte as 2 ASCII chars
PRTBYT  STA     TEMP    ; save A
		LSR             ; shift A 4 times
		LSR
		LSR
		LSR
		JSR     HEXTA   ; convert BIT 4..7 to HEX AND print
		LDA     TEMP
		JSR     HEXTA   ; convert BIT 0..7 to HEX AND print
		LDA     TEMP    ; restore A
		RTS
;
HEXTA   AND     #$0F    ; mask BIT 0..4
		CMP     #$0A    ; >10 ?
		CLC
		BMI     HEXTA1  ; no ->

		ADC     #7      ; A..F
HEXTA1  ADC     #$30    ; convert to ASCII-char...
		JMP     OUTCH   ;  ...AND print it
;
; Get char from TTY in A
GETCH   STX     TMPX
		LDX     #8      ; count 8 bits
		LDA     #1
GET1    BIT     SAD     ; check if TTY-mode
		BNE     GET6    ; no ->

; PA7 is input TTY
		BMI     GET1    ; wait for startbit

		JSR     DELAY   ; delay 1       BIT
;
; By delaying another half BIT time, you read the BIT in the middle
; of every BIT.
GET5    JSR     DEHALF  ; delay 1/2 BIT time
GET2    LDA     SAD
		AND     #$80    ; mask BIT 7
		LSR     CHAR    ; shift last result
		ORA     CHAR    ; OR it with new BIT
		STA     CHAR    ; AND store it again
		JSR     DELAY
		DEX
		BNE     GET2    ; next BIT

		JSR     DEHALF  ; why ????
;
		LDX     TMPX
		LDA     CHAR
		ROL     		; shift off stopbit
		LSR
GET6    RTS
;
; Initialization 6530   $1E88
INITS   LDX     #1      ; set display to address mode
		STX     MODE
;
INIT1   LDX     #0
		STX     PADD    ; PA0..PA7 = input
		LDX     #$3F
		STX     PBDD    ; PB0..PB5 = output
						; PB6, PB7 = input
		LDX     #7      ; enable 74145 output 3 to
		STX     SBD     ;  check KB/TTY-mode
		CLD
		SEI
		RTS
;
; Output char in A to TTY       $1E9E
OUTSP   LDA     #" "    ; print space
OUTCH   STA     CHAR
		STX     TMPX
		JSR     DELAY
		LDA     SBD
		AND     #$FE    ; send startbit
		STA     SBD     ; PB0 = 0 -> TTY := (H)
		JSR     DELAY
;
		LDX     #8      ; send character
OUT1    LDA     SBD
		AND     #$FE    ; clear BIT 0
		LSR     CHAR    ; shift byte
		ADC     #0      ; add Carry = former BIT 0
		STA     SBD     ; output BIT
		JSR     DELAY
		DEX             ; all bits?
		BNE     OUT1    ; no ->

		LDA     SBD
		ORA     #1
		STA     SBD     ; stop BIT
		JSR     DELAY
		LDX     TMPX
		RTS
;
; Delay 1 BIT time as determined by DETCPS
DELAY   LDA     CNTH30
		STA     TIMH
		LDA     CNTL30
DE2     SEC
DE4     SBC     #1
		BCS     DE3     ; A<>$FF ->

		DEC     TIMH
DE3     LDY     TIMH    ; TIMH > 0 ?
		BPL     DE2     ; yes ->

		RTS
;
; Delay half a BIT time
DEHALF  LDA     CNTH30
		STA     TIMH
		LDA     CNTL30
		LSR
		LSR     TIMH
		BCC     DE2

		ORA     #$80
		BCS     DE4     ; always ->
;
; Determine if key is depressed: NO -> A=0, YES -> A>0
AK      LDY     #3      ; 3 rows
		LDX     #1      ; select 74145 output 0

ONEKEY  LDA     #$FF    ; initial value
;
AKA     STX     SBD     ; enable output = select row
		INX
		INX             ; prepare for next row
		AND     SAD     ; A := A && (PA0..PA7)
		DEY             ; all rows?
		BNE     AKA     ; no ->

		LDY     #7
		STY     SBD     ; select 74145 output 3 (not used)
;
		ORA     #$80    ; mask BIT 7 of A
		eor     #$FF    ; if A still is $FF -> A := 0
		RTS
;
; Output to 7-segment-display
SCAND   LDY     #0      ; POINTL/POINTH = address on display
		LDA     (POINTL),Y      ; get data from this address
		STA     INH     ; store in INH =
SCANDS  LDA     #$7F    ; PA0..PA6 := output
		STA     PADD

		LDX     #9      ; Start with display at output 4
		LDY     #3      ; 3 bytes to be shown
;
SCAND1  LDA     INL,y	; get byte
		LSR             ; get MSD by shifting A
		LSR
		LSR
		LSR
		JSR     CONVD
		LDA     INL,y	; get byte again
		AND     #$0F    ; get LSD
		JSR     CONVD
		DEY             ; all ?
		BNE     SCAND1  ; no ->

		STY     SBD     ; all digits off
		LDA     #0
		STA     PADD    ; PA0..PA7 := input
		JMP     AK
;
; Convert digit into 7-segment-value
CONVD   STY     TEMP
	    TAY
	    LDA     TABLE,Y
	    LDY     #0
	    STY     SAD     ; turn off segments
	    STX     SBD     ; select 7-s-display
	    STA     SAD     ; output code on display

	    LDY     #$7F    ; delay ~500 cycles
CONVD1  DEY
	    BNE     CONVD1

	    INX             ; next display
	    INX
	    LDY     TEMP
	    RTS
;
; Increment POINT = address on display
INCPT   INC     POINTL
    	BNE     INCPT2

    	INC     POINTH
INCPT2  RTS
;
; Get key from keyboard in A
;
GETKEY  LDX     #$21    ; row 0 / disable input TTY
GETKE5  LDY     #1      ; only one row in the time
    	JSR     ONEKEY  ; key?
    	BNE     KEYIN   ; yes ->

	    cpx     #$27    ; last row?
    	BNE     GETKE5  ; no, next one ->

    	LDA     #$15    ; 15 = no key
    	RTS
;
KEYIN   LDY     #$FF    ; Y := key number
KEYIN1  ASL             ; shift A until
    	BCS     KEYIN2  ;  BIT = 1 ->
;
; Comment: BIT 7 is always 0 so Carry is always 0 the first time
;  AND allowing Y to become 0 (key $FF does not exist)
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
	ADC     #7      ; add (X-1) times 7 to A
KEYIN4  DEX             ; countdown to 0
    	BNE     KEYIN3

    	RTS             ; A is always < 21 eg. < $15
;
; Compute checksum
CHK     CLC
	    ADC     CHKSUM
    	STA     CHKSUM
	    LDA     CHKHI
    	ADC     #0
    	STA     CHKHI
    	RTS
;
; Get 2 hex-chars AND pack into INL AND INH
;  Non hex char will be loaded as nearsest hex equivalent
GETBYT  JSR     GETCH
	    JSR     PACK
	    LSR     GETCH
    	JSR     PACK
    	LDA     INL
	    RTS
;
; Shift char in A into INL AND INH
PACK    CMP     #$30    ; is hex?
	    BMI     UPDAT2  ; < = no ->

	    CMP     #$47
	    BPL     UPDAT2  ; > = no ->

HEXNUM  CMP     #$40    ; A..F ?
	    BMI     UPDATE  ; no ->

HEXALP  CLC
	    ADC     #9
UPDATE  ROL     ; shift to BIT 4..7
    	ROL
    	ROL
    	ROL
    	LDY     #4      ; shift into INL/INH
UPDAT1  ROL
    	ROL     INL
    	ROL     INH
    	DEY     ; 4 times?
    	BNE     UPDAT1  ; no ->

    	LDA     #0      ; if hex number -> A := 0
UPDAT2  RTS
;
OPEN    LDA     INL     ; move I/O-buffer to POINT
    	STA     POINTL
    	LDA     INH
    	STA     POINTH
    	RTS
;
; Tabels
TOP     .BYTE     0, 0, 0, 0, 0, 0, $A0, $AD
    	.BYTE     $4D, $49, $4B            ; "MIK"
    	.BYTE     $20, $13
    	.BYTE     $50, $52, $45, $20,  $13 ; "RRE "

; Hex -> 7-segment
;                  0    1    2    3    4    5    6    7
TABLE   .BYTE     $BF, $86, $DB, $CF, $E6, $ED, $FD, $87
;                  8    9    A    B    C    D    E    F
	    .BYTE     $FF, $EF, $F7, $FC, $B9, $DE, $F9, $F1
;
; Comment: if everything is compiled right, next vectors should
;  start at $1FFA
        *=    $1FFA
NMIENT  .WORD NMIT
RSTENT  .WORD RESET
IRQENT  .WORD IRQT

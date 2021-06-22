;
;   ________                                _____  .____    .__  _____
;  /  _____/_____    _____   ____     _____/ ____\ |    |   |__|/ ____\____
; /   \  ___\__  \  /     \_/ __ \   /  _ \   __\  |    |   |  \   __\/ __ \
; \    \_\  \/ __ \|  Y Y  \  ___/  (  <_> )  |    |    |___|  ||  | \  ___/
;  \______  (____  /__|_|  /\___  >  \____/|__|    |_______ \__||__|  \___  >
;         \/     \/      \/     \/                         \/             \/
;

; Run the emulator to show the initial map
; Run it again to show the next life cycle

; Initialize variables
ch_live    = $2A   ; Character for live cell
ch_dead    = $00   ; Character for dead cell
main_map   = $0400 ; Main map location
helper_map = $0600 ; Helper map location

; Program address
* = $0800

                LDX #$FF             ; Reset stack pointer
                TXS
                LDA #0               ; Reset A
                LDX #0               ; Reset X
                LDY #0               ; Reset Y
                CLI                  ; Clear Interrupt disable flag

                JSR init_map         ; Initialize main map with life
                BRK                  ; Break to show the initial map

game_loop       JSR examine_cells    ; Count each cell neighbours (store in temp map)
                JSR toggle_cells     ; Toggle cells according to the GoL rules
                BRK                  ; Break after each cycle
                JMP game_loop        ; Loop game

;----------------------------------------;
; Initialize main map with life          ;
;----------------------------------------;

init_map        LDX #0
                LDY spaceship,X
                LDA #ch_live

init_map_loop   STA main_map,Y

                INX
                LDY spaceship,X
                BEQ init_map_end
                JMP init_map_loop

spaceship      .BYTE $AA,$AD,$B9,$C9,$CD,$D9,$DA,$DB,$DC,0

init_map_end    RTS

;---------------------------------------;
; Examine all cells in main map.        ;
;---------------------------------------;

examine_cells   LDA #0
                STA examine_pos       ; Set position to 0 (start of map)

examine_loop    LDA examine_pos       ; Load current position in A
                JSR count_nbrs        ; Count neighbours
                LDX examine_pos       ; Load current position in X
                STA helper_map,X      ; Store the count of neighbours in helper map

                LDA examine_pos       ; Load current position
                CMP #$FF              ; Check if it is at the end of the map
                BEQ examine_end       ; If true, finish
                INC examine_pos
                JMP examine_loop

examine_pos     NOP                   ; Current cell's position
examine_end     RTS


;--------------------------------------;
; Count neighbours of the cell in A    ;
;--------------------------------------;

count_nbrs      STA count_nbrs_cell ; Backup cell position
                LDA #0
                STA count_nbrs_res  ; Reset counter
                LDX #0
                LDY dir_offset,X

count_loop      LDA count_nbrs_cell ; Recover cell position
                CLC
                ADC dir_offset,X    ; Adjust A
                TAY                 ; Transfer A to Y
                LDA main_map,Y      ; Load target cell in A
                BEQ count_continue  ; Branch if A zero ( dead cell )
                INC count_nbrs_res  ; Increment result if target alive

count_continue  INX
                LDY dir_offset,X
                BEQ count_nbrs_end
                JMP count_loop

dir_offset      .BYTE $EF,$F0,$F1,$FF,$01,$0F,$10,$11,0

count_nbrs_cell NOP                 ; Current cell position
count_nbrs_res  NOP                 ; Counter for the neighbours
count_nbrs_end  LDA count_nbrs_res  ; Load result in A
                RTS                 ; Return


;------------------------------------------;
; Toggle each cell live or dead            ;
;------------------------------------------;

toggle_cells    LDA #0
                STA tggl_pos

tgl_loop        LDX tggl_pos        ; Load current position in X
                LDA helper_map,X    ; Get count of neighbours

                ; Rule 1 - Any cell with fewer than two live neighbours dies.
                CMP #2
                BMI tggl_make_dead  ; A < 2

                ; Rule 2 - Any cell with more than three live neighbours dies.
                CMP #4
                BPL tggl_make_dead  ; A >= 4

                ; Rule 3 - Any cell with exactly three live neighbours becomes live.
                CMP #3
                BEQ tggl_make_live  ; A == 3

tgl_next        LDA tggl_pos        ; Load current position
                CMP #$FF            ; Check if it is at the end of the map
                BEQ tggl_end        ; If true, finish
                INC tggl_pos        ; if not, increment position
                JMP tgl_loop        ; Loop

                ; Make cell dead
tggl_make_dead  LDX tggl_pos
                LDA #ch_dead
                STA main_map,X
                JMP tgl_next

                ; Make cell live
tggl_make_live  LDX tggl_pos
                LDA #ch_live
                STA main_map,X
                JMP tgl_next

tggl_pos        NOP                 ; Cell position
tggl_end        RTS


;------------------------------------------;
; Continue after BRK                       ;
;------------------------------------------;

brk_proc        LDX #$FF             ; Reset stack pointer
                TXS
                JMP game_loop        ; Continue Game of Life


;-----------------------------------;

* = $FFFE       ; Set BRK vector
                .WORD brk_proc

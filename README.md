# MOS 6502 Emulator

Yet another emulator of the great MOS 6502 processor.

![MOS 6502](https://www.masswerk.at/6502/MOS_6502AD_4585.jpg "MOS 6502")

## Why?

To learn the processor and its Assembly.

## Try online

 Online 6502 emulator: https://popovmp.github.io/mos-6502/


### Specifics:

We created this emulator to be easier to monitor the internal work of MOS 6502.

It shows:

 * Code disassembly on "Load"

```text
                       Disassembly
---------------------------------------------------------
$0800   A9 0D      LDA #$0D       ; Load Accumulator
$0802   85 00      STA $00        ; Store Accumulator
$0804   A9 00      LDA #$00       ; Load Accumulator
$0806   85 01      STA $01        ; Store Accumulator
$0808   A9 01      LDA #$01       ; Load Accumulator
$080A   85 02      STA $02        ; Store Accumulator
$080C   A2 01      LDX #$01       ; Load X Register
```

 * Object code:

```text
                       Object code
---------------------------------------------------------
0800: A9 0D 85 00 A9 00 85 01 A9 01 85 02 A2 01 E4 00
0810: F0 11 A5 02 85 03 18 65 01 85 02 A5 03 85 01 E8
0820: 4C 0E 08 A5 02 00  .  .  .  .  .  .  .  .  .  .

```

 * Processor registers and flags:

```text
R  Hex  Dec   +/-    R   Hex   N V - B D I Z C
-----------------    -------   ---------------
A   E9  233   -23    P    A1   1 0 1 0 0 0 0 1
X   0D   13    13    S    FF
Y   00    0     0    PC 0825   Cycles: 393
```

 * Instruction trace:

```text
                         Instruction Log
-------------------------------------------------------------------------
     $0806   85 01      STA $01        ; Store Accumulator
     $0808   A9 01      LDA #$01       ; Load Accumulator
 --> $080A   85 02      STA $02        ; Store Accumulator
```

 * Memory dump:

```text
                           Memory Dump
-------------------------------------------------------------------------
0000 | 0D 90 E9 90 00 00 00 00 00 00 00 00 00 00 00 00 | ................
0010 | 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 | ................
*
0800 | A9 0D 85 00 A9 00 85 01 A9 01 85 02 A2 01 E4 00 | ................
0810 | F0 11 A5 02 85 03 18 65 01 85 02 A5 03 85 01 E8 | .......e........
0820 | 4C 0E 08 A5 02 00 00 00 00 00 00 00 00 00 00 00 | L...............
0830 | 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 | ................
*
FFF0 | 00 00 00 00 00 00 00 00 00 00 00 00 00 08 00 00 | ................
```

## Resources

6502 Opcodes: https://www.pagetable.com/c64ref/6502/
Rockwell 6502 Programmers Reference: https://csh.rit.edu/~moffitt/docs/6502.html

export class Utils {
    public static byteToHex(val: number): string {
        const hex: string = "0123456789ABCDEF";
        return hex[(val >> 4) & 0x0F] +
               hex[(val >> 0) & 0x0F];
    }

    public static wordToHex(val: number): string {
        const hex: string = "0123456789ABCDEF";
        return hex[(val >> 12) & 0x0F] +
               hex[(val >>  8) & 0x0F] +
               hex[(val >>  4) & 0x0F] +
               hex[(val >>  0) & 0x0F];
    }

    /**
     * Returns Two's complement number to string
     *
     * @param { number } val
     *
     * @returns { string }
     */
    public static byteToSInt(val: number): string {
        if (val > 0x7F)
            return "-" + (((~val) + 1) & 0xFF).toString(10);

        return val.toString(10);
    }

    public static randomByte(): number {
        return Math.floor((0xFF + 1) * Math.random());
    }

    public static randomBit(): number {
        return Math.floor(2 * Math.random());
    }

    public static replaceLastInstance(text: string, search: string, replace: string): string {
        const pos: number = text.lastIndexOf(search);
        return pos >= 0 ? text.substring(0, pos) + replace + text.substring(pos + search.length) : text;
    }
}

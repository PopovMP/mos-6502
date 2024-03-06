export class Utils {
    static byteToHex(val) {
        const hex = "0123456789ABCDEF";
        return hex[(val >> 4) & 0x0F] +
            hex[(val >> 0) & 0x0F];
    }
    static wordToHex(val) {
        const hex = "0123456789ABCDEF";
        return hex[(val >> 12) & 0x0F] +
            hex[(val >> 8) & 0x0F] +
            hex[(val >> 4) & 0x0F] +
            hex[(val >> 0) & 0x0F];
    }
    static byteToSInt(val) {
        if (val > 0x7F)
            return "-" + (((~val) + 1) & 0xFF).toString(10);
        return val.toString(10);
    }
    static randomByte() {
        return Math.floor((0xFF + 1) * Math.random());
    }
    static randomBit() {
        return Math.floor(2 * Math.random());
    }
    static replaceLastInstance(text, search, replace) {
        const pos = text.lastIndexOf(search);
        return pos >= 0 ? text.substring(0, pos) + replace + text.substring(pos + search.length) : text;
    }
}
//# sourceMappingURL=utils.js.map
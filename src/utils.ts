class Utils {
	public static byteToHex(val: number): string {
		const hex = '0123456789ABCDEF'
		return hex[(val >> 4) & 0xF] + hex[val & 0xF]
	}

	public static wordToHex(val: number): string {
		const hex = '0123456789ABCDEF'
		return hex[(val >> 12) & 0xF] + hex[(val >> 8) & 0xF] + hex[(val >> 4) & 0xF] + hex[val & 0xF]
	}

	/**
	 * Returns Two's complement number to string
	 * @param { number } val
	 * @returns { string }
	 */
	public static byteToSInt(val: number): string {
		if (val > 0x7F) {
			return '-' + (((~ val) + 1) & 0xFF).toString(10)
		}

		return val.toString(10)
	}

	public static randomByte(): number {
		return Math.floor((0xFF + 1) * Math.random())
	}

	public static randomBit(): number {
		return Math.floor(2 * Math.random())
	}
}

module.exports.Utils = Utils

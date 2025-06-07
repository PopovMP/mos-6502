/**
 * @class
 *
 * Represents a screen buffer for storing character content and managing cursor position.
 */
export class ScreenBuffer {
    /** @field {number} */
    #COLS = 40;

    /** @field {number} */
    #ROWS = 24;

    /** @field {string[]} character content */
    #screenBuffer = new Array(this.#ROWS * this.#COLS).fill(" ");

    /** @field {number} - the cursor position */
    #bufferIndex = 0;

    /**
     * Clears the screen buffer and sets the cursor position to the beginning.
     *
     * @returns {void}
     */
    clear() {
        this.#bufferIndex = 0;
        this.#screenBuffer.fill(" ");
    }

    /**
     * Prints a character on the screen buffer.
     *
     * @param {string} character - The character to be printed.
     * @returns {void}
     */
    print(character) {
        if (character === "\r") {
            // Move the index to the end of the line
            this.#bufferIndex += this.#COLS - this.#bufferIndex % this.#COLS - 1;
        } else {
            // Set the character
            this.#screenBuffer[this.#bufferIndex] = character;
        }

        if (this.#bufferIndex === this.#screenBuffer.length - 1) {
            this.#scrollBuffer();
        }

        // Increment the index
        this.#bufferIndex += 1;
    }

    /**
     * Retrieves the character at the specified index in the screen buffer.
     *
     * @param {number} index - The index of the character to retrieve.
     * @returns {string} - The character at the specified index.
     */
    getCharacter(index) {
        return this.#screenBuffer[index];
    }

    /**
     * Returns the current cursor position.
     *
     * @returns {number} The index of the cursor position within the buffer.
     */
    getCursorPosition() {
        return this.#bufferIndex;
    }

    /**
     * Scrolls the buffer one row upwards.
     *
     * @returns {void}
     */
    #scrollBuffer() {
        // Shift the buffer data one row upwards
        for (let i = this.#COLS; i < this.#screenBuffer.length; i++) {
            this.#screenBuffer[i - this.#COLS] = this.#screenBuffer[i];
        }

        // Empty the last line
        for (let i = this.#screenBuffer.length - this.#COLS; i < this.#screenBuffer.length; i++) {
            this.#screenBuffer[i] = " ";
        }

        // Set the index to the beginning of the last line
        this.#bufferIndex = this.#screenBuffer.length - this.#COLS - 1;
    }
}

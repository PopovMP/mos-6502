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
    #screenBuffer;

    /** @field {number} - the cursor position */
    #bufferIndex;

    /**
     * Creates a new instance of the constructor.
     * Initializes the ##screenBuffer with an array of size ##ROWS * ##COLS.
     * Calls the clear() method to clear the screen buffer.
     *
     * @constructor
     * @return {void}
     */
    constructor() {
        this.#screenBuffer = new Array(this.#ROWS * this.#COLS);
        this.clear();
    }

    /**
     * Clears the screen buffer and sets the cursor position to the beginning.
     *
     * @return {void}
     */
    clear() {
        this.#bufferIndex = 0;
        this.#screenBuffer.fill(" ");
    }

    /**
     * Prints a character on the screen buffer.
     *
     * @param {string} character - The character to be printed.
     */
    print(character) {
        if (character === "\r") {
            // Move the index to the end of the line
            this.#bufferIndex += this.#COLS - this.#bufferIndex % this.#COLS - 1;
        } else {
            // Set the character
            this.#screenBuffer[this.#bufferIndex] = character;
        }

        if (this.#bufferIndex === this.#screenBuffer.length - 1)
            this.#scrollBuffer();

        // Increment the index
        this.#bufferIndex += 1;
    }

    /**
     * Retrieves the character at the specified index in the screen buffer.
     *
     * @param {number} index - The index of the character to retrieve.
     * @return {string} - The character at the specified index.
     */
    getCharacter(index) {
        return this.#screenBuffer[index];
    }

    /**
     * Returns the current cursor position.
     *
     * @return {number} The index of the cursor position within the buffer.
     */
    getCursorPosition() {
        return this.#bufferIndex;
    }

    /**
     * Scrolls the buffer one row upwards.
     *
     * @return {void}
     */
    #scrollBuffer() {
        // Shift the buffer data one row upwards
        for (let i = this.#COLS; i < this.#screenBuffer.length; i += 1)
            this.#screenBuffer[i - this.#COLS] = this.#screenBuffer[i];

        // Empty the last line
        for (let i = this.#screenBuffer.length - this.#COLS; i < this.#screenBuffer.length; i += 1)
            this.#screenBuffer[i] = " ";

        // Set the index to the beginning of the last line
        this.#bufferIndex = this.#screenBuffer.length - this.#COLS - 1;
    }
}
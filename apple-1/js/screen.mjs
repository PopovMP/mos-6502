import {ScreenBuffer} from "./screen-buffer.mjs";
import {fontBitmap} from "./font-bitmap.mjs";

export class Screen {
    #COLS = 40;
    #ROWS = 24;
    #FONT_WIDTH  = 6;
    #FONT_HEIGHT = 8;

    #foregroundColor = "#FFFFFF";
    #backgroundColor = "#000000";
    #scale           = 1;

    /** @field {HTMLCanvasElement} Canvas element */
    #canvas;

    /** @field {CanvasRenderingContext2D} Canvas rendering context */
    #ctx;

    /** @field {ScreenBuffer} */
    #screenBuffer;

    /** @field {string[]} Drown content */
    #drownBuffer;

    /** @field {boolean} */
    #isCursorVisible;

    /**
     * Constructor for initializing a new instance of the Screen class.
     *
     * @param {HTMLCanvasElement} canvasElem
     * @param {number} scale
     *
     * @return {void}
     */
    constructor(canvasElem, scale) {
        this.#canvas          = canvasElem;
        this.#ctx             = this.#canvas.getContext("2d");
        this.#scale           = scale;
        this.#screenBuffer    = new ScreenBuffer();
        this.#drownBuffer     = new Array(this.#ROWS * this.#COLS).fill(" ");
        this.#isCursorVisible = false;
        this.setScale(scale);

        setTimeout(this.#drawCursor.bind(this), 500);
    }

    /**
     * Sets the #scale of the #canvas.
     * Render the screen.
     *
     * @public
     *
     * @param {number} scale - The #scale value to set. Must be a positive number.
     *
     * @return {void}
     */
    setScale(scale) {
        this.#scale = scale;
        this.#canvas.width  = scale * this.#FONT_WIDTH  * this.#COLS;
        this.#canvas.height = scale * this.#FONT_HEIGHT * this.#ROWS;
        this.#drownBuffer.fill(" ");
        this.#render();
    }

    /**
     * Print a character to the screen.
     *
     * @public
     * @param {string} character - The character to be printed.
     *
     * @return {void}
     */
    print(character) {
        this.#screenBuffer.print(character);
        this.#render();
    }

    /**
     * Clears the screen.
     * Draws the cursor.
     *
     * @public
     *
     * @return {void}
     */
    clear() {
        this.#screenBuffer.clear();
        this.#render();
    }

    /**
     * Renders the screen buffer to the display.
     *
     * The method iterates over the screen buffer and compares each character with
     * the corresponding character in the drown buffer. If they are different, it
     * calculates the position on the display based on the column, row, and #scale,
     * and draws the character at that position using the #drawCharacter method. It
     * then updates the corresponding value in the drown buffer with the character.
     *
     * @returns {void}
     */
    #render() {
        for (let i = 0; i < this.#ROWS * this.#COLS; i += 1) {
            const character = this.#screenBuffer.getCharacter(i);
            if (this.#drownBuffer[i] !== character) {
                this.#drownBuffer[i] = character;
                this.#drawCharacter(character, i);
            }
        }
    }

    /**
     * Draws a character at coordinates X and Y.
     *
     * @private
     *
     * @param {string} character - The character to draw.
     * @param {number} i - buffer index
     *
     * @return {void}
     */
    #drawCharacter(character, i) {
        const col = i % this.#COLS;
        const row = Math.floor(i / this.#COLS);
        const x   = col * this.#FONT_WIDTH  * this.#scale;
        const y   = row * this.#FONT_HEIGHT * this.#scale;

        // Clear character
        this.#ctx.fillStyle = this.#backgroundColor;
        this.#ctx.fillRect(x, y, this.#FONT_WIDTH * this.#scale, this.#FONT_HEIGHT * this.#scale);

        if (character === " ") return;

        // Draw new character
        this.#ctx.fillStyle = this.#foregroundColor;
        for (let i = 1; i < this.#FONT_HEIGHT; i += 1) {
            for (let j = 0; j < this.#FONT_WIDTH - 1; j += 1) {
                if (fontBitmap[character][(i - 1) * (this.#FONT_WIDTH - 1) + j] === 1)
                    this.#ctx.fillRect(x + j * this.#scale, y + i * this.#scale, this.#scale, this.#scale);
            }
        }
    }

    /**
     * Draws a flashing cursor at the cursorPosition from the ScreenBuffer.
     *
     * @private
     * @return {void}
     */
    #drawCursor() {
        this.#isCursorVisible = !this.#isCursorVisible;
        const index  = this.#screenBuffer.getCursorPosition();
        const cursor = this.#isCursorVisible ? "@" : " ";
        this.#drownBuffer[index] = cursor;
        this.#drawCharacter(cursor, index);

        setTimeout(this.#drawCursor.bind(this), 500);
    }
}
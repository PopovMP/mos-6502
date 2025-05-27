import { ScreenBuffer } from "./screen-buffer.mjs";
import { fontBitmap }   from "./font-bitmap.mjs";

export class Screen {
    #COLS        = 40;
    #ROWS        = 24;
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

    /** @field {string[]} Drawn content */
    #drawnBuffer;

    /** @field {boolean} */
    #isCursorVisible;

    /**
     * Constructor for initializing a new instance of the Screen class.
     *
     * @param {HTMLCanvasElement} canvasElement
     * @param {number} scale
     */
    constructor(canvasElement, scale) {
        this.#canvas          = canvasElement;
        this.#ctx             = /** @type { CanvasRenderingContext2D }} */ (this.#canvas.getContext("2d"));
        this.#scale           = scale;
        this.#screenBuffer    = new ScreenBuffer();
        this.#drawnBuffer     = new Array(this.#ROWS * this.#COLS).fill(" ");
        this.#isCursorVisible = false;

        this.setScale(this.#scale);

        setInterval(this.#drawCursor.bind(this), 500);
    }

    /**
     * Sets the #scale of the #canvas.
     * Render the screen.
     *
     * @param {number} scale - The #scale value to set. Must be a positive number.
     * @returns {void}
     */
    setScale(scale) {
        this.#scale = scale;
        this.#canvas.width  = this.#scale * this.#FONT_WIDTH  * this.#COLS;
        this.#canvas.height = this.#scale * this.#FONT_HEIGHT * this.#ROWS;
        this.#drawnBuffer.fill(" ");
        this.#render();
    }

    /**
     * Print a character to the screen.
     *
     * @param {string} character - The character to be printed.
     * @returns {void}
     */
    print(character) {
        this.#screenBuffer.print(character);
        this.#render();
    }

    /**
     * Clears the screen.
     * Draws the cursor.
     *
     * @returns {void}
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
        for (let i = 0; i < this.#ROWS * this.#COLS; i++) {
            const character = this.#screenBuffer.getCharacter(i);
            if (this.#drawnBuffer[i] !== character) {
                this.#drawnBuffer[i] = character;
                this.#drawCharacter(character, i);
            }
        }
    }

    /**
     * Draws a character at coordinates X and Y.
     *
     * @param {string} character - character to draw.
     * @param {number} index     - buffer index
     * @returns {void}
     */
    #drawCharacter(character, index) {
        const chWidth  = this.#FONT_WIDTH  * this.#scale;
        const chHeight = this.#FONT_HEIGHT * this.#scale;
        const col      = index % this.#COLS;
        const row      = Math.floor(index / this.#COLS);
        const chX      = col * chWidth;
        const chY      = row * chHeight;

        // Clear character
        this.#ctx.fillStyle = this.#backgroundColor;
        this.#ctx.fillRect(chX, chY, chWidth, chHeight);

        if (character === " ") return;

        // Draw new character
        this.#ctx.fillStyle = this.#foregroundColor;
        for (let i = 1; i < this.#FONT_HEIGHT; i++) {
            for (let j = 0; j < this.#FONT_WIDTH - 1; j++) {
                if (fontBitmap[character][(i - 1) * (this.#FONT_WIDTH - 1) + j] === 1) {
                    this.#ctx.fillRect(chX + j * this.#scale, chY + i * this.#scale, this.#scale, this.#scale);
                }
            }
        }
    }

    /**
     * Draws a flashing cursor at the cursorPosition from the ScreenBuffer.
     *
     * @returns {void}
     */
    #drawCursor() {
        this.#isCursorVisible = !this.#isCursorVisible;
        const index  = this.#screenBuffer.getCursorPosition();
        const cursor = this.#isCursorVisible ? "@" : " ";
        this.#drawnBuffer[index] = cursor;
        this.#drawCharacter(cursor, index);
    }
}

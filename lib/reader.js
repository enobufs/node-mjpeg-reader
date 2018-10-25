'use strict';

// References:
//  * W3C JPEG JFIF: https://www.w3.org/Graphics/JPEG/
//  * ITU Recommendation T.81: https://www.w3.org/Graphics/JPEG/itu-t81.pdf

const fs = require('fs');
const { EventEmitter } = require('events');
const assert = require('assert');

const SOI = 0xD8;
const EOI = 0xD9;
const DEFAULT_MAX_JPEG_SIZE = 4 * 1024 * 1024; // 4 MB

class Reader extends EventEmitter {
    constructor(fileName, option) {
        super();
        this._opts = option || {
            maxJpegSize: DEFAULT_MAX_JPEG_SIZE
        };
        this._fileName = fileName;
        this._lastFrame = null;
        this._lastFrameAt = 0;
        this._curr = Buffer.alloc(this._opts.maxJpegSize);
        this._currLen = 0
        this._inFrame = false;
        this._sawFF = false;
    }

    start() {
        if (this._stream) {
            throw new Error('already started');
        }
        this._lastFrame = null;
        this._lastFrameAt = 0;
        const fd = fs.openSync(this._fileName, 'r+')
        this._stream = fs.createReadStream(/*this._fileName*/ null, { fd: fd });
        this._stream.on('close', () => {
            this._stream = null;
            this.emit('close');
        })
        this._stream.on('data', (buf) => {
            this._onData(buf);
        })
        this._stream.on('error', (err) => {
            this.emit('error', err);
        })
    }

    stop() {
        if (this._stream) {
            this._stream.close();
        }
        this._inFrame = false;
        this._sawFF = false;
        this._curLen = 0;
    }

    getLastFrame() {
        return { frame: this._lastFrame, timestamp: this._lastFrameAt };
    }

    _appendToBuffer(bytes) {
        if (this._currLen + bytes.length > this._opts.maxJpegSize) {
            this.emit('error', new Error('input data is too large'));
            this._currLen = 0;
            this._inFrame = false; // search for SOI
            return;
        }

        bytes.forEach((c) => {
            this._curr.writeUInt8(c, this._currLen);
            this._currLen++;
        });
    }

    _onData(buf) {
        for (let i = 0; i < buf.length; ++i) {
            const c = buf[i];
            //console.log('byte: 0x%s', c.toString(16));
            if (!this._sawFF) {
                if (c === 0xFF) {
                    this._sawFF = true;
                } else {
                    if (this._inFrame) {
                        this._appendToBuffer([c]);
                    }
                }
            } else {
                this._sawFF = false;
                switch (c) {
                    case SOI:
                        this._inFrame = true;
                        assert.strictEqual(this._currLen, 0);
                        this._appendToBuffer([0xFF, SOI]);
                        break;

                    case EOI:
                        if (this._inFrame) {
                            const firstFrame = !this._lastFrame;
                            this._inFrame = false;
                            this._appendToBuffer([0xFF, EOI]);
                            if (this._currLen === 0) {
                                break;
                            }
                            this._lastFrame = this._curr.slice(0, this._currLen);
                            this._lastFrameAt = Date.now();
                            this._currLen = 0;
                            if (firstFrame) {
                                this.emit('ready');
                            }
                            this.emit('jpeg', this._lastFrame);
                        }
                        break;

                    default:
                        if (this._inFrame) {
                            this._appendToBuffer([0xFF, c]);
                        }
                }
            }
        }
    }
}

module.exports = Reader;


'use strict';

const rimraf = require('rimraf');
const mjpeg = require('..');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { mkfifo } = require('mkfifo');
const assert = require('assert');

describe('Reader tests', function () {
    let reader; 
    let tmpdir;
    let fileName;
    let ws;

    before(function (done) {
        tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mjpeg'));
        fileName = path.join(tmpdir, 'mjpeg-stream');
        mkfifo(fileName, parseInt('0666',8), done);
    });

    after(function (done) {
        rimraf(tmpdir, () => {
            done();
        });
    });

    beforeEach(function () {
        ws = fs.createWriteStream(fileName, { flags: 'a', encoding: 'binary' });
    });

    afterEach(function (done) {
        ws.close();
        ws.on('close', done);
    });

    it('successfull read', function (done) {
        const rs = mjpeg.createReader(fileName);
        const exp = Buffer.from([0xFF, 0xD8, 0x12, 0x34, 0x56, 0xFF, 0xD9]);
        let isReady = false;
        rs.on('ready', () => {
            isReady = true;
        });
        rs.on('jpeg', (jpeg) => {
            assert.ok(isReady);
            assert.equal(Buffer.compare(jpeg, exp), 0, `data mismatch: ${jpeg.toString('hex')}`);
            rs.stop();
            done();
        });
        rs.start();
        ws.write(exp);
    });

    it('successfull read with other markers than SOI/EOI', function (done) {
        const rs = mjpeg.createReader(fileName);
        const exp = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0xFF, 0xFE, 0xFF, 0xD9]);
        let isReady = false;
        rs.on('ready', () => {
            isReady = true;
        });
        rs.on('jpeg', (jpeg) => {
            assert.ok(isReady);
            assert.equal(Buffer.compare(jpeg, exp), 0, `data mismatch: ${jpeg.toString('hex')}`);
            rs.stop();
            done();
        });
        rs.start();
        ws.write(exp);
    });

    it('#getLastFrame()', function (done) {
        const rs = mjpeg.createReader(fileName);
        const exp = Buffer.from([0xFF, 0xD8, 0x12, 0x34, 0x56, 0xFF, 0xD9]);
        let isReady = false;
        const start = Date.now();
        rs.on('ready', () => {
            const end = Date.now();
            isReady = true;
            const { frame, timestamp } = rs.getLastFrame();
            assert.equal(Buffer.compare(frame, exp), 0, `data mismatch: ${frame.toString('hex')}`);
            assert.ok(timestamp >= start, `${timestamp} >= $[start}`);
            assert.ok(timestamp <= end, `${timestamp} >= $[end}`);
            rs.stop();
            done();
        });
        rs.start();
        ws.write(exp);
    });

    it('should ignore data before SOI', function (done) {
        const rs = mjpeg.createReader(fileName);
        const garbage = Buffer.from([0xA5, 0x3C, 0x96]);
        const exp = Buffer.from([0xFF, 0xD8, 0x12, 0x34, 0x56, 0xFF, 0xD9])
        let isReady = false;
        rs.on('ready', () => {
            isReady = true;
        });
        rs.on('error', (err) => {
            done(err);
        });
        rs.on('jpeg', (jpeg) => {
            assert.ok(isReady);
            assert.equal(Buffer.compare(jpeg, exp), 0, `data mismatch: ${jpeg.toString('hex')}`);
            rs.stop();
            done();
        });
        rs.start();

        assert.ok(ws.write(garbage));
        assert.ok(ws.write(exp));
    });

    it('should ignore data between EOI and SOI', function (done) {
        const rs = mjpeg.createReader(fileName);
        const garbage = Buffer.from([0xA5, 0x3C, 0x96]);
        const exp = [
            Buffer.from([0xFF, 0xD8, 0x12, 0x34, 0x56, 0xFF, 0xD9]),
            Buffer.from([0xFF, 0xD8, 0x9e, 0xc5, 0xFF, 0xD9])
        ];
        let isReady = false;
        let count = 0;
        rs.on('ready', () => {
            isReady = true;
        });
        rs.on('error', (err) => {
            done(err);
        });
        rs.on('jpeg', (jpeg) => {
            assert.ok(isReady);
            assert.equal(Buffer.compare(jpeg, exp[count]), 0, `data mismatch: ${jpeg.toString('hex')}`);
            count++;
            if (count === 2) {
                rs.stop();
                done();
            }
        });
        rs.start();

        assert.ok(ws.write(exp[0]));
        assert.ok(ws.write(garbage));
        assert.ok(ws.write(exp[1]));
    });

    it('calling start() twice should fail', function (done) {
        const rs = mjpeg.createReader(fileName);
        rs.on('close', done);
        rs.start();
        assert.throws(() => {
            rs.start();
        }, (err) => {
            return err instanceof Error;
        });
        rs.stop();
    });

    it('ok to call stop() twice', function (done) {
        const rs = mjpeg.createReader(fileName);
        rs.on('close', () => {
            rs.stop();
            done();
        });
        rs.start();
        rs.stop();
    });

    it('message too large should cause an error', function (done) {
        const rs = mjpeg.createReader(fileName, { maxJpegSize: 8 });
        const jpegs = [
            Buffer.from([0xFF, 0xD8, 0x01, 0x02, 0x03, 0x04, 0x05, 0xFF, 0xD9]), // too long
            Buffer.from([0xFF, 0xD8, 0x01, 0x02, 0x03, 0x04, 0xFF, 0xD9]) // ok
        ];
        let lastError = null;
        rs.on('error', (err) => {
            lastError = err;
        });
        rs.on('jpeg', (jpeg) => {
            assert.equal(Buffer.compare(jpeg, jpegs[1]), 0, `data mismatch: ${jpeg.toString('hex')}`);
            assert.ok(lastError instanceof Error);
            rs.stop();
        });
        rs.on('close', () => {
            done();
        });
        rs.start();
        jpegs.forEach((jpeg) => {
            assert.ok(ws.write(jpeg));
        });
    });

    it('out of frame EOI and other markers should be ignored', function (done) {
        const rs = mjpeg.createReader(fileName);
        const garbage = Buffer.from([0xA5, 0xFF, 0xD4, 0xFF, 0xD9]);
        const exp = Buffer.from([0xFF, 0xD8, 0x12, 0x34, 0x56, 0xFF, 0xD9])
        let isReady = false;
        rs.on('ready', () => {
            isReady = true;
        });
        rs.on('error', (err) => {
            done(err);
        });
        rs.on('jpeg', (jpeg) => {
            assert.ok(isReady);
            assert.equal(Buffer.compare(jpeg, exp), 0, `data mismatch: ${jpeg.toString('hex')}`);
            rs.stop();
            done();
        });
        rs.start();

        assert.ok(ws.write(garbage));
        assert.ok(ws.write(exp));
    });

    it('end events should be notified', function (done) {
        const rs = mjpeg.createReader(fileName);
        rs.on('error', (err) => {
            assert.equal(err.message, 'fake error');
            done();
        });
        rs.start();
        rs._stream.destroy(new Error('fake error'));
    });
});

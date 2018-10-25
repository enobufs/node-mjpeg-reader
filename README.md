# mjpeg-reader
[![NPM
version](https://badge.fury.io/js/node-mjpeg-reader.svg)](http://badge.fury.io/js/node-mjpeg-reader)
[![Build Status](https://travis-ci.org/enobufs/node-mjpeg-reader.svg?branch=master)](https://travis-ci.org/enobufs/node-mjpeg-reader)
[![Coverage Status](https://coveralls.io/repos/github/enobufs/node-mjpeg-reader/badge.svg?branch=master)](https://coveralls.io/github/enobufs/node-mjpeg-reader?branch=master)

Motion JPEG stream reader.
It reads from either named pipe or a file with [JFIF format](https://www.w3.org/Graphics/JPEG/) then returns individual JPEG data (a Buffer).

## Installation
```
npm install mjpeg-reader --save
```


## Example

### To receive all JPEG data
```js
const mjpeg = require('mjpeg-reader');
const reader = mjpeg.createReader('/tmp/my_fifo');
reader.on('jpeg', (jpeg) => {
    // `jpeg` is a Buffer.
});
reader.start();
```

### To get the last JPEG data
```js
const mjpeg = require('mjpeg-reader');
const reader = mjpeg.createReader('/tmp/my_fifo')
reader.on('ready', () => {
    const { jpeg, timestamp } = reader.getLastFrame();
    // `jpeg` - a Buffer
    // `timestamp` - The time (UTC time in msec) when the last frame was parsed.
});
reader.start();
```


## API
### Module methods
#### mjpeg.createReader(fileName [, option]) => {Reader}
* fileName {string} - a path to named pipe or a file.
* option {object}
    - option.maxJpegSize {number} - Max JPEG size. (default: 4 MiB)

### Reader

#### reader.start() => {void}
Start reading from the specified file.

#### reader.stop() => {void}
Start reading.

#### reader.getLastFrame() => {void}
Get the last JPEG data and the timestamp at which the data was received.
See `Event: 'ready'`.

#### Event: 'ready'
The first JPEG data has been ready.
Once this event is notified, it is guaranteed that there is always
`the last (JPEG) frame` available.

#### Event: 'jpeg'
A JPEG data is received.
* arg1: a buffer contains a JPEG data.

#### Event: 'close'
The reader has been closed.

#### Event: 'error'
The reader encoutered an error.
* arg1: an Error object.


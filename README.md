# mjpeg-reader
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


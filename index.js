'use strict';

const Reader = require('./lib/reader');

exports.createReader = (fileName, option) => {
    return new Reader(fileName, option);
};


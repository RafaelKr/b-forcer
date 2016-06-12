# get-cursor-position

> Get the cursor's current position in your terminal.
 
[![MIT License](https://img.shields.io/badge/license-MIT_License-green.svg?style=flat-square)](https://github.com/bubkoo/get-cursor-position/blob/master/LICENSE)
[![npm:](https://img.shields.io/npm/v/get-cursor-position.svg?style=flat-square)](https://www.npmjs.com/packages/get-cursor-position)


## Install

```
$ npm install get-cursor-position --save
```

## Usage

Async:

```js

var getCursorPosition = require('get-cursor-position');

getCursorPosition.async(function(pos) {
    console.log('row: ' + pos.row);
    console.log('col: ' + pos.col);
});

```

Sync:

```js
var getCursorPosition = require('get-cursor-position');
var pos = getCursorPosition.sync();
console.log('row: ' + pos.row);
console.log('col: ' + pos.col);
```

## Contributing

Pull requests and stars are highly welcome.

For bugs and feature requests, please [create an issue](https://github.com/bubkoo/get-cursor-position/issues/new).

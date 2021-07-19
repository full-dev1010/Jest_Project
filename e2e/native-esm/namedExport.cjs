/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = require('./commonjsNamed.cjs');
module.exports.namedFunction = () => 'hello from a named CJS function!';
module.exports.default = () => '"default" export';

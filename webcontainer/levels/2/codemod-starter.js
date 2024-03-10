/** @type {import('jscodeshift').Transform} */
module.exports = function transformer(file, api, options) {
  const j = api.jscodeshift;
  const rootSource = j(file.source);
  
  // Write your transform
  
  return rootSource.toSource();
}
module.exports = {
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': ['error', {'trailingComma': 'es5', 'singleQuote': true}],
    'no-underscore-dangle': 0,
    'no-param-reassign': 0,
  }
}
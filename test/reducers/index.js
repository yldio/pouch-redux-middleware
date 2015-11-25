var redux = require('redux');
var todos = require('./todos');

module.exports = redux.combineReducers({
  todos: todos
});

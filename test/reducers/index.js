var redux = require('redux');
var todos = require('./todos');
var todosobject = require('./todosobject');

module.exports = redux.combineReducers({
  todos: todos,
  todosobject: todosobject 
});

'use strict';

const redux = require('redux');
const todos = require('./todos');
const todosobject = require('./todosobject');

module.exports = redux.combineReducers({
  todos,
  todosobject,
});

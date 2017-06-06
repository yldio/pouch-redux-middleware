'use strict';

const actionTypes = require('../_action_types');

const initialState = {};

function id() {
  return Math.random().toString(36).substring(7);
}

module.exports = function todosobject(state, action) {
  if (!state) return initialState;
  switch (action.type) {
    case actionTypes.ADD_TODO: {
      const todo = {
        _id: action.id || id(),
        completed: false,
        text: action.text,
      };
      return Object.assign(state, { [todo._id]: todo });
    }
    case actionTypes.INSERT_TODO:
      return Object.assign(state, { [action.todo._id]: action.todo });
    case actionTypes.DELETE_TODO: {
      const newState = Object.assign({}, state);
      delete newState[action.id];
      return newState;
    }

    case actionTypes.UPDATE_TODO:
      return Object.assign(state, { [action.todo._id]: action.todo });

    default:
      return state;
  }
};

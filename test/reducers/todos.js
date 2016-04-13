var actionTypes = require('../_action_types');

const initialState = []

module.exports = function todos(state, action) {
  if (! state) {
    state = [];
  }

  switch (action.type) {
    case actionTypes.ADD_TODO:
      return [
        {
          _id: action.id || id(),
          completed: false,
          text: action.text
        },
        ...state
      ]

    case actionTypes.INSERT_TODO:
      return [
        action.todo,
        ...state
      ]

    case actionTypes.DELETE_TODO:
      return state.filter(todo =>
        todo._id !== action.id
      )

    case actionTypes.EDIT_TODO:
      return state.map(todo =>
        todo._id === action.id ?
          Object.assign({}, todo, { text: action.text }) :
          todo
      )

    case actionTypes.UPDATE_TODO:
      return state.map(todo =>
        todo._id === action.todo._id ?
          action.todo :
          todo
      )

    case actionTypes.COMPLETE_TODO:
      return state.map(todo =>
        todo._id === action.id ?
          Object.assign({}, todo, { completed: !todo.completed }) :
          todo
      )

    case actionTypes.COMPLETE_ALL:
      const areAllMarked = state.every(todo => todo.completed)
      return state.map(todo => Object.assign({}, todo, {
        completed: !areAllMarked
      }))

    case actionTypes.CLEAR_COMPLETED:
      return state.filter(todo => todo.completed === false)

    default:
      return state
  }
}

function id() {
  return Math.random().toString(36).substring(7);
}

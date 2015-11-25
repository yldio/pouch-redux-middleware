# pouch-redux-middleware

Redux Middleware for syncing state and a PouchDB database.

Propagates state changes into PouchDB.
Propagates PouchDB changes into the state.

## Install

```
$ npm install pouch-redux-middleware --save
```

## Use

Example of configuring a store:

```js
import * as types from '../constants/ActionTypes'
import PouchMiddleware from 'pouch-redux-middleware'
import { createStore, applyMiddleware } from 'redux'
import rootReducer from '../reducers'
import PouchDB from 'pouchdb'

export default function configureStore() {
  const db = new PouchDB('todos');

  const pouchMiddleware = PouchMiddleware({
    path: '/todos',
    db,
    actions: {
      remove: doc => store.dispatch({type: types.DELETE_TODO, id: doc._id}),
      insert: doc => store.dispatch({type: types.INSERT_TODO, todo: doc}),
      update: doc => store.dispatch({type: types.UPDATE_TODO, todo: doc}),
    }
  })
  const createStoreWithMiddleware = applyMiddleware(pouchMiddleware)(createStore)
  const store = createStoreWithMiddleware(rootReducer)

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers')
      store.replaceReducer(nextReducer)
    })
  }

  return store
}
```

## API

### PouchMiddleware(paths)

* `paths`: path or array containing path specs

A path spec is an object describing the behaviour of a sub-tree of the state it has the following attributes:

* `path`: a JsonPath path where the documents will stored in the state as an array
* `db`: a PouchDB database
* `actions`: an object describing the actions to perform when a change in the Po. It's an object containing a function that returns an action for each of the events (`remove`, `insert` and `update`) 

Example of a path spec:

```js
{
  path: '/todos',
  db,
  actions: {
    remove: doc => store.dispatch({type: types.DELETE_TODO, id: doc._id}),
    insert: doc => store.dispatch({type: types.INSERT_TODO, todo: doc}),
    update: doc => store.dispatch({type: types.UPDATE_TODO, todo: doc}),
  }
}
```

## License

ISC

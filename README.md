# pouch-redux-middleware

[![By](https://img.shields.io/badge/made%20by-yld!-32bbee.svg?style=flat)](http://yld.io/contact?source=github-pouch-redux-middleware)
[![Build Status](https://secure.travis-ci.org/pgte/pouch-redux-middleware.svg?branch=master)](http://travis-ci.org/pgte/pouch-redux-middleware?branch=master)

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
* `changeFilter`: a function that receives a changed document, and if it returns
false, the document will be ignored for the path. This is useful when you have
multiple paths in a single database that are differentiated through an attribute
(like `type`).

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
